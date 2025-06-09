# CodeQL Setup Instructions

## Overview

This repository includes a comprehensive CodeQL workflow for automated security
analysis. To enable the full functionality, you need to enable Code Scanning in
your GitHub repository settings.

## Enable Code Scanning

1. **Navigate to Repository Settings**
   - Go to your repository on GitHub
   - Click on the "Settings" tab
   - Select "Security & Analysis" from the sidebar

2. **Enable Code Scanning Alerts**
   - Find the "Code scanning alerts" section
   - Click "Enable" to turn on code scanning
   - This will allow CodeQL to upload SARIF results and create security alerts

3. **Configure Branch Protection (Optional)**
   - Go to Settings → Branches
   - Add a branch protection rule for `main`/`master`
   - Enable "Require status checks to pass before merging"
   - Select the CodeQL analysis checks

## Workflow Features

### Pull Request Analysis

- Runs on every pull request
- Provides security analysis without blocking merges
- Uses unique categories to prevent SARIF upload conflicts

### Main Branch Scanning

- Comprehensive security analysis on pushes to main/master
- Automatic fix suggestions via CodeQL autofix
- Scheduled weekly scans for proactive security monitoring

### Query Configuration

- Uses `security-extended` and `security-and-quality` query suites
- Focuses on real security vulnerabilities
- Excludes common development-time issues like unused variables

## Troubleshooting

### Common Issues

1. **"Code Scanning not enabled" warnings**
   - Solution: Follow the "Enable Code Scanning" steps above

2. **SARIF upload conflicts**
   - Fixed: Categories now include `github.run_id` for uniqueness

3. **Query pack reference errors**
   - Fixed: Using built-in query suites instead of specific packs

### Manual Testing

You can test the workflow locally by running:

```bash
npm run lint    # Validate YAML syntax
npm run build   # Ensure project builds correctly
npm test        # Run all tests
```

## Security Features

The CodeQL configuration is designed to catch:

- Insecure randomness usage
- Cross-site scripting (XSS) vulnerabilities
- SQL injection possibilities
- Authentication and authorization issues
- Crypto and hashing problems
- File system security issues

## Next Steps

1. Enable Code Scanning in repository settings
2. Create a test pull request to verify the workflow
3. Review any security alerts that are generated
4. Consider adding branch protection rules

For more information, see the
[GitHub Code Scanning
documentation](<https://docs.github.com/en/code-security/co>
de-scanning).
