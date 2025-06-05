const fs = require('fs');
const path = require('path');

/**
 * Discovers potential NodeJS sub-projects within a given root directory.
 * A subdirectory is considered a potential sub-project if it contains a package.json file.
 *
 * @param {string} rootDir - The main directory to scan.
 * @param {number} [depth=2] - How many levels deep to scan for sub-projects.
 *                             depth=0 means only rootDir (if it's a project, but this func finds *sub*-projects).
 *                             depth=1 means rootDir/* /package.json.
 *                             depth=2 means rootDir/* /package.json and rootDir/* /* /package.json.
 * @returns {string[]} An array of relative paths to these discovered sub-projects from rootDir.
 */
function discoverSubProjects(rootDir, depth = 2) {
  const foundProjects = new Set(); // Use a Set to store relative paths to avoid duplicates

  function scanDir(currentDir, currentDepth) {
    if (currentDepth > depth) {
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      // console.warn(`Could not read directory ${currentDir}: ${error.message}`);
      return; // Skip directories that can't be read
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue; // Ignore node_modules and hidden directories
      }

      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory itself is a project (contains package.json)
        // Only add if it's not the initial rootDir being scanned (we are looking for *sub*-projects)
        if (currentDir !== rootDir && entryPath !== rootDir) { // Check to ensure it's a sub-directory
             const packageJsonPath = path.join(entryPath, 'package.json');
             if (fs.existsSync(packageJsonPath)) {
                // Store the path relative to the initial rootDir
                foundProjects.add(path.relative(rootDir, entryPath));
             }
        }

        // Recursively scan, even if current directory is a project, to find nested ones
        if (currentDepth < depth) {
             scanDir(entryPath, currentDepth + 1);
        }

      }
    }
  }

  // Start scanning from depth 1 (immediate children of rootDir)
  // The initial call to scanDir explores rootDir's children.
  // The logic inside scanDir adds projects if they are subdirectories.
  scanDir(rootDir, 1); // Start scanning children of rootDir

  return Array.from(foundProjects);
}

module.exports = {
  discoverSubProjects,
};
