import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import semver from 'semver'; // Keep semver import
// fs is now mocked globally
import nodeEnv from '../src/lib/node-env.js'; // Ensure .js extension if using ES modules

import { KNOWN_LTS_VERSIONS, getAvailableUpgradeOptions, updatePackageJsonEngines, identifyNodeOutliers } from '../src/lib/node-env.js';

const {
  calculateSupportedNodeVersions,
  // getCurrentNodeVersion,
  // generateTestNodeVersions, // Now mocked where needed or original used
  getProjectNodeVersionConstraint,
  // getDependencyNodeVersionConstraintsFromEnriched,
  // getNodeCompatibilityRange,
} = nodeEnv; // nodeEnv already imported, so we can destructure more from it.

// Mock 'fs' module (already defined from previous step)
const fsMock = {
  existsSync: mock.fn(() => true),
  readFileSync: mock.fn(() => JSON.stringify({})),
  writeFileSync: mock.fn(() => {}),
};
mock.module('fs', () => fsMock);


describe('node-env.js', () => {
  const originalGenerateTestNodeVersions = nodeEnv.generateTestNodeVersions; // Keep for reference if needed

  beforeEach(() => {
    fsMock.existsSync.mock.resetCalls();
    fsMock.readFileSync.mock.resetCalls();
    fsMock.writeFileSync.mock.resetCalls();
    // No direct equivalent for jest.isMockFunction, if generateTestNodeVersions is mocked using mock.method,
    // it will be automatically restored if `times` is specified.
    // If it's globally mocked via mock.module, then you'd manage its behavior differently or per-test.
  });

  afterEach(() => {
    // mock.reset() would reset all mocks, which might be too broad.
    // Individual mock functions are typically reset in beforeEach or specific mocks restored.
    // `mock.method` with `times` option handles its own restoration.
  });

  describe('calculateSupportedNodeVersions', () => {
    const ensureTestVersionsInclude = (versions) => {
        const currentTestVersions = originalGenerateTestNodeVersions(); // Assuming this original is not a mock
        const combined = new Set([...currentTestVersions, ...versions]);
        return [...combined].sort(semver.compare);
    };

    test('should return min, max, and range for simple overlap', () => {
      const constraints = ['>=18.0.0', '<=18.19.1'];
      mock.method(nodeEnv, 'generateTestNodeVersions', () =>
        ensureTestVersionsInclude(['18.0.0', '18.10.0', '18.19.1', '20.0.0']),
        { times: 1 }
      );
      const result = calculateSupportedNodeVersions(constraints);
      assert.strictEqual(result.min, '18.0.0');
      assert.strictEqual(result.max, '18.19.1');
      assert.strictEqual(result.range, '>=18.0.0 <=18.19.1');
    });

    test('should return null for no overlap', () => {
      const constraints = ['<16.0.0', '>18.0.0'];
      mock.method(nodeEnv, 'generateTestNodeVersions', () =>
        ensureTestVersionsInclude(['14.0.0', '15.0.0', '18.0.0', '19.0.0']),
        { times: 1 }
      );
      assert.strictEqual(calculateSupportedNodeVersions(constraints), null);
    });

    test('should handle complex overlapping ranges (carets, tildes)', () => {
      const constraints = ['^16.0.0', '~16.13.0', '<=16.15.0'];
      mock.method(nodeEnv, 'generateTestNodeVersions', () =>
        ensureTestVersionsInclude(['16.13.0', '16.13.1', '16.13.2', '16.14.0', '16.15.0']),
        { times: 1 }
      );
      const result = calculateSupportedNodeVersions(constraints);
      assert.strictEqual(result.min, '16.13.0');
      assert.strictEqual(result.max, '16.13.2');
      assert.strictEqual(result.range, '>=16.13.0 <=16.13.2');
    });

    test('should handle multiple conflicting constraints leading to no common range', () => {
      const constraints = ['^16.0.0', '^18.0.0'];
      mock.method(nodeEnv, 'generateTestNodeVersions', () =>
        ensureTestVersionsInclude(['16.0.0', '16.5.0', '17.0.0', '18.0.0']),
        { times: 1 }
      );
      assert.strictEqual(calculateSupportedNodeVersions(constraints), null);
    });

    test('should handle prerelease versions if present in test versions', () => {
        const constraints = ['>=18.0.0-alpha.1'];
        mock.method(nodeEnv, 'generateTestNodeVersions', () =>
            ensureTestVersionsInclude(['17.0.0', '18.0.0-alpha.1', '18.0.0']),
            { times: 1 }
        );
        const result = calculateSupportedNodeVersions(constraints);
        assert.strictEqual(result.min, '18.0.0-alpha.1');
    });

    test('should return {min: null, max: null, range: null} for empty or all invalid constraints', () => {
      assert.deepStrictEqual(calculateSupportedNodeVersions([]), { min: null, max: null, range: null });
      assert.deepStrictEqual(calculateSupportedNodeVersions(['invalid', '>']), { min: null, max: null, range: null });
    });
  });

  describe('getProjectNodeVersionConstraint', () => {
    beforeEach(() => { fsMock.existsSync.mock.resetCalls(); fsMock.readFileSync.mock.resetCalls(); });
    // Test already converted in previous step
    test('should read project constraint', () => {
        fsMock.readFileSync.mock.mockImplementationOnce(() => JSON.stringify({engines: {node: '>=16'}}), { times: 1 });
        assert.strictEqual(getProjectNodeVersionConstraint('/fake'), '>=16');
    });
  });

  describe('getAvailableUpgradeOptions', () => {
    // KNOWN_LTS_VERSIONS is imported directly, no need for _KNOWN_LTS_VERSIONS if not modified
    test('should show only LTS versions higher than current and within a tight supported range', () => {
      const currentNode = 'v16.18.0';
      const supportedRange = { min: '18.18.0', max: '18.19.1', range: '>=18.18.0 <=18.19.1' };
      const options = getAvailableUpgradeOptions(currentNode, supportedRange, KNOWN_LTS_VERSIONS);
      assert.deepStrictEqual(options, ['18.18.0', '18.19.1']);
    });

    test('should handle current version being a pre-release against stable LTS', () => {
        const currentNode = 'v20.0.0-beta.1';
        const supportedRange = {min: '18.0.0', max: '22.0.0', range: ">=18.0.0 <=22.0.0"};
        const options = getAvailableUpgradeOptions(currentNode, supportedRange, KNOWN_LTS_VERSIONS);
        const expectedSubset = ['20.9.0', '20.10.0', '20.11.0', '22.0.0'];
        assert.ok(expectedSubset.every(item => options.includes(item)), "Options should contain all expected subset items");
    });
  });

  describe('updatePackageJsonEngines', () => {
    test('should update existing engines.node', () => {
      fsMock.existsSync.mock.mockImplementationOnce(() => true); // Explicitly set for this test
      fsMock.readFileSync.mock.mockImplementationOnce(() => JSON.stringify({ name: 'test', engines: { node: '>=16.0.0' } }));
      updatePackageJsonEngines('/fake', '>=20.0.0');
      assert.strictEqual(fsMock.writeFileSync.mock.calls.length, 1);
      const writtenContent = JSON.parse(fsMock.writeFileSync.mock.calls[0].arguments[1]);
      assert.strictEqual(writtenContent.engines.node, '>=20.0.0');
    });
  });

  describe('identifyNodeOutliers', () => {
    let mockEnrichedDependencies;
    let projectNodeRange;
    let rootConstraint;
    const testNodeVersions = ['16.0.0', '17.0.0', '18.0.0', '18.9.9', '18.18.0', '19.0.0', '20.0.0', '22.0.0'].sort(semver.compare);

    // Apply mock for generateTestNodeVersions for all tests in this describe block
    beforeEach(() => {
      mock.method(nodeEnv, 'generateTestNodeVersions', () => testNodeVersions);

      rootConstraint = '>=16.0.0 <=22.0.0';
      mockEnrichedDependencies = {
        '/': { name: 'root', version: '1.0.0', isRoot: true, installedPackageJson: { name: 'root', engines: { node: rootConstraint } }, engines: { node: rootConstraint } },
        'depA_limits_max': { name: 'depA_limits_max', path:'depA', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depA_limits_max', engines: { node: '<=18.9.9' } }, engines: { node: '<=18.9.9' } },
        'depB_limits_min': { name: 'depB_limits_min', path:'depB', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depB_limits_min', engines: { node: '>=18.0.0' } }, engines: { node: '>=18.0.0' } },
        'depC_conforming': { name: 'depC_conforming', path:'depC', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depC_conforming', engines: { node: '>=16.0.0 <=20.0.0' } }, engines: { node: '>=16.0.0 <=20.0.0' } },
      };

      const allConstraintsForProject = [rootConstraint, '<=18.9.9', '>=18.0.0', '>=16.0.0 <=20.0.0'];
      projectNodeRange = calculateSupportedNodeVersions(allConstraintsForProject); // Uses the mocked generateTestNodeVersions
      assert.strictEqual(projectNodeRange.min, '18.0.0');
      assert.strictEqual(projectNodeRange.max, '18.9.9');
    });

    afterEach(() => {
      // Restore the original method if it was mocked with mock.method in beforeEach
      // This is important if the mock is not self-restoring (e.g. no `times` option or not per-test)
      // However, node:test's mock.method is designed to be reset for each test.
      // If issues arise, explicit restoration might be needed: mock.restore(nodeEnv, 'generateTestNodeVersions');
    });

    test('should identify depA as limiting max version', () => {
      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
      const outlierA = outliers.find(o => o.packageName === 'depA_limits_max');
      assert.ok(outlierA !== undefined, 'Outlier A should be defined');
      assert.ok(outlierA.impact.includes('Allows newer Node.js'));
      assert.strictEqual(outlierA.rangeWithoutOutlier.max, '20.0.0'); // Without depA (<=18.9.9), max becomes 20.0.0
    });

    test('should identify depB as limiting min version', () => {
      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
      const outlierB = outliers.find(o => o.packageName === 'depB_limits_min');
      assert.ok(outlierB !== undefined, 'Outlier B should be defined');
      assert.ok(outlierB.impact.includes('Allows older Node.js'));
      assert.strictEqual(outlierB.rangeWithoutOutlier.min, '16.0.0'); // Without depB (>=18), min becomes 16.0.0
    });

    test('should identify multiple outliers correctly', () => {
        const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint);
        assert.strictEqual(outliers.length, 2);
    });
  });
});
