/**
 * Public identity and access-shaped contracts retained by Aeromech's open-only
 * package. They carry request context but do not provide licensed policy
 * enforcement.
 */
export type MastraFGAPermissionInput = string;

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

export type FGARouteConfig = Record<string, unknown>;

export interface IFGAProvider<TUser = unknown> {
  readonly __userType?: TUser;
}

export interface IRBACProvider<TUser = unknown> {
  readonly __userType?: TUser;
}

export const MastraFGAPermissions = {
  AGENTS_EXECUTE: 'agents:execute',
  MEMORY_READ: 'memory:read',
  TOOLS_EXECUTE: 'tools:execute',
  WORKFLOWS_EXECUTE: 'workflows:execute',
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

export async function requireFGA(): Promise<void> {}

export function isEEEnabled(): boolean {
  return false;
}
