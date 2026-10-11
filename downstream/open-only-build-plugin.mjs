import path from 'node:path';

const openAuth = path.resolve(import.meta.dirname, '../packages/core/src/auth/open-only.ts');
const openBuilder = path.resolve(import.meta.dirname, '../packages/core/src/agent-builder/open-only.ts');
const openLicense = path.resolve(import.meta.dirname, '../packages/core/src/license/open-only.ts');
const editorUnavailable = '\0aeromech-editor-feature-unavailable';
const emptyModule = '\0aeromech-open-empty';

export function openOnlyBuildPlugin() {
  return {
    name: 'aeromech-open-only',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.includes('auth/ee')) return openAuth;
      if (source.includes('agent-builder/ee')) return openBuilder;
      if (source === '../license' && importer?.includes('/packages/core/src/mastra/')) return openLicense;
      if (source === './ee' && importer?.includes('/packages/_internals/auth/src/')) return emptyModule;
      if (source === './ee' && importer?.includes('/packages/editor/src/')) return editorUnavailable;
      return null;
    },
    load(id) {
      if (id === emptyModule) return 'export {}';
      if (id !== editorUnavailable) return null;
      return `
        class UnavailableFeature {
          constructor() {
            throw new Error('This feature is not included in the Aeromech open-only package.');
          }
        }
        export const EditorAgentBuilder = UnavailableFeature;
        export const EditorWorkflowBuilder = UnavailableFeature;
      `;
    },
  };
}
