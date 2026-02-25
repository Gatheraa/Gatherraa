#!/usr/bin/env node
/**
 * Checks Next.js build output against performance-budget.json.
 * Reads from .next/static/chunks (gzipped sizes).
 */
import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

const NEXT_DIR  = path.resolve('.next/static/chunks');
const BUDGET    = JSON.parse(fs.readFileSync(path.resolve('performance-budget.json'), 'utf-8'));

function parseSize(str) {
  const m = str.match(/^(\d+(?:\.\d+)?)(kb|mb)$/i);
  if (!m) throw new Error(`Invalid size string: ${str}`);
  return m[2].toLowerCase() === 'mb'
    ? parseFloat(m[1]) * 1024 * 1024
    : parseFloat(m[1]) * 1024;
}

function gzipSize(filePath) {
  return gzipSync(fs.readFileSync(filePath)).length;
}

function fmt(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(2)} KB`;
}

if (!fs.existsSync(NEXT_DIR)) {
  console.error('❌  .next/static/chunks not found — run `npm run build` first.');
  process.exit(1);
}

const scriptBudget = BUDGET.budgets.find(b => b.type === 'anyScript');
const warnLimit    = parseSize(scriptBudget.maximumWarning);
const errorLimit   = parseSize(scriptBudget.maximumError);
const initialBudget = BUDGET.budgets.find(b => b.type === 'initial');

let totalSize  = 0;
let hasErrors  = false;
let hasWarnings = false;

// Walk all JS chunks (including pages/ subdirectory)
function walkChunks(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) entries.push(...walkChunks(full));
    else if (entry.name.endsWith('.js')) entries.push(full);
  }
  return entries;
}

const chunks = walkChunks(NEXT_DIR);

console.log('\n📦  Next.js Bundle Size Report (gzipped)\n' + '='.repeat(64));

chunks.forEach(filePath => {
  const size     = gzipSize(filePath);
  const relative = path.relative(NEXT_DIR, filePath);
  totalSize     += size;

  let status = '✅';
  if (size >= errorLimit)      { status = '❌'; hasErrors   = true; }
  else if (size >= warnLimit)  { status = '⚠️ '; hasWarnings = true; }

  console.log(`${status}  ${relative.padEnd(55)} ${fmt(size)}`);
});

console.log('='.repeat(64));
console.log(`    ${'TOTAL (gzipped)'.padEnd(54)} ${fmt(totalSize)}`);

const initWarn  = parseSize(initialBudget.maximumWarning);
const initError = parseSize(initialBudget.maximumError);

if (totalSize >= initError) {
  console.error(`\n❌  Total (${fmt(totalSize)}) exceeds error budget (${initialBudget.maximumError})`);
  hasErrors = true;
} else if (totalSize >= initWarn) {
  console.warn(`\n⚠️   Total (${fmt(totalSize)}) exceeds warning budget (${initialBudget.maximumWarning})`);
  hasWarnings = true;
}

console.log('');
if (hasErrors)        { console.error('❌  Budget breached. Fix before merging.\n'); process.exit(1); }
else if (hasWarnings) { console.warn('⚠️   Warnings present. Consider optimizing.\n'); }
else                  { console.log('✅  All chunks within budget.\n'); }