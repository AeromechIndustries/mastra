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

describe('knowledge semantic search hit shape', () => {
  it('returns hits joinable with lexical search results', async () => {
    const { store, scopeIds, coordinator, upserts } = await fixture();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await store.createRecord({ node, text: 'Atlas ships in March', scopeIds });
    await coordinator.drain(scopeIds);
    const indexed = upserts.flatMap(batch => batch.ids.map((id, index) => ({ id, metadata: batch.metadata[index]! })));
    const queryable = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector: {
        ...createFakes().vector,
        listIndexes: async () => ['knowledge_documents_dimension_3'],
        query: async () => indexed.map(hit => ({ ...hit, score: 0.5 })),
      },
      embedder: createFakes().embedder,
    });

    const semantic = await queryable.search('Atlas', scopeIds);
    const lexical = await store.search({ query: 'Atlas', scopeIds });

    expect(lexical.length).toBeGreaterThan(0);
    const joinKey = ({ type, id, recordId, name, scopeIds }: (typeof lexical)[number]) => ({
      type,
      id,
      recordId,
      name,
      scopeIds,
    });
    for (const hit of lexical) {
      expect(semantic.map(joinKey)).toContainEqual(joinKey(hit));
    }
    for (const hit of semantic) {
      expect(hit).toEqual({ ...joinKey(hit), text: expect.any(String), score: 0.5 });
    }
  });
});
