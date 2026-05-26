# NightCode — Terminal AI Coding Agent

## Stack
- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Monorepo:** pnpm workspaces (`packages/*`)
- **Terminal UI:** OpenTUI + React 19 + react-router v7
- **Server:** Hono (port 3000)
- **Database:** PostgreSQL via Prisma (Neon)
- **Auth:** Clerk OAuth (PKCE flow)
- **Billing:** Polar credits metering
- **AI SDK:** `ai` v6 with Anthropic/OpenAI/OpenRouter providers

## Packages
| Package | Path | Role |
|---------|------|------|
| `@nightcode/shared` | `packages/shared/` | Zod schemas, tool contracts, model registry |
| `@nightcode/database` | `packages/database/` | Prisma schema + client (PostgreSQL) |
| `@nightcode/server` | `packages/server/` | Hono API: auth, billing, sessions, chat streaming |
| `@nightcode/cli` | `packages/cli/` | OpenTUI terminal client |

## Quick Start
```bash
bun run dev:server     # Terminal 1: Hono API on :3000
bun run dev:cli        # Terminal 2: OpenTUI terminal client
```

## Scripts
| Command | Description |
|---------|-------------|
| `bun run dev:cli` | Start CLI in watch mode |
| `bun run dev:server` | Start server with hot reload |
| `bun run build:cli` | Build CLI package |
| `bun run link:cli` | Build + link `nightcode` binary globally |
| `bun run --cwd packages/database db:generate` | Generate Prisma client |

## Architecture
- **Tools execute client-side** in `packages/cli/src/lib/local-tools.ts` — the server only streams AI responses
- **MCP tools** connect via `packages/cli/src/lib/mcp/client.ts` — discovered at startup, sent to server as tool defs, executed CLI-side via `onToolCall`
- **Browse tool** (`packages/cli/src/lib/browser/`) — headless Chromium via Playwright with ARIA snapshot @e-ref interaction
- **Chat flow:** CLI → POST /chat {mcpTools} → server streams AI response → CLI runs tool calls locally (built-in, browse, or MCP) → CLI auto-submits results → repeat
- **Session messages** stored as JSON blobs in Prisma `Session.messages` column
- **Auth** via Clerk PKCE OAuth — token stored at `~/.nightcode/auth.json`
- **Billing** gated by Polar credits balance before sessions and chat requests

## Conventions
- **No comments** in code unless documenting a non-obvious trade-off
- **No classes** — use functions, types, and modules
- **Async/await** everywhere (no raw promises)
- **Zod schemas** defined in `@nightcode/shared` shared between server and CLI
- **Tool contracts** defined with `ai` SDK's `tool()` in shared package; contracts are what the model sees
- **Tool execution** implemented in `local-tools.ts`; validate paths against `process.cwd()`
- **Server routes** use Hono with `zValidator` for input validation
- **Environment variables** loaded from `.env` at project root (by both CLI and server)

## Model Registry
Models defined in `packages/shared/src/models.ts`. Supports Anthropic (`claude-sonnet-4-6`, etc.), OpenAI (`gpt-5.4`, etc.), and OpenRouter (prefixed variants). OpenRouter is the default provider. Default model: `google/gemini-2.5-flash-lite`.

## Tools Currently Available
### Read-only (PLAN + BUILD)
- `readFile` — Read file contents (truncated at 10KB)
- `listDirectory` — List directory entries (not dotfiles/node_modules)
- `glob` — Find files by glob pattern (max 200 results)
- `grep` — Search file contents with regex (max 50 matches)

### Write (BUILD only)
- `writeFile` — Create or overwrite a file
- `editFile` — Targeted string replacement (must be unique)
- `bash` — Run shell command (30s default timeout, 20KB output truncation)
- `webSearch` — Search the web via Exa API
- `browse` — Headless browser: goto, click, fill, snapshot (ARIA + @e refs), screenshot, text, html, url, tabs, close
- `gitStatus` — Show working tree status
- `gitDiff` — Show unstaged diff
- `gitLog` — Show recent commit history
- `gitCommit` — Stage all and commit with a message
- `gitBranch` — List or create branches
- `gitPush` — Push commits to remote

## MCP Integration
MCP servers configured in `nightcode.json` at project root. Servers auto-connected at CLI startup. Default config includes:
- **context7** — Remote MCP for Context7 documentation
- **ghGrep** — Remote MCP for grep.app code search
- **browser** — Local MCP via @browsermcp/mcp (optional, built-in browse tool used instead)

MCP tools are discovered at startup, prefixed with `{serverName}_{toolName}`, and executed CLI-side. Config supports `{env:VAR}` syntax for header values.

## Security Rules
- All file paths must resolve within `process.cwd()` — enforced by `resolveInsideCwd()`
- Auth tokens stored at `~/.nightcode/auth.json` with owner-only permissions (0o600)
- OAuth nonces verified server-side
- Bash commands run in project directory with `TERM=dumb`
- MCP tools are executed CLI-side only; server receives tool definitions but never executes them

## Git State
The active branch is selected by the user. Always check `git status` before making changes. Prefer `editFile` over `writeFile` for modifying existing files. After making changes, run build/typecheck before committing.
