import { z } from "zod";

export const mcpToolDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
});

export type McpToolDef = z.infer<typeof mcpToolDefSchema>;

export const mcpServerStatusSchema = z.enum(["disconnected", "connecting", "connected", "failed"]);

export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>;

export interface McpServerConfig {
  type: "local" | "remote";
  url?: string;
  command?: string[];
  headers?: Record<string, string>;
}

export interface NightcodeConfig {
  mcp: Record<string, McpServerConfig>;
}
