import type { IMastraLogger } from '../logger';

export interface LicenseSnapshot {
  mode: 'open-source';
  status: 'valid';
  entitlements: null;
  planTier: null;
  expiresAt: null;
}

/** Fixed open-source status used by the Aeromech open-only package. */
export class LicenseClient {
  private static instance: LicenseClient | undefined;

  private constructor(_logger?: IMastraLogger) {}

  static getInstance(logger?: IMastraLogger): LicenseClient {
    return (LicenseClient.instance ??= new LicenseClient(logger));
  }

  static resetInstance(): void {
    LicenseClient.instance = undefined;
  }

  async validate(): Promise<boolean> {
    return true;
  }

  getSnapshot(): LicenseSnapshot {
    return { mode: 'open-source', status: 'valid', entitlements: null, planTier: null, expiresAt: null };
  }
}
