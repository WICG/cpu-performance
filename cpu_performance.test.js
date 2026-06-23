// Unit tests for the JavaScript reference implementation of the CPU
// Performance API. Each test pins a concrete (CPU model, core count) pair
// to the tier that the Chromium implementation in cpu_performance.cc would
// classify it under, so the two implementations can be cross-validated.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  Manufacturer,
  splitCpuModel,
  getTierFromCores,
  getTierFromCpuInfo,
  createNavigatorCpuPerformance,
} = require('./cpu_performance');

// 20 representative CPU configurations covering every tier and every
// manufacturer-specific code path that the Chromium implementation handles.
const CPU_CASES = [
  // --- Tier 0 (unknown) ---
  {
    name: 'zero cores reports tier 0',
    model: 'Apple M2',
    cores: 0,
    expected: 0,
  },

  // --- Tier 1 ---
  {
    name: 'single core falls into tier 1 regardless of model',
    model: 'Some Future Mystery Chip',
    cores: 1,
    expected: 1,
  },
  {
    name: 'two cores on an unknown manufacturer is tier 1',
    model: 'Mystery Brand XPU 9000',
    cores: 2,
    expected: 1,
  },
  {
    name: 'Intel Atom Z520 (Silverthorne) on 2 cores is tier 1',
    model: 'Intel(R) Atom(TM) CPU Z520 @ 1.33GHz',
    cores: 2,
    expected: 1,
  },
  {
    name: 'Intel Pentium N3540 (Bay Trail-M) on 4 cores is tier 1',
    model: 'Intel(R) Pentium(R) CPU N3540 @ 2.16GHz',
    cores: 4,
    expected: 1,
  },
  {
    name: 'Intel Core 2 Duo T7700 (Merom) on 2 cores is tier 1',
    model: 'Intel(R) Core(TM)2 Duo CPU T7700 @ 2.40GHz',
    cores: 2,
    expected: 1,
  },
  {
    name: 'AMD A4-9120e (Stoney Ridge re-release) on 2 cores is tier 1',
    model: 'AMD A4-9120e',
    cores: 2,
    expected: 1,
  },

  // --- Tier 2 ---
  {
    name: 'three cores on an unknown manufacturer is tier 2',
    model: 'Mystery Brand XPU 9000',
    cores: 3,
    expected: 2,
  },
  {
    name: 'AMD Ryzen 3 2200U on 4 cores is excluded from tier 3, so tier 2',
    model: 'AMD Ryzen 3 2200U',
    cores: 4,
    expected: 2,
  },

  // --- Tier 3 ---
  {
    name: 'AMD Ryzen 5 2400G on 4 cores is tier 3 (Zen-class)',
    model: 'AMD Ryzen 5 2400G',
    cores: 4,
    expected: 3,
  },
  {
    name: 'Intel Atom x7425E (Alder Lake-N) on 4 cores is tier 3',
    model: 'Intel(R) Atom(TM) x7425E',
    cores: 4,
    expected: 3,
  },
  {
    name: 'Intel N100 (Alder Lake-N) on 4 cores is tier 3',
    model: 'Intel N100',
    cores: 4,
    expected: 3,
  },
  {
    name: 'Intel Core i5-10400 on 6 cores is tier 3',
    model: 'Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz',
    cores: 6,
    expected: 3,
  },
  {
    name: 'AMD Ryzen 5 5600X on 6 cores is tier 3',
    model: 'AMD Ryzen 5 5600X 6-Core Processor',
    cores: 6,
    expected: 3,
  },
  {
    name: 'Intel Core i7-1185G7 on 8 cores is tier 3 (not Core Ultra)',
    model: 'Intel(R) Core(TM) i7-1185G7 CPU @ 3.00GHz',
    cores: 8,
    expected: 3,
  },
  {
    name: 'Qualcomm Snapdragon 8cx Gen 3 on 8 cores is tier 3',
    model: 'Qualcomm Snapdragon 8cx Gen 3',
    cores: 8,
    expected: 3,
  },
  {
    name: 'Microsoft SQ3 on 8 cores is tier 3',
    model: 'Microsoft SQ3',
    cores: 8,
    expected: 3,
  },

  // --- Tier 4 ---
  {
    name: 'Apple M1 on 8 cores is tier 4',
    model: 'Apple M1',
    cores: 8,
    expected: 4,
  },
  {
    name: 'Apple M2 Pro on 10 cores is tier 4',
    model: 'Apple M2 Pro',
    cores: 10,
    expected: 4,
  },
  {
    name: 'Intel Core Ultra 7 155H (Meteor Lake) on 8 cores is tier 4',
    model: 'Intel(R) Core(TM) Ultra 7 155H',
    cores: 8,
    expected: 4,
  },
  {
    name: 'AMD Ryzen 9 5950X on 16 cores is tier 4 (cores > 10)',
    model: 'AMD Ryzen 9 5950X 16-Core Processor',
    cores: 16,
    expected: 4,
  },
  {
    name: 'Intel Core i9-13900K on 24 cores is tier 4 (cores > 10)',
    model: 'Intel(R) Core(TM) i9-13900K CPU @ 3.00GHz',
    cores: 24,
    expected: 4,
  },
];

