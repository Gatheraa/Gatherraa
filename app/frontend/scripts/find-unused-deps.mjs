#!/usr/bin/env node
import fs   from 'fs';
import path from 'path';

const ROOT    = path.resolve('.');
const SCAN    = ['app', 'components', 'hooks', 'lib'].map(d => path.resolve(d));
const PKG     = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const deps    = Object.keys(PKG.dependencies    || {});
const devDeps = Object.keys(PKG.devDependencies || {});

function walk(dir, exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.next') {
      out.push(...walk(full, exts));
    } else if (exts.some(x => e.name.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

// Also scan root-level config files (next.config, tailwind, etc.)
const configFiles = fs
  .readdirSync(ROOT)
  .filter(f => /\.(ts|js|mjs|cjs)$/.test(f) && !f.startsWith('.'))
  .map(f => path.join(ROOT, f));

const allFiles  = [...SCAN.flatMap(d => walk(d)), ...configFiles];
const allSource = allFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');

const importedPkgs = new Set();
const RE = /(?:from|import|require)\s+['"](@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)?)['"]/gi;
let m;
while ((m = RE.exec(allSource)) !== null) importedPkgs.add(m[1]);

// Normalise scoped packages: @hookform/resolvers -> @hookform/resolvers
function isUsed(dep) {
  if (importedPkgs.has(dep)) return true;
  // Allow sub-path imports like lodash/merge matching lodash
  return [...importedPkgs].some(imp => imp === dep || imp.startsWith(dep + '/'));
}

const unusedDeps    = deps.filter(d => !isUsed(d));
const unusedDevDeps = devDeps.filter(d => !isUsed(d));

console.log('\n🔍  Unused Dependency Audit\n' + '='.repeat(50));

if (unusedDeps.length === 0) {
  console.log('✅  No unused production dependencies.');
} else {
  console.log('⚠️   Possibly unused production deps (verify before removing):');
  unusedDeps.forEach(d => console.log(`    - ${d}`));
}

console.log('');

if (unusedDevDeps.length === 0) {
  console.log('✅  No unused devDependencies.');
} else {
  console.log('ℹ️   Possibly unused devDependencies:');
  unusedDevDeps.forEach(d => console.log(`    - ${d}`));
}

console.log('\nTip: run `npm run depcheck` for a more thorough analysis (depcheck is already installed).\n');