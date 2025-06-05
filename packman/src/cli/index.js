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
const { discoverSubProjects } = require('../lib/project-discovery'); // Added

// Global state for replacements (cleared for each project)
let replacementsToApplyGlobal = [];

// Helper function to encapsulate the core logic for a single project
async function processProject(currentProjectPath) {
  console.log(chalk.bold.magenta(`\n=== Processing Project: ${chalk.underline(currentProjectPath)} ===`));
  replacementsToApplyGlobal = []; // Reset for current project

  // --- 1. Node.js Environment Analysis ---
  console.log(chalk.bold.cyan("\n--- Node.js Compatibility Analysis ---"));
  const rootProjectNodeConstraint = getProjectNodeVersionConstraint(currentProjectPath);
  if (rootProjectNodeConstraint) console.log(`Current 'engines.node': ${chalk.yellow(rootProjectNodeConstraint)}`);
  else console.log(chalk.yellow("No 'engines.node' in package.json."));

  const initialDepDetails = await getFullDependencyDetailsWithUpdates(currentProjectPath, null);
  const allEnrichedDepsMap = initialDepDetails.enriched;

  if (!allEnrichedDepsMap) {
    console.log(chalk.red("Could not load dependency details. Skipping this project."));
    return;
  }

  const projectNodeRangeDetails = getNodeCompatibilityRange(currentProjectPath, allEnrichedDepsMap);
  // Simplified handleNodeAnalysisAndMaybeUpdate from before
    if (projectNodeRangeDetails && projectNodeRangeDetails.min) {
        console.log(`Project Node Range: Min ${chalk.green(projectNodeRangeDetails.min)}, Max ${chalk.green(projectNodeRangeDetails.max || 'any')}, Recommended: ${chalk.green(projectNodeRangeDetails.range)}`);
        // Further Node update prompts could go here if desired for sub-projects too
    } else {
        console.log(chalk.red("Could not determine Node.js range."));
    }

  let nodeOutliers = [];
  if (projectNodeRangeDetails && projectNodeRangeDetails.min && allEnrichedDepsMap) {
      nodeOutliers = identifyNodeOutliers(allEnrichedDepsMap, projectNodeRangeDetails, rootProjectNodeConstraint);
      if (nodeOutliers.length > 0) {
          console.log(chalk.bold.yellowBright("\nNode.js Versioning Outliers Detected:"));
          nodeOutliers.forEach(o => console.log(`  - ${chalk.bold(o.packageName)}: ${chalk.yellow(o.impact)} (Constraint: ${o.packageNodeConstraint})`));
      } else {
          console.log(chalk.green("\nNo significant Node.js versioning outliers detected."));
      }
  }
  console.log(chalk.gray("------------------------------------------"));

  // --- 2. Dependency Management Action Selection ---
  const depDetailsWithNodeRange = await getFullDependencyDetailsWithUpdates(currentProjectPath, projectNodeRangeDetails);
  if (!depDetailsWithNodeRange.enriched) {
    console.log(chalk.red("Could not reload dependency details with Node range. Skipping dependency management for this project."));
    return;
  }

  console.log(chalk.bold.cyan("\n--- Dependency Management ---"));
  const { action } = await inquirer.prompt([
    { type: 'list', name: 'action', message: `Action for ${path.basename(currentProjectPath)}:`,
      choices: [
        { name: 'Review and update individual dependencies', value: 'individual' },
        { name: 'Attempt to update all outdated to highest compatible versions', value: 'all_highest' },
        new inquirer.Separator(),
        { name: 'Skip dependency management for this project', value: 'skip' },
      ]
    }
  ]);

  if (action === 'skip') {
    console.log(chalk.yellow(`Skipping dependency management for ${currentProjectPath}.`));
    return;
  }

  const { selectedTypes } = await inquirer.prompt([
    { type: 'checkbox', name: 'selectedTypes', message: 'Dependency types to include:',
      choices: [
        { name: 'Production', value: 'dependencies', checked: true },
        { name: 'Development', value: 'devDependencies', checked: true },
        { name: 'Optional', value: 'optionalDependencies', checked: false },
      ],
      validate: (input) => input.length > 0 ? true : 'Please select at least one type.'
    }
  ]);

  let updatesToApply = [];
  if (action === 'individual') {
    updatesToApply = await handleIndividualDependencyUpdates(currentProjectPath, depDetailsWithNodeRange, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers);
  } else if (action === 'all_highest') {
    updatesToApply = await handleUpdateAllHighest(depDetailsWithNodeRange, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers);
    // Offer to review alternatives after "update all"
    const { reviewAltsAfterUpdateAll } = await inquirer.prompt([{type: 'confirm', name: 'reviewAltsAfterUpdateAll', message: 'Review suggested alternatives for any remaining packages?', default: true}]);
    if (reviewAltsAfterUpdateAll) {
        for (const depUpdateInfo of depDetailsWithNodeRange.updates) {
            // ... (logic to call handleAlternativeSelection for relevant packages) ...
             if (depUpdateInfo.alternatives && depUpdateInfo.alternatives.length > 0 &&
                Object.values(filterDependenciesByType(allEnrichedDepsMap, selectedTypes)).some(fd => fd.name === depUpdateInfo.name) &&
                !replacementsToApplyGlobal.find(r => r.originalPackageName === depUpdateInfo.name) &&
                !updatesToApply.find(u => u.name === depUpdateInfo.name)
            ) {
                 await handleAlternativeSelection(depUpdateInfo, currentProjectPath, allEnrichedDepsMap); // Pass currentProjectPath
            }
        }
    }
  }

  // --- 3. Execute Updates and Replacements ---
  if (updatesToApply && updatesToApply.length > 0) {
    const { confirmApplyVersions } = await inquirer.prompt([{type:'confirm', name:'confirmApplyVersions', message:`Proceed with ${updatesToApply.length} version update(s) for ${path.basename(currentProjectPath)}?`, default:true}]);
    if (confirmApplyVersions) {
        console.log(chalk.bold(`\nApplying version updates for ${path.basename(currentProjectPath)}...`));
        const results = await applyUpdates(currentProjectPath, updatesToApply, allEnrichedDepsMap);
        // ... (display update results) ...
    } else { console.log(chalk.yellow("Version updates cancelled.")); }
  } else if (action !== 'skip' && replacementsToApplyGlobal.length === 0) {
    console.log(chalk.yellow("\nNo version updates were selected."));
  }

  if (replacementsToApplyGlobal.length > 0) {
    console.log(chalk.bold.cyan(`\n--- Summary of Planned Replacements for ${path.basename(currentProjectPath)} ---`));
    replacementsToApplyGlobal.forEach(rep => console.log(`  - ${chalk.red(rep.originalPackageName)} -> ${chalk.greenBright(rep.alternativePackageName)}`));
    const { confirmApplyReplacements } = await inquirer.prompt([{type:'confirm', name:'confirmApplyReplacements', message:`Proceed with ${replacementsToApplyGlobal.length} package replacement(s) for ${path.basename(currentProjectPath)}?`, default:false}]);
    if (confirmApplyReplacements) {
        console.log(chalk.bold(`\nApplying replacements for ${path.basename(currentProjectPath)}...`));
        const repResults = await applyReplacements(currentProjectPath, replacementsToApplyGlobal, allEnrichedDepsMap);
        // ... (display replacement results) ...
    } else { console.log(chalk.yellow("Package replacements cancelled."));}
  }
}


