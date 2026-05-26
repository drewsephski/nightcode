import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpToolDef, McpServerConfig, McpServerStatus } from "@nightcode/shared";
import { loadConfig, saveConfig, resolveHeaders } from "./config";

export interface McpServerInfo {
  name: string;
  config: McpServerConfig;
  status: McpServerStatus;
  error?: string;
  toolCount: number;
}

interface McpServerEntry {
  client: Client | null;
  status: McpServerStatus;
  error?: string;
}

export function getDefaultConfigPath(): string | undefined {
  return undefined;
}

export class ClientManager {
  private servers = new Map<string, McpServerEntry>();
  private serverConfigs = new Map<string, McpServerConfig>();
  private toolDefs: McpToolDef[] = [];
  private initialized = false;
  private configPath?: string;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore subscriber errors */ }
    }
  }

  async init(configPath?: string): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.configPath = configPath;

    const config = loadConfig(configPath);

    const connections = Object.entries(config.mcp ?? {}).map(async ([name, serverConfig]) => {
      this.serverConfigs.set(name, serverConfig);
      this.servers.set(name, { client: null, status: "disconnected" });
      await this.connectServer(name, serverConfig);
    });

    await Promise.allSettled(connections);
    await this.discoverAllTools();
    process.on("exit", () => { this.disconnect(); });
  }

  private async connectServer(name: string, config: McpServerConfig, timeoutMs = 10000): Promise<void> {
    try {
      this.setStatus(name, "connecting");
      const client = new Client({ name: "nightcode", version: "1.0.0" });

      let transport: StdioClientTransport | StreamableHTTPClientTransport;

      if (config.type === "local" && config.command) {
        const [command, ...args] = config.command;
        transport = new StdioClientTransport({ command, args });
      } else if (config.type === "remote" && config.url) {
        const headers = resolveHeaders(config.headers);
        transport = new StreamableHTTPClientTransport(new URL(config.url), {
          headers,
        });
      } else {
        throw new Error(`Invalid MCP configuration for "${name}"`);
      }

      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), timeoutMs),
        ),
      ]);
      this.servers.set(name, { client, status: "connected" });
      this.notifyListeners();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.servers.set(name, { client: null, status: "failed", error: message });
      this.notifyListeners();
      console.error(`[nightcode] MCP server "${name}" failed: ${message}`);
    }
  }

  private setStatus(name: string, status: McpServerStatus): void {
    const entry = this.servers.get(name);
    if (entry) {
      this.servers.set(name, { ...entry, status });
      this.notifyListeners();
    }
  }

  private async discoverAllTools(): Promise<void> {
    for (const [name, entry] of this.servers.entries()) {
      if (entry.status !== "connected" || !entry.client) continue;
      try {
        const result = await entry.client.listTools();
        for (const tool of result.tools) {
          this.toolDefs.push({
            name: `${name}_${tool.name}`,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema as Record<string, unknown>,
          });
        }
      } catch (error) {
        console.error(`[nightcode] Failed to discover tools from "${name}":`, error);
      }
    }
  }

  getToolDefs(): McpToolDef[] {
    return this.toolDefs;
  }

  matchTool(name: string): { serverName: string; toolName: string } | null {
    for (const def of this.toolDefs) {
      const prefix = def.name.split("_")[0];
      const tool = def.name.slice(prefix.length + 1);
      if (def.name === name) {
        return { serverName: prefix, toolName: tool };
      }
    }
    return null;
  }

  async executeTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.servers.get(serverName);
    if (!entry || entry.status !== "connected" || !entry.client) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    const result = await entry.client.callTool({ name: toolName, arguments: args });

    const content = result.content as Array<{ type: string; text?: string }> | undefined;
    if (content && Array.isArray(content)) {
      return content.map(c => c.text ?? "").join("\n").trim() || result;
    }

    return result;
  }

  hasTools(): boolean {
    return this.toolDefs.length > 0;
  }

  getServerStatus(name: string): McpServerStatus | undefined {
    return this.servers.get(name)?.status;
  }

  getServerStatuses(): Record<string, McpServerStatus> {
    const statuses: Record<string, McpServerStatus> = {};
    for (const [name, entry] of this.servers.entries()) {
      statuses[name] = entry.status;
    }
    return statuses;
  }

  getServerInfos(): McpServerInfo[] {
    const infos: McpServerInfo[] = [];
    for (const [name, entry] of this.servers.entries()) {
      const config = this.serverConfigs.get(name);
      if (!config) continue;
      const toolCount = this.toolDefs.filter(t => t.name.startsWith(`${name}_`)).length;
      infos.push({
        name,
        config,
        status: entry.status,
        error: entry.error,
        toolCount,
      });
    }
    return infos;
  }

  getServerTools(serverName: string): McpToolDef[] {
    return this.toolDefs.filter(t => t.name.startsWith(`${serverName}_`));
  }

  async reconnectServer(name: string): Promise<void> {
    const config = this.serverConfigs.get(name);
    if (!config) throw new Error(`Unknown server: ${name}`);

    this.toolDefs = this.toolDefs.filter(t => !t.name.startsWith(`${name}_`));
    this.servers.set(name, { client: null, status: "disconnected" });
    this.notifyListeners();

    await this.connectServer(name, config);

    const entry = this.servers.get(name);
    if (entry?.status === "connected" && entry.client) {
      try {
        const result = await entry.client.listTools();
        for (const tool of result.tools) {
          this.toolDefs.push({
            name: `${name}_${tool.name}`,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema as Record<string, unknown>,
          });
        }
      } catch (error) {
        console.error(`[nightcode] Failed to discover tools after reconnect "${name}":`, error);
      }
    }
    this.notifyListeners();
  }

  async addServer(name: string, config: McpServerConfig): Promise<void> {
    if (this.servers.has(name)) {
      throw new Error(`Server "${name}" already exists`);
    }

    this.serverConfigs.set(name, config);
    this.servers.set(name, { client: null, status: "disconnected" });
    this.notifyListeners();

    const existing = loadConfig(this.configPath);
    existing.mcp[name] = config;
    saveConfig(existing, this.configPath);

    await this.connectServer(name, config);

    const entry = this.servers.get(name);
    if (entry?.status === "connected" && entry.client) {
      try {
        const result = await entry.client.listTools();
        for (const tool of result.tools) {
          this.toolDefs.push({
            name: `${name}_${tool.name}`,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema as Record<string, unknown>,
          });
        }
      } catch (error) {
        console.error(`[nightcode] Failed to discover tools from new server "${name}":`, error);
      }
    }
    this.notifyListeners();
  }

  removeServer(name: string): void {
    this.servers.delete(name);
    this.serverConfigs.delete(name);
    this.toolDefs = this.toolDefs.filter(t => !t.name.startsWith(`${name}_`));

    const config = loadConfig(this.configPath);
    delete config.mcp[name];
    saveConfig(config, this.configPath);

    this.notifyListeners();
  }

  disconnect(): void {
    for (const [name, entry] of this.servers.entries()) {
      if (entry.client) {
        try {
          Promise.race([
            entry.client.close(),
            new Promise(resolve => setTimeout(resolve, 2000)),
          ]).catch(() => {});
        } catch {
          // ignore cleanup errors
        }
      }
    }
    this.servers.clear();
    this.toolDefs = [];
    this.notifyListeners();
  }
}

let defaultInstance: ClientManager | null = null;

export function getMcpClient(): ClientManager {
  if (!defaultInstance) {
    defaultInstance = new ClientManager();
  }
  return defaultInstance;
}
