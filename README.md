# Mermaid MCP App

A streamable MCP App server that renders interactive Mermaid diagrams with live preview, theme switching, and fullscreen editing.

## Features

- **Streaming Preview** - Watch diagrams render progressively as the model generates them
- **Interactive Pan/Zoom** - Navigate large diagrams with mouse controls
- **Fullscreen Editor** - Edit Mermaid syntax with live preview
- **Theme Switching** - Choose from 5 built-in Mermaid themes
- **All Diagram Types** - Flowcharts, sequence, class, state, ER, gantt, pie, git graphs, and more
- **Export** - Copy SVG to clipboard for external use
- **Client-side Rendering** - No server dependencies, runs entirely in the browser

## Installation

```bash
npm install
```

## Development

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start at `http://localhost:3001/mcp`

## Build

Build for production:

```bash
npm run build
```

This creates:
- `dist/mcp-app.html` - Single-file bundled UI
- `dist/server.js` - MCP server
- `dist/index.js` - CLI entry point

## Usage

### Local (HTTP)

```bash
npm run serve
# or
node dist/index.js
```

### Local (stdio)

```bash
node dist/index.js --stdio
```

### Vercel Deployment

Deploy to Vercel for remote access:

```bash
npx vercel
```

The MCP endpoint will be available at `https://your-deployment.vercel.app/mcp`

## MCP Tools

### `read_me`

Returns comprehensive Mermaid syntax reference with examples for all diagram types.

**Usage**: Call this before `create_view` to learn Mermaid syntax.

### `create_view`

Renders a Mermaid diagram with streaming animations.

**Parameters**:
- `mermaid` (string, required) - Mermaid diagram syntax
- `theme` (string, optional) - One of: `default`, `forest`, `dark`, `neutral`, `base`
- `title` (string, optional) - Title to display above the diagram

**Example**:
```typescript
{
  "mermaid": "flowchart TD\n  A[Start] --> B[End]",
  "theme": "forest",
  "title": "Simple Flow"
}
```

### `export_svg` (app-only)

Export the rendered diagram as SVG. Called by the UI, not by the model.

## Architecture

- **Server**: Node.js with Express + MCP SDK
  - Supports both Streamable HTTP and stdio transports
  - Stateless per-request design (no sessions)
- **UI**: React 19 with Mermaid.js
  - Loaded from CDN (jsdelivr) via importmap
  - Client-side rendering for zero server dependencies
  - Single-file HTML bundle via Vite
- **Build**: TypeScript + Vite + Bun
  - Type-safe server and client code
  - Optimized production bundles

## File Structure

```
mermaid-mcp-app/
├── src/
│   ├── server.ts          # MCP server with tool registration
│   ├── main.ts            # Transport layer (HTTP + stdio)
│   ├── mcp-app.html       # HTML shell with importmap
│   ├── mcp-app.tsx        # React UI component
│   └── global.css         # Styles
├── api/
│   └── mcp.ts            # Vercel serverless handler
├── dist/                  # Build output
├── scripts/
│   └── setup-bun.mjs     # Auto-install bun
├── package.json
├── tsconfig.json          # Client TS config
├── tsconfig.server.json   # Server TS config
├── vite.config.ts         # Vite bundler config
├── vercel.json           # Vercel deployment config
└── manifest.json         # MCP app manifest
```

## Technologies

- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol
- [ext-apps](https://github.com/modelcontextprotocol/ext-apps) - MCP Apps extension
- [Mermaid.js](https://mermaid.js.org/) - Diagram generation
- [React 19](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Bun](https://bun.sh/) - Build bundler

## License

MIT
