const semver = require('semver');

// Mock package registry data (ensure all packages used in alternativesDB also have basic entries here)
const mockRegistry = {
  'pkg-a': { /* ... */ }, 'pkg-b': { /* ... */ }, 'pkg-c-no-engines': { /* ... */ }, 'pkg-d-legacy': { /* ... */ },
  'old-package-a': {
    versions: { '0.5.0': { name: 'old-package-a', version: '0.5.0', engines: { node: '>=12' } } },
    time: { '0.5.0': '2020-01-01T00:00:00.000Z', modified: '2020-01-01T00:00:00.000Z', created: '2020-01-01T00:00:00.000Z' },
    'dist-tags': { latest: '0.5.0' },
  },
  'package-b-with-vuln': {
    versions: { '1.2.3': { name: 'package-b-with-vuln', version: '1.2.3', engines: { node: '>=14' } } },
    time: { '1.2.3': '2021-05-01T00:00:00.000Z', modified: '2021-05-01T00:00:00.000Z', created: '2021-05-01T00:00:00.000Z' },
    'dist-tags': { latest: '1.2.3' },
  },
  'tiny-utility-a': {
    versions: { '1.0.0': { name: 'tiny-utility-a', version: '1.0.0', engines: { node: '>=12' } } },
    time: { '1.0.0': '2022-01-01T00:00:00.000Z', modified: '2022-01-01T00:00:00.000Z', created: '2022-01-01T00:00:00.000Z' },
    'dist-tags': { latest: '1.0.0' },
  },
  'another-old-lib': {
    versions: { '2.2.0': { name: 'another-old-lib', version: '2.2.0', engines: { node: '>=10' } } },
    time: { '2.2.0': '2019-06-01T00:00:00.000Z', modified: '2019-06-01T00:00:00.000Z', created: '2019-06-01T00:00:00.000Z' },
    'dist-tags': { latest: '2.2.0' },
  },
  // Entries for alternatives themselves, assuming they exist in the registry
  'new-package-x': {
    versions: { '1.0.0': { name: 'new-package-x', version: '1.0.0', engines: { node: '>=16' } }, '1.1.0': { name: 'new-package-x', version: '1.1.0', engines: { node: '>=16' } } },
    time: { /* ... */ }, 'dist-tags': { latest: '1.1.0' }
  },
  'package-b-replacement': {
    versions: { '1.0.0': { name: 'package-b-replacement', version: '1.0.0', engines: { node: '>=16' } } },
    time: { /* ... */ }, 'dist-tags': { latest: '1.0.0' }
  },
  'mega-utility-suite': {
    versions: { '1.0.0': { name: 'mega-utility-suite', version: '1.0.0', engines: { node: '>=16' } } },
    time: { /* ... */ }, 'dist-tags': { latest: '1.0.0' }
  },
  'modern-lib-c': {
    versions: { '3.0.0': { name: 'modern-lib-c', version: '3.0.0', engines: { node: '>=18' } } },
    time: { /* ... */ }, 'dist-tags': { latest: '3.0.0' }
  }
};
// Auto-fill time data for brevity
Object.keys(mockRegistry).forEach(pkgName => {
    if (mockRegistry[pkgName].versions && !mockRegistry[pkgName].time) {
        mockRegistry[pkgName].time = {};
        const versions = Object.keys(mockRegistry[pkgName].versions);
        versions.forEach((v, i) => {
            mockRegistry[pkgName].time[v] = new Date(Date.now() - (versions.length - i) * 30 * 24 * 60 * 60 * 1000).toISOString();
        });
        mockRegistry[pkgName].time.modified = new Date().toISOString();
        mockRegistry[pkgName].time.created = new Date(Date.now() - versions.length * 30 * 24 * 60 * 60 * 1000).toISOString();
    }
});


/**
 * @typedef {object} PackageAlternative
 * @property {string} name - Name of the alternative package
 * @property {string} version - A specific version to suggest, or "latest"
 * @property {string} reason - Why it's suggested
 * @property {string} source - Where this suggestion came from
 */

const mockAlternativesDb = {
  'old-package-a': [ // Outdated
    { name: 'new-package-x', version: 'latest', reason: 'Actively maintained, better performance, and supports modern Node.', source: 'PACKMAN DB' }
  ],
  'package-b-with-vuln': [ // Security
    { name: 'package-b-replacement', version: 'latest', reason: 'Fixes CVE-2023-XXXX in package-b-with-vuln. Drop-in replacement.', source: 'Security Advisory X' },
    { name: 'another-secure-alt', version: '2.1.0', reason: 'Also secure, different API but more features.', source: 'Community Rec.'}
  ],
  'tiny-utility-a': [ // Consolidation hint
    { name: 'mega-utility-suite', version: 'latest', reason: 'mega-utility-suite can replace tiny-utility-a, tiny-utility-b, and tiny-utility-c, simplifying your dependency tree.', source: 'PACKMAN Analysis' }
  ],
  'another-old-lib': [ // Multiple reasons, one alternative
    { name: 'modern-lib-c', version: '3.0.0', reason: 'Outdated and unmaintained. modern-lib-c offers similar functionality with active support.', source: 'PACKMAN DB'}
  ]
};

async function fetchPackageInfo(packageName) {
  if (mockRegistry[packageName]) {
    return Promise.resolve(mockRegistry[packageName]);
  }
  return Promise.resolve({
    versions: {}, time: {}, 'dist-tags': { latest: null },
    name: packageName, error: 'Not found in mock registry'
  });
}

async function fetchPackageAlternatives(packageName, packageVersion) {
  return Promise.resolve(mockAlternativesDb[packageName] || []);
}

module.exports = {
  fetchPackageInfo,
  fetchPackageAlternatives,
  _mockRegistry: mockRegistry,
  _mockAlternativesDb: mockAlternativesDb,
};
