import type { McpToolDef } from "@nightcode/shared";
import type { ClientManager } from "./client";

export function mcpToolsToRequestPayload(mcpClient: ClientManager): McpToolDef[] {
  return mcpClient.getToolDefs();
}

export function isMcpTool(toolName: string, mcpClient: ClientManager): boolean {
  return mcpClient.matchTool(toolName) !== null;
}
