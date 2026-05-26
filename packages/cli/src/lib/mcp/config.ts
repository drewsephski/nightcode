import { readFileSync, writeFileSync } from "fs";
import { existsSync } from "fs";
import { join } from "path";
import type { NightcodeConfig } from "@nightcode/shared";

const CONFIG_FILENAME = "nightcode.json";

export function resolveEnvVars(value: string): string {
  return value.replace(/\{env:(\w+)\}/g, (_, varName: string) => process.env[varName] ?? "");
}

export function resolveHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = resolveEnvVars(value);
  }
  return result;
}

export function loadConfig(configPath?: string): NightcodeConfig {
  if (configPath && existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as NightcodeConfig;
  }

  const cwd = process.cwd();
  const localPath = join(cwd, CONFIG_FILENAME);
  if (existsSync(localPath)) {
    const raw = readFileSync(localPath, "utf-8");
    return JSON.parse(raw) as NightcodeConfig;
  }

  return { mcp: {} };
}

export function findConfigPath(configPath?: string): string {
  if (configPath) return configPath;

  const cwd = process.cwd();
  const localPath = join(cwd, CONFIG_FILENAME);
  if (existsSync(localPath)) return localPath;

  return join(cwd, CONFIG_FILENAME);
}

export function saveConfig(config: NightcodeConfig, configPath?: string): void {
  const path = findConfigPath(configPath);
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
