import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--application'),
  'Usage: node downstream/check-inventory.mjs [--application <checkout>]');
const application = args[1];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const source = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], {
  cwd: application,
});
const records = [...manifest.patches, ...manifest.adaptations];
assert.equal(manifest.schemaVersion, 1);
assert.equal(new Set(records.map(record => record.file)).size, records.length);
for (const record of records) {
  assert.equal(record.status, 'recorded');
  const file = path.resolve(directory, record.file);
  assert(file.startsWith(directory + path.sep), 'Inventory files stay within downstream/');
  const bytes = readFileSync(file);
  assert.equal(sha256(bytes), record.sha256, `Checksum mismatch: ${record.file}`);
  if (record.file.endsWith('.patch')) {
    assert(execFileSync('git', ['apply', '--numstat', file], {
      cwd: path.dirname(directory), encoding: 'utf8',
    }).trim(), `Empty patch: ${record.file}`);
  }
  if (application) {
    assert.deepEqual(bytes, source(record.sourceRevision ?? manifest.sourceRevision,
      record.sourcePath ?? record.path), `Source mismatch: ${record.file}`);
  }
}
if (application) {
  const declared = JSON.parse(source(manifest.sourceRevision, 'package.json')).pnpm.patchedDependencies;
  const inventory = Object.fromEntries([...manifest.patches, ...manifest.externalPatches]
    .map(record => [record.package, record.path]));
  assert.deepEqual(inventory, declared, 'Application patch inventory is incomplete');
  for (const record of manifest.externalPatches) {
    assert.equal(sha256(source(manifest.sourceRevision, record.path)), record.sha256);
  }
}
console.log(`Verified ${manifest.patches.length} Mastra patch snapshots and ${manifest.adaptations.length} build recipe.`);
if (application) console.log('Source bytes and complete application patch inventory match.');
