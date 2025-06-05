const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const {
    applyUpdates,
    applyReplacements,
    _modifyPackageJsonContent: _modifyPackageJsonContentForUpdate,
    _modifyPackageJsonContentForReplacement,
    _getDependencyType
} = require('../src/lib/update-executor');

jest.mock('fs');
jest.mock('child_process');

const MOCK_PROJECT_PATH = '/fake/project';

describe('update-executor.js', () => {
  beforeEach(() => {
    fs.readFileSync.mockReset();
    fs.writeFileSync.mockReset();
    fs.existsSync.mockReset();
    child_process.exec.mockReset();
  });

  describe('_getDependencyType', () => {
    // ... (existing tests - assumed complete)
    const mockEnrichedDeps = { 'node_modules/prod-pkg': { name: 'prod-pkg', isDev: false, isOptional: false }};
    it('should identify production dependency', () => {
      expect(_getDependencyType('prod-pkg', mockEnrichedDeps)).toBe('dependencies');
    });
  });

  describe('_modifyPackageJsonContentForUpdate', () => {
    // ... (existing tests - assumed complete)
     const initialPackageJson = { name: 'test', dependencies: { 'pkg-a': '1.0.0' } };
    const initialContent = JSON.stringify(initialPackageJson, null, 2);
    it('should update a dependency version', () => {
      const newContent = _modifyPackageJsonContentForUpdate(initialContent, 'pkg-a', '1.1.0', 'dependencies');
      expect(JSON.parse(newContent).dependencies['pkg-a']).toBe('1.1.0');
    });
  });

  describe('_modifyPackageJsonContentForReplacement', () => {
    // ... (existing tests - assumed complete)
    const initialPackageJson = { name: 'test', dependencies: { 'old-pkg': '1.0.0' }};
    const initialContent = JSON.stringify(initialPackageJson, null, 2);
    it('should remove old and add new', () => {
      const newContent = _modifyPackageJsonContentForReplacement(initialContent, 'old-pkg', 'new-pkg', '2.0.0', 'dependencies');
      const parsed = JSON.parse(newContent);
      expect(parsed.dependencies['old-pkg']).toBeUndefined();
      expect(parsed.dependencies['new-pkg']).toBe('2.0.0');
    });
  });

  describe('applyUpdates', () => {
    const mockUpdates = [{ name: 'pkg-a', currentVersion: '1.0.0', targetVersion: '1.1.0' }];
    const mockEnrichedDeps = { 'node_modules/pkg-a': { name: 'pkg-a', isDev: false, isOptional: false, path: 'node_modules/pkg-a', version: '1.0.0' }};
    const initialPackageJsonString = JSON.stringify({ name: 'test', dependencies: { 'pkg-a': '1.0.0' } }, null, 2);
    const initialLockfileString = 'lockfile-content-v1';

    beforeEach(() => {
      fs.existsSync.mockImplementation(filePath => true);
      fs.readFileSync.mockImplementation(filePath => {
        if (filePath.endsWith('package.json')) return initialPackageJsonString;
        if (filePath.endsWith('package-lock.json')) return initialLockfileString;
        return '';
      });
    });

    it('should use --save-optional for optionalDependencies', async () => {
      const optionalUpdates = [{ name: 'opt-pkg', currentVersion: '1.0.0', targetVersion: '1.1.0' }];
      const optionalEnrichedDeps = { 'node_modules/opt-pkg': { name: 'opt-pkg', isOptional: true, path: 'node_modules/opt-pkg', version: '1.0.0' }};
      const optionalInitialJson = JSON.stringify({ name: 'test', optionalDependencies: { 'opt-pkg': '1.0.0' } });
      fs.readFileSync.mockImplementation(filePath => filePath.endsWith('package.json') ? optionalInitialJson : initialLockfileString);
      child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, '', ''));
      await applyUpdates(MOCK_PROJECT_PATH, optionalUpdates, optionalEnrichedDeps);
      expect(child_process.exec).toHaveBeenCalledWith('npm install opt-pkg@1.1.0 --save-optional', expect.any(Object), expect.any(Function));
    });

    it('should handle missing package-lock.json on successful update (npm creates it)', async () => {
      fs.existsSync.mockImplementation(filePath => filePath.endsWith('package.json')); // Lockfile doesn't exist
      fs.readFileSync.mockReturnValue(initialPackageJsonString); // Only package.json read
      child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, 'stdout', '')); // npm install success

      await applyUpdates(MOCK_PROJECT_PATH, mockUpdates, mockEnrichedDeps);
      // Check that writeFileSync for lockfile was NOT called for rollback (because it didn't exist to be backed up)
      // This is implicitly tested by not throwing and by the number of writeFileSync calls for package.json.
      // A more specific test would involve inspecting all fs.writeFileSync calls.
      // For now, we ensure it completes and only tries to write package.json for the update itself.
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1); // Only for package.json update
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), expect.any(String), 'utf8');
    });

  });

  describe('applyReplacements', () => {
    const mockReplacements = [{
      originalPackageName: 'old-pkg', originalPackageVersion: '1.0.0',
      alternativePackageName: 'new-pkg', alternativePackageVersion: '2.0.0',
      reason: 'test reason'
    }];
    const mockEnrichedDepsSingle = { 'node_modules/old-pkg': { name: 'old-pkg', isDev: false, isOptional: false, path: 'node_modules/old-pkg', version: '1.0.0' }};
    const initialPackageJsonSingleString = JSON.stringify({ name: 'test', dependencies: { 'old-pkg': '1.0.0' } }, null, 2);
    const initialLockfileString = 'lockfile-content-for-replacement';

    beforeEach(() => {
      fs.existsSync.mockImplementation(filePath => true);
      fs.readFileSync.mockImplementation(filePath => {
        if (filePath.endsWith('package.json')) return initialPackageJsonSingleString;
        if (filePath.endsWith('package-lock.json')) return initialLockfileString;
        return '';
      });
    });

    it('should use --save-optional for uninstalling an optionalDependency', async () => {
        const optReplacement = [{ ...mockReplacements[0], originalPackageName: 'old-opt-pkg' }];
        const optEnriched = { 'node_modules/old-opt-pkg': { name: 'old-opt-pkg', isOptional: true, path: 'node_modules/old-opt-pkg', version: '1.0.0' }};
        const optInitialJson = JSON.stringify({ name: 'test', optionalDependencies: { 'old-opt-pkg': '1.0.0' } });
        fs.readFileSync.mockImplementation(filePath => filePath.endsWith('package.json') ? optInitialJson : initialLockfileString);
        child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, '', ''));

        await applyReplacements(MOCK_PROJECT_PATH, optReplacement, optEnriched);
        expect(child_process.exec).toHaveBeenCalledWith(
            'npm uninstall old-opt-pkg --save-optional', // Check correct flag
            expect.any(Object), expect.any(Function)
        );
        expect(child_process.exec).toHaveBeenCalledWith( // Ensure install new still happens
            `npm install ${optReplacement[0].alternativePackageName}@${optReplacement[0].alternativePackageVersion} --save`,
            expect.any(Object), expect.any(Function)
        );
    });

    it('should handle missing package-lock.json on successful replacement (npm creates it)', async () => {
      fs.existsSync.mockImplementation(filePath => filePath.endsWith('package.json')); // Lockfile doesn't exist
      fs.readFileSync.mockReturnValue(initialPackageJsonSingleString);
      child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, 'stdout', '')); // npm commands success

      await applyReplacements(MOCK_PROJECT_PATH, mockReplacements, mockEnrichedDepsSingle);
      // Similar to applyUpdates, ensure no attempt to rollback a non-existent lockfile.
      // package.json is written once (the modification).
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), expect.any(String), 'utf8');
    });

    // ... (existing tests for applyReplacements - success, uninstall fail, install fail)
    it('should successfully apply a replacement', async () => {
      child_process.exec.mockImplementation((command, options, callback) => callback(null, 'stdout', ''));
      const result = await applyReplacements(MOCK_PROJECT_PATH, mockReplacements, mockEnrichedDepsSingle);
      expect(result.successfulReplacements).toEqual(mockReplacements);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1); // Only initial modification, no rollback
    });


  });
});
