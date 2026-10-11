import type { Mastra } from '@mastra/core';

import { HTTPException } from '../http-exception';

export async function isBuilderFeatureEnabled(_mastra: Mastra, _feature: string): Promise<boolean> {
  return false;
}

export async function requireBuilderFeature(_mastra: Mastra, _feature: string): Promise<void> {
  throw new HTTPException(404, { message: 'Not Found' });
}
