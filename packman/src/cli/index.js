#!/usr/bin/env node

const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const semver = require('semver');

// Lib imports
const {
  getNodeCompatibilityRange, getCurrentNodeVersion, KNOWN_LTS_VERSIONS,
  getAvailableUpgradeOptions, updatePackageJsonEngines, getProjectNodeVersionConstraint,
  identifyNodeOutliers
} = require('../lib/node-env');
const { getFullDependencyDetailsWithUpdates } = require('../lib/dependency-manager');
const { formatDependencyChoice, filterDependenciesByType } = require('../lib/cli-display');
const { applyUpdates, applyReplacements } = require('../lib/update-executor');
const { discoverSubProjects } = require('../lib/project-discovery');

// Global state for replacements (cleared for each project)
let replacementsToApplyGlobal = [];
let overallSummary = []; // To store summaries for each project

async function handleNodeAnalysisAndMaybeUpdate(currentProjectPath, projectNodeRangeDetails) {
    if (!projectNodeRangeDetails || !projectNodeRangeDetails.min) {
        console.log(chalk.red("Could not determine Node.js range. Skipping Node update suggestions."));
        return false; // Indicate no update was made
    }
    console.log(`Project Node Range: Min ${chalk.green(projectNodeRangeDetails.min || 'N/A')}, Max ${chalk.green(projectNodeRangeDetails.max || 'any')}, Recommended: ${chalk.green(projectNodeRangeDetails.range || 'N/A')}`);
    const currentNode = getCurrentNodeVersion();
    console.log(`Current Node.js: ${chalk.yellow(currentNode)}`);
    const upgradeOptions = getAvailableUpgradeOptions(currentNode, projectNodeRangeDetails, KNOWN_LTS_VERSIONS);

    if (upgradeOptions.length > 0) {
      const nodeChoices = [
        ...upgradeOptions.map(v => ({ name: `Target Node.js ${chalk.green(v)} (LTS) and update 'engines' field`, value: v })),
        new inquirer.Separator(),
        { name: 'Do not update Node.js settings now', value: null }
      ];
      const { selectedNodeVersion } = await inquirer.prompt([
          { type: 'list', name: 'selectedNodeVersion', message: `Recommended Node.js versions for ${chalk.bold(path.basename(currentProjectPath))}:`, choices: nodeChoices, pageSize: 5 }
      ]);
      if (selectedNodeVersion) {
        const rangeToSet = projectNodeRangeDetails.range;
        if (updatePackageJsonEngines(currentProjectPath, rangeToSet)) {
            console.log(chalk.greenBright(`Successfully updated 'engines.node' in package.json for ${path.basename(currentProjectPath)}.`));
            console.log(chalk.yellow(`Remember to switch your Node.js environment to ${selectedNodeVersion} or a compatible version.`));
            return true; // Indicate update was made
        } else {
            console.error(chalk.red(`Failed to update package.json for Node engines in ${path.basename(currentProjectPath)}.`));
        }
      }
    } else {
      console.log(chalk.yellow("\nNo recommended Node.js LTS upgrades available, or already on a suitable version."));
    }
    return false; // No update made
}

async function handleAlternativeSelection(depUpdateInfo, currentProjectPath) {
    if (!depUpdateInfo.alternatives || depUpdateInfo.alternatives.length === 0) return;
    const choices = depUpdateInfo.alternatives.map(alt => ({
        name: `${chalk.bold(alt.name)} (v${alt.version || 'latest'}) - ${chalk.dim(alt.reason)} ${chalk.gray(`(Source: ${alt.source})`)}`,
        value: alt,
    }));
    choices.push(new inquirer.Separator(), { name: 'Do not replace this package', value: null });
    const { chosenAlternative } = await inquirer.prompt([ { type: 'list', name: 'chosenAlternative', message: `Review alternatives for ${chalk.bold(depUpdateInfo.name)}:`, choices, pageSize: choices.length } ]);
    if (chosenAlternative) {
        replacementsToApplyGlobal.push({
            originalPackageName: depUpdateInfo.name, originalPackageVersion: depUpdateInfo.installedVersion,
            alternativePackageName: chosenAlternative.name, alternativePackageVersion: chosenAlternative.version || 'latest',
            reason: chosenAlternative.reason,
        });
        console.log(chalk.greenBright(`  Marked ${depUpdateInfo.name} for replacement with ${chosenAlternative.name}.`));
    }
}

