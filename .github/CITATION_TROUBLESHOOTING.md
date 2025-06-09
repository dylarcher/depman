# GitHub Citation Setup - Troubleshooting Guide

## Current Status ✅

Your repository now has a properly structured `CITATION.cff` file in the root
directory with all required fields:

- ✅ **CFF Version**: 1.2.0 (latest standard)
- ✅ **Required Fields**: All present (cff-version, message, type, title,
authors)
- ✅ **File Location**: `/CITATION.cff` (root directory - correct)
- ✅ **File Format**: Valid YAML structure
- ✅ **Author Information**: Complete with given/family names and email

## Why GitHub Might Not Show "Cite this repository" Button Yet

### 1. **Repository Visibility**

- **Issue**: Citation features are primarily available for **public
repositories**
- **Check**: Ensure your repository is public in Settings → General → Repository
visibility

### 2. **GitHub Processing Time**

- **Issue**: GitHub may take time to detect and process the CITATION.cff file
- **Timeline**: Can take minutes to hours after pushing changes
- **Solution**: Wait and check again later

### 3. **Browser Cache**

- **Issue**: Your browser might be showing cached version of the GitHub page
- **Solution**: Hard refresh (Ctrl+F5 / Cmd+Shift+R) or open in incognito mode

### 4. **Repository Activity**

- **Issue**: GitHub may require some repository activity before enabling
features
- **Solution**: Ensure you have commits, issues, or releases

## How to Verify Citation Setup

### 1. **Check File Existence**

Visit:
`https://github.com/dylarcher/git.starter-template/blob/main/CITATION.cff`

### 2. **Look for "Cite this repository" Button**

- Should appear on the right sidebar of your repository's main page
- Located near the "About" section and below the repository stats

### 3. **Alternative Access**

If button doesn't appear, you can still access citations via:

- Repository → Insights → Community → Citation (if available)

## Manual Citation Information

Until GitHub processes the file, users can manually cite using:

### APA Format

```plaintext
Archer, D. (2025). git.starter-template: A github starter template for creating
a new repository with a set of predefined structures, documents and
configurations (Version 0.1.0) [Computer software].
https://github.com/dylarcher/git.starter-template
```

### BibTeX Format

```bibtex
@software{git_starter_template,
  author       = {Archer, Dylan},
  title        = {git.starter-template: A github starter template for creating
                  a new repository with a set of predefined structures,
                  documents and configurations},
  version      = {0.1.0},
  year         = {2025},
  month        = {6},
  publisher    = {GitHub},
  url          = {https://github.com/dylarcher/git.starter-template}
}
```

## Next Steps

1. **Push Changes**: Ensure the CITATION.cff file is committed and pushed to
   GitHub
2. **Wait**: Allow GitHub time to process the file (up to 24 hours)
3. **Check Repository Settings**: Verify repository is public
4. **Test**: Try accessing the repository from different browsers/devices
5. **Verify**: Look for the "Cite this repository" button on the main page

## Additional Resources

-

[GitHub Citation
Documentation](<https://docs.github.com/en/repositories/managing>
-your-repositorys-settings-and-features/customizing-your-repository/about-citati
on-files)

- [Citation File Format Specification](https://citation-file-format.github.io/)
- [CFF Validation Tool](https://cff-validator.netlify.app/)

---

**Note**: The citation functionality depends on GitHub's backend processing.
Even with a perfect CITATION.cff file, the button may take time to appear.
