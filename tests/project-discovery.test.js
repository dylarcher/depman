const fs = require('fs');
const path = require('path');
const { discoverSubProjects } = require('../src/lib/project-discovery');

jest.mock('fs');

describe('project-discovery.js', () => {
  describe('discoverSubProjects', () => {
    const MOCK_ROOT_DIR = '/app';

    beforeEach(() => {
      // Reset all fs mocks before each test
      fs.readdirSync.mockReset();
      fs.statSync.mockReset(); // If used by discoverSubProjects (not directly, but good practice)
      fs.existsSync.mockReset();
    });

    it('should find no sub-projects in a flat structure', () => {
      fs.readdirSync.mockReturnValue([]); // No entries in rootDir
      const projects = discoverSubProjects(MOCK_ROOT_DIR);
      expect(projects).toEqual([]);
    });

    it('should find sub-projects at depth 1', () => {
      // Structure:
      // /app/package-a/package.json
      // /app/package-b/package.json
      // /app/not-a-project/somefile.js
      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === MOCK_ROOT_DIR) {
          return [
            { name: 'package-a', isDirectory: () => true },
            { name: 'package-b', isDirectory: () => true },
            { name: 'not-a-project', isDirectory: () => true },
          ];
        }
        return []; // No further nesting for this test
      });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === path.join(MOCK_ROOT_DIR, 'package-a', 'package.json')) return true;
        if (filePath === path.join(MOCK_ROOT_DIR, 'package-b', 'package.json')) return true;
        if (filePath === path.join(MOCK_ROOT_DIR, 'not-a-project', 'package.json')) return false;
        return false;
      });

      const projects = discoverSubProjects(MOCK_ROOT_DIR, 1);
      expect(projects).toEqual(expect.arrayContaining(['package-a', 'package-b']));
      expect(projects.length).toBe(2);
    });

    it('should find sub-projects up to specified depth (depth 2)', () => {
      // /app/group1/package-c/package.json
      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === MOCK_ROOT_DIR) {
          return [{ name: 'group1', isDirectory: () => true }];
        }
        if (dirPath === path.join(MOCK_ROOT_DIR, 'group1')) {
          return [{ name: 'package-c', isDirectory: () => true }];
        }
        return [];
      });
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === path.join(MOCK_ROOT_DIR, 'group1', 'package-c', 'package.json')) return true;
        return false;
      });
      const projects = discoverSubProjects(MOCK_ROOT_DIR, 2);
      expect(projects).toEqual(['group1/package-c']);
    });

    it('should not find projects beyond specified depth', () => {
      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === MOCK_ROOT_DIR) return [{ name: 'group1', isDirectory: () => true }];
        if (dirPath === path.join(MOCK_ROOT_DIR, 'group1')) return [{ name: 'package-c', isDirectory: () => true }];
        // package-c itself could have sub-projects, but we are scanning with depth 1 from root
        return [];
      });
      fs.existsSync.mockImplementation((filePath) => {
         // only package-c/package.json exists for this test's purpose at depth 2
        if (filePath === path.join(MOCK_ROOT_DIR, 'group1', 'package-c', 'package.json')) return true;
        return false;
      });
      // discoverSubProjects with depth 1 should NOT find group1/package-c
      const projects = discoverSubProjects(MOCK_ROOT_DIR, 1);
      // It finds 'group1/package-c' because the scan starts at depth 1 for children of rootDir.
      // The package.json for 'group1/package-c' is at level 2 relative to rootDir.
      // The current logic: scanDir(rootDir, 1) -> currentDepth is 1.
      // It finds 'group1'. entryPath is '/app/group1'. currentDir is '/app'.
      // packageJsonPath for 'group1/package.json' - assume false.
      // It calls scanDir('/app/group1', 2). currentDepth is 2.
      // It finds 'package-c'. entryPath is '/app/group1/package-c'. currentDir is '/app/group1'.
      // packageJsonPath for '/app/group1/package-c/package.json' - true. Add 'group1/package-c'.
      // Calls scanDir('/app/group1/package-c', 3). currentDepth is 3. Exceeds depth 2. Returns.
      // So, with depth=2, it should find it.
      // If depth=1, scanDir(rootDir, 1) -> finds group1. scanDir(group1, 2). currentDepth 2 > depth 1. Returns.
      // This means it won't even check for package.json inside group1 if depth is 1.
      // The test logic needs to align with how `depth` is interpreted.
      // If depth=1 means "only direct children of rootDir that are projects".
      // The current code: depth=1 means "scan children of rootDir, and if they are directories, check them for package.json"
      // "and then scan their children (depth 2) but don't go further".
      // Let's re-evaluate discoverSubProjects depth interpretation.
      // If depth=1, scanDir(rootDir,1). For child 'group1', package.json is at 'group1/package.json'.
      // Then scanDir('group1', 2). 2 > depth (1) is false. Oh, it's currentDepth > depth.
      // So if depth = 1, scanDir(currentDir, 1) is fine.
      // scanDir(childDir, 2) is called. currentDepth (2) > depth (1) is true. Returns.
      // This means it will only find projects that are direct children of rootDir.
      // So, for depth=1, `group1/package-c` should NOT be found.

      // Reset for this specific test
      fs.readdirSync.mockReset(); fs.existsSync.mockReset();
      fs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath === MOCK_ROOT_DIR) return [{ name: 'group1', isDirectory: () => true }];
        if (dirPath === path.join(MOCK_ROOT_DIR, 'group1')) return [{ name: 'package-c', isDirectory: () => true }];
        return [];
      });
       fs.existsSync.mockImplementation((filePath) => {
        // package.json only exists for package-c
        if (filePath === path.join(MOCK_ROOT_DIR, 'group1', 'package-c', 'package.json')) return true;
        // No package.json for group1 itself
        if (filePath === path.join(MOCK_ROOT_DIR, 'group1', 'package.json')) return false;
        return false;
      });

      const projectsDepth1 = discoverSubProjects(MOCK_ROOT_DIR, 1);
      expect(projectsDepth1).toEqual([]); // Correct: group1 itself is not a project, package-c is too deep for depth=1

      const projectsDepth2 = discoverSubProjects(MOCK_ROOT_DIR, 2);
      expect(projectsDepth2).toEqual(['group1/package-c']); // Correct

    });


    it('should ignore node_modules directories', () => {
      fs.readdirSync.mockReturnValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: 'package-a', isDirectory: () => true },
      ]);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === path.join(MOCK_ROOT_DIR, 'package-a', 'package.json')) return true;
        // Should not check inside node_modules
        if (filePath.includes('node_modules')) return true; // if it did check, assume it finds one
        return false;
      });
      const projects = discoverSubProjects(MOCK_ROOT_DIR, 1);
      expect(projects).toEqual(['package-a']);
      expect(fs.readdirSync).not.toHaveBeenCalledWith(path.join(MOCK_ROOT_DIR, 'node_modules'), expect.any(Object));
    });

    it('should handle read errors gracefully for a directory', () => {
        fs.readdirSync.mockImplementation((dirPath) => {
            if (dirPath === MOCK_ROOT_DIR) {
                return [
                    { name: 'good-dir', isDirectory: () => true },
                    { name: 'bad-dir', isDirectory: () => true }, // This one will throw
                    { name: 'another-good-dir', isDirectory: () => true },
                ];
            }
            if (dirPath === path.join(MOCK_ROOT_DIR, 'good-dir')) {
                return [{ name: 'pkg-g', isDirectory: () => true }];
            }
            if (dirPath === path.join(MOCK_ROOT_DIR, 'bad-dir')) {
                throw new Error("Permission denied");
            }
             if (dirPath === path.join(MOCK_ROOT_DIR, 'another-good-dir')) {
                return [{ name: 'pkg-h', isDirectory: () => true }];
            }
            return [];
        });
        fs.existsSync.mockImplementation((filePath) => {
            if (filePath === path.join(MOCK_ROOT_DIR, 'good-dir', 'pkg-g', 'package.json')) return true;
            if (filePath === path.join(MOCK_ROOT_DIR, 'another-good-dir', 'pkg-h', 'package.json')) return true;
            return false;
        });
        const projects = discoverSubProjects(MOCK_ROOT_DIR, 2);
        expect(projects).toEqual(expect.arrayContaining(['good-dir/pkg-g', 'another-good-dir/pkg-h']));
        expect(projects.length).toBe(2);
    });

  });
});