async function handleIndividualDependencyUpdates(currentProjectPath, depDetails, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers) {
    const filteredEnrichedDeps = filterDependenciesByType(allEnrichedDepsMap, selectedTypes);
    const depsForDisplay = depDetails.updates
        .filter(updInfo => Object.values(filteredEnrichedDeps).some(fd => fd.name === updInfo.name))
        .map(updInfo => {
            const enrichedDep = Object.values(filteredEnrichedDeps).find(fd => fd.name === updInfo.name);
            const outlier = nodeOutliers.find(o => o.packageName === updInfo.name);
            return { name: formatDependencyChoice(updInfo, enrichedDep, outlier), value: updInfo, disabled: updInfo.availableUpdates.length === 0 && updInfo.health === 'Green' && !outlier && (!updInfo.alternatives || updInfo.alternatives.length === 0) };
        }).sort((a,b) => a.name.localeCompare(b.name)); // Simple sort for now

    if (depsForDisplay.length === 0) { console.log(chalk.yellow("No dependencies found for selected types or no actions available.")); return []; }

    const { selectedDepsForAction } = await inquirer.prompt([{ type: 'checkbox', name: 'selectedDepsForAction', message: 'Choose packages to inspect for updates or alternatives:', choices: depsForDisplay, pageSize: 15 }]);
    let updatesToApplyInternal = [];
    if (selectedDepsForAction && selectedDepsForAction.length > 0) {
        for (const depUpdateInfo of selectedDepsForAction) {
            let choseToUpdateVersion = false;
            if (depUpdateInfo.availableUpdates.length > 0) {
                const { chosenVersion } = await inquirer.prompt([ { type: 'list', name: 'chosenVersion', message: `Target version for ${chalk.bold(depUpdateInfo.name)}:`, choices: [...depUpdateInfo.availableUpdates.map(v=>({name:`Update to ${v}`, value:v})), new inquirer.Separator(), {name:'Keep current', value:depUpdateInfo.installedVersion}]}]);
                if (chosenVersion !== depUpdateInfo.installedVersion) {
                    updatesToApplyInternal.push({ name: depUpdateInfo.name, currentVersion: depUpdateInfo.installedVersion, targetVersion: chosenVersion });
                    choseToUpdateVersion = true;
                }
            } else { console.log(chalk.yellow(`No direct compatible version updates for ${depUpdateInfo.name}.`)); }
            if (depUpdateInfo.alternatives && depUpdateInfo.alternatives.length > 0) {
                const { reviewAlts } = await inquirer.prompt([{ type: 'confirm', name: 'reviewAlts', message: `Package ${chalk.bold(depUpdateInfo.name)} has suggested alternatives. Review them?`, default: !choseToUpdateVersion }]);
                if (reviewAlts) await handleAlternativeSelection(depUpdateInfo, currentProjectPath);
            }
        }
    }
    return updatesToApplyInternal;
}

