const fs = require('fs');
const path = require('path');
const semver = require('semver');
// Ensure fetchPackageAlternatives is also imported
const { fetchPackageInfo, fetchPackageAlternatives } = require('./registry-utils');

/**
 * Reads and returns direct dependencies from the project's package.json.
 * @param {string} projectPath - The path to the project root.
 * @returns {object|null} An object containing different types of dependencies, or null on error.
 */
function getDirectDependencies(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    return {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      peerDependencies: packageJson.peerDependencies || {},
      optionalDependencies: packageJson.optionalDependencies || {},
    };
  } catch (error) {
    return null;
  }
}

/**
 * @typedef {import('./registry-utils').PackageAlternative} PackageAlternative
 */

/**
 * @typedef {object} LockfileDependency
 * @property {string} name
 * @property {string} version
 * @property {string} path
 * @property {boolean} isDev
 * @property {boolean} isOptional
 * @property {object} dependencies
 * @property {object} optionalDependencies
 * @property {string|undefined} resolved
 * @property {string|undefined} integrity
 * @property {boolean} isRoot
 * @property {object|null} installedPackageJson
 * @property {object|null} engines
 * @property {string|null} license
 */

/**
 * @typedef {'Green' | 'Yellow' | 'Orange' | 'Red' | 'Unknown'} DependencyHealth
 */

/**
 * @typedef {object} DependencyUpdateInfo
 * @property {string} name
 * @property {string} installedVersion
 * @property {string|null} latestVersion
 * @property {string[]} availableUpdates
 * @property {DependencyHealth} health
 * @property {string|null} releaseDateInstalled
 * @property {string|null} releaseDateLatest
 * @property {string|null} nodeCompatibilityMessage
 * @property {PackageAlternative[] | undefined} alternatives - Suggested alternative packages.
 */

