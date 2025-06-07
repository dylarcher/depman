const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chalk = require('chalk'); // For console output within the module

/**
 * @typedef {import('./dependency-manager').LockfileDependency} LockfileDependency
 */

/**
 * @typedef {object} UpdateToApply
 * @property {string} name
 * @property {string} currentVersion
 * @property {string} targetVersion
 */

/**
 * @typedef {object} ReplacementToApply
 * @property {string} originalPackageName
 * @property {string} originalPackageVersion
 * @property {string} alternativePackageName
 * @property {string} alternativePackageVersion // e.g., "latest" or "1.2.3"
 * @property {string} reason
 */


function getDependencyType(packageName, allEnrichedDeps) {
  for (const key in allEnrichedDeps) {
    const dep = allEnrichedDeps[key];
    if (dep.name === packageName && !dep.isRoot) {
      if (dep.isDev) return 'devDependencies';
      if (dep.isOptional) return 'optionalDependencies';
      return 'dependencies';
    }
  }
  return 'dependencies';
}

function modifyPackageJsonContentForUpdate(packageJsonContent, packageName, targetVersion, depType) {
  try {
    const packageJson = JSON.parse(packageJsonContent);
    if (packageJson[depType] && packageJson[depType][packageName]) {
      packageJson[depType][packageName] = targetVersion;
      const indent = packageJsonContent.match(/^(\s+)"name":/m)?.[1]?.length || 2;
      return JSON.stringify(packageJson, null, indent);
    }
    return null;
  } catch (error) {
    return null;
  }
}

function modifyPackageJsonContentForReplacement(packageJsonContent, originalPackageName, alternativePackageName, alternativePackageVersion, originalDepType) {
  try {
    const packageJson = JSON.parse(packageJsonContent);
    if (packageJson[originalDepType] && packageJson[originalDepType][originalPackageName]) {
      delete packageJson[originalDepType][originalPackageName];
    }
    if (!packageJson.dependencies) { // Assume new alternatives are prod deps for now
      packageJson.dependencies = {};
    }
    packageJson.dependencies[alternativePackageName] = alternativePackageVersion;
    const indent = packageJsonContent.match(/^(\s+)"name":/m)?.[1]?.length || 2;
    return JSON.stringify(packageJson, null, indent);
  } catch (error) {
    return null;
  }
}


async function runNpmCommand(command, projectPath) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command "'${command}'" failed: ${error.message}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function applyUpdates(projectPath, updatesToApply, allEnrichedDeps) {
  const successfulUpdates = [];
  const failedUpdates = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  const lockfilePath = path.join(projectPath, 'package-lock.json');

  for (const update of updatesToApply) {
    console.log(chalk.blue(`\nAttempting to update ${chalk.bold(update.name)} to ${chalk.green(update.targetVersion)}...`));
    let originalPackageJson = '', originalLockfile = '', packageJsonModified = false;

    try {
      if (!fs.existsSync(packageJsonPath)) throw new Error('package.json not found.');
      originalPackageJson = fs.readFileSync(packageJsonPath, 'utf8');
      originalLockfile = fs.existsSync(lockfilePath) ? fs.readFileSync(lockfilePath, 'utf8') : '';

      const depType = getDependencyType(update.name, allEnrichedDeps);
      const newPackageJsonContent = modifyPackageJsonContentForUpdate(originalPackageJson, update.name, update.targetVersion, depType);
      if (!newPackageJsonContent) throw new Error(`Failed to modify package.json for ${update.name}.`);

      fs.writeFileSync(packageJsonPath, newPackageJsonContent, 'utf8');
      packageJsonModified = true;
      console.log(chalk.dim(`  Updated ${update.name} in package.json.`));

      let installCommand = `npm install ${update.name}@${update.targetVersion}`;
      if (depType === 'devDependencies') installCommand += ' --save-dev';
      else if (depType === 'optionalDependencies') installCommand += ' --save-optional';
      else installCommand += ' --save';

      console.log(chalk.dim(`  Running: ${installCommand}`));
      await runNpmCommand(installCommand, projectPath);

      console.log(chalk.greenBright(`  Successfully installed ${update.name}@${update.targetVersion}.`));
      successfulUpdates.push(update);

    } catch (error) {
      console.error(chalk.red(`  Failed to update ${update.name}: ${error.message}`));
      failedUpdates.push({ update, error: error.message });
      if (packageJsonModified) {
        try {
          console.log(chalk.yellow(`  Rolling back package.json and package-lock.json for ${update.name}...`));
          fs.writeFileSync(packageJsonPath, originalPackageJson, 'utf8');
          if (originalLockfile || fs.existsSync(lockfilePath)) {
             fs.writeFileSync(lockfilePath, originalLockfile, 'utf8');
          }
          console.log(chalk.yellowBright(`  Rollback successful for ${update.name}.`));
          // Added recommendation for consistency with replacements
          console.log(chalk.cyan("  Consider running 'npm install' manually to ensure your node_modules directory is consistent."));
        } catch (rollbackError) {
          console.error(chalk.redBright(`  CRITICAL: Rollback FAILED for ${update.name}: ${rollbackError.message}`));
        }
      }
      console.log(chalk.yellow("Stopping further updates due to an error."));
      break;
    }
  }
  return { successfulUpdates, failedUpdates };
}


