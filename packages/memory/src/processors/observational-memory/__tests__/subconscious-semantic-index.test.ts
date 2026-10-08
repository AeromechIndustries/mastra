import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../..';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { KnowledgeSemanticIndexCoordinator } from '../subconscious/semantic-index';

function createFakes() {
  const embeddedTexts: string[] = [];
  const upserts: Array<{ ids: string[]; metadata: Array<Record<string, unknown>> }> = [];
  const embedder = {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'test-embedder',
    maxEmbeddingsPerCall: 10,
    supportsParallelCalls: true,
    doEmbed: async ({ values }: { values: string[] }) => {
      embeddedTexts.push(...values);
      return { embeddings: values.map(() => [0.1, 0.2, 0.3]) };
    },
  } as any;
  const indexes = new Set<string>();
  const vector = {
    listIndexes: async () => [...indexes],
    createIndex: async ({ indexName }: { indexName: string }) => {
      indexes.add(indexName);
    },
    deleteVectors: async () => {},
    upsert: async (input: { ids: string[]; metadata: Array<Record<string, unknown>> }) => {
      upserts.push({ ids: input.ids, metadata: input.metadata });
    },
    query: async () => [],
  } as any;
  return { embedder, vector, embeddedTexts, upserts };
}

async function fixture() {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
  const store = (await memory.storage.getStore('knowledge'))!;
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const scopeIds = await resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext,
  });
  const { embedder, vector, embeddedTexts, upserts } = createFakes();
  const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge: store, vector, embedder });
  return { store, scopeIds, coordinator, embeddedTexts, upserts };
}

describe('knowledge semantic index descriptions', () => {
  it('indexes the node name when no description exists', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await store.createNode({ name: 'Bare Node', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas');
    expect(embeddedTexts).toContain('Bare Node');
  });

  it('includes the description in the indexed document when present', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      metadata: { description: 'Flagship migration project.' },
      scopeIds,
    });
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas\nFlagship migration project.');
  });

  it('re-enqueues and re-embeds the whole document on a description-only update', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    const updated = await store.updateNode({
      id: node.id,
      version: node.version,
      metadata: { description: 'New synopsis.' },
    });
    expect(updated.version).toBe(node.version + 1);
    const pending = await store.listSemanticOutbox({ status: 'pending', scopeIds, limit: 10 });
    expect(pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: `knowledge:node:${node.id}`, operation: 'upsert' }),
      ]),
    );
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas\nNew synopsis.');
  });
});

function createQueryableVector() {
  const documents = new Map<string, Record<string, unknown>>();
  const indexes = new Set<string>();
  return {
    listIndexes: async () => [...indexes],
    createIndex: async ({ indexName }: { indexName: string }) => {
      indexes.add(indexName);
    },
    deleteVectors: async ({ ids }: { ids: string[] }) => {
      for (const id of ids) documents.delete(id);
    },
    upsert: async (input: { ids: string[]; metadata: Array<Record<string, unknown>> }) => {
      input.ids.forEach((id, index) => documents.set(id, input.metadata[index]!));
    },
    query: async () => [...documents].map(([id, metadata]) => ({ id, score: 1, metadata })),
  } as any;
}

describe('knowledge semantic search visibility', () => {
  async function mentionFixture() {
    const store = (await new Memory({ storage: new InMemoryStore() }).storage.getStore('knowledge'))!;
    const org = await store.createNode({ name: 'Acme', isScope: true, scopeIds: [] });
    const visible = await store.createNode({ name: 'Visible', isScope: true, scopeIds: [org.id] });
    const hidden = await store.createNode({ name: 'Hidden', isScope: true, scopeIds: [org.id] });
    await store.createNode({ name: 'Project Nightjar', kind: 'project', scopeIds: [hidden.id] });
    const subject = await store.createNode({ name: 'Echidna', kind: 'project', scopeIds: [visible.id, hidden.id] });
    const record = await store.createRecord({
      node: subject.id,
      text: 'Budget tied to [[Project Nightjar]].',
      scopeIds: [visible.id, hidden.id],
      resolutionScopeIds: [visible.id, hidden.id],
    });
    const { embedder } = createFakes();
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector: createQueryableVector(),
      embedder,
    });
    await coordinator.drain();
    return { store, org, visible, hidden, record, coordinator };
  }

  it('hides records whose mentioned node is outside the caller view, matching lexical search', async () => {
    const { store, org, visible, record, coordinator } = await mentionFixture();
    const view = [org.id, visible.id];

    const lexical = await store.search({ query: 'budget', scopeIds: view });
    const semantic = await coordinator.search('budget', view);

    expect(lexical.some(hit => hit.id === record.id)).toBe(false);
    expect(semantic.some(hit => hit.metadata?.record_id === record.id)).toBe(false);
    expect(semantic.some(hit => String(hit.metadata?.text ?? '').includes('Nightjar'))).toBe(false);
  });

  it('still returns the record when the caller can see the mentioned node', async () => {
    const { org, visible, hidden, record, coordinator } = await mentionFixture();

    const semantic = await coordinator.search('budget', [org.id, visible.id, hidden.id]);

    expect(semantic.some(hit => hit.metadata?.record_id === record.id)).toBe(true);
  });
});
