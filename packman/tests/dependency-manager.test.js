const fs = require('fs'); // To be mocked
const path = require('path');
const semver = require('semver');
const dm = require('../src/lib/dependency-manager');
// Import an object that contains the mocked functions
const registryUtils = require('../src/lib/registry-utils');

jest.mock('fs');
// Mock the entire registry-utils module
jest.mock('../src/lib/registry-utils', () => ({
  fetchPackageInfo: jest.fn(),
  fetchPackageAlternatives: jest.fn(),
  // Do not include _mockRegistry or _mockAlternativesDb here if they are not functions
}));


const MOCK_PROJECT_PATH = '/fake/project';

describe('dependency-manager.js', () => {
  // Previous tests for getDirectDependencies, getLockfileDependencies, crawlNodeModules
  // ... (assuming these are present and correct) ...
  describe('getDirectDependencies', () => {
    beforeEach(() => fs.readFileSync.mockReset());
    it('should work', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify({dependencies: {a:'1'}}));
        expect(dm.getDirectDependencies(MOCK_PROJECT_PATH)).toEqual({dependencies: {a:'1'}, devDependencies:{}, optionalDependencies:{}, peerDependencies:{}});
    });
  });


  describe('getDependencyUpdateInfo', () => {
    let mockDep;
    const projectNodeRange = { min: '16.0.0', max: '20.9.0', range: '>=16.0.0 <=20.9.0' };

    beforeEach(() => {
      // Reset mocks for fetchPackageInfo and fetchPackageAlternatives before each test in this suite
      registryUtils.fetchPackageInfo.mockReset();
      registryUtils.fetchPackageAlternatives.mockReset();

      mockDep = {
        name: 'pkg-a',
        version: '1.0.0',
        isRoot: false,
        engines: { node: '>=14.0.0' },
        installedPackageJson: { name: 'pkg-a', version: '1.0.0', engines: { node: '>=14.0.0' } },
        // Ensure all fields expected by the function are present
        path: 'node_modules/pkg-a',
        isDev: false,
        isOptional: false,
        dependencies: {},
        optionalDependencies: {},
        license: 'MIT',
      };

      // Default mock implementations
      registryUtils.fetchPackageInfo.mockResolvedValue({
        versions: { '1.0.0': { engines: { node: '>=14.0.0' } } },
        time: { '1.0.0': new Date().toISOString() },
        'dist-tags': { latest: '1.0.0' },
      });
      registryUtils.fetchPackageAlternatives.mockResolvedValue([]); // Default to no alternatives
    });

    it('should call fetchPackageAlternatives and include alternatives in the result', async () => {
      const mockAlts = [{ name: 'alt-pkg', version: 'latest', reason: 'better', source: 'DB' }];
      registryUtils.fetchPackageAlternatives.mockResolvedValue(mockAlts);

      const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
      expect(registryUtils.fetchPackageAlternatives).toHaveBeenCalledWith(mockDep.name, mockDep.version);
      expect(result.alternatives).toEqual(mockAlts);
    });

    it('should handle no alternatives found', async () => {
      registryUtils.fetchPackageAlternatives.mockResolvedValue([]); // Explicitly empty
      const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
      expect(result.alternatives).toEqual([]);
    });

    it('should correctly identify available updates and latest version', async () => {
        registryUtils.fetchPackageInfo.mockResolvedValue({
            versions: {
                '1.0.0': { engines: { node: '>=14.0.0' } },
                '1.0.1': { engines: { node: '>=14.0.0' } }, // Compatible
                '1.1.0': { engines: { node: '>=16.0.0' } }, // Compatible
                '2.0.0': { engines: { node: '>=22.0.0' } }, // Incompatible Node
            },
            time: { /* ... time data ... */ },
            'dist-tags': { latest: '2.0.0' }, // Latest overall, but not necessarily compatible for project
        });
        registryUtils.fetchPackageAlternatives.mockResolvedValue([]);

        const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
        expect(result.latestVersion).toBe('2.0.0');
        expect(result.availableUpdates).toEqual(['1.1.0', '1.0.1']); // Only Node-compatible ones
    });


    // Add more tests for health indicators, nodeCompatibilityMessage etc. as before
    // Ensure these tests also correctly mock fetchPackageAlternatives to return [] typically
     it('should assign "Green" health if on latest and no alternatives', async () => {
      mockDep.version = '1.0.0';
      registryUtils.fetchPackageInfo.mockResolvedValue({
        versions: { '1.0.0': { engines: { node: '>=14.0.0' } } },
        time: { '1.0.0': new Date().toISOString() },
        'dist-tags': { latest: '1.0.0' },
      });
      registryUtils.fetchPackageAlternatives.mockResolvedValue([]);
      const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
      expect(result.health).toBe('Green');
      expect(result.alternatives).toEqual([]);
    });


  });

  describe('getFullDependencyDetailsWithUpdates', () => {
    // Tests for this orchestrator function
    // Need to mock getDirectDependencies, getLockfileDependencies, crawlNodeModules,
    // and now getDependencyUpdateInfo (which itself uses the mocked registryUtils)
    let getDirectDepsSpy, getLockfileDepsSpy, crawlSpy, getUpdateInfoSpy;

    beforeEach(() => {
        getDirectDepsSpy = jest.spyOn(dm, 'getDirectDependencies');
        getLockfileDepsSpy = jest.spyOn(dm, 'getLockfileDependencies');
        crawlSpy = jest.spyOn(dm, 'crawlNodeModules');
        // Spy on getDependencyUpdateInfo within the same module
        getUpdateInfoSpy = jest.spyOn(dm, 'getDependencyUpdateInfo');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should call getDependencyUpdateInfo and include alternatives in the final updates array', async () => {
        const mockDirect = { dependencies: { 'pkg-a': '1.0.0' } };
        const mockLockfile = { 'node_modules/pkg-a': { name: 'pkg-a', version: '1.0.0', path: 'node_modules/pkg-a', isRoot: false } };
        const mockEnriched = { 'node_modules/pkg-a': { ...mockLockfile['node_modules/pkg-a'], name:'pkg-a', installedPackageJson: { name: 'pkg-a' } } };
        const mockAlts = [{ name: 'alt-x', version: 'latest', reason: 'test', source: 'testDB' }];
        const mockUpdateInfoForPkgA = {
            name: 'pkg-a', installedVersion: '1.0.0', latestVersion: '1.0.0',
            availableUpdates: [], health: 'Green', alternatives: mockAlts,
            nodeCompatibilityMessage: null, releaseDateInstalled: null, releaseDateLatest: null,
        };

        getDirectDepsSpy.mockReturnValue(mockDirect);
        getLockfileDepsSpy.mockReturnValue(mockLockfile);
        crawlSpy.mockReturnValue(mockEnriched);
        getUpdateInfoSpy.mockResolvedValue(mockUpdateInfoForPkgA); // Mock the resolved value of getDependencyUpdateInfo

        const projectNodeRange = { min: '16.0.0', max: '18.0.0', range: '>=16.0.0 <=18.0.0' };
        const result = await dm.getFullDependencyDetailsWithUpdates(MOCK_PROJECT_PATH, projectNodeRange);

        expect(getUpdateInfoSpy).toHaveBeenCalledWith(mockEnriched['node_modules/pkg-a'], projectNodeRange);
        expect(result.updates.length).toBe(1);
        expect(result.updates[0].alternatives).toEqual(mockAlts);
    });
  });
});
