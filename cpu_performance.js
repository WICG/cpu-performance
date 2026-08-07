// JavaScript reference implementation of the CPU Performance API.
//
// This module is a direct translation of the Chromium C++ implementation in
// cpu_performance.cc. Its purpose is to make the classification rules
// described informally by the specification (index.bs) easy to inspect,
// reproduce, and test in isolation. The high-level shape of the API matches
// the specification: `navigator.cpuPerformance` returns a non-negative
// integer, where 0 means "unknown" and higher values mean higher tiers.
// The specification currently defines tiers 1..4; future revisions are
// expected to add 5, 6, and so on.

'use strict';

const Manufacturer = Object.freeze({
  UNKNOWN: 'unknown',
  AMD: 'amd',
  APPLE: 'apple',
  INTEL: 'intel',
  MEDIATEK: 'mediatek',
  MICROSOFT: 'microsoft',
  QUALCOMM: 'qualcomm',
  SAMSUNG: 'samsung',
});

function trimAndCollapseWhitespace(text) {
  // \p{Z} matches unicode separators (including NBSP).
  // \x1C\x1F match the file and unit separator characters.
  return text
    .replace(/^[\s\p{Z}\x1C\x1F]+/u, '')
    .replace(/[\s\p{Z}\x1C\x1F]+$/u, '')
    .replace(/[\s\p{Z}\x1C\x1F]+/gu, ' ');
}

function getManufacturer(cpuModel) {
  if (/\bAMD\b/i.test(cpuModel)) return Manufacturer.AMD;
  if (/\bApple\b/i.test(cpuModel)) return Manufacturer.APPLE;
  if (/\b(Intel|Celeron|Pentium)\b/i.test(cpuModel)) return Manufacturer.INTEL;
  if (/\bMediaTek\b/i.test(cpuModel)) return Manufacturer.MEDIATEK;
  if (/\bMicrosoft\b/i.test(cpuModel)) return Manufacturer.MICROSOFT;
  if (/\b(Qualcomm|Snapdragon)\b/i.test(cpuModel)) return Manufacturer.QUALCOMM;
  if (/\bSamsung\b/i.test(cpuModel)) return Manufacturer.SAMSUNG;
  return Manufacturer.UNKNOWN;
}

function splitCpuModel(cpuModel) {
  let text = String(cpuModel == null ? '' : cpuModel);

  text = trimAndCollapseWhitespace(text);

  const manufacturer = getManufacturer(text);

  // Remove everything between parentheses.
  text = text.replace(/\([^)]*\)/g, ' ');

  // Remove special characters.
  text = text.replace(/\$|®|™/g, ' ');

  // Remove "GHz" patterns.
  text = text.replace(/@( )?\d[.,]\d+([~\-]\d[.,]\d+)?( )?GHz\b/gi, '');
  text = text.replace(/\b\d[.,]\d+([~\-]\d[.,]\d+)?( )?GHz\b/gi, '');

  text = trimAndCollapseWhitespace(text);

  // Remove trailing special characters.
  text = text.replace(/(^| )?[@~\-,.]$/g, '');

  // Remove filler words.
  text = text.replace(/\bCPU\b/gi, '');
  text = text.replace(/\bMobile\b/gi, '');
  text = text.replace(/\bProcessor\b/gi, '');
  text = text.replace(/\bSilicon\b/gi, '');
  text = text.replace(/\bSOC\b/gi, '');
  text = text.replace(/\bTechnology\b/gi, '');

  text = trimAndCollapseWhitespace(text);

  switch (manufacturer) {
    case Manufacturer.AMD:
      // ReplaceFirst: strip everything up to and including the first "AMD" token.
      text = text.replace(/.*?\bAMD\b/i, '');
      text = trimAndCollapseWhitespace(text);
      text = text.replace(/\bFX -/gi, 'FX-');
      text = text.replace(/\+( )?(AMD )?Radeon.*/gi, '');
      text = text.replace(
        /\b(RADEON )?R\d+, \d+ COMPUTE CORES \d+C\+\d+G\b/gi,
        '',
      );
      text = text.replace(/\bwith (AMD )?Radeon.*/gi, '');
      text = text.replace(/\bw\/( )?(AMD )?Radeon.*/gi, '');
      text = text.replace(/\bRadeon.*/gi, '');

      text = text.replace(/\b\w+( |-)Core\b/gi, '');
      text = text.replace(/\b\d+-Core(s)?\b/gi, '');

      text = text.replace(/\bAPU\b/gi, '');
      text = text.replace(/\bCreator Edition\b/gi, '');
      text = text.replace(/\bDesktop Kit\b/gi, '');

      text = text.replace(/\b(3250C) 15W\b/gi, '$1');
      break;
    case Manufacturer.APPLE:
      text = text.replace(/.*?\bApple\b/i, '');
      break;
    case Manufacturer.INTEL:
      text = text.replace(/.*?\bIntel\b/i, '');
      text = trimAndCollapseWhitespace(text);
      text = text.replace(/\b(Core)(2)\b/gi, '$1 $2');
      text = text.replace(/\b(Core i\d+)( )?-( )?/gi, '$1-');
      text = text.replace(/\b(Core i\d+) (M) (\d+)\b/gi, '$1-$3$2');
      text = text.replace(/\b(Core i\d+) ([LQU]) (\d+)\b/gi, '$1-$3$2M');
      text = text.replace(/\b(Core i\d+) (\d+)\b/gi, '$1-$2');
      text = text.replace(/\b(Celeron|Pentium) Dual(-Core)?\b/gi, '$1');
      text = text.replace(/\b0+$/g, '');
      break;
    default:
      // For all other manufacturers including UNKNOWN, return an empty model.
      return { manufacturer, model: '' };
  }

  text = trimAndCollapseWhitespace(text);
  return { manufacturer, model: text };
}