test('getTierFromCpuInfo classifies known CPU configurations', async (t) => {
  for (const c of CPU_CASES) {
    await t.test(c.name, () => {
      assert.equal(getTierFromCpuInfo(c.model, c.cores), c.expected);
    });
  }
});

test('getTierFromCores follows the documented thresholds', () => {
  assert.equal(getTierFromCores(0), 0);
  assert.equal(getTierFromCores(1), 1);
  assert.equal(getTierFromCores(2), 1);
  assert.equal(getTierFromCores(3), 2);
  assert.equal(getTierFromCores(4), 2);
  assert.equal(getTierFromCores(5), 3);
  assert.equal(getTierFromCores(12), 3);
  assert.equal(getTierFromCores(13), 4);
  assert.equal(getTierFromCores(64), 4);
});

test('splitCpuModel normalizes vendor strings', () => {
  assert.deepEqual(splitCpuModel('Apple M1'), {
    manufacturer: Manufacturer.APPLE,
    model: 'M1',
  });

  assert.deepEqual(
    splitCpuModel('Intel(R) Core(TM) i7-1185G7 CPU @ 3.00GHz'),
    { manufacturer: Manufacturer.INTEL, model: 'Core i7-1185G7' },
  );

  assert.deepEqual(splitCpuModel('Intel(R) Core(TM)2 Duo CPU T7700 @ 2.40GHz'), {
    manufacturer: Manufacturer.INTEL,
    model: 'Core 2 Duo T7700',
  });

  assert.deepEqual(
    splitCpuModel('AMD Ryzen 9 5950X 16-Core Processor'),
    { manufacturer: Manufacturer.AMD, model: 'Ryzen 9 5950X' },
  );

  assert.deepEqual(
    splitCpuModel('AMD Ryzen 5 PRO 5650U with Radeon Graphics'),
    { manufacturer: Manufacturer.AMD, model: 'Ryzen 5 PRO 5650U' },
  );

  // Unknown manufacturers always yield an empty model.
  assert.deepEqual(splitCpuModel('Mystery Brand XPU 9000'), {
    manufacturer: Manufacturer.UNKNOWN,
    model: '',
  });

  // Qualcomm is recognized but falls into the empty-model default branch.
  assert.deepEqual(splitCpuModel('Qualcomm Snapdragon 8cx Gen 3'), {
    manufacturer: Manufacturer.QUALCOMM,
    model: '',
  });
});

test('createNavigatorCpuPerformance exposes the spec-shaped attribute', () => {
  const nav = createNavigatorCpuPerformance({
    cpuModel: 'Apple M2',
    cores: 8,
  });
  assert.equal(nav.cpuPerformance, 4);

  // The returned value must always be an integer >= 0 per the spec.
  assert.equal(Number.isInteger(nav.cpuPerformance), true);
  assert.ok(nav.cpuPerformance >= 0);

  // Default arguments mean "no CPU info available" — unknown tier (0).
  assert.equal(createNavigatorCpuPerformance().cpuPerformance, 0);
});
