# AGENTS.md

Guidance for autonomous or semi-autonomous coding agents contributing to the Magic Web codebase.

## Mission & Responsibilities
- Deliver changes that align with the existing product vision and user experience.
- Follow repository conventions for TypeScript, React, styling, and internationalization.
- Provide concise, auditable change descriptions and list follow-up actions when relevant.
- Default to non-destructive, minimal edits that respect any existing local modifications.

## Environment & Tooling
- **Runtime**: Node.js ≥ 18, package manager is `pnpm` (v9+). Do not switch managers.
- **Key commands**
  - `pnpm install` — install dependencies.
  - `pnpm dev` — HTTPS dev server on port 443.
  - `pnpm build` / `pnpm preview` — production bundle & preview.
  - `pnpm lint`, `pnpm lint:fix` — linting and auto-fix.
  - `pnpm test`, `pnpm test:watch`, `pnpm coverage` — Vitest suite.
  - `pnpm test path/to/spec.test.ts` — run focused tests.
- Prefer `rg` for code search, `pnpm` scripts for tooling, and `apply_patch` for edits that are not auto-generated.

## Architecture Snapshot
- **Framework**: React 18 + TypeScript compiled by Vite.
- **Styling**: 
  - **New components**: Use shadcn/ui + Tailwind CSS (configured in `components.json`)
  - **Existing components**: antd-style CSS-in-JS (frozen, maintenance only)
  - Never mix both styling systems in a single component
  - Never add Less, CSS modules, or `styled-components`
- **Icons**: 
  - **Primary**: Use `lucide-react` (preferred icon library)
  - **Fallback**: Use `@tabler/icons-react` only if icon not available in lucide-react
  - Always use 16px size for consistent visual alignment
- **State**: MobX for global stores (`src/stores/`)
- **UI Layers**:
  - `src/` — main (commercial) application.
  - `src/opensource/` — open-source edition; mirror patterns but reduced scope.
- **Components**: Base components in `src/components/base/`, business widgets in `src/components/business/`, node/TipTap extensions under `src/components/tiptap-*`.
- **APIs & Services**: REST/WebSocket clients in `src/apis/`, business logic in `src/services/`.
- **Internationalization**: `react-i18next` with locales in `src/opensource/assets/locales/{zh_CN,en_US}/`.
- **Testing**: Vitest with `__tests__/` colocated alongside source.

## Implementation Standards
- Maintain strict TypeScript typing; add or update types when altering APIs or props.
- Keep React components modular: separate `styles.ts`, `types.ts`, `hooks/`, and `index.tsx` where the pattern already exists.
- **Styling conventions**:
  - **For new components**: Use Tailwind CSS utility classes and shadcn/ui components from `@/opensource/components/shadcn-ui`
  - **For existing components**: Use `createStyles` and `cx` helpers from `antd-style`; never import `classnames` or `clsx`
  - **Never mix**: Do not use Tailwind and antd-style in the same component
  - Tailwind config: `tailwind.config.ts`, CSS variables in `src/index.css`
  - shadcn/ui config: `components.json` with aliases pointing to `@/opensource/`
- All user-visible strings must use i18n keys. Update both `zh_CN` and `en_US` dictionaries together.
- Honour existing project aliases (`@/`) and barrel exports. Add exports to `index.ts` files when exposing new modules.
- When touching MobX stores, ensure actions remain pure and derivations are memoized where necessary.
- Keep business logic out of presentation components—place it in services or hooks.

## Workflow for Agents
1. **Orient**: Read the user request, repo instructions (`README.md`, `CLAUDE.local.md`, this file), and any task-specific files.
2. **Investigate**: Use `rg`/`pnpm` tooling to locate relevant code; inspect existing patterns before creating new ones.
3. **Plan**: Outline multi-step approaches for non-trivial work; update plan status as steps progress.
4. **Implement**: Prefer minimal, targeted diffs. Annotate complex logic with succinct comments when needed.
5. **Verify**: Run lint/tests that are impacted; if tooling cannot be executed, explain the gap and how to verify manually.
6. **Report**: Summarize changes, reference touched files with line numbers, and call out risks or follow-up work.

## Testing & Quality Gates
- Always run `pnpm lint` and relevant `pnpm test` commands when feasible.
- For utility changes, add or update Vitest specs under `__tests__/`.
- For UI changes, describe manual verification steps (screens navigated, states tested) if automated tests are absent.
- Keep coverage stable; when adding significant logic, include regression tests.

## Task Playbooks
- **UI Adjustments**: 
  - For new components: Use shadcn/ui + Tailwind CSS, ensure props are typed, update i18n keys
  - For existing components: Mirror component structure, extend styles via `createStyles`, maintain consistency
  - Never convert existing antd-style components to Tailwind unless explicitly requested
- **Data/Store Changes**: Modify MobX/Zustand stores cautiously, update dependent selectors, and add tests or storybook notes if behaviour shifts.
- **Docs & Configuration**: Keep documentation bilingual when user-facing, and update related config or example snippets.
- **Bug Fixes**: Reproduce, add a failing test when practical, fix, and confirm the test passes.

## Communication & Deliverables
- Provide final responses that start with the change explanation (no “summary” heading) and list modified files with precise paths.
- Mention tests executed (or unexecuted with reasons). Suggest logical next steps when they exist (e.g., run `pnpm build`, deploy).
- Flag assumptions, unresolved questions, or potential regressions explicitly so maintainers can follow up.

## Helpful References
- `README.md` — onboarding, workflows, environment requirements.
- `CLAUDE.local.md` — Claude-specific but useful architectural overview.
- `docs/` — additional project manuals and architectural deep dives.
- `vitest.config.ts`, `vite.config.ts` — testing/build behaviour.
- `tsconfig*.json` — TypeScript compiler settings and path aliases.

Following this guide keeps automated contributors aligned with the core team’s standards while minimizing integration friction.
