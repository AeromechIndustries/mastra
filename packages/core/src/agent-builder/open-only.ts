import type { ModelForProvider, Provider } from '../llm/model';

/** Type-only compatibility surface for packages that do not enable the builder. */
export type ProviderModelEntry =
  | { [P in Provider]: { provider: P; modelId?: ModelForProvider<P> } }[Provider]
  | { kind: 'custom'; provider: string; modelId?: string };

export type DefaultModelEntry =
  | { [P in Provider]: { provider: P; modelId: ModelForProvider<P> } }[Provider]
  | { kind: 'custom'; provider: string; modelId: string };

export interface BuilderModelPolicy {
  active: boolean;
  pickerVisible?: boolean;
  allowed?: ProviderModelEntry[];
  default?: DefaultModelEntry;
}
export type AgentFeatures = Record<string, boolean | undefined>;

export interface AgentBuilderOptions {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface IAgentBuilder {
  getConfiguration(): Record<string, any> | undefined;
  getFeatures(): { agent?: AgentFeatures } | undefined;
}