async function handleUpdateAllHighest(depDetails, allEnrichedDepsMap, selectedTypes, nodeOutliers) {
    const filteredEnrichedDeps = filterDependenciesByType(allEnrichedDepsMap, selectedTypes);
    let proposedUpdates = [];
    depDetails.updates.forEach(updateInfo => {
        if (Object.values(filteredEnrichedDeps).some(fd => fd.name === updateInfo.name)) {
            const outlierInfo = nodeOutliers.find(o => o.packageName === updateInfo.name);
            if (updateInfo.availableUpdates && updateInfo.availableUpdates.length > 0 && (updateInfo.health !== 'Green' || outlierInfo)) {
                const highestCompatibleVersion = updateInfo.availableUpdates[0]; // Already sorted rcompare
                if (highestCompatibleVersion && semver.gt(highestCompatibleVersion, updateInfo.installedVersion)) {
                    proposedUpdates.push({ name: updateInfo.name, currentVersion: updateInfo.installedVersion, targetVersion: highestCompatibleVersion, health: updateInfo.health, outlierInfo });
                }
            }
        }
    });
    if (proposedUpdates.length === 0) { console.log(chalk.yellow("\nNo outdated dependencies found with compatible updates for the selected types.")); return []; }

    console.log(chalk.bold.cyan("\n--- Proposed Updates (Highest Compatible) ---"));
    proposedUpdates.forEach(upd => { /* ... display logic ... */ console.log(`  - ${upd.name}: ${upd.currentVersion} -> ${upd.targetVersion}`); });
    const { confirmUpdateAll } = await inquirer.prompt([{ type: 'confirm', name: 'confirmUpdateAll', message: `Proceed with these ${proposedUpdates.length} version updates?`, default: false}]);
    return confirmUpdateAll ? proposedUpdates.map(({name, currentVersion, targetVersion}) => ({name, currentVersion, targetVersion})) : [];
}

async function processProject(currentProjectPath) {
  console.log(chalk.bold.magenta(`\n=== Processing Project: ${chalk.underline(currentProjectPath)} ===`));
  replacementsToApplyGlobal = [];
  let projectSummary = { name: path.basename(currentProjectPath) || currentProjectPath, nodeEngineUpdated: false, versionUpdatesCount: 0, replacementCount: 0, errors: 0 };

  // Node.js Analysis
  console.log(chalk.bold.cyan("\n--- Node.js Compatibility Analysis ---"));
  const rootProjectNodeConstraint = getProjectNodeVersionConstraint(currentProjectPath);
  if (rootProjectNodeConstraint) console.log(`Current 'engines.node': ${chalk.yellow(rootProjectNodeConstraint)}`);
  else console.log(chalk.yellow("No 'engines.node' in package.json."));

  const initialDepDetails = await getFullDependencyDetailsWithUpdates(currentProjectPath, null);
  const allEnrichedDepsMap = initialDepDetails.enriched;

  if (!allEnrichedDepsMap) {
    console.log(chalk.red("Could not load dependency details. Skipping this project."));
    projectSummary.errors++;
    overallSummary.push(projectSummary);
    return;
  }

  const projectNodeRangeDetails = getNodeCompatibilityRange(currentProjectPath, allEnrichedDepsMap);
  const nodeUpdateMade = await handleNodeAnalysisAndMaybeUpdate(currentProjectPath, projectNodeRangeDetails);
  if (nodeUpdateMade) projectSummary.nodeEngineUpdated = true;

  let nodeOutliers = [];
  if (projectNodeRangeDetails && projectNodeRangeDetails.min && allEnrichedDepsMap) {
      nodeOutliers = identifyNodeOutliers(allEnrichedDepsMap, projectNodeRangeDetails, rootProjectNodeConstraint);
      if (nodeOutliers.length > 0) { /* ... display outliers ... */ }
  }
  console.log(chalk.gray("------------------------------------------"));

  // Dependency Management
  const depDetailsWithNodeRange = await getFullDependencyDetailsWithUpdates(currentProjectPath, projectNodeRangeDetails);
  if (!depDetailsWithNodeRange.enriched) { /* ... error message ... */ projectSummary.errors++; overallSummary.push(projectSummary); return; }

  console.log(chalk.bold.cyan("\n--- Dependency Management ---"));
  const { action } = await inquirer.prompt([/* ... main action prompt for current project ... */]);
  if (action === 'skip') { /* ... skip message ... */ overallSummary.push(projectSummary); return; }
  const { selectedTypes } = await inquirer.prompt([/* ... type selection ... */]);

  let updatesToApply = [];
  if (action === 'individual') {
    updatesToApply = await handleIndividualDependencyUpdates(currentProjectPath, depDetailsWithNodeRange, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers);
  } else if (action === 'all_highest') {
    updatesToApply = await handleUpdateAllHighest(depDetailsWithNodeRange, allEnrichedDepsMap, selectedTypes, nodeOutliers); // Removed projectNodeRangeDetails, nodeOutliers from here as they are for display mostly
    const { reviewAltsAfterUpdateAll } = await inquirer.prompt([/* ... review alts confirm ... */]);
    if (reviewAltsAfterUpdateAll) { /* ... call handleAlternativeSelection loop ... */ }
  }

  if (updatesToApply && updatesToApply.length > 0) {
    const { confirmApplyVersions } = await inquirer.prompt([/* ... confirm version updates ... */]);
    if (confirmApplyVersions) {
        const results = await applyUpdates(currentProjectPath, updatesToApply, allEnrichedDepsMap);
        projectSummary.versionUpdatesCount = results.successfulUpdates.length;
        if (results.failedUpdates.length > 0) projectSummary.errors++;
        // ... display update results ...
    } else { console.log(chalk.yellow("Version updates cancelled.")); }
  } else if (action !== 'skip' && replacementsToApplyGlobal.length === 0) { /* ... no version updates message ... */ }

  if (replacementsToApplyGlobal.length > 0) {
    console.log(chalk.bold.cyan(`\n--- Summary of Planned Replacements for ${path.basename(currentProjectPath)} ---`));
    replacementsToApplyGlobal.forEach(rep => console.log(`  - ${chalk.red(rep.originalPackageName)} -> ${chalk.greenBright(rep.alternativePackageName)}`));
    const { confirmApplyReplacements } = await inquirer.prompt([/* ... confirm replacements ... */]);
    if (confirmApplyReplacements) {
        const repResults = await applyReplacements(currentProjectPath, replacementsToApplyGlobal, allEnrichedDepsMap);
        projectSummary.replacementCount = repResults.successfulReplacements.length;
        if (repResults.failedReplacements.length > 0) projectSummary.errors++;
        // ... display replacement results ...
    } else { console.log(chalk.yellow("Package replacements cancelled."));}
  }
  console.log(chalk.green(`\nFinished processing project: ${chalk.underline(path.basename(currentProjectPath))}.`));
  overallSummary.push(projectSummary);
}

