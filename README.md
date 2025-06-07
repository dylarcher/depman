
# PACKMAN

**An Expert System for NodeJS Project Modernization and Management**

## Introduction

Maintaining a NodeJS project can be challenging. Over time, dependencies become outdated, security vulnerabilities emerge, and managing compatibility with Node.js versions (especially across a complex dependency tree) can become a significant hurdle often referred to as "dependency hell."

**PACKMAN (Package Manager And Node Wrangler)** is a command-line tool designed to alleviate these challenges. It acts as an intelligent assistant, helping you keep your NodeJS projects (and their sub-projects within a monorepo) up-to-date, secure, and aligned with industry best practices and supported Node.js versions. PACKMAN is interactive, guiding you through analysis and update processes with a focus on safety and compatibility.

## Key Features

PACKMAN offers a suite of features to streamline your project maintenance:

* **Node.js Environment Management:**

  * **Automated Compatibility Analysis:** Discovers your project's `engines.node` requirements and analyzes all dependencies (from `package-lock.json` and their individual `package.json` files in `node_modules`) to calculate the true, effective Node.js version range your project supports.
  * **Interactive Node.js Upgrades:** Suggests compatible LTS Node.js versions your project can upgrade to, based on the comprehensive compatibility analysis.
  * **Automated `package.json` Updates:** If you choose to target a new Node.js version range, PACKMAN can automatically update your `package.json`'s `engines.node` field. *(Future: will also suggest updates to `packageManager` field based on common npm versions bundled with Node.js releases).*
* **Advanced Dependency Management:**

  * **Comprehensive Scanning:** Performs a deep scan of your dependencies, starting with `package.json` and `package-lock.json`, then enriching this data by crawling `node_modules` to inspect the actual `package.json` of each installed package.
  * **Interactive Updates & Health Indicators:** Presents your dependencies with clear visual health indicators (Green, Yellow, Orange, Red) based on how up-to-date they are and their release history.
  * **Node.js Aware Filtering:** Filters available dependency updates, showing only versions compatible with your project's calculated Node.js range.
  * **"Update All to Highest Supported" Option:** Provides a convenient way to attempt updating multiple outdated dependencies to their latest versions that are still compatible with your project's Node.js environment.
  * **Node.js Versioning Outlier Detection:** Identifies specific dependencies whose `engines.node` requirements are significantly restricting your project's overall Node.js compatibility (e.g., preventing an upgrade to a newer Node LTS).
* **Intelligent Dependency Alternatives (Experimental):**

  * **Suggestion Engine:** Suggests alternative libraries for packages that might be outdated, known to have security issues, or could be consolidated by other packages. *(Currently uses mock data for suggestions, future versions will integrate with curated databases or more advanced analysis).*
  * **Interactive Replacement Workflow:** Allows you to review and select suggested alternatives. If chosen, PACKMAN automates the uninstallation of the old package and installation of the new one, including updating `package.json`.
* **Complex Project Architectures:**

  * **Monorepo & Multi-Package Support:** Automatically discovers and processes NodeJS sub-projects within a larger repository. Each discovered project (root and sub-projects) undergoes isolated analysis and update cycles.
* **Safe Operations:**

  * **Rollback Mechanisms:** For dependency version updates and package replacements, PACKMAN backs up `package.json` and `package-lock.json` before executing `npm` commands. If an operation fails, it automatically restores these files to their previous state to minimize disruption.

## Installation

PACKMAN is intended to be used as a command-line tool.

**Global Installation (Recommended for general use - once published to npm):**

```bash
npm install -g packman
```

**Local Development/Testing:**

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/packman.git
   ```

   *(Replace with the actual repository URL)*
2. Navigate to the project directory:

   ```bash
   cd packman
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Link the package to make the `packman` command available locally:

   ```bash
   npm link
   ```

## Usage

Navigate to your NodeJS project's root directory and run:

```bash
packman
```