// --- Helper functions for CLI (handleAlternativeSelection, handleIndividualDependencyUpdates, etc.) ---
// These need to be adapted to take currentProjectPath if they perform operations or construct paths
async function handleAlternativeSelection(depUpdateInfo, currentProjectPath, allEnrichedDeps) { // Added currentProjectPath
    if (!depUpdateInfo.alternatives || depUpdateInfo.alternatives.length === 0) return;
    // ... (rest of the function as before, ensure any path-dependent ops use currentProjectPath) ...
    const choices = depUpdateInfo.alternatives.map(alt => ({
        name: `${chalk.bold(alt.name)} (v${alt.version || 'latest'}) - ${chalk.dim(alt.reason)}`, value: alt,
    }));
    choices.push(new inquirer.Separator(), { name: 'Do not replace', value: null });
    const { chosenAlternative } = await inquirer.prompt([ { type: 'list', name: 'chosenAlternative', message: `Alternatives for ${chalk.bold(depUpdateInfo.name)}:`, choices, pageSize: choices.length } ]);
    if (chosenAlternative) {
        replacementsToApplyGlobal.push({
            originalPackageName: depUpdateInfo.name, originalPackageVersion: depUpdateInfo.installedVersion,
            alternativePackageName: chosenAlternative.name, alternativePackageVersion: chosenAlternative.version || 'latest',
            reason: chosenAlternative.reason,
        });
    }
}

