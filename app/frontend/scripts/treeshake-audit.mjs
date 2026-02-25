#!/usr/bin/env node
import fs   from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

const DIST               = path.resolve('.next/static/chunks');
const WARN_KB            = 100;
const ERROR_KB           = 250;

// Offenders relevant to YOUR package.json
const KNOWN_OFFENDERS = [
  {
    pattern: /moment/i,
    suggestion: 'Replace with date-fns or dayjs — both are fully tree-shakeable',
  },
  {
    pattern: /"lodash"(?!-es)/,
    suggestion: 'Switch to lodash-es or import individual functions: lodash/merge',
  },
  {
    pattern: /ethers/i,
    suggestion: 'ethers v6 is tree-shakeable; ensure you import from "ethers" subpaths, not the barrel',
  },
  {
    pattern: /recharts/i,
    suggestion: 'recharts bundles D3 — only import the chart components you use',
  },
];

if (!fs.existsSync(DIST)) {
  console.error('❌  .next/static/chunks not found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const chunks     = walk(DIST);
let   hasIssues  = false;

console.log('\n🌳  Tree-Shaking Audit\n' + '='.repeat(64));

chunks.forEach(filePath => {
  const content  = fs.readFileSync(filePath, 'utf-8');
  const sizeKB   = gzipSync(content).length / 1024;
  const relative = path.relative(DIST, filePath);

  const status = sizeKB > ERROR_KB ? '❌' : sizeKB > WARN_KB ? '⚠️ ' : '✅';
  if (sizeKB > WARN_KB) hasIssues = true;

  console.log(`\n${status}  ${relative} (${sizeKB.toFixed(1)} KB gzipped)`);

  if (sizeKB > WARN_KB) {
    console.log(`    → Large chunk. Consider dynamic import() for route-level code splitting.`);
  }

  KNOWN_OFFENDERS.forEach(({ pattern, suggestion }) => {
    if (pattern.test(content)) {
      console.log(`    ⚠️  Detected: ${pattern.source} — ${suggestion}`);
      hasIssues = true;
    }
  });
});

console.log('\n' + '='.repeat(64));
console.log(hasIssues
  ? '⚠️   Issues found — review suggestions above.\n'
  : '✅  No tree-shaking issues detected.\n'
);