const { fetchPackageInfo, fetchPackageAlternatives, _mockRegistry, _mockAlternativesDb } = require('../src/lib/registry-utils');

describe('registry-utils.js', () => {
  describe('fetchPackageInfo', () => {
    it('should return package info for a known package', async () => {
      const packageName = 'pkg-a';
      const result = await fetchPackageInfo(packageName);
      expect(result).toBeDefined();
      // The mock for pkg-a doesn't have a top-level 'name' field, it's implicit by the key in _mockRegistry
      expect(result.versions).toEqual(_mockRegistry[packageName].versions);
      expect(result['dist-tags'].latest).toBe('2.0.0');
    });

    it('should return a default structure for an unknown package', async () => {
      const packageName = 'unknown-pkg';
      const result = await fetchPackageInfo(packageName);
      expect(result).toBeDefined();
      expect(result.name).toBe(packageName); // Default structure includes the name
      expect(result.versions).toEqual({});
      expect(result.time).toEqual({});
      expect(result['dist-tags'].latest).toBeNull();
      expect(result.error).toBe('Not found in mock registry');
    });
  });

  describe('fetchPackageAlternatives', () => {
    it('should return alternatives for a known package with suggestions', async () => {
      const packageName = 'old-package-a';
      const result = await fetchPackageAlternatives(packageName, '0.5.0');
      expect(result).toEqual(_mockAlternativesDb[packageName]);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('new-package-x');
    });

    it('should return an empty array for a package without predefined alternatives', async () => {
      const packageName = 'pkg-a'; // This package is in _mockRegistry but not _mockAlternativesDb
      const result = await fetchPackageAlternatives(packageName, '1.0.0');
      expect(result).toEqual([]);
    });

    it('should return an empty array for an unknown package', async () => {
      const packageName = 'completely-unknown-package';
      const result = await fetchPackageAlternatives(packageName, '1.0.0');
      expect(result).toEqual([]);
    });

    it('should use packageVersion if logic dependent on it (though current mock does not)', async () => {
      // This test is more for future-proofing if the mock or real implementation uses packageVersion
      const packageName = 'old-package-a';
      const version = '0.5.0'; // Specific version
      const result = await fetchPackageAlternatives(packageName, version);
      // Current mock doesn't change output based on version, so this is same as above
      expect(result).toEqual(_mockAlternativesDb[packageName]);
    });
  });
});
