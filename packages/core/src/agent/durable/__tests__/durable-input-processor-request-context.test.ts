/**
 * Regression test for #23904:
 * Request context values written by input processors must be captured in the
 * serialized workflow input (`requestContextEntries`). Before the fix, the
 * snapshot was taken at the start of preparation — before input processors
 * ran — so processor writes never reached the durable run on cross-process
 * engines (e.g. Inngest), which rebuild the run's RequestContext from the
 * persisted entries via `restoreRequestContext`. In-process runs stayed green
 * because they read the live RequestContext from the run registry, which is
 * exactly why this asserts on the serialized workflow input instead.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import type { Processor } from '../../../processors';
import { RequestContext, MASTRA_AUTH_TOKEN_KEY, MASTRA_VERSIONS_KEY } from '../../../request-context';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';
import { prepareForDurableExecution } from '../preparation';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function getRequestContextEntries(workflowInput: unknown): Record<string, unknown> | undefined {
  return (workflowInput as { requestContextEntries?: Record<string, unknown> }).requestContextEntries;
}

describe('DurableAgent input processor requestContext writes (#23904)', () => {
  it('forwards the application projection through prepare()', async () => {
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');
    requestContext.set('secret', 'do-not-save');
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'prepare-projection-agent',
        name: 'Prepare Projection Agent',
        instructions: 'You are a helpful assistant.',
        model: createTextModel('ok') as LanguageModelV2,
      }),
      snapshotRequestContext: context => ({ tenantId: context.get('tenantId') }),
    });

    const result = await agent.prepare('Hello', { requestContext });

    expect(getRequestContextEntries(result.workflowInput)).toEqual({ tenantId: 'tenant-1' });
  });

  it('uses an application projection and still strips framework credentials', async () => {
    const baseAgent = new Agent({
      id: 'projected-context-agent',
      name: 'Projected Context Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
    });
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');
    requestContext.set('secret', 'do-not-save');
    requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'do-not-save');

    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      requestContext,
      snapshotRequestContext: context => ({
        tenantId: context.get('tenantId'),
        [MASTRA_AUTH_TOKEN_KEY]: context.get(MASTRA_AUTH_TOKEN_KEY),
      }),
    });

    expect(getRequestContextEntries(result.workflowInput)).toEqual({ tenantId: 'tenant-1' });
    expect(result.registryEntry.requestContext?.get('secret')).toBe('do-not-save');
    expect(result.registryEntry.requestContext?.get(MASTRA_AUTH_TOKEN_KEY)).toBe('do-not-save');
    expect(result.registryEntry.requestContext?.toJSON()).toEqual({ tenantId: 'tenant-1' });
    expect(result.registryEntry.requestContext?.serializeForSpan()).toEqual({ tenantId: 'tenant-1' });
    expect(JSON.stringify(result.registryEntry.requestContext)).not.toContain('do-not-save');
  });

  it('persists input processor requestContext writes into the workflow input', async () => {
    const routingProcessor: Processor = {
      id: 'route-pin',
      name: 'route-pin',
      processInput: async ({ requestContext, messages }) => {
        requestContext?.set('routePin', 'specialized');
        return messages;
      },
    };

    const baseAgent = new Agent({
      id: 'processor-context-agent',
      name: 'Processor Context Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      inputProcessors: [routingProcessor as any],
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-123');

    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      requestContext,
    });

    // Both the caller-provided entry and the processor's write must survive
    // into the persisted entries a cross-process worker restores from.
    expect(getRequestContextEntries(result.workflowInput)).toEqual({
      userId: 'user-123',
      routePin: 'specialized',
    });
  });

  it('excludes framework-internal prep keys while pinning the caller versions entry', async () => {
    const stageProcessor: Processor = {
      id: 'stage-marker',
      name: 'stage-marker',
      processInput: async ({ requestContext, messages }) => {
        requestContext?.set('stage', 'processed');
        return messages;
      },
    };

    const baseAgent = new Agent({
      id: 'versions-pin-agent',
      name: 'Versions Pin Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      inputProcessors: [stageProcessor as any],
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-123');
    // Caller-provided version overrides must persist as-is.
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { helper: { status: 'draft' } } });
    // A delegated/caller context can carry the parent's framework-managed
    // memory entry; it must never persist into workflow input.
    requestContext.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });

    const result = await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
      requestContext,
      // Call-site versions merge into the live context during prep (step 3),
      // but the persisted entry must stay pinned to the caller's own value.
      options: { versions: { defaultStatus: 'published' } } as any,
    });

    expect(getRequestContextEntries(result.workflowInput)).toEqual({
      userId: 'user-123',
      stage: 'processed',
      [MASTRA_VERSIONS_KEY]: { agents: { helper: { status: 'draft' } } },
    });
  });
});