Or, to analyze a specific project (including monorepos where you want to start from the root):

```bash
packman /path/to/your-project
```

PACKMAN is an interactive tool. It will guide you through a series of prompts to analyze your project and apply changes.

**Typical Workflow:**

1. **Project Selection (if sub-projects detected):** PACKMAN will list the root project and any discovered sub-projects, asking if you want to process them all.
2. **For each project:**
   * **Node.js Compatibility:** PACKMAN analyzes `engines.node` from `package.json` and all dependencies to calculate the effective supported Node.js range. It then suggests compatible LTS versions for potential upgrade and can update your `package.json`'s `engines.node` field.
   * **Node.js Outlier Detection:** Highlights any dependencies significantly restricting this Node.js range.
   * **Dependency Management Action:** You'll be asked to choose an action:
     * Review and update individual dependencies.
     * Attempt to update all outdated dependencies to their highest supported versions.
     * Skip dependency management for the current project.
   * **Dependency Type Selection:** Choose which types of dependencies to analyze (Production, Development, Optional).
   * **Review & Action:**
     * Dependencies are listed with health indicators, version information, update availability (filtered by Node.js compatibility), and any alternative suggestions or outlier tags.
     * **Individual Mode:** Select specific packages to update their version or review alternatives.
     * **Update All Mode:** Review a list of proposed updates to the highest compatible versions and confirm.
   * **Confirmation & Execution:** Before any changes are made (version updates or package replacements), PACKMAN shows a summary and asks for final confirmation. If confirmed, it runs the necessary `npm` commands.
   * **Results & Rollback:** Reports success or failure for each operation. If an `npm` command fails, changes to `package.json` and `package-lock.json` for that specific operation are automatically rolled back.
3. **Overall Summary:** After processing all selected projects, PACKMAN displays a summary of actions taken and errors encountered for each project.

**Example CLI Interaction (Conceptual):**

```
PACKMAN - NodeJS Project Modernizer

=== Processing Project: /path/to/your-project ===

--- Node.js Compatibility Analysis ---
Current 'engines.node': >=16.0.0
Project Node Range: Min 18.0.0, Max 20.9.0, Recommended: >=18.0.0 <=20.9.0
Current Node.js: v16.10.0
[?] Recommended Node.js versions based on project compatibility: (Use arrow keys)
  > Target Node.js 18.19.1 (LTS) and update 'engines' field
    Target Node.js 20.10.0 (LTS) and update 'engines' field
    Do not update Node.js settings now
...

--- Dependency Management ---
[?] Action for your-project: (Use arrow keys)
  > Review and update individual dependencies
    Attempt to update all outdated dependencies to their highest compatible versions
    Skip dependency management for this project
[?] Dependency types to include: (Press <space> to select, <a> to toggle all, <i> to invert selection)
  ◉ Production
  ◉ Development
  ○ Optional
...

[RED] old-package: 1.0.0 (latest 3.5.0) -> Updatable to: 2.0.0 (Node compatible) [NODE OUTLIER: Limits max Node to 16.x] [ALT SUGGESTED]
[YEL] another-dep: 2.1.0 (latest 2.2.5) -> Updatable to: 2.2.5 (Node compatible)
[GRN] modern-dep: 5.0.1 (latest 5.0.1)
...
[?] Choose packages to inspect for updates or alternatives: (Press <space> to select, <a> to toggle all, <i> to invert selection)
  ◉ [RED] old-package: 1.0.0 ...
  ○ [YEL] another-dep: 2.1.0 ...
...
[?] Package old-package has suggested alternatives. Review them? (Y/n)
[?] Alternatives for old-package:
  > Replace with new-shiny-lib (latest) - Reason: Actively maintained, better features.
    Do not replace this package
...
```

## Contributing

Contributions are welcome! Please refer to `CONTRIBUTING.md` (once created) for guidelines on how to contribute to PACKMAN.

## License

This project is licensed under the **MIT License**.
