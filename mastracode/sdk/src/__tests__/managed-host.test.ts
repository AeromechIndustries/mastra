import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDynamicInstructionSections } from '../agents/instructions.js';
import { resolveModel } from '../agents/model.js';
import { AccountRotationProcessor } from '../auth/account-rotation-processor.js';
import { configureManagedCodeHost, getManagedCodeHost, type ManagedCodeHost } from '../managed-host.js';
import { resolveDefaultThinkingLevel } from '../onboarding/settings.js';
import { getAppDataDir } from '../utils/project.js';

const disposers: Array<() => void> = [];
const directories: string[] = [];

afterEach(() => {
  while (disposers.length) disposers.pop()!();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

function install(overrides: Partial<ManagedCodeHost> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'mastracode-managed-host-'));
  directories.push(directory);
  const model = { provider: 'host', modelId: 'selected' } as never;
  const host: ManagedCodeHost = {
    appDataDir: join(directory, 'state'),
    authPath: join(directory, 'credentials-disabled.json'),
    resolveModel: vi.fn(() => model),
    resolveThinkingLevel: vi.fn(() => ({ level: 'high', source: 'mode-default' })),
    buildPrompt: vi.fn(() => ({ toolGuidance: 'Use the published tools.', modePrompt: 'Published mode.' })),
    ...overrides,
  };
  disposers.push(configureManagedCodeHost(host));
  return { host, model };
}

describe('managed Code host', () => {
  it('owns state, model resolution, and thinking defaults through explicit source APIs', () => {
    const { host, model } = install();

    expect(getManagedCodeHost()).toBe(host);
    expect(getAppDataDir()).toBe(host.appDataDir);
    expect(resolveModel('host/model')).toBe(model);
    expect(host.resolveModel).toHaveBeenCalledWith('host/model', undefined);
    expect(resolveDefaultThinkingLevel({} as never, 'build')).toEqual({ level: 'high', source: 'mode-default' });
  });

  it('uses only host-owned prompt inputs for a managed surface', async () => {
    install();
    const sections = await getDynamicInstructionSections({
      requestContext: {
        get: key =>
          key === 'controller'
            ? {
                getState: () => ({
                  projectPath: '/workspace/project',
                  projectName: 'project',
                  pluginInstructions: ['Local plugin instruction'],
                }),
                session: { modeId: 'build', modelId: 'host/model' },
              }
            : undefined,
      },
      hostInstructions: 'Published host instruction.',
    });

    expect(sections.map(section => section.id)).toEqual(['base-prompt', 'host-instructions', 'mode-prompt']);
    expect(sections.map(section => section.content).join('\n')).toContain('Published mode.');
    expect(sections.map(section => section.content).join('\n')).not.toContain('Local plugin instruction');
  });

  it('leaves provider retry decisions with the host', async () => {
    install();
    const processor = new AccountRotationProcessor({ credentialStore: {} as never, maxProcessorRetries: 2 });
    await expect(processor.processAPIError({} as never)).resolves.toEqual({ retry: false });
  });
});
