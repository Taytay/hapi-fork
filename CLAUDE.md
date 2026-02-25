# HAPI Monorepo

TypeScript/Bun monorepo with 6 workspace packages.

## Package Structure

| Package | Path       | Description                                       |
| ------- | ---------- | ------------------------------------------------- |
| CLI     | `cli/`     | HAPI CLI tool (Bun runtime)                       |
| Hub     | `hub/`     | Backend server (Hono + Socket.IO + SQLite)        |
| Web     | `web/`     | React frontend (Vite + TailwindCSS)               |
| Shared  | `shared/`  | Protocol types and Zod schemas (`@hapi/protocol`) |
| Website | `website/` | Marketing site                                    |
| Docs    | `docs/`    | VitePress documentation                           |

## Common Commands

```bash
# Install dependencies
bun install

# Development
bun run dev          # Hub + Web concurrently
bun run dev:hub      # Hub only
bun run dev:web      # Web only

# Build
bun run build        # All packages
bun run build:cli    # CLI only
bun run build:hub    # Hub only
bun run build:web    # Web only

# Quality
bun run format       # Format with Prettier
bun run format:check # Check formatting
bun run lint         # ESLint
bun run lint:fix     # ESLint with auto-fix
bun run typecheck    # TypeScript checks (cli + web + hub)

# Testing
bun run test         # All tests (cli + shared + hub + web)
bun run test:cli     # CLI tests only
bun run test:shared  # Shared package tests only
bun run test:hub     # Hub tests only
bun run test:web     # Web tests only
```

## Code Style

- **No semicolons**, single quotes, 4-space indent, 120-char print width
- Prettier enforces formatting (config: `.prettierrc`)
- ESLint enforces TypeScript best practices (config: `eslint.config.js`)
- Website has its own Prettier config (2-space indent, semicolons, double quotes)

## Testing

- **CLI**: Vitest (extensive coverage, 19+ test files)
- **Web**: Vitest + jsdom + Testing Library (chat pipeline tests)
- **Hub**: Vitest (SSE manager, notifications, terminal handling)
- **Shared**: Vitest (schema validation, utility functions, modes)

## Key Architecture

- **Chat pipeline**: `normalizeAgent` → `tracer` → `reducerTimeline` → `reconcile`
- **Sync**: Real-time via Socket.IO + SSE, with versioned updates (optimistic locking)
- **Auth**: JWT tokens, Telegram init data validation
- **Shared protocol**: Zod schemas for type-safe message passing between packages
