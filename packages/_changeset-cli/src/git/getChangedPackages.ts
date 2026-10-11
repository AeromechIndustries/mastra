import path from 'node:path';
import { getChangedPackagesSinceRef } from '@changesets/git';
import { rootDir } from '../config.js';
import { getPublicPackages } from '../pkg/getPublicPackages.js';

export interface ChangedPackage {
  name: string;
  path: string;
  version: string;
}

export async function getChangedPackages(): Promise<ChangedPackage[]> {
  try {
    const packages = await getPublicPackages();

    let changedPackageDirs;
    let lastError: unknown;
    for (const ref of ['origin/master', 'master', 'origin/main', 'main']) {
      try {
        changedPackageDirs = await getChangedPackagesSinceRef({
          cwd: rootDir,
          ref,
          changedFilePatterns: ['**/*'],
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!changedPackageDirs) throw lastError;

    const changedPackages: ChangedPackage[] = [];

    for (const { dir } of changedPackageDirs) {
      const pkg = packages.find(pkg => {
        return pkg.dir === dir;
      });

      if (pkg) {
        const relativePath = path.relative(rootDir, pkg.dir);
        changedPackages.push({
          name: pkg.packageJson.name,
          path: relativePath,
          version: pkg.packageJson.version,
        });
      }
    }

    return changedPackages;
  } catch (error) {
    throw new Error('Error detecting changed packages.', { cause: error });
  }
}
