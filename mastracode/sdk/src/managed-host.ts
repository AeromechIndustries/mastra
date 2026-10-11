import type { GatewayLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import type { PromptContext } from './agents/prompts/index.js';
import type { GlobalSettings } from './onboarding/settings.js';
import type { AnthropicPromptCacheScope } from './providers/anthropic-prompt-cache.js';
import type { ThinkingLevelSetting, ThinkingLevelSource } from './thinking.js';

export interface ManagedCodeHost {
  appDataDir: string;
  authPath: string;
  resolveModel(
    modelId: string,
    options?: {
      thinkingLevel?: ThinkingLevelSetting;
      remapForCodexOAuth?: boolean;
      requestContext?: RequestContext;
      anthropicPromptCacheScope?: AnthropicPromptCacheScope;
    },
  ): GatewayLanguageModel;
  resolveThinkingLevel(
    settings: GlobalSettings,
    mode?: string | null,
  ): { level: ThinkingLevelSetting; source: ThinkingLevelSource };
  buildPrompt(context: PromptContext): { toolGuidance: string; modePrompt: string };
}

let configuredHost: ManagedCodeHost | undefined;

/** Install process-scoped ownership hooks for an embedded Code surface. */
export function configureManagedCodeHost(host: ManagedCodeHost): () => void {
  const previous = configuredHost;
  configuredHost = host;
  return () => {
    if (configuredHost === host) configuredHost = previous;
  };
}

export function getManagedCodeHost(): ManagedCodeHost | undefined {
  return configuredHost;
}