async function main() {
  const initialTargetProjectPath = process.cwd();
  let argPath = process.argv[2];
  // ... (targetProjectPath init) ...
  targetProjectPath = argPath && !argPath.startsWith('--') ? path.resolve(argPath) : initialTargetProjectPath;

  console.log(chalk.blue(`Packman starting analysis from root: ${targetProjectPath}`));
  const subProjects = discoverSubProjects(targetProjectPath);
  const projectsToProcess = [ { name: path.basename(targetProjectPath) || 'Current Project', path: targetProjectPath, isRoot: true }, ...subProjects.map(sp => ({ name: sp, path: path.join(targetProjectPath, sp), isRoot: false })) ];

  if (projectsToProcess.length > 1) { /* ... confirm process all ... */ }
  overallSummary = []; // Reset for the run

  for (const project of projectsToProcess) {
    try { await processProject(project.path); }
    catch (error) { /* ... error handling & continue prompt ... */ }
  }

  // --- Overall Summary ---
  console.log(chalk.bold.magenta("\n\n--- PACKMAN Overall Run Summary ---"));
  if (overallSummary.length === 0) {
    console.log(chalk.yellow("No projects were processed."));
  } else {
    overallSummary.forEach(s => {
        let summaryLine = `Project ${chalk.underline(s.name)}: `;
        let details = [];
        if(s.nodeEngineUpdated) details.push(chalk.green("Node 'engines' updated"));
        if(s.versionUpdatesCount > 0) details.push(chalk.green(`${s.versionUpdatesCount} dep version(s) updated`));
        if(s.replacementCount > 0) details.push(chalk.green(`${s.replacementCount} dep(s) replaced`));
        if(s.errors > 0) details.push(chalk.red(`${s.errors} error(s) encountered`));
        if(details.length === 0) details.push("No changes applied or errors.");
        console.log(summaryLine + details.join(', '));
    });
  }
  console.log(chalk.bold.magenta("\nPackman analysis complete."));
}

main().catch(error => { /* ... final error handling ... */ });
