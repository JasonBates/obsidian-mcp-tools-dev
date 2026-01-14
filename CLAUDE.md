# Obsidian MCP Tools

## Overview
A monorepo containing an MCP server and Obsidian plugin for exposing Obsidian vault data to Claude Desktop via the Model Context Protocol.

## Architecture

```
obsidian-mcp-tools-dev/
├── packages/
│   ├── mcp-server/              # MCP server (compiled to binary)
│   │   └── src/
│   │       ├── index.ts         # Entry point
│   │       └── features/
│   │           ├── core/        # ObsidianMcpServer base
│   │           ├── local-rest-api/   # Obsidian REST API integration
│   │           ├── smart-connections/ # Semantic search via embeddings
│   │           ├── llm-categorization/ # GPT-4o note categorization
│   │           ├── moc-linking/      # Map of Contents linking
│   │           ├── templates/        # Templater execution
│   │           ├── fetch/            # Web content fetching
│   │           └── prompts/          # Prompt resources
│   │
│   ├── obsidian-plugin/         # Obsidian plugin
│   │   └── src/
│   │       ├── main.ts          # Plugin entry point
│   │       └── features/
│   │           ├── core/             # Plugin core & settings UI
│   │           ├── categorization/   # GPT-4o note categorization (Ctrl+Alt+V)
│   │           └── mcp-server-install/ # MCP server installer/manager
│   │
│   ├── shared/                  # Shared types & utilities
│   │   └── src/
│   │       ├── index.ts         # Exports
│   │       ├── types/           # Shared type definitions
│   │       └── prompts/
│   │           └── categorization.ts  # Shared categorization prompt
│   │
│   └── test-site/               # SvelteKit development/testing app
│
├── bin/                         # Compiled binaries (gitignored)
├── dist/                        # Distribution files
├── main.js                      # Compiled plugin bundle
└── manifest.json                # Obsidian plugin manifest
```

## Key Components

### MCP Server Features
- **local-rest-api**: Vault file operations via Obsidian Local REST API plugin
- **smart-connections**: Semantic search using Smart Connections plugin
- **llm-categorization**: `categorize_note` tool using GPT-4o for MoC linking
- **moc-linking**: `link_to_mocs` tool for semantic MoC connections
- **templates**: Execute Templater templates with arguments
- **fetch**: Fetch and convert web content to markdown

### Obsidian Plugin Features
- **categorization**: Ctrl+Alt+V hotkey to categorize current note with MoCs
- **mcp-server-install**: Install/configure MCP server for Claude Desktop
- **Settings UI**: Configure OpenAI API key for categorization

### Shared Package
- Type definitions for Local REST API
- Categorization prompt (single source of truth)
- `extractConnectedSection()` function for parsing GPT responses

## Build Commands
```bash
# Install dependencies
bun install

# Type check all packages
bun --filter '*' check

# Build MCP server binary
cd packages/mcp-server && bun run build

# Build Obsidian plugin
cd packages/obsidian-plugin && bun run build

# Link plugin to vault for development
cd packages/obsidian-plugin && bun run link <vault-config-path>
```

## Secrets Management
- **MCP Server**: Expects `OBSIDIAN_API_KEY` env var (from Local REST API plugin)
- **MCP Server**: Optional `OPENAI_API_KEY` for categorization tool
- **Plugin**: OpenAI API key stored in plugin settings (local Obsidian data)
- **data.json**: Local settings file (gitignored)

## Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol
- `openai` - OpenAI API client
- `arktype` - Type validation
- `obsidian` - Obsidian API (plugin)
- `svelte` - UI components (plugin)
- `fastmcp` concepts via SDK

## Platform Support
Binary builds available for:
- Linux (x64)
- macOS (ARM64, x64)
- Windows (x64)
