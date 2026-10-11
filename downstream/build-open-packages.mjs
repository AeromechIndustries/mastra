import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { openPackages } from './open-packages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outputs = [];
const fromName = process.argv[2];
const start = fromName
  ? openPackages.findIndex(({ directory }) => {
      const manifest = JSON.parse(readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
      return manifest.name === fromName;
    })
  : 0;
if (start < 0) throw new Error(`Unknown open package: ${fromName}`);

for (const descriptor of openPackages.slice(start)) {
  const directory = path.join(root, descriptor.directory);
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const builds = descriptor.builds ?? [
    manifest.scripts?.['build:lib'] ? 'build:lib' : manifest.scripts?.build ? 'build' : undefined,
  ];
  if (builds.includes(undefined)) throw new Error(`${manifest.name} has no supported build command`);
  for (const build of builds) {
    try {
      execFileSync('corepack', ['pnpm', '--filter', manifest.name, build], {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, AEROMECH_OPEN_ONLY: '1' },
      });
    } catch (error) {
      if (!existsSync(path.join(directory, 'dist'))) throw error;
      console.warn(
        `${manifest.name} emitted output with upstream type diagnostics; package and release-boundary checks remain mandatory.`,
      );
    }
  }
  const output = path.join(directory, 'dist');
  if (!existsSync(output)) throw new Error(`${manifest.name} did not produce dist`);
  outputs.push(output);
}

execFileSync('node', ['downstream/sanitize-open-output.mjs', ...outputs], { cwd: root, stdio: 'inherit' });
execFileSync('node', ['downstream/check-release-boundary.mjs', ...outputs], { cwd: root, stdio: 'inherit' });
