/** Type-only compatibility surface for packages that do not enable the builder. */
export type BuilderModelPolicy = Record<string, unknown>;
export type AgentFeatures = Record<string, boolean | undefined>;

export interface AgentBuilderOptions {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface IAgentBuilder {
  getConfiguration(): Record<string, any> | undefined;
  getFeatures(): { agent?: AgentFeatures } | undefined;
}
