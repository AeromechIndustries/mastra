import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openPackages } from './open-packages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stagingRoot = path.join(root, 'downstream', 'staging');
const artifactRoot = path.join(root, 'downstream', 'artifacts');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const repository = 'https://github.com/AeromechIndustries/mastra';
const workspaceVersions = new Map();
for (const manifestPath of execFileSync(
  'find',
  [root, '-name', 'package.json', '-not', '-path', '*/node_modules/*', '-print'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)) {
  const workspaceManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (workspaceManifest.name && workspaceManifest.version) {
    workspaceVersions.set(workspaceManifest.name, workspaceManifest.version);
  }
}

rmSync(stagingRoot, { recursive: true, force: true });
rmSync(artifactRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });
mkdirSync(artifactRoot, { recursive: true });

for (const descriptor of openPackages) {
  const source = path.join(root, descriptor.directory);
  const stage = path.join(stagingRoot, descriptor.slug);
  mkdirSync(stage, { recursive: true });
  cpSync(path.join(source, 'dist'), path.join(stage, 'dist'), { recursive: true });
  cpSync(path.join(root, 'downstream', 'APACHE-LICENSE.md'), path.join(stage, 'LICENSE.md'));
  for (const file of descriptor.extraFiles ?? []) cpSync(path.join(source, file), path.join(stage, file));

  const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
  manifest.private = false;
  manifest.files = ['dist', 'LICENSE.md', 'NOTICE', 'AEROMECH_SOURCE.json', ...(descriptor.extraFiles ?? [])];
  manifest.scripts = {};
  manifest.aeromechSource = { repository, revision, line: 'master', openOnly: true };
  delete manifest.devDependencies;

  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
      if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) continue;
      const version = workspaceVersions.get(name);
      if (!version) throw new Error(`Cannot resolve ${specifier} for ${name}`);
      const range = specifier.slice('workspace:'.length);
      manifest[field][name] = range === '^' || range === '~' ? `${range}${version}` : version;
    }
  }

  if (manifest.exports) {
    for (const key of Object.keys(manifest.exports)) {
      if (key === './ee' || key.startsWith('./ee/') || key === './auth/ee' || key === './agent-builder/ee') {
        delete manifest.exports[key];
      }
    }
  }

  if (descriptor.core) {
    manifest.exports['./auth/open-only'] = {
      import: { types: './dist/auth/open-only.d.ts', default: './dist/auth/open-only.js' },
      require: { types: './dist/auth/open-only.d.ts', default: './dist/auth/open-only.cjs' },
    };
    manifest.exports['./agent-builder/open-only'] = {
      import: { types: './dist/agent-builder/open-only.d.ts', default: './dist/agent-builder/open-only.js' },
      require: { types: './dist/agent-builder/open-only.d.ts', default: './dist/agent-builder/open-only.cjs' },
    };
    manifest.exports['./license'] = {
      import: { types: './dist/license/open-only.d.ts', default: './dist/license/open-only.js' },
      require: { types: './dist/license/open-only.d.ts', default: './dist/license/open-only.cjs' },
    };
  }

  writeFileSync(path.join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    path.join(stage, 'AEROMECH_SOURCE.json'),
    `${JSON.stringify({ package: manifest.name, version: manifest.version, repository, revision, line: 'master' }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(stage, 'NOTICE'),
    `Modified by Aeromech Industries.\nSource: ${repository}\nCommit: ${revision}\nChanges: open-only packaging and TessarAct integration adaptations.\n`,
  );

  execFileSync('corepack', ['pnpm', 'pack', '--pack-destination', artifactRoot], {
    cwd: stage,
    stdio: 'inherit',
  });
}

const tarballs = execFileSync('find', [artifactRoot, '-maxdepth', '1', '-type', 'f', '-name', '*.tgz', '-print'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort();

const sums = tarballs.map(file => {
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  return `${hash}  ${path.basename(file)}`;
});
writeFileSync(path.join(artifactRoot, 'SHA256SUMS'), `${sums.join('\n')}\n`);

console.log(`Packed ${tarballs.length} open-only packages from ${revision}.`);
