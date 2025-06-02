# Contributing to depman

First off, thank you for considering contributing to `depman`! We're excited to have you join our community. Your contributions help make `depman` a better tool for everyone.

This document provides guidelines for contributing to `depman`. Please read it carefully to ensure a smooth and effective contribution process.

## Table of Contents

* Code of Conduct
* How Can I Contribute?
  * Reporting Bugs
  * Suggesting Enhancements
  * Your First Code Contribution
  * Pull Requests
* Getting Started
  * Prerequisites
  * Fork & Clone
  * Installation
* Development Process
  * Branching
  * Making Changes
  * Running Tests
  * Linting and Formatting
  * Commit Messages
* Style Guides
* Questions?

## Code of Conduct

This project and everyone participating in it is governed by the depman Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior as specified in the Code of Conduct.

## How Can I Contribute?

### Reporting Bugs

If you encounter a bug, please help us by reporting it!

* **Check existing issues:** Before creating a new issue, please check if the bug has already been reported on the GitHub Issues page.
* **Provide details:** If it's a new bug, create a new issue. Be sure to include:
  * A clear and descriptive title.
  * Steps to reproduce the bug.
  * What you expected to happen.
  * What actually happened (including any error messages and stack traces).
  * Your environment (OS, Node.js version, pnpm version, `depman` version if applicable).

### Suggesting Enhancements

We welcome suggestions for new features or improvements to existing functionality.

* **Check existing issues/discussions:** Your idea might already be under discussion.
* **Create an issue:** If not, please open a new issue on GitHub, clearly outlining your suggestion:
  * A clear and descriptive title.
  * A detailed description of the proposed enhancement and why it would be beneficial.
  * Any potential drawbacks or alternative solutions.

### Your First Code Contribution

Unsure where to begin contributing to `depman`?

* Look for issues tagged `good first issue` or `help wanted`.
* Start with something small, like fixing a typo, improving documentation, or tackling a simple bug. This will help you get familiar with the codebase and contribution process.

### Pull Requests

When you're ready to contribute code:

1. Ensure your contribution aligns with the project's goals and the issue it addresses (if any).
2. Follow the Getting Started and Development Process sections below.
3. Make sure your code adheres to the Style Guides.
4. Ensure all tests pass.
5. Submit a pull request (PR) with a clear title and a detailed description of your changes. Link any relevant issues.

## Getting Started

### Prerequisites

* **Node.js:** `depman` requires Node.js version `^22.16.0` or later. You can check your version with `node -v`. We recommend using a Node version manager like nvm or fnm.
* **pnpm:** This project uses `pnpm` as its package manager. The required version is `^8.6.0`. If you don't have `pnpm` installed, follow the official pnpm installation guide. The project's `package.json` specifies `pnpm` via the `packageManager` field, which should help ensure you're using the correct version if you have Corepack enabled (`corepack enable`).

### Fork & Clone

1. Fork the repository `https://github.com/dylarcher/depman` to your own GitHub account.
2. Clone your fork locally:

    ```bash
    git clone https://github.com/YOUR_USERNAME/depman.git
    cd depman
    ```

3. Add the original repository as an upstream remote:

    ```bash
    git remote add upstream https://github.com/dylarcher/depman.git
    ```

### Installation

Install project dependencies using `pnpm`:

```bash
pnpm install
```

This will install dependencies for the root project and all packages within the `packages/` and `apps/` directories.

## Development Process

### Branching

Create a new branch for each feature or bug fix you work on. Base your branch off the `main` branch (or the relevant development branch if specified by maintainers).

```bash
git checkout main
git pull upstream main # Keep your main branch up-to-date
git checkout -b your-feature-or-bugfix-branch-name
```

### Making Changes

* Write clean, understandable, and maintainable code.
* If you're adding a new feature, consider adding tests for it.
* If you're fixing a bug, try to write a test that reproduces the bug before you fix it.
* Update documentation if your changes affect user-facing features or APIs.

### Running Tests

`depman` is a monorepo. Tests are typically run within individual packages. For example, to run tests in `@dad/corelib`:

```bash
pnpm --filter @dad/corelib test
```

Or navigate to the package directory and run its test script:

```bash
cd packages/corelib
pnpm test
```

Please ensure all relevant tests pass before submitting a pull request. The root `package.json` currently has a placeholder test script; contributions to improve project-wide testing are welcome!

### Linting and Formatting

This project uses ESLint for linting and Prettier for code formatting. Configuration files (`.eslintrc.js`, `.prettierrc.js`) are in the root directory.

It's recommended to set up your editor to automatically format code on save using Prettier and highlight ESLint issues. You can also run these tools manually:

```bash
# To lint (example, may need a root script or per-package script)
# pnpm lint

# To format (example, may need a root script or per-package script)
# pnpm format
```

*(Maintainers: Consider adding root `lint` and `format` scripts to the main `package.json`)*

### Commit Messages

Please write clear and concise commit messages. We encourage following the Conventional Commits specification. This helps in generating changelogs and understanding the history of changes.

Example: `feat: add user authentication endpoint` or `fix: resolve issue with dependency parsing`

## Style Guides

* Follow the coding style enforced by ESLint and Prettier.
* For Markdown files, try to keep lines under 120 characters where feasible.

## Questions?

If you have any questions, feel free to open an issue on GitHub or reach out to the maintainers.

Thank you for contributing!

---

**Key things this `CONTRIBUTING.md` includes:**

* **Link to Code of Conduct:** Prominently displayed.
* **Clear ways to contribute:** Bug reports, feature suggestions, and pull requests.
* **Getting Started Guide:**
  * Specifies Node.js and `pnpm` versions from your `package.json`.
  * Instructions for forking, cloning, and installing dependencies with `pnpm`.
* **Development Process:**
  * Basic branching strategy.
  * Guidance on making changes and writing tests (mentioning `vitest` implicitly through package test scripts).
  * Notes on linting/formatting (referencing your root `.eslintrc.js` and `.prettierrc.js`).
  * Recommendation for Conventional Commits.
* **Monorepo considerations:** Mentions running tests per package.
* **Placeholders/Suggestions for Maintainers:** Notes where you might want to add root scripts for linting/formatting or improve project-wide testing.

**Next Steps:**

1. **Create the file:** Add a new file named `CONTRIBUTING.md` to the root of your `depman` repository.
2. **Paste the content:** Copy the markdown content above into this new file.
3. **Review and Customize:** Read through it and make any adjustments specific to your project's workflow if needed (e.g., specific branch names, more detailed testing instructions if you have them).
4. **Add Root Scripts (Optional but Recommended):**
    Consider adding `lint` and `format` scripts to your root `package.json` for easier developer experience. For example:

      ```json
      // In your root package.json
      "scripts": {
        // ... other scripts
        "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
        "format": "prettier --write .",
        "test": "pnpm -r test" // Example to run tests in all packages
      },
      ```

5. **Commit and Push:** Save the file, commit it, and push it to your GitHub repository.

GitHub will automatically link to this file in various places (e.g., when someone creates an issue or pull request) making it highly visible to potential contributors.
