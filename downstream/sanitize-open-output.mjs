import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('Usage: node downstream/sanitize-open-output.mjs <dist-directory>...');
  process.exit(2);
}

const textExtensions = new Set(['.cjs', '.d.ts', '.js', '.json', '.mjs']);
const prohibitedSegment = /^ee(?:[-.]|$)/i;

function sanitize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (prohibitedSegment.test(entry.name)) {
        rmSync(target, { recursive: true, force: true });
      } else {
        sanitize(target);
      }
      continue;
    }

    if (entry.name.endsWith('.map') || prohibitedSegment.test(entry.name)) {
      rmSync(target, { force: true });
      continue;
    }

    if (!textExtensions.has(extname(entry.name)) && !entry.name.endsWith('.d.ts')) continue;
    const original = readFileSync(target, 'utf8');
    const rewritten = original
      .replace(/^export \* from ['"]\.\/ee(?:\/[^'"]*)?['"];?\r?\n/gm, '')
      .replaceAll('@mastra/core/auth/ee', '@mastra/core/auth/open-only')
      .replaceAll('@mastra/core/agent-builder/ee', '@mastra/core/agent-builder/open-only')
      .replace(/(?:\.\.\/)+auth\/ee(?:\/[^'";\s]+)?/g, match => match.replace(/auth\/ee(?:\/.*)?$/, 'auth/open-only'))
      .replace(/(?:\.\.\/)+agent-builder\/ee(?:\/[^'";\s]+)?/g, match =>
        match.replace(/agent-builder\/ee(?:\/.*)?$/, 'agent-builder/open-only'),
      );
    if (rewritten !== original) writeFileSync(target, rewritten);
  }
}

for (const root of roots) {
  if (!existsSync(root)) {
    console.error(`Missing output directory: ${root}`);
    process.exitCode = 1;
  } else {
    sanitize(root);
  }
}
