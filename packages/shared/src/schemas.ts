import { z } from "zod";
import { tool } from "ai";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read"),
  }),
  listDirectory: z.object({
    path: z.string().default(".").describe("Relative directory path to list"),
  }),
  glob: z.object({
    pattern: z.string().describe("Glob pattern to match files"),
    path: z.string().default(".").describe("Directory to search from"),
  }),
  grep: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().default(".").describe("Directory to search from"),
    include: z.string().optional().describe("Optional glob for files to include"),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to write"),
    content: z.string().describe("File contents"),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to edit"),
    oldString: z.string().describe("Exact text to replace; must be unique"),
    newString: z.string().describe("Replacement text"),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to run"),
    description: z.string().optional().describe("Short description of the command"),
    timeout: z.number().optional().describe("Timeout in milliseconds"),
  }),
  webSearch: z.object({
    query: z.string().describe("Search query to look up on the web"),
    numResults: z.number().optional().default(8).describe("Number of search results to return"),
  }),
  browse: z.object({
    action: z.enum(["goto", "click", "fill", "snapshot", "screenshot", "text", "html", "url", "tabs", "close"]),
    url: z.string().optional().describe("URL for goto action"),
    selector: z.string().optional().describe("CSS selector or @e ref for click/fill"),
    value: z.string().optional().describe("Value for fill action"),
    path: z.string().optional().describe("File path for screenshot output"),
  }),
  gitStatus: z.object({}).describe("Show working tree status"),
  gitDiff: z.object({}).describe("Show unstaged diff"),
  gitLog: z.object({
    maxCount: z.number().optional().default(10).describe("Number of recent commits to show"),
  }),
  gitCommit: z.object({
    message: z.string().describe("Commit message"),
  }),
  gitBranch: z.object({
    name: z.string().optional().describe("Branch name to create (omit to list branches)"),
  }),
  gitPush: z.object({
    remote: z.string().optional().default("origin").describe("Remote name"),
    branch: z.string().optional().describe("Branch to push (defaults to current)"),
  }),
} as const;

export const readOnlyToolContracts = {
  readFile: tool({
    description: "Read a file from the current project directory.",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List entries in a directory under the current project directory.",
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: "Find files matching a glob pattern under the current project directory.",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description:
      "Search file contents with a regular expression under the current project directory.",
    inputSchema: toolInputSchemas.grep,
  }),
  webSearch: tool({
    description: "Search the web for documentation, solutions, and information.",
    inputSchema: toolInputSchemas.webSearch,
  }),
  browse: tool({
    description: "Control a headless browser. Navigate pages, interact with elements, inspect content, and take screenshots. Use snapshot to see page structure with @e refs for click/fill.",
    inputSchema: toolInputSchemas.browse,
  }),
  gitStatus: tool({
    description: "Show the working tree status, including staged, unstaged, and untracked files.",
    inputSchema: toolInputSchemas.gitStatus,
  }),
  gitDiff: tool({
    description: "Show unstaged diff of changes in the working tree.",
    inputSchema: toolInputSchemas.gitDiff,
  }),
  gitLog: tool({
    description: "Show recent commit history.",
    inputSchema: toolInputSchemas.gitLog,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Create or overwrite a file under the current project directory.",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: "Replace exact text in a file under the current project directory.",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Run a shell command in the current project directory.",
    inputSchema: toolInputSchemas.bash,
  }),
  gitCommit: tool({
    description: "Stage all changes and create a commit with a message.",
    inputSchema: toolInputSchemas.gitCommit,
  }),
  gitBranch: tool({
    description: "List branches or create a new branch.",
    inputSchema: toolInputSchemas.gitBranch,
  }),
  gitPush: tool({
    description: "Push commits to a remote repository.",
    inputSchema: toolInputSchemas.gitPush,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.PLAN 
    ? readOnlyToolContracts 
    : buildToolContracts;
};
