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

# Quality (Biome)
bun run format       # Format with Biome (auto-fix)
bun run format:check # Check formatting (no changes)
bun run lint         # Lint with Biome
bun run lint:fix     # Lint with auto-fix
bun run check        # Format + lint + import sorting (all-in-one)
bun run check:fix    # Format + lint + import sorting with auto-fix
bun run typecheck    # TypeScript checks (cli + web + hub)

# CI / pre-commit
bun run ci           # Full CI check: format, lint, typecheck, test

# Testing
bun run test         # All tests (cli + hub + web)
bun run test:cli     # CLI tests only
bun run test:hub     # Hub tests only
bun run test:web     # Web tests only
```

## Code Style

Biome handles both formatting and linting (config: `biome.json`).

- Single quotes, 4-space indent, 120-char line width
- Semicolons enforced (Biome default)
- Trailing commas enforced (Biome default)
- Import sorting via Biome's `organizeImports`
- Website has its own override (2-space indent, double quotes, 80-char width)

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