async function handleIndividualDependencyUpdates(currentProjectPath, depDetails, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers) {
    // ... (ensure all calls within pass currentProjectPath if they need it) ...
    // This function now primarily prepares and returns `updatesToApply`.
    // Calls to `handleAlternativeSelection` are made within this loop as well.
    const filteredEnrichedDeps = filterDependenciesByType(allEnrichedDepsMap, selectedTypes);
    // ... (map to depsForDisplay as before, passing outlierInfo) ...
    const depsForDisplay = depDetails.updates
        .filter(updInfo => Object.values(filteredEnrichedDeps).some(fd => fd.name === updInfo.name))
        .map(updInfo => { /* ... format choice with outlier ... */
            const enrichedDep = Object.values(filteredEnrichedDeps).find(fd => fd.name === updInfo.name);
            const outlier = nodeOutliers.find(o => o.packageName === updInfo.name);
            return { name: formatDependencyChoice(updInfo, enrichedDep, outlier), value: updInfo, disabled: updInfo.availableUpdates.length === 0 && updInfo.health === 'Green' && !outlier && (!updInfo.alternatives || updInfo.alternatives.length === 0) };
        });

    if (depsForDisplay.length === 0) { console.log(chalk.yellow("No dependencies for individual action.")); return []; }
    const { selectedDepsForAction } = await inquirer.prompt([/* ... dep selection prompt ... */]);
    let updatesToApplyInternal = [];
    if (selectedDepsForAction && selectedDepsForAction.length > 0) {
        for (const depUpdateInfo of selectedDepsForAction) {
            // ... (version update choice logic) ...
            if (depUpdateInfo.alternatives && depUpdateInfo.alternatives.length > 0) {
                const { reviewAlts } = await inquirer.prompt([/* ... review alts confirm ... */]);
                if (reviewAlts) await handleAlternativeSelection(depUpdateInfo, currentProjectPath, allEnrichedDepsMap);
            }
        }
    }
    return updatesToApplyInternal;
}

async function handleUpdateAllHighest(depDetails, allEnrichedDepsMap, projectNodeRangeDetails, selectedTypes, nodeOutliers) {
    // ... (implementation as before, returns list for updatesToApply) ...
    let proposedUpdates = [];
    // ... (logic to find highest compatible for non-Green or outlier deps) ...
    if (proposedUpdates.length === 0) { console.log(chalk.yellow("No outdated dependencies for 'Update All'.")); return []; }
    // ... (confirm and return only name, currentVersion, targetVersion) ...
    const { confirmUpdateAll } = await inquirer.prompt([ { type: 'confirm', name: 'confirmUpdateAll', message: 'Proceed with these version updates?', default: false} ]);
    return confirmUpdateAll ? proposedUpdates.map(p => ({name: p.name, currentVersion: p.currentVersion, targetVersion: p.targetVersion})) : [];
}


// --- Main Application Flow ---
async function main() {
  const initialTargetProjectPath = process.cwd(); // Default to CWD
  let argPath = process.argv[2];
  if (argPath && !argPath.startsWith('--') && argPath !== 'test_dependency_scan') {
    targetProjectPath = path.resolve(argPath);
  } else {
    targetProjectPath = initialTargetProjectPath;
  }
  console.log(chalk.blue(`Packman starting analysis from root: ${targetProjectPath}`));

  const subProjects = discoverSubProjects(targetProjectPath);
  const projectsToProcess = [
    { name: path.basename(targetProjectPath) || 'Current Project', path: targetProjectPath, isRoot: true }, // Root project first
    ...subProjects.map(sp => ({ name: sp, path: path.join(targetProjectPath, sp), isRoot: false }))
  ];

  console.log(chalk.cyan(`Found ${projectsToProcess.length} project(s) to analyze (root and ${subProjects.length} sub-project(s)).`));
  if (projectsToProcess.length > 1) {
      const { proceedWithAll } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceedWithAll',
          message: `Process all ${projectsToProcess.length} projects sequentially? (You'll be prompted for actions on each)`,
          default: true
      }]);
      if (!proceedWithAll) {
          console.log(chalk.yellow("Aborted by user."));
          return;
      }
  }


  for (const project of projectsToProcess) {
    try {
      await processProject(project.path);
    } catch (error) {
      console.error(chalk.red(`\nFATAL ERROR while processing project ${project.name} (${project.path}):`));
      console.error(error);
      if (projectsToProcess.length > 1) {
          const { continueToNext } = await inquirer.prompt([{
              type: 'confirm',
              name: 'continueToNext',
              message: `An error occurred in project ${project.name}. Continue to the next project?`,
              default: false // Default to not continuing on error
          }]);
          if (!continueToNext) {
              console.log(chalk.yellow("Aborting further processing."));
              break;
          }
      }
    }
  }

  console.log(chalk.bold.magenta("\nPackman overall analysis complete."));
}

main().catch(error => {
  console.error(chalk.redBright("\nAn unexpected critical error occurred in PACKMAN CLI:"));
  console.error(error);
  process.exitCode = 1;
});