function getLockfileDependencies(projectPath) {
  try {
    const lockfilePath = path.join(projectPath, 'package-lock.json');
    if (!fs.existsSync(lockfilePath)) return null;
    const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
    const lockfileJson = JSON.parse(lockfileContent);

    if (!lockfileJson.packages || (lockfileJson.lockfileVersion !== 2 && lockfileJson.lockfileVersion !== 3)) {
      if (!lockfileJson.packages) return null;
    }

    const parsedDependencies = {};
    const directDeps = getDirectDependencies(projectPath);
    const rootDevDependencies = directDeps?.devDependencies || {};

    for (const packagePathKey in lockfileJson.packages) {
      const packageData = lockfileJson.packages[packagePathKey];
      let name = packageData.name;

      if (packagePathKey === '') {
         parsedDependencies['/'] = {
            name: packageData.name || path.basename(projectPath), version: packageData.version || 'N/A',
            path: '/', isDev: false, isOptional: false,
            dependencies: { ...packageData.dependencies, ...packageData.peerDependencies },
            optionalDependencies: packageData.optionalDependencies || {},
            resolved: undefined, integrity: undefined, isRoot: true,
            installedPackageJson: null, engines: null, license: null,
         };
        continue;
      }
      if (!packagePathKey.startsWith('node_modules/') || !packageData.version) continue;
      if (!name) {
        const pathParts = packagePathKey.replace(/^node_modules\//, '').split('/');
        name = pathParts[0].startsWith('@') ? `${pathParts[0]}/${pathParts[1]}` : pathParts[0];
      }
      let isDevHeuristic = packageData.dev === true;
      if (!isDevHeuristic && directDeps && rootDevDependencies[name]) isDevHeuristic = true;
      // Simplified nested dev dep check for brevity for now
      parsedDependencies[packagePathKey] = {
        name: name, version: packageData.version, path: packagePathKey,
        isDev: isDevHeuristic, isOptional: packageData.optional === true,
        dependencies: { ...packageData.dependencies, ...packageData.peerDependencies },
        optionalDependencies: packageData.optionalDependencies || {},
        resolved: packageData.resolved, integrity: packageData.integrity, isRoot: false,
        installedPackageJson: null, engines: null, license: null,
      };
    }
    return parsedDependencies;
  } catch (error) { return null; }
}

function crawlNodeModules(projectPath, lockfileDeps) {
  if (!lockfileDeps) return {};
  const enrichedDeps = { ...lockfileDeps };
  for (const packageKey in enrichedDeps) {
    const dep = enrichedDeps[packageKey];
    const packageJsonFname = 'package.json';
    const depPackageJsonPath = dep.isRoot ?
        path.join(projectPath, packageJsonFname) :
        path.join(projectPath, dep.path, packageJsonFname);
    try {
      if (fs.existsSync(depPackageJsonPath)) {
        const rawJson = fs.readFileSync(depPackageJsonPath, 'utf-8');
        const parsedJson = JSON.parse(rawJson);
        dep.installedPackageJson = parsedJson;
        dep.engines = parsedJson.engines || null;
        dep.license = parsedJson.license || null;
        if (dep.isRoot) {
            if (dep.version === 'N/A' && parsedJson.version) dep.version = parsedJson.version;
            if (dep.name === path.basename(projectPath) && parsedJson.name) dep.name = parsedJson.name;
        }
      }
    } catch (e) { /* ignore */ }
  }
  return enrichedDeps;
}

async function getDependencyUpdateInfo(dependency, projectNodeRange) {
  if (!dependency || dependency.isRoot || !dependency.name) {
    return {
        name: dependency?.name || 'Unknown', installedVersion: dependency?.version || 'N/A',
        latestVersion: null, availableUpdates: [], health: 'Unknown',
        releaseDateInstalled: null, releaseDateLatest: null, nodeCompatibilityMessage: 'Dep data incomplete.',
        alternatives: [], // Initialize with empty alternatives
    };
  }

  const [packageInfo, alternatives] = await Promise.all([
      fetchPackageInfo(dependency.name),
      fetchPackageAlternatives(dependency.name, dependency.version)
  ]);

  const installedVersion = dependency.version;
  const latestVersion = packageInfo['dist-tags']?.latest || null;
  let availableUpdates = [];
  let nodeCompatibilityMessage = null;

  if (packageInfo.versions && projectNodeRange && projectNodeRange.range) {
    availableUpdates = Object.keys(packageInfo.versions)
      .filter(v => semver.gt(v, installedVersion))
      .filter(v => {
        const versionEngines = packageInfo.versions[v]?.engines?.node;
        if (versionEngines && !semver.intersects(projectNodeRange.range, versionEngines)) return false;
        if (!versionEngines && dependency.engines?.node && !semver.intersects(projectNodeRange.range, dependency.engines.node)) return false;
        return true;
      })
      .sort(semver.rcompare);
  }

  let health = 'Unknown';
  const releaseDateInstalled = packageInfo.time?.[installedVersion] || null;
  const releaseDateLatest = latestVersion ? (packageInfo.time?.[latestVersion] || null) : null;

  if (latestVersion) {
    if (semver.eq(installedVersion, latestVersion)) health = 'Green';
    else {
      const diff = semver.diff(installedVersion, latestVersion);
      if (diff === 'major') health = 'Red';
      else if (diff === 'minor') health = 'Orange';
      else if (diff === 'patch' || diff === 'prerelease') health = 'Yellow';
      if (releaseDateLatest && releaseDateInstalled) {
        const timeDiff = new Date(releaseDateLatest).getTime() - new Date(releaseDateInstalled).getTime();
        const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
        if (timeDiff > sixMonths && health !== 'Red') health = health === 'Yellow' ? 'Orange' : 'Red';
        if (timeDiff > 12 * 30 * 24 * 60 * 60 * 1000) health = 'Red';
      }
    }
  } else if (packageInfo.error) {
    nodeCompatibilityMessage = `Package ${dependency.name} not found in mock registry.`;
    health = 'Unknown';
  } else if (Object.keys(packageInfo.versions).length === 0) {
     nodeCompatibilityMessage = `No versions listed for ${dependency.name} in mock registry.`;
     health = 'Unknown';
  }

  if (dependency.engines?.node && projectNodeRange?.range && !semver.intersects(projectNodeRange.range, dependency.engines.node)) {
      nodeCompatibilityMessage = (nodeCompatibilityMessage ? nodeCompatibilityMessage + " Also, i" : "I") +
                                 `nstalled version's Node req (${dependency.engines.node}) may not fit project range (${projectNodeRange.range}).`;
      if (health !== 'Red') health = 'Orange';
  }

  return {
    name: dependency.name, installedVersion, latestVersion, availableUpdates, health,
    releaseDateInstalled, releaseDateLatest, nodeCompatibilityMessage,
    alternatives: alternatives || [], // Ensure alternatives is always an array
  };
}

async function getFullDependencyDetailsWithUpdates(projectPath, projectNodeRange) {
  const direct = getDirectDependencies(projectPath);
  let lockfileDeps = getLockfileDependencies(projectPath);
  let enriched = null;
  const updateInfos = [];

  if (lockfileDeps) {
    enriched = crawlNodeModules(projectPath, lockfileDeps);
    for (const key in enriched) {
      if (enriched[key].isRoot || !enriched[key].name) continue;
      const updateInfo = await getDependencyUpdateInfo(enriched[key], projectNodeRange);
      updateInfos.push(updateInfo);
    }
  }
  return { direct, enriched, updates: updateInfos };
}

module.exports = {
  getDirectDependencies, getLockfileDependencies, crawlNodeModules,
  getFullDependencyDetailsWithUpdates, getDependencyUpdateInfo,
};