function getTierFromCores(cores) {
  if (cores >= 1 && cores <= 2) return 1;
  if (cores >= 3 && cores <= 4) return 2;
  if (cores >= 5 && cores <= 12) return 3;
  if (cores >= 13) return 4;
  return 0;
}

function getTierFromCpuInfo(cpuModel, cores) {
  if (cores <= 0) return 0;
  if (cores <= 1) return 1;

  const { manufacturer, model } = splitCpuModel(cpuModel);
  const m = (re) => re.test(model);

  if (cores <= 4) {
    switch (manufacturer) {
      case Manufacturer.AMD:
        // 2 cores, K8 + K10 + Mobile Trinity
        if (
          cores === 2 &&
          (m(/^Athlon 64\b/) ||
            m(/^Athlon II\b/) ||
            m(/^Athlon X2\b/) ||
            m(/^Phenom II\b/) ||
            m(/^Sempron X2\b/) ||
            m(/^Turion II\b/) ||
            m(/^Turion X2\b/) ||
            // Llano (~2011)
            m(/^(A4|E2)-[3]\d\d\d[A-Z]*\b/) ||
            // Trinity (~2012)
            m(/^(A4|A6)-[4]\d\d\dM[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2 cores, Bobcat + Jaguar
        if (
          cores === 2 &&
          (m(/^(C|E|E1|E2|T|Z)-\w*\b/) ||
            m(/^(A4)-[1]\d\d\d[A-Z]*\b/) ||
            m(/^(GX)-[2]\d\d[A-Z]*\b/) ||
            m(/^Sempron 2650\b/))
        ) {
          return 1;
        }
        // 2 cores, Entry-Level Stoney Ridge 2019 6W Re-Release
        if (cores === 2 && m(/^A4-9120[Ce]\b/)) {
          return 1;
        }
        // 4 cores, >= Zen
        if (
          cores === 4 &&
          m(/^Ryzen\b/) &&
          // not 2 cores, Zen (~2017)
          !m(/^Ryzen 3 Pro 2100GE\b/) &&
          !m(/^Ryzen 3 Pro 3050GE\b/) &&
          !m(/^Ryzen 3 2200U\b/) &&
          !m(/^Ryzen 3 3200U\b/) &&
          !m(/^Ryzen 3 3250[UC]\b/) &&
          !m(/^Ryzen Embedded R[1]\d\d\d[A-Z]*\b/) &&
          // not 2 cores, Zen+ (~2018)
          !m(/^Ryzen Embedded R2312\b/)
        ) {
          return 3;
        }
        break;
      case Manufacturer.INTEL:
        // 2-4 cores, E-Core, Bonnell + Saltwell
        if (
          cores >= 2 && cores <= 4 &&
          (// Silverthorne (~2008)
            m(/^Atom (Z5)\d\d[A-Z]*\b/) ||
            // Diamondville (~2008)
            m(/^Atom (2|3|N2)\d\d[A-Z]*\b/) ||
            // Pineview (~2010)
            m(/^Atom (D4|N4|D5|N5)\d\d[A-Z]*\b/) ||
            // Tunnel Creek (~2010) / Stellarton (~2010)
            m(/^Atom (E6)\d\d[A-Z]*\b/) ||
            // Lincroft (~2010)
            m(/^Atom (Z6)\d\d[A-Z]*\b/) ||
            // Cedarview (~2011)
            m(/^Atom (D2|N2)\d\d\d[A-Z]*\b/) ||
            // Penwell (~2012) + Cloverview (~2012)
            m(/^Atom (Z2)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2-4 cores, E-Core, Silvermont + Airmont
        if (
          cores >= 2 && cores <= 4 &&
          (// Bay Trail-D (~2013)
            m(/^Celeron (J1)\d\d\d[A-Z]*\b/) ||
            m(/^Pentium (J2)\d\d\d[A-Z]*\b/) ||
            // Avoton (~2013) / Rangeley (~2013)
            m(/^Atom (C2)[35]\d\d[A-Z]*\b/) ||
            // Bay Trail-I (~2013)
            m(/^Atom (E3)[8]\d\d[A-Z]*\b/) ||
            // Bay Trail-M (~2013)
            m(/^Celeron (N2)\d\d\d[A-Z]*\b/) ||
            m(/^Pentium (N3)[5]\d\d[A-Z]*\b/) ||
            // Bay Trail-T (~2013) + Merrifield (~2014) + Moorefield (~2014)
            m(/^Atom (Z3)\d\d\d[A-Z]*\b/) ||
            // Braswell (~2016)
            m(/^Atom x[5]-(E8)\d\d\d[A-Z]*\b/) ||
            m(/^Celeron (J3|N3)[01]\d\d[A-Z]*\b/) ||
            m(/^Pentium (J3|N3)[7]\d\d[A-Z]*\b/) ||
            // Cherry Trail-T (~2015)
            m(/^Atom x[57]-(Z8)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2 cores, E-Core, Goldmont
        if (
          cores === 2 &&
          (// Apollo Lake (~2016)
            m(/^Atom x[5]-(A3|E3)\d\d\d[A-Z]*\b/) ||
            m(/^Celeron (J3|N3)[34]\d\d[A-Z]*\b/) ||
            // Denverton (~2017)
            m(/^Atom (C3)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2 cores, P-Core, Merom + Penryn
        if (
          cores === 2 &&
          (// Merom (~2006) + Conroe (~2006) + Penryn (~2007)
            m(/^Celeron (E1|SU2|T1|T3)\d\d\d[A-Z]*\b/) ||
            m(/^Core 2 Duo\b/) ||
            m(/^Core 2 Extreme\b/) ||
            m(/^Pentium (E2|SU2|SU4|T2|T3|T4)\d\d\d[A-Z]*\b/) ||
            m(/^Xeon (3|E3|L3)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2 cores, P-Core, Nehalem + Westmere
        if (
          cores === 2 &&
          (// Arrandale (~2010)
            m(/^Celeron (P4|U3)\d\d\d[A-Z]*\b/) ||
            m(/^Pentium (P6|U5)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 2 cores, P-Core, Mobile Sandy Bridge + Mobile Ivy Bridge
        if (
          cores === 2 &&
          (// Sandy Bridge-M (~2011)
            m(/^Celeron (7|8|B7|B8)\d\d[A-Z]*\b/) ||
            m(/^Pentium (9|B9)\d\d[A-Z]*\b/) ||
            // Ivy Bridge-M (~2012)
            m(/^Celeron (1)\d\d\d[A-Z]*\b/) ||
            m(/^Pentium (2|A1)\d\d\d[A-Z]*\b/))
        ) {
          return 1;
        }
        // 4 cores, E-Core, >= Gracemont
        if (
          cores === 4 &&
          (m(/^N\d\d+\b/) ||
            // Alder Lake-N (~2023)
            m(/^Atom x7425E\b/))
        ) {
          return 3;
        }
        break;
      default:
        // Any other manufacturer with at most 2 cores is demoted to tier 1.
        if (cores <= 2) return 1;
        break;
    }
    return 2;
  }

  if (cores <= 10) {
    switch (manufacturer) {
      case Manufacturer.APPLE:
        // 8+ cores, M-series
        if (cores >= 8 && m(/^M\d+\b/)) return 4;
        break;
      case Manufacturer.INTEL:
        // 8+ cores, >= Meteor Lake
        if (cores >= 8 && m(/^Core Ultra\b/)) return 4;
        break;
      default:
        break;
    }
    return 3;
  }

  return 4;
}

// Spec-shaped accessor. Returns an object that exposes a `cpuPerformance`
// getter behaving like `navigator.cpuPerformance` as defined in index.bs:
// a non-negative integer where 0 means "unknown" and higher values mean
// higher tiers.
function createNavigatorCpuPerformance({ cpuModel = '', cores = 0 } = {}) {
  const tier = getTierFromCpuInfo(cpuModel, cores);
  return Object.freeze({
    get cpuPerformance() {
      return tier;
    },
  });
}

const exports_ = {
  Manufacturer,
  trimAndCollapseWhitespace,
  getManufacturer,
  splitCpuModel,
  getTierFromCores,
  getTierFromCpuInfo,
  createNavigatorCpuPerformance,
};

// Support both Node.js (require) and a plain browser <script> tag (global).
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = exports_;
} else if (typeof globalThis !== 'undefined') {
  globalThis.CpuPerformance = exports_;
}
