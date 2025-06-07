const semver = require('semver')
const fs = require('node:fs')
const nodeEnv = require('../src/lib/node-env')

const {
  calculateSupportedNodeVersions,
  getCurrentNodeVersion,
  KNOWN_LTS_VERSIONS,
  getAvailableUpgradeOptions,
  updatePackageJsonEngines,
  generateTestNodeVersions,
  getProjectNodeVersionConstraint,
  getDependencyNodeVersionConstraintsFromEnriched,
  getNodeCompatibilityRange,
  identifyNodeOutliers,
} = nodeEnv

jest.mock('fs')

describe('node-env.js', () => {
  const originalGenerateTestNodeVersions = nodeEnv.generateTestNodeVersions

  beforeEach(() => {
    fs.existsSync.mockReset()
    fs.readFileSync.mockReset()
    fs.writeFileSync.mockReset()
    // Restore generateTestNodeVersions to its original implementation before each test
    // This is important if any specific test suite or test case mocks it.
    if (jest.isMockFunction(nodeEnv.generateTestNodeVersions)) {
      nodeEnv.generateTestNodeVersions.mockImplementation(originalGenerateTestNodeVersions)
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('calculateSupportedNodeVersions', () => {
    const ensureTestVersionsInclude = (versions) => {
      // Use the actual originalGenerateTestNodeVersions from the module for a consistent base list
      const currentTestVersions = originalGenerateTestNodeVersions()
      const combined = new Set([...currentTestVersions, ...versions])
      return [...combined].sort(semver.compare)
    }

    it('should return min, max, and range for simple overlap', () => {
      const constraints = ['>=18.0.0', '<=18.19.1']
      // Temporarily mock generateTestNodeVersions for this specific test case
      const mockGenerateFn = jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(
        ensureTestVersionsInclude(['18.0.0', '18.10.0', '18.19.1', '20.0.0'])
      )
      const result = calculateSupportedNodeVersions(constraints)
      expect(result.min).toBe('18.0.0')
      expect(result.max).toBe('18.19.1')
      expect(result.range).toBe('>=18.0.0 <=18.19.1')
      mockGenerateFn.mockRestore()
    })

    it('should return null for no overlap', () => {
      const constraints = ['<16.0.0', '>18.0.0']
      const mockGenerateFn = jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(
        ensureTestVersionsInclude(['14.0.0', '15.0.0', '18.0.0', '19.0.0'])
      )
      expect(calculateSupportedNodeVersions(constraints)).toBeNull()
      mockGenerateFn.mockRestore()
    })

    it('should handle complex overlapping ranges (carets, tildes)', () => {
      const constraints = ['^16.0.0', '~16.13.0', '<=16.15.0']
      const mockGenerateFn = jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(
        ensureTestVersionsInclude(['16.13.0', '16.13.1', '16.13.2', '16.14.0', '16.15.0'])
      )
      const result = calculateSupportedNodeVersions(constraints)
      expect(result.min).toBe('16.13.0')
      expect(result.max).toBe('16.13.2')
      expect(result.range).toBe('>=16.13.0 <=16.13.2')
      mockGenerateFn.mockRestore()
    })

    it('should handle multiple conflicting constraints leading to no common range', () => {
      const constraints = ['^16.0.0', '^18.0.0']
      const mockGenerateFn = jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(
        ensureTestVersionsInclude(['16.0.0', '16.5.0', '17.0.0', '18.0.0'])
      )
      expect(calculateSupportedNodeVersions(constraints)).toBeNull()
      mockGenerateFn.mockRestore()
    })

    it('should handle prerelease versions if present in test versions', () => {
      const constraints = ['>=18.0.0-alpha.1']
      const mockGenerateFn = jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValueOnce(
        ensureTestVersionsInclude(['17.0.0', '18.0.0-alpha.1', '18.0.0'])
      )
      const result = calculateSupportedNodeVersions(constraints)
      expect(result.min).toBe('18.0.0-alpha.1')
      mockGenerateFn.mockRestore()
    })

    it('should return {min: null, max: null, range: null} for empty or all invalid constraints', () => {
      expect(calculateSupportedNodeVersions([])).toEqual({ min: null, max: null, range: null })
      expect(calculateSupportedNodeVersions(['invalid', '>'])).toEqual({ min: null, max: null, range: null })
    })
  })

  describe('getProjectNodeVersionConstraint', () => {
    beforeEach(() => { fs.existsSync.mockReset(); fs.readFileSync.mockReset() })
    // ... (Existing tests for getProjectNodeVersionConstraint from previous subtask) ...
    it('should read project constraint', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(JSON.stringify({ engines: { node: '>=16' } }))
      expect(getProjectNodeVersionConstraint('/fake')).toBe('>=16')
    })
  })

  describe('getAvailableUpgradeOptions', () => {
    const _KNOWN_LTS_VERSIONS = KNOWN_LTS_VERSIONS
    // ... (Existing tests for getAvailableUpgradeOptions from previous subtask) ...
    it('should show only LTS versions higher than current and within a tight supported range', () => {
      const currentNode = 'v16.18.0'
      const supportedRange = { min: '18.18.0', max: '18.19.1', range: '>=18.18.0 <=18.19.1' }
      const options = getAvailableUpgradeOptions(currentNode, supportedRange, _KNOWN_LTS_VERSIONS)
      expect(options).toEqual(['18.18.0', '18.19.1'])
    })
    it('should handle current version being a pre-release against stable LTS', () => {
      const currentNode = 'v20.0.0-beta.1'
      const supportedRange = { min: '18.0.0', max: '22.0.0', range: ">=18.0.0 <=22.0.0" }
      const options = getAvailableUpgradeOptions(currentNode, supportedRange, _KNOWN_LTS_VERSIONS)
      expect(options).toEqual(expect.arrayContaining(['20.9.0', '20.10.0', '20.11.0', '22.0.0']))
    })
  })

  describe('updatePackageJsonEngines', () => {
    // ... (Existing tests for updatePackageJsonEngines from previous subtask) ...
    it('should update existing engines.node', () => {
      fs.existsSync.mockReturnValue(true)
      fs.readFileSync.mockReturnValue(JSON.stringify({ name: 'test', engines: { node: '>=16.0.0' } }))
      updatePackageJsonEngines('/fake', '>=20.0.0')
      const writtenContent = JSON.parse(fs.writeFileSync.mock.calls[0][1])
      expect(writtenContent.engines.node).toBe('>=20.0.0')
    })
  })

  describe('identifyNodeOutliers', () => {
    let mockEnrichedDependencies
    let projectNodeRange
    let rootConstraint

    beforeEach(() => {
      jest.spyOn(nodeEnv, 'generateTestNodeVersions').mockReturnValue(
        ['16.0.0', '17.0.0', '18.0.0', '18.9.9', '18.18.0', '19.0.0', '20.0.0', '22.0.0'].sort(semver.compare)
      )

      rootConstraint = '>=16.0.0 <=22.0.0'
      mockEnrichedDependencies = {
        '/': { name: 'root', version: '1.0.0', isRoot: true, installedPackageJson: { name: 'root', engines: { node: rootConstraint } }, engines: { node: rootConstraint } },
        'depA_limits_max': { name: 'depA_limits_max', path: 'depA', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depA_limits_max', engines: { node: '<=18.9.9' } }, engines: { node: '<=18.9.9' } },
        'depB_limits_min': { name: 'depB_limits_min', path: 'depB', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depB_limits_min', engines: { node: '>=18.0.0' } }, engines: { node: '>=18.0.0' } },
        'depC_conforming': { name: 'depC_conforming', path: 'depC', version: '1.0.0', isRoot: false, installedPackageJson: { name: 'depC_conforming', engines: { node: '>=16.0.0 <=20.0.0' } }, engines: { node: '>=16.0.0 <=20.0.0' } },
      }

      const allConstraintsForProject = [rootConstraint, '<=18.9.9', '>=18.0.0', '>=16.0.0 <=20.0.0']
      projectNodeRange = calculateSupportedNodeVersions(allConstraintsForProject)
      // Expected: min=max(16,18,16)=18. max=min(22,18.9.9,20)=18.9.9. Range: >=18.0.0 <=18.9.9
      expect(projectNodeRange.min).toBe('18.0.0')
      expect(projectNodeRange.max).toBe('18.9.9')
    })

    it('should identify depA as limiting max version', () => {
      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint)
      const outlierA = outliers.find(o => o.packageName === 'depA_limits_max')
      expect(outlierA).toBeDefined()
      expect(outlierA.impact).toContain('Allows newer Node.js')
      expect(outlierA.rangeWithoutOutlier.max).toBe('20.0.0') // Without depA (<=18.9.9), max becomes 20.0.0
    })

    it('should identify depB as limiting min version', () => {
      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint)
      const outlierB = outliers.find(o => o.packageName === 'depB_limits_min')
      expect(outlierB).toBeDefined()
      expect(outlierB.impact).toContain('Allows older Node.js')
      expect(outlierB.rangeWithoutOutlier.min).toBe('16.0.0') // Without depB (>=18), min becomes 16.0.0
    })

    it('should identify multiple outliers correctly', () => {
      const outliers = identifyNodeOutliers(mockEnrichedDependencies, projectNodeRange, rootConstraint)
      expect(outliers.length).toBe(2)
    })
  })
})
