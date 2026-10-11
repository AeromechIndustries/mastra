import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';
import { openOnlyBuildPlugin } from '../../../downstream/open-only-build-plugin.mjs';

const openOnly = process.env.AEROMECH_OPEN_ONLY === '1';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/provider/index.ts',
    'src/types/index.ts',
    'src/session/index.ts',
    ...(!openOnly ? ['src/ee/index.ts', 'src/ee/capabilities.ts'] : []),
  ],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  inputOptions: {
    plugins: openOnly ? [openOnlyBuildPlugin()] : [],
  },
  sourcemap: !openOnly,
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/core']));
  },
});
