const fs = require('fs');
const path = require('path');
const semver = require('semver');
const dm = require('../src/lib/dependency-manager');
const registryUtils = require('../src/lib/registry-utils');

jest.mock('fs');
jest.mock('../src/lib/registry-utils', () => ({
  fetchPackageInfo: jest.fn(),
  fetchPackageAlternatives: jest.fn(),
}));

const MOCK_PROJECT_PATH = '/fake/project';

describe('dependency-manager.js', () => {
  beforeEach(() => {
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
    fs.writeFileSync.mockReset(); // Though not used by this module directly, good practice
    registryUtils.fetchPackageInfo.mockReset();
    registryUtils.fetchPackageAlternatives.mockReset();
  });

  describe('getDirectDependencies', () => {
    // ... (tests from previous subtask - assumed complete and correct) ...
    it('should return all dependency types if present', () => {
      const packageJsonContent = { dependencies: { 'a': '1' }, devDependencies: { 'b': '2' }, peerDependencies: { 'c': '3' }, optionalDependencies: { 'd': '4' }};
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJsonContent));
      expect(dm.getDirectDependencies(MOCK_PROJECT_PATH)).toEqual(packageJsonContent);
    });
  });

  describe('getLockfileDependencies', () => {
    const MOCK_PACKAGE_JSON_FOR_DEV_HEURISTIC = {
        name: 'test-project',
        devDependencies: { 'dev-dep-root': '^1.0.0', 'another-dev': '^2.0.0' }
    };
    const complexLockfile = {
      name: 'test-project',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': { name: 'test-project', version: '1.0.0', dependencies: {'prod-dep': '1.0.0'}, devDependencies: {'dev-dep-root': '1.0.0'} },
        'node_modules/prod-dep': { name: 'prod-dep', version: '1.0.0', resolved: 'r1', integrity: 'i1', dependencies: {'transitive-prod': '0.5.0'} },
        'node_modules/transitive-prod': { name: 'transitive-prod', version: '0.5.0', resolved: 'r2', integrity: 'i2' },
        'node_modules/dev-dep-root': { name: 'dev-dep-root', version: '1.0.0', dev: true, resolved: 'r3', integrity: 'i3', dependencies: {'transitive-dev': '0.1.0'} },
        'node_modules/transitive-dev': { name: 'transitive-dev', version: '0.1.0', dev: true, resolved: 'r4', integrity: 'i4' }, // Transitive dev of a dev dep
        'node_modules/optional-dep': { name: 'optional-dep', version: '2.0.0', optional: true, integrity: 'i5' },
        'node_modules/peer-dep-carrier': { name: 'peer-dep-carrier', version: '1.0.0', integrity: 'i6', peerDependencies: {'actual-peer': '>=1.0.0'} },
        'node_modules/actual-peer': { name: 'actual-peer', version: '1.1.0', integrity: 'i7' }, // Typically listed if met
        'node_modules/missing-version-pkg': { name: 'missing-version-pkg', resolved:'r8', integrity: 'i8'}, // No version
        'packages/local-pkg': { name: 'local-pkg', version: 'link:../local-pkg' } // Local path, no version from registry
      }
    };

    beforeEach(() => {
        fs.existsSync.mockImplementation(filePath => true); // Assume all files exist
        fs.readFileSync.mockImplementation(filePath => {
            if (filePath.endsWith('package-lock.json')) return JSON.stringify(complexLockfile);
            if (filePath.endsWith('package.json')) return JSON.stringify(MOCK_PACKAGE_JSON_FOR_DEV_HEURISTIC);
            return '';
        });
    });

    it('should parse a complex lockfile correctly', () => {
      const deps = dm.getLockfileDependencies(MOCK_PROJECT_PATH);
      expect(deps).not.toBeNull();
      expect(deps['/'].name).toBe('test-project');
      expect(deps['node_modules/prod-dep'].dependencies['transitive-prod']).toBe('0.5.0');
      expect(deps['node_modules/dev-dep-root'].isDev).toBe(true);
      expect(deps['node_modules/transitive-dev'].isDev).toBe(true); // Heuristic: parent isDev OR self is dev
      expect(deps['node_modules/optional-dep'].isOptional).toBe(true);
      expect(deps['node_modules/peer-dep-carrier'].dependencies['actual-peer']).toBe('>=1.0.0'); // Peer deps included
    });

    it('should filter out packages without a version or not in node_modules', () => {
      const deps = dm.getLockfileDependencies(MOCK_PROJECT_PATH);
      expect(deps['node_modules/missing-version-pkg']).toBeUndefined();
      expect(deps['packages/local-pkg']).toBeUndefined();
    });
  });

  describe('crawlNodeModules', () => {
    const mockLockfileDataForCrawl = {
      '/': { name: 'root', version: '1.0.0', path: '/', isRoot: true, dependencies: {}, installedPackageJson: null, engines: null, license: null },
      'node_modules/dep-a': { name: 'dep-a', version: '1.0.0', path: 'node_modules/dep-a', isRoot: false, dependencies: {}, installedPackageJson: null, engines: null, license: null },
      'node_modules/dep-b-missing': { name: 'dep-b-missing', version: '1.1.0', path: 'node_modules/dep-b-missing', isRoot: false, dependencies: {}, installedPackageJson: null, engines: null, license: null },
    };
    const rootPkgJson = { name: 'root', version: '1.0.0', engines: { node: '>=18' } };
    const depAPkgJson = { name: 'dep-a', version: '1.0.0', engines: { node: '>=16' }, license: 'ISC' };

    beforeEach(() => {
      fs.existsSync.mockImplementation(filePath => {
        if (filePath.endsWith('/package.json') && filePath.includes('dep-a')) return true;
        if (filePath.endsWith('/package.json') && filePath.startsWith(MOCK_PROJECT_PATH) && !filePath.includes('node_modules')) return true; // Root package.json
        if (filePath.endsWith('/package.json') && filePath.includes('dep-b-missing')) return false; // Missing
        return false;
      });
      fs.readFileSync.mockImplementation(filePath => {
        if (filePath.endsWith('/package.json') && filePath.includes('dep-a')) return JSON.stringify(depAPkgJson);
        if (filePath.endsWith('/package.json') && filePath.startsWith(MOCK_PROJECT_PATH) && !filePath.includes('node_modules')) return JSON.stringify(rootPkgJson);
        throw new Error('File not found by mock in crawlNodeModules test');
      });
    });

    it('should enrich data and handle missing package.json for a dep', () => {
      const enriched = dm.crawlNodeModules(MOCK_PROJECT_PATH, JSON.parse(JSON.stringify(mockLockfileDataForCrawl)));
      expect(enriched['/'].installedPackageJson).toEqual(rootPkgJson);
      expect(enriched['/'].engines).toEqual({ node: '>=18' });
      expect(enriched['node_modules/dep-a'].installedPackageJson).toEqual(depAPkgJson);
      expect(enriched['node_modules/dep-a'].license).toBe('ISC');
      expect(enriched['node_modules/dep-b-missing'].installedPackageJson).toBeNull(); // Gracefully handled
    });
  });

  describe('getDependencyUpdateInfo', () => {
    let mockDep; // Define mockDep structure based on LockfileDependency with installedPackageJson
    const projectNodeRange = { min: '18.0.0', max: '20.9.0', range: '>=18.0.0 <=20.9.0' };

    beforeEach(() => {
        mockDep = {
            name: 'pkg-a', version: '1.0.0', path: 'node_modules/pkg-a', isRoot: false,
            isDev: false, isOptional: false, dependencies: {}, optionalDependencies: {},
            installedPackageJson: { name: 'pkg-a', version: '1.0.0', engines: { node: '>=16.0.0' } },
            engines: { node: '>=16.0.0' }, license: 'MIT',
        };
        // Default mocks for registry utils
        registryUtils.fetchPackageInfo.mockResolvedValue({
            versions: { '1.0.0': { engines: { node: '>=16.0.0' } }, '1.1.0': { engines: { node: '>=18.0.0' } } },
            time: { '1.0.0': '2023-01-01T00:00:00.000Z', '1.1.0': '2023-02-01T00:00:00.000Z' },
            'dist-tags': { latest: '1.1.0' }
        });
        registryUtils.fetchPackageAlternatives.mockResolvedValue([]);
    });

    it('health should be Yellow if latest is recent patch/minor and no Node issues', async () => {
      // mockDep version 1.0.0, latest 1.1.0 (minor), both recent
      const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
      expect(result.health).toBe('Yellow'); // Minor update makes it yellow
    });

    it('should assume compatibility if newer version in registry lacks engines field', async () => {
      registryUtils.fetchPackageInfo.mockResolvedValue({
        versions: {
            '1.0.0': { engines: { node: '>=16.0.0' } },
            '1.2.0': { /* no engines field */ }
        },
        time: { '1.0.0': '2023-01-01T00:00:00.000Z', '1.2.0': '2023-03-01T00:00:00.000Z' },
        'dist-tags': { latest: '1.2.0' }
      });
      // Installed pkg-a engines: { node: '>=16.0.0' }
      // Project node range: >=18.0.0 <=20.9.0
      // The installed version's engine (>=16) IS compatible with project range.
      // The new version 1.2.0 has no engine, so it should be considered compatible.
      const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange);
      expect(result.availableUpdates).toContain('1.2.0');
      expect(result.nodeCompatibilityMessage).toBeNull();
    });

    it('should flag available update if its specific engine is incompatible, even if installed was compatible', async () => {
        mockDep.engines = { node: '>=18.0.0' }; // Installed is compatible
        mockDep.installedPackageJson.engines = { node: '>=18.0.0' };

        registryUtils.fetchPackageInfo.mockResolvedValue({
            versions: {
                '1.0.0': { engines: { node: '>=18.0.0' } },
                '1.2.0': { engines: { node: '>=22.0.0' } } // This version requires Node 22+
            },
            time: { /* ... */ }, 'dist-tags': { latest: '1.2.0' }
        });
        const result = await dm.getDependencyUpdateInfo(mockDep, projectNodeRange); // project range max 20.9.0
        expect(result.availableUpdates).not.toContain('1.2.0');
    });

  });
  // ... (getFullDependencyDetailsWithUpdates tests as before, ensure mocks are right) ...
});
