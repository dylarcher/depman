const semver = require('semver');
const fs = require('fs'); // Import fs for mocking
const nodeEnv = require('../src/lib/node-env');

// Destructure all functions from nodeEnv for easier access
const {
  calculateSupportedNodeVersions,
  getCurrentNodeVersion,
  KNOWN_LTS_VERSIONS,
  getAvailableUpgradeOptions,
  updatePackageJsonEngines,
  generateTestNodeVersions,
  getProjectNodeVersionConstraint,
  // getDependencyNodeVersionConstraints, // Original mock source
  getDependencyNodeVersionConstraintsFromEnriched, // New one used by identifyNodeOutliers
  getNodeCompatibilityRange,
  identifyNodeOutliers, // The function to test
} = nodeEnv;

jest.mock('fs'); // Mock fs for functions that use it (like updatePackageJsonEngines, getProjectNodeVersionConstraint)

describe('node-env.js', () => {

  // ... (existing test suites for other functions like calculateSupportedNodeVersions, etc.)
  // For brevity, assuming they are present and correct as per previous steps.
  // We'll focus on adding the new test suite for identifyNodeOutliers.

  describe('calculateSupportedNodeVersions', () => {
    // Minimal placeholder, assuming full tests exist elsewhere
    it('should return a value', () => {
        jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(['16.0.0', '18.0.0']);
        expect(calculateSupportedNodeVersions(['>=16.0.0'])).not.toBeNull();
    });
  });

  describe('getProjectNodeVersionConstraint', () => {
    it('should read project constraint', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify({engines: {node: '>=16'}}));
        expect(getProjectNodeVersionConstraint('/fake')).toBe('>=16');
    });
  });


  describe('identifyNodeOutliers', () => {
    let mockEnrichedDependencies;
    let projectNodeRange;
    let rootConstraint;
    let calculateSupportedNodeVersionsSpy;

    beforeEach(() => {
      // Reset mocks
      calculateSupportedNodeVersionsSpy = jest.spyOn(nodeEnv, 'calculateSupportedNodeVersions');

      mockEnrichedDependencies = {
        '/': { name: 'root', version: '1.0.0', isRoot: true, installedPackageJson: { name: 'root', version: '1.0.0', engines: { node: '>=16.0.0 <=20.0.0' } }, engines: { node: '>=16.0.0 <=20.0.0' } },
        'depA': { name: 'depA', version: '1.0.0', path: 'depA', isRoot: false, installedPackageJson: { name: 'depA', engines: { node: '>=16.0.0 <=18.0.0' } }, engines: { node: '>=16.0.0 <=18.0.0' } }, // Outlier (limits max)
        'depB': { name: 'depB', version: '1.0.0', path: 'depB', isRoot: false, installedPackageJson: { name: 'depB', engines: { node: '>=16.0.0 <=20.0.0' } }, engines: { node: '>=16.0.0 <=20.0.0' } }, // Conforms
        'depC': { name: 'depC', version: '1.0.0', path: 'depC', isRoot: false, installedPackageJson: { name: 'depC', engines: { node: '>=18.0.0 <=20.0.0' } }, engines: { node: '>=18.0.0 <=20.0.0' } }, // Outlier (limits min)
        'depD_noEngine': { name: 'depD_noEngine', version: '1.0.0', path: 'depD_noEngine', isRoot: false, installedPackageJson: { name: 'depD_noEngine' }, engines: null }, // No engine specified
      };
      rootConstraint = '>=16.0.0 <=20.0.0'; // From root project's package.json
      projectNodeRange = { min: '18.0.0', max: '18.0.0', range: '18.0.0' }; // Calculated with all deps
    });

    afterEach(() => {
      calculateSupportedNodeVersionsSpy.mockRestore();
    });

    it('should identify a dependency that limits the max Node version', () => {
      // Simulate that without depA (max <=18), the range would be wider (e.g., max <=20)
      calculateSupportedNodeVersionsSpy.mockImplementation((constraints) => {
        // If depA's constraint (<=18) is NOT in constraints, simulate a wider range
        if (!constraints.includes('>=16.0.0 <=18.0.0')) {
          return { min: '16.0.0', max: '20.0.0', range: '>=16.0.0 <=20.0.0' }; // Wider max
        }
        return { min: '18.0.0', max: '18.0.0', range: '18.0.0' }; // Original project range with depA
      });

      // Recalculate projectNodeRange based on the specific mock for this test
      const currentConstraints = [rootConstraint];
      Object.values(mockEnrichedDependencies).forEach(dep => {
          if (!dep.isRoot && dep.engines?.node) currentConstraints.push(dep.engines.node);
      });
      projectNodeRange = calculateSupportedNodeVersions(currentConstraints); // Should be 18.0.0 - 18.0.0


      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
      const outlierA = outliers.find(o => o.packageName === 'depA');
      expect(outlierA).toBeDefined();
      expect(outlierA.impact).toContain('Allows newer Node.js'); // Because without it, max becomes 20.0.0
      expect(outlierA.rangeWithoutOutlier.max).toBe('20.0.0');
    });

    it('should identify a dependency that limits the min Node version', () => {
      // Simulate that without depC (min >=18), the range would be wider (e.g., min >=16)
      calculateSupportedNodeVersionsSpy.mockImplementation((constraints) => {
        if (!constraints.includes('>=18.0.0 <=20.0.0')) { // If depC's constraint is NOT present
          return { min: '16.0.0', max: '20.0.0', range: '>=16.0.0 <=20.0.0' }; // Wider min
        }
        return { min: '18.0.0', max: '18.0.0', range: '18.0.0' }; // Original project range with depC
      });

      const currentConstraints = [rootConstraint];
      Object.values(mockEnrichedDependencies).forEach(dep => {
          if (!dep.isRoot && dep.engines?.node) currentConstraints.push(dep.engines.node);
      });
      projectNodeRange = calculateSupportedNodeVersions(currentConstraints); // Should be 18.0.0 - 18.0.0

      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
      const outlierC = outliers.find(o => o.packageName === 'depC');
      expect(outlierC).toBeDefined();
      expect(outlierC.impact).toContain('Allows older Node.js'); // Because without it, min becomes 16.0.0
      expect(outlierC.rangeWithoutOutlier.min).toBe('16.0.0');
    });

    it('should return empty array if no outliers are found', () => {
        // All deps conform to a range that's already tight
        mockEnrichedDependencies['depA'].engines.node = '>=18.0.0 <=18.0.0';
        mockEnrichedDependencies['depB'].engines.node = '>=18.0.0 <=18.0.0';
        mockEnrichedDependencies['depC'].engines.node = '>=18.0.0 <=18.0.0';
        rootConstraint = '>=18.0.0 <=18.0.0';
        projectNodeRange = { min: '18.0.0', max: '18.0.0', range: '18.0.0' };

        calculateSupportedNodeVersionsSpy.mockReturnValue(projectNodeRange); // Removing any still results in the same range

        const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
        expect(outliers.length).toBe(0);
    });

    it('should handle cases where removing a dep makes the range invalid/wider (e.g. it was the only constraint)', () => {
        mockEnrichedDependencies = {
            '/': { name: 'root', version: '1.0.0', isRoot: true, installedPackageJson: { name: 'root', version: '1.0.0' }, engines: null }, // No root constraint
            'depA': { name: 'depA', version: '1.0.0', path: 'depA', isRoot: false, installedPackageJson: { name: 'depA', engines: { node: '>=16.0.0 <=18.0.0' } }, engines: { node: '>=16.0.0 <=18.0.0' } },
        };
        rootConstraint = null;
        projectNodeRange = { min: '16.0.0', max: '18.0.0', range: '>=16.0.0 <=18.0.0' }; // Only depA defines the range

        calculateSupportedNodeVersionsSpy.mockImplementation((constraints) => {
            if (constraints.includes('>=16.0.0 <=18.0.0')) { // With depA
                return projectNodeRange;
            }
            return { min: null, max: null, range: null }; // Without depA, no constraints, so effectively {min:null, max:null} from calculateSupportedNodeVersions
        });

        const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
        expect(outliers.length).toBe(1);
        expect(outliers[0].packageName).toBe('depA');
        expect(outliers[0].impact).toContain('Was essential for establishing any valid project Node.js range');
    });


    it('should not identify a non-restrictive dependency as an outlier', () => {
        // depB is not restrictive, project range is set by depA and depC
        calculateSupportedNodeVersionsSpy.mockImplementation((constraints) => {
            // If depB's constraint is removed, the range should remain the same (18-18)
            if (!constraints.includes('>=16.0.0 <=20.0.0')) { // depB's constraint
                 return { min: '18.0.0', max: '18.0.0', range: '18.0.0' };
            }
            // If depA is removed
            if (!constraints.includes('>=16.0.0 <=18.0.0')) {
                return { min: '18.0.0', max: '20.0.0', range: '>=18.0.0 <=20.0.0' }; // depC and depB define this
            }
            // If depC is removed
            if (!constraints.includes('>=18.0.0 <=20.0.0')) {
                 return { min: '16.0.0', max: '18.0.0', range: '>=16.0.0 <=18.0.0' };// depA and depB define this
            }
            return { min: '18.0.0', max: '18.0.0', range: '18.0.0' }; // Original project range
        });

        const currentConstraints = [rootConstraint]; // >=16 <=20
        Object.values(mockEnrichedDependencies).forEach(dep => {
            if (!dep.isRoot && dep.engines?.node) currentConstraints.push(dep.engines.node);
        });
        // depA: >=16 <=18
        // depB: >=16 <=20
        // depC: >=18 <=20
        // Overall intersection: min is max(16,16,18) = 18. max is min(20,18,20,20) = 18. So range is 18.0.0.
        projectNodeRange = calculateSupportedNodeVersions(currentConstraints);


        const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
        const outlierB = outliers.find(o => o.packageName === 'depB');
        expect(outlierB).toBeUndefined();
    });

  });

});
