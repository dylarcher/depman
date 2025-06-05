const chalk = require('chalk');
const semver = require('semver');

/**
 * @typedef {import('./dependency-manager').DependencyUpdateInfo} DependencyUpdateInfo
 * @typedef {import('./dependency-manager').LockfileDependency} LockfileDependency
 * @typedef {import('./node-env').NodeOutlierInfo} NodeOutlierInfo
 */

/**
 * Gets a colored health indicator string.
 * @param {DependencyUpdateInfo['health']} health
 * @returns {string}
 */
function getHealthIndicator(health) {
  switch (health) {
    case 'Green':
      return chalk.greenBright('[GREEN]');
    case 'Yellow':
      return chalk.yellowBright('[YELLOW]');
    case 'Orange':
      return chalk.rgb(255, 165, 0)('[ORANGE]'); // Orange color
    case 'Red':
      return chalk.redBright('[RED]');
    case 'Unknown':
    default:
      return chalk.gray('[UNKNOWN]');
  }
}

/**
 * Formats a DependencyUpdateInfo object into a user-friendly string for display.
 * @param {DependencyUpdateInfo} depInfo - The dependency update information.
 * @param {LockfileDependency} enrichedDep - The corresponding enriched LockfileDependency.
 * @param {NodeOutlierInfo|undefined} outlierInfo - Optional outlier information for this dependency.
 * @returns {string} Formatted string for display.
 */
function formatDependencyChoice(depInfo, enrichedDep, outlierInfo) {
  const healthIndicator = getHealthIndicator(depInfo.health);
  let choiceStr = `${healthIndicator} ${chalk.bold(depInfo.name)}: ${chalk.cyan(depInfo.installedVersion)}`;

  if (depInfo.latestVersion && depInfo.installedVersion !== depInfo.latestVersion) {
    choiceStr += ` (latest ${chalk.magenta(depInfo.latestVersion)})`;
  }

  if (depInfo.availableUpdates && depInfo.availableUpdates.length > 0) {
    const topUpdates = depInfo.availableUpdates.slice(0, 2).map(v => chalk.green(v)).join(', ');
    const moreCount = depInfo.availableUpdates.length - 2;
    choiceStr += ` ${chalk.blueBright('-> Updatable to:')} ${topUpdates}`;
    if (moreCount > 0) {
      choiceStr += ` ${chalk.blueBright(`(+${moreCount} more)`)}`;
    }
  } else if (depInfo.latestVersion && depInfo.installedVersion !== depInfo.latestVersion) {
    choiceStr += ` ${chalk.yellowBright('-> (Latest may require different Node.js)')}`;
  }

  if (outlierInfo) {
    choiceStr += ` ${chalk.yellowBright.bold('[NODE OUTLIER]')} ${chalk.yellow(`(${outlierInfo.impact})`)}`;
  } else if (depInfo.nodeCompatibilityMessage) {
    choiceStr += ` ${chalk.red(`| Node issue: ${depInfo.nodeCompatibilityMessage}`)}`;
  }

  if (depInfo.alternatives && depInfo.alternatives.length > 0) {
    choiceStr += ` ${chalk.cyanBright('[ALT SUGGESTED]')}`;
  }

  if(enrichedDep.isDev) choiceStr += chalk.gray(' [dev]');
  if(enrichedDep.isOptional) choiceStr += chalk.gray(' [optional]');

  return choiceStr;
}

/**
 * Filters dependencies based on user-selected types.
 * @param {Record<string, LockfileDependency>} enrichedDependencies - All enriched dependencies.
 * @param {string[]} selectedTypes - Array of selected types ('dependencies', 'devDependencies', 'optionalDependencies').
 * @returns {Record<string, LockfileDependency>} Filtered dependencies.
 */
function filterDependenciesByType(enrichedDependencies, selectedTypes) {
  if (!enrichedDependencies) return {};
  const filtered = {};
  for (const key in enrichedDependencies) {
    const dep = enrichedDependencies[key];
    if (dep.isRoot) continue;

    let include = false;
    if (selectedTypes.includes('dependencies') && !dep.isDev && !dep.isOptional) {
      include = true;
    }
    if (selectedTypes.includes('devDependencies') && dep.isDev) {
      include = true;
    }
    if (selectedTypes.includes('optionalDependencies') && dep.isOptional) {
      include = true;
    }
    if (include) {
      filtered[key] = dep;
    }
  }
  return filtered;
}

module.exports = {
  formatDependencyChoice,
  filterDependenciesByType,
  getHealthIndicator,
};
