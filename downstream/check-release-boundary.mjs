import { createReadStream, existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error('Usage: pnpm check:aeromech-release -- <packed-package-or-directory>...');
  process.exit(2);
}

const forbiddenPath = /(^|\/)(ee)(\/|$)|(^|\/)enterprise([./-]|\/|$)/i;
const forbiddenText =
  /Mastra Enterprise License|@internal\/auth\/ee|@mastra\/core\/(?:auth|agent-builder)\/ee|src\/(?:auth|agent-builder)\/ee\/|MASTRA_(?:EE_)?LICENSE|license\.mastra\.ai/i;
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.d.ts',
  '.html',
  '.js',
  '.json',
  '.map',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
]);
const findings = [];

function normalized(value) {
  return value.split(sep).join('/');
}

function inspectFile(file, displayName) {
  if (forbiddenPath.test(normalized(displayName))) findings.push(`${displayName}: prohibited path`);
  if (!textExtensions.has(extname(file)) && !file.endsWith('.d.ts')) return;
  const content = readFileSync(file, 'utf8');
  if (forbiddenText.test(content)) findings.push(`${displayName}: prohibited content or reference`);
}

function walk(directory, root = directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    const displayName = normalized(relative(root, file));
    if (entry.isDirectory()) walk(file, root);
    else if (entry.isFile()) inspectFile(file, displayName);
  }
}

async function inspectTarball(file) {
  let buffer = Buffer.alloc(0);
  await pipeline(
    createReadStream(file),
    createGunzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        buffer = Buffer.concat([buffer, chunk]);
        callback();
      },
    }),
  );

  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const path = normalized(prefix ? `${prefix}/${name}` : name);
    const sizeText = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const bodyStart = offset + 512;
    const body = buffer.subarray(bodyStart, bodyStart + size);
    if (forbiddenPath.test(path)) findings.push(`${file}:${path}: prohibited path`);
    if ([...textExtensions].some(extension => path.endsWith(extension)) && forbiddenText.test(body.toString('utf8'))) {
      findings.push(`${file}:${path}: prohibited content or reference`);
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
}

for (const input of inputs) {
  const target = resolve(input);
  if (!existsSync(target)) {
    findings.push(`${input}: does not exist`);
    continue;
  }
  if (lstatSync(target).isDirectory()) walk(target);
  else if (target.endsWith('.tgz')) await inspectTarball(target);
  else inspectFile(target, input);
}

if (findings.length > 0) {
  console.error(['Aeromech release boundary failed:', ...findings.map(finding => `- ${finding}`)].join('\n'));
  process.exit(1);
}

console.log(`Aeromech release boundary passed for ${inputs.length} input(s).`);
