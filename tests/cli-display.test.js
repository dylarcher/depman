import { test, describe } from 'node:test';
import assert from 'node:assert';
import chalk from 'chalk';
import { formatDependencyChoice, filterDependenciesByType, getHealthIndicator } from '../src/lib/cli-display.js';

// Disable chalk coloring for snapshot consistency in tests
chalk.level = 0;

describe('cli-display.js', () => {
  describe('getHealthIndicator', () => {
    // ... existing tests ...
    test('should return correct strings for health statuses', () => {
        assert.strictEqual(getHealthIndicator('Green'), '[GREEN]');
    });
  });

  describe('formatDependencyChoice', () => {
    const mockDepInfoBase = {
      name: 'pkg-a',
      installedVersion: '1.0.0',
      latestVersion: '1.1.0',
      availableUpdates: ['1.1.0', '1.0.1'],
      health: 'Yellow',
      releaseDateInstalled: '2023-01-01T00:00:00.000Z',
      releaseDateLatest: '2023-02-01T00:00:00.000Z',
      nodeCompatibilityMessage: null,
      alternatives: [], // Default to no alternatives
    };
    const mockEnrichedDepBase = {
      name: 'pkg-a', version: '1.0.0', path: 'node_modules/pkg-a',
      isDev: false, isOptional: false, isRoot: false,
      engines: { node: '>=14' },
      installedPackageJson: { name: 'pkg-a', version: '1.0.0', engines: { node: '>=14' } },
      license: 'MIT', dependencies: {}, optionalDependencies: {}
    };

    test('should format a basic dependency choice correctly', () => {
      const choice = formatDependencyChoice(mockDepInfoBase, mockEnrichedDepBase, undefined);
      assert.ok(choice.includes('[YELLOW] pkg-a: 1.0.0'));
      assert.ok(choice.includes('(latest 1.1.0)'));
      assert.ok(choice.includes('-> Updatable to: 1.1.0, 1.0.1'));
      assert.ok(!choice.includes('[ALT SUGGESTED]'));
    });

    test('should include [ALT SUGGESTED] tag if alternatives are present', () => {
      const depInfoWithAlts = {
        ...mockDepInfoBase,
        alternatives: [{ name: 'alt-pkg', reason: 'test' }]
      };
      const choice = formatDependencyChoice(depInfoWithAlts, mockEnrichedDepBase, undefined);
      assert.ok(choice.includes('[ALT SUGGESTED]'));
    });

    test('should still show other info like outlier even if alternatives are present', () => {
      const depInfoWithAlts = {
        ...mockDepInfoBase,
        alternatives: [{ name: 'alt-pkg', reason: 'test' }]
      };
      const outlierInfo = {
        packageName: 'pkg-a', packageVersion: '1.0.0', packageNodeConstraint: '<=16',
        impact: 'Limits max Node to 16.x.x', rangeWithoutOutlier: { min: '14', max: '18', range: ''}
      };
      const choice = formatDependencyChoice(depInfoWithAlts, mockEnrichedDepBase, outlierInfo);
      assert.ok(choice.includes('[ALT SUGGESTED]'));
      assert.ok(choice.includes('[NODE OUTLIER]'));
      assert.ok(choice.includes('(Limits max Node to 16.x.x)'));
    });

    // ... other existing tests for formatDependencyChoice, nodeCompatibilityMessage, outlierInfo etc. ...
     test('should include outlier information if present', () => {
      const outlierInfo = {
        packageName: 'pkg-a', packageVersion: '1.0.0', packageNodeConstraint: '<=16',
        impact: 'Limits max Node to 16.x.x', rangeWithoutOutlier: { min: '14', max: '18', range: ''}
      };
      const choice = formatDependencyChoice(mockDepInfoBase, mockEnrichedDepBase, outlierInfo);
      assert.ok(choice.includes('[NODE OUTLIER]'));
      assert.ok(choice.includes('(Limits max Node to 16.x.x)'));
    });
  });

  describe('filterDependenciesByType', () => {
    // ... existing tests ...
     const enrichedDeps = {
      'node_modules/prod-a': { name: 'prod-a', isDev: false, isOptional: false, isRoot: false },
      '/': { name: 'root', isRoot: true },
    };
    test('should filter for production dependencies', () => {
      const filtered = filterDependenciesByType(enrichedDeps, ['dependencies']);
      assert.deepStrictEqual(Object.keys(filtered), ['node_modules/prod-a']);
    });
  });
});
