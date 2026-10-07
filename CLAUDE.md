# Obsidian MCP Tools

A Bun monorepo containing an MCP server (`packages/mcp-server`, compiled to a binary) and an Obsidian plugin (`packages/obsidian-plugin`) that expose Obsidian vault data to Claude Desktop, plus shared types and the categorization prompt (`packages/shared`). Architecture notes: `docs/project-architecture.md`.

This is Jason's fork: `origin` is `JasonBates/obsidian-mcp-tools-dev`, and the `upstream` remote is `jacksteamdev/obsidian-mcp-tools`.

## Build commands

```bash
bun install                                     # install dependencies
bun --filter '*' check                          # type check all packages
cd packages/mcp-server && bun run build         # MCP server binary -> packages/mcp-server/dist/mcp-server
cd packages/mcp-server && bun run test          # MCP server tests
cd packages/obsidian-plugin && bun run build    # Obsidian plugin (runs check first)
cd packages/obsidian-plugin && bun run link <vault-config-path>   # link plugin into a vault for development
```

`bin/` holds only the `dev` watch binary (gitignored); `build` writes to `packages/mcp-server/dist/`.

## Secrets

- MCP server: expects `OBSIDIAN_API_KEY` (from the Local REST API plugin); optional `OPENAI_API_KEY` for the categorization tool.
- Plugin: the OpenAI API key is stored in plugin settings (local Obsidian data).
- `data.json` is a local settings file (gitignored); never commit it.