async function applyReplacements(projectPath, replacementsToApply, allEnrichedDeps) {
  const successfulReplacements = [];
  const failedReplacements = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  const lockfilePath = path.join(projectPath, 'package-lock.json');

  for (const rep of replacementsToApply) {
    console.log(chalk.blue(`\nAttempting to replace ${chalk.bold(rep.originalPackageName)} with ${chalk.bold(rep.alternativePackageName)}@${chalk.green(rep.alternativePackageVersion)}...`));
    let originalPackageJson = '', originalLockfile = '', packageJsonModified = false;

    try {
      if (!fs.existsSync(packageJsonPath)) throw new Error('package.json not found.');
      originalPackageJson = fs.readFileSync(packageJsonPath, 'utf8');
      originalLockfile = fs.existsSync(lockfilePath) ? fs.readFileSync(lockfilePath, 'utf8') : '';

      const originalDepType = getDependencyType(rep.originalPackageName, allEnrichedDeps);
      const newPackageJsonContent = modifyPackageJsonContentForReplacement(
        originalPackageJson, rep.originalPackageName,
        rep.alternativePackageName, rep.alternativePackageVersion, originalDepType
      );
      if (!newPackageJsonContent) throw new Error(`Failed to modify package.json for replacement of ${rep.originalPackageName}.`);

      fs.writeFileSync(packageJsonPath, newPackageJsonContent, 'utf8');
      packageJsonModified = true;
      console.log(chalk.dim(`  Modified package.json: removed ${rep.originalPackageName}, added ${rep.alternativePackageName}.`));

      let uninstallCommand = `npm uninstall ${rep.originalPackageName}`;
      if (originalDepType === 'devDependencies') uninstallCommand += ' --save-dev';
      else if (originalDepType === 'optionalDependencies') uninstallCommand += ' --save-optional';

      console.log(chalk.dim(`  Running: ${uninstallCommand}`));
      await runNpmCommand(uninstallCommand, projectPath);
      console.log(chalk.dim(`  Uninstalled ${rep.originalPackageName}.`));

      const installCommand = `npm install ${rep.alternativePackageName}@${rep.alternativePackageVersion} --save`;
      console.log(chalk.dim(`  Running: ${installCommand}`));
      await runNpmCommand(installCommand, projectPath);

      console.log(chalk.greenBright(`  Successfully replaced ${rep.originalPackageName} with ${rep.alternativePackageName}@${rep.alternativePackageVersion}.`));
      successfulReplacements.push(rep);

    } catch (error) {
      console.error(chalk.red(`  Failed to replace ${rep.originalPackageName}: ${error.message}`));
      failedReplacements.push({ replacement: rep, error: error.message });
      if (packageJsonModified) {
        try {
          console.log(chalk.yellow(`  Rolling back package.json and package-lock.json for ${rep.originalPackageName} replacement...`));
          fs.writeFileSync(packageJsonPath, originalPackageJson, 'utf8');
           if (originalLockfile || fs.existsSync(lockfilePath)) {
             fs.writeFileSync(lockfilePath, originalLockfile, 'utf8');
          }
          console.log(chalk.yellowBright(`  Rollback successful for ${rep.originalPackageName} replacement.`));
          console.log(chalk.cyan("  You may need to run 'npm install' manually to ensure your node_modules directory is consistent with the rolled-back state."));
        } catch (rollbackError) {
          console.error(chalk.redBright(`  CRITICAL: Rollback FAILED for ${rep.originalPackageName} replacement: ${rollbackError.message}`));
        }
      }
      console.log(chalk.yellow("Stopping further replacements due to an error."));
      break;
    }
  }
  return { successfulReplacements, failedReplacements };
}

module.exports = {
  applyUpdates,
  applyReplacements,
  _modifyPackageJsonContent: modifyPackageJsonContentForUpdate,
  _modifyPackageJsonContentForReplacement: modifyPackageJsonContentForReplacement,
  _getDependencyType: getDependencyType,
};
