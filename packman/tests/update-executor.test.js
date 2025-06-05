const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const {
    applyUpdates,
    applyReplacements, // Import the new function
    _modifyPackageJsonContent: _modifyPackageJsonContentForUpdate, // Alias for clarity
    _modifyPackageJsonContentForReplacement, // Import new helper
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
    // ... existing tests for _getDependencyType ...
    const mockEnrichedDeps = { 'node_modules/prod-pkg': { name: 'prod-pkg', isDev: false, isOptional: false }};
    it('should identify production dependency', () => {
      expect(_getDependencyType('prod-pkg', mockEnrichedDeps)).toBe('dependencies');
    });
  });

  describe('_modifyPackageJsonContentForUpdate', () => {
    // ... existing tests for _modifyPackageJsonContent (aliased to _modifyPackageJsonContentForUpdate) ...
    const initialPackageJson = { name: 'test', dependencies: { 'pkg-a': '1.0.0' } };
    const initialContent = JSON.stringify(initialPackageJson, null, 2);
    it('should update a dependency version', () => {
      const newContent = _modifyPackageJsonContentForUpdate(initialContent, 'pkg-a', '1.1.0', 'dependencies');
      expect(JSON.parse(newContent).dependencies['pkg-a']).toBe('1.1.0');
    });
  });

  describe('_modifyPackageJsonContentForReplacement', () => {
    const initialPackageJson = {
      name: 'test',
      dependencies: { 'old-pkg': '1.0.0', 'another-dep': '3.0.0' },
      devDependencies: { 'dev-dep': '2.0.0' }
    };
    const initialContent = JSON.stringify(initialPackageJson, null, 2);

    it('should remove old package and add new package to dependencies', () => {
      const newContent = _modifyPackageJsonContentForReplacement(initialContent, 'old-pkg', 'new-pkg', '2.0.0', 'dependencies');
      const parsed = JSON.parse(newContent);
      expect(parsed.dependencies['old-pkg']).toBeUndefined();
      expect(parsed.dependencies['new-pkg']).toBe('2.0.0');
      expect(parsed.dependencies['another-dep']).toBe('3.0.0'); // Ensure other deps are preserved
    });

    it('should remove old devDependency and add new to dependencies (default for new)', () => {
      const newContent = _modifyPackageJsonContentForReplacement(initialContent, 'dev-dep', 'new-dev-replacement', '1.0.0', 'devDependencies');
      const parsed = JSON.parse(newContent);
      expect(parsed.devDependencies['dev-dep']).toBeUndefined();
      expect(parsed.dependencies['new-dev-replacement']).toBe('1.0.0');
    });

    it('should create dependencies section if it does not exist for new package', () => {
        const noProdDepsJson = { name: 'test', devDependencies: {'old-pkg': '1.0.0'} };
        const noProdDepsContent = JSON.stringify(noProdDepsJson, null, 2);
        const newContent = _modifyPackageJsonContentForReplacement(noProdDepsContent, 'old-pkg', 'new-pkg', '1.0.0', 'devDependencies');
        const parsed = JSON.parse(newContent);
        expect(parsed.devDependencies['old-pkg']).toBeUndefined();
        expect(parsed.dependencies['new-pkg']).toBe('1.0.0');
    });
  });


  describe('applyUpdates', () => {
    // ... existing tests for applyUpdates ...
    const mockUpdates = [{ name: 'pkg-a', currentVersion: '1.0.0', targetVersion: '1.1.0' }];
    const mockEnrichedDeps = { 'node_modules/pkg-a': { name: 'pkg-a', isDev: false, path: 'node_modules/pkg-a', version: '1.0.0' }};
    const initialPackageJsonString = JSON.stringify({ name: 'test', dependencies: { 'pkg-a': '1.0.0' } });
     beforeEach(() => { // Simplified setup for applyUpdates
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(initialPackageJsonString);
    });
    it('should successfully apply an update', async () => {
      child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, '', ''));
      await applyUpdates(MOCK_PROJECT_PATH, mockUpdates, mockEnrichedDeps);
      expect(child_process.exec).toHaveBeenCalledWith('npm install pkg-a@1.1.0 --save', expect.any(Object), expect.any(Function));
    });
  });

  describe('applyReplacements', () => {
    const mockReplacements = [{
      originalPackageName: 'old-pkg', originalPackageVersion: '1.0.0',
      alternativePackageName: 'new-pkg', alternativePackageVersion: '2.0.0',
      reason: 'test reason'
    }];
    const mockEnrichedDepsSingle = {
      'node_modules/old-pkg': { name: 'old-pkg', isDev: false, isOptional: false, path: 'node_modules/old-pkg', version: '1.0.0' }
    };
    const initialPackageJsonSingleString = JSON.stringify({ name: 'test', dependencies: { 'old-pkg': '1.0.0' } }, null, 2);
    const initialLockfileString = 'lockfile-content-for-replacement';

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(filePath => {
        if (filePath.endsWith('package.json')) return initialPackageJsonSingleString;
        if (filePath.endsWith('package-lock.json')) return initialLockfileString;
        return '';
      });
    });

    it('should successfully apply a replacement', async () => {
      child_process.exec.mockImplementation((command, options, callback) => callback(null, 'stdout', '')); // Both commands succeed

      const result = await applyReplacements(MOCK_PROJECT_PATH, mockReplacements, mockEnrichedDepsSingle);

      // 1. package.json modification (remove old, add new)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(MOCK_PROJECT_PATH, 'package.json'),
        expect.stringMatching(/"new-pkg": "2.0.0"/), // New package added
        'utf8'
      );
      expect(fs.writeFileSync.mock.calls.find(call => call[1].includes('"new-pkg": "2.0.0"'))[1]).not.toContain('"old-pkg":');


      // 2. npm uninstall for old package
      expect(child_process.exec).toHaveBeenCalledWith(
        'npm uninstall old-pkg', // Default --save is implied for uninstall from dependencies
        expect.any(Object),
        expect.any(Function)
      );
      // 3. npm install for new package
      expect(child_process.exec).toHaveBeenCalledWith(
        'npm install new-pkg@2.0.0 --save', // Default --save for new prod dep
        expect.any(Object),
        expect.any(Function)
      );

      expect(result.successfulReplacements).toEqual(mockReplacements);
      expect(result.failedReplacements).toEqual([]);
    });

    it('should roll back if npm uninstall fails', async () => {
      child_process.exec.mockImplementationOnce((command, options, callback) => { // Fails on uninstall
        if (command.startsWith('npm uninstall')) {
          callback(new Error('Uninstall failed'), '', 'stderr');
        } else {
          callback(null, 'stdout', '');
        }
      });

      const result = await applyReplacements(MOCK_PROJECT_PATH, mockReplacements, mockEnrichedDepsSingle);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Initial modify + rollback
      expect(fs.writeFileSync).toHaveBeenNthCalledWith(2, path.join(MOCK_PROJECT_PATH, 'package.json'), initialPackageJsonSingleString, 'utf8');
      expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(MOCK_PROJECT_PATH, 'package-lock.json'), initialLockfileString, 'utf8'); // Rollback lockfile

      expect(child_process.exec).toHaveBeenCalledTimes(1); // Only uninstall was attempted
      expect(result.failedReplacements.length).toBe(1);
      expect(result.failedReplacements[0].replacement).toEqual(mockReplacements[0]);
      expect(result.failedReplacements[0].error).toContain('Uninstall failed');
    });

    it('should roll back if npm install (for new package) fails', async () => {
      child_process.exec.mockImplementation((command, options, callback) => {
        if (command.startsWith('npm install')) { // Fails on install new
          callback(new Error('Install new failed'), '', 'stderr');
        } else { // Uninstall old succeeds
          callback(null, 'stdout', '');
        }
      });

      const result = await applyReplacements(MOCK_PROJECT_PATH, mockReplacements, mockEnrichedDepsSingle);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Initial modify + rollback
      expect(fs.writeFileSync).toHaveBeenNthCalledWith(2, path.join(MOCK_PROJECT_PATH, 'package.json'), initialPackageJsonSingleString, 'utf8');
      // Lockfile might have been modified by successful uninstall, then needs rollback
      expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(MOCK_PROJECT_PATH, 'package-lock.json'), initialLockfileString, 'utf8');

      expect(child_process.exec).toHaveBeenCalledTimes(2); // Uninstall old, attempt install new
      expect(result.failedReplacements.length).toBe(1);
      expect(result.failedReplacements[0].error).toContain('Install new failed');
    });

    it('should use --save-dev for uninstalling a devDependency', async () => {
        const devReplacement = [{ ...mockReplacements[0], originalPackageName: 'old-dev-pkg' }];
        const devEnriched = { 'node_modules/old-dev-pkg': { name: 'old-dev-pkg', isDev: true, path: 'node_modules/old-dev-pkg', version: '1.0.0' }};
        const devInitialJson = JSON.stringify({ name: 'test', devDependencies: { 'old-dev-pkg': '1.0.0' } });
        fs.readFileSync.mockImplementation(filePath => {
            if (filePath.endsWith('package.json')) return devInitialJson;
            return initialLockfileString;
        });
        child_process.exec.mockImplementation((cmd, opts, cb) => cb(null, '', ''));

        await applyReplacements(MOCK_PROJECT_PATH, devReplacement, devEnriched);
        expect(child_process.exec).toHaveBeenCalledWith(
            'npm uninstall old-dev-pkg --save-dev',
            expect.any(Object), expect.any(Function)
        );
    });

  });
});
