/**
 * Public identity and access-shaped contracts retained by Aeromech's open-only
 * package. They carry request context but do not provide licensed policy
 * enforcement.
 */
export type MastraFGAPermissionInput = string;

export type EEUser = any;

export type FGARouteInfo = {
  method: string;
  path: string;
  [key: string]: unknown;
};

export type ActorSignal =
  | true
  | {
      actorKind: 'system';
      sourceWorkflow?: string;
      agentId?: string;
      permissions?: MastraFGAPermissionInput[];
      scope?: Record<string, string>;
      propagate?: boolean;
    };

export type FGARouteConfig = {
  resourceType?: string;
  resourceIdParam?: string;
  resourceId?: string | ((params: Record<string, unknown>, context: { requestContext: any }) => string | undefined);
  permission?: MastraFGAPermissionInput;
};

export interface IFGAProvider<TUser = unknown> {
  readonly __userType?: TUser;
  filterAccessible<T>(user: TUser, resources: T[], ...args: any[]): Promise<T[]>;
  validatePermissions?(...args: any[]): Promise<boolean | void>;
  auditProtectedRoutes?: false | 'warn' | 'error';
  requireForProtectedRoutes?: boolean;
  resolveRouteFGA?(...args: any[]): any;
  check(user: TUser, input: any): boolean | Promise<boolean>;
}

export interface IRBACProvider<TUser = unknown> {
  readonly __userType?: TUser;
  hasPermission(...args: any[]): boolean | Promise<boolean>;
  getPermissions(user: any): Promise<string[]>;
  getRoles(user: any): Promise<string[]>;
  getPermissionsForRole?(roleId: string): Promise<string[]>;
}

export const PERMISSION_PATTERNS: Record<string, unknown> = {};

export function matchesPermission(granted: string, required: string): boolean {
  if (granted === '*' || granted === required) return true;
  const grantedParts = granted.split(':');
  const requiredParts = required.split(':');
  if (grantedParts.length > requiredParts.length) return false;
  return grantedParts.every((part, index) => part === '*' || part === requiredParts[index]);
}

export function hasPermission(): boolean {
  return false;
}

export async function buildCapabilities(): Promise<Record<string, unknown>> {
  return {};
}

export const MastraFGAPermissions = {
  AGENTS_CREATE: 'agents:create',
  AGENTS_DELETE: 'agents:delete',
  AGENTS_EXECUTE: 'agents:execute',
  AGENTS_READ: 'agents:read',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  TOOLS_EXECUTE: 'tools:execute',
  TOOLS_READ: 'tools:read',
  WORKFLOWS_EXECUTE: 'workflows:execute',
  WORKFLOWS_READ: 'workflows:read',
} as const;

export function getAgentFGAResourceId(id: string): string {
  return `agent:${id}`;
}

export function getAgentToolFGAResourceId(agentId: string, toolId: string): string {
  return `agent:${agentId}:tool:${toolId}`;
}

export function getMCPToolFGAResourceId(serverId: string, toolId: string): string {
  return `mcp:${serverId}:tool:${toolId}`;
}

export function getStandaloneToolFGAResourceId(toolId: string): string {
  return `tool:${toolId}`;
}

export function getWorkflowFGAResourceId(id: string): string {
  return `workflow:${id}`;
}

export class FGADeniedError extends Error {
  constructor(..._args: unknown[]) {
    super('Fine-grained authorization is unavailable in this open-only distribution.');
    this.name = 'FGADeniedError';
  }
}

export async function requireFGA(..._args: unknown[]): Promise<void> {
  throw new FGADeniedError();
}

export function isEEEnabled(): boolean {
  return false;
}
