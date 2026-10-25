# AGENTS.md

Guidance for autonomous or semi-autonomous coding agents contributing to the Magic Web codebase.

Instruction priority: system/developer instructions and the user's request take precedence over this file; this file takes precedence over an applicable Skill; reference documents provide context only. If guidance conflicts, follow the higher-priority instruction and report the conflict when it affects the result.

## Mission & Responsibilities
- Deliver changes that align with the existing product vision and user experience.
- Follow repository conventions for TypeScript, React, styling, and internationalization.
- Provide concise, auditable change descriptions and list follow-up actions when relevant.
- Default to non-destructive, minimal edits that respect any existing local modifications.

## Environment & Tooling
- **Runtime**: Node.js ≥ 18, package manager is `pnpm` (v9+). Do not switch managers.
- **Browser compatibility standard**: Chrome/Edge `111+`, Firefox `114+`, Safari `16.4+` are the supported minimums. Treat this range as the target for new browser-facing code.
- Browsers below the supported minimum only receive the early upgrade prompt; no compatibility is promised for them. `package.json#browserslist` describes build output only and neither widens nor narrows this standard.
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
  - `src/` — primary application source; baseline for the open-source edition build.
  - `enterprise/src/` — enterprise overlay: mirror the same relative paths as `src/` where behavior differs (`vitePluginLayeredOverlay` in `vite/config/enterprise/index.ts`).
- **Components**: Base components in `src/components/base/`, business widgets in `src/components/business/`, node/TipTap extensions under `src/components/tiptap-*`.
- **APIs & Services**: REST/WebSocket clients in `src/apis/`, business logic in `src/services/`.
- **Internationalization**: `react-i18next` with locales in `src/assets/locales/{zh_CN,en_US}/`.
- **Testing**: Vitest with `__tests__/` colocated alongside source.

## Implementation Standards
- **Navigation feedback**: Reuse shared navigation components with their complete hover and keyboard-focus behavior. For `SidebarRow`, use `labelVariant="navigation"` to inherit the sidebar hover and `focus-visible` background treatment. Do not copy thick black/gray focus rings into sidebar navigation entries or treat focus as route selection; keep selection in its existing state contract.
- **Focus preservation**: Removing a focus outline or ring requires a visible, theme-aware keyboard-focus alternative. Do not hide focus problems with `blur()`, blocked focus, removed tab stops, or global outline/ring resets; preserve dialog focus restoration. Inputs and other controls retain their component-specific focus design.
- Before adding or changing tooltips, read [Tooltip usage](src/components/base/MagicTooltip/README.md). Use the existing entries for action labels and truncated text; preserve the interaction and lifecycle of rich content and media previews.
- Maintain strict TypeScript typing; add or update types when altering APIs or props.
- **Structured reference tags**: Adding or changing a tag requires checking source data, model-readable serialization, standard clipboard formats, paste recognition and earlier input routing, schema, history rendering, and re-editing together. Rendering alone does not complete the feature. Preserve real file identity internally and resolvable paths plus necessary task context in model-readable text; do not replace missing identity with a display name or expose unnecessary editor metadata.
- Keep React components modular: separate `styles.ts`, `types.ts`, `hooks/`, and `index.tsx` where the pattern already exists.
- For changes under an edition-shared or edition-specific module, check whether `enterprise/` has a corresponding implementation, adapter, test, or config that must be updated in sync. Do not scan the whole overlay for unrelated changes.
- **Styling conventions**:
  - **For new components**: Use Tailwind CSS utility classes and shadcn/ui components from `@/components/shadcn-ui`
  - **For existing components**: Use `createStyles` and `cx` helpers from `antd-style`; never import `classnames` or `clsx`
  - **Never mix**: Do not use Tailwind and antd-style in the same component
  - Tailwind config: `tailwind.config.ts`, CSS variables in `src/index.css`
  - shadcn/ui config: `components.json` with aliases pointing to `@/components/shadcn-ui`, `@/utils/cn`, etc.
- All user-visible strings must use i18n keys. Update both `zh_CN` and `en_US` dictionaries together.
- **i18n — React**: After `const { t } = useTranslation("namespace")`, only use **literal** keys, e.g. `t("common.confirm")`. Do not pass `t` as props or helper args typed as generic `string` keys—static tools lose track. Long copy: same file, inline right after `useTranslation`, or a `use*` hook that calls `useTranslation` itself.
- **i18n — keys**: Keys must be **static full strings** (`t("a.b.c")`). Avoid building keys from variables, `+`, or template literals—tooling cannot see those. Use dynamic keys **only** when there is no workable literal-based design; add a short comment explaining why.
- **i18n — elsewhere**: In plain functions, stores, or post-init module code (no hooks), use **`i18next.t("key", { ns: "…" })`** or **`i18next.getFixedT(i18next.language, "ns")`** with literal keys; call only after i18n has initialized. Language-sensitive UI still belongs in components with `useTranslation`.
- Honour existing project aliases (`@/`) and barrel exports. Add exports to `index.ts` files when exposing new modules.
- **Scroll areas**: Wrap new or modified scrollable content regions with the shared `ScrollArea` from `@/components/shadcn-ui/scroll-area`. Use `viewportRef` for scroll positioning and `viewportClassName` for viewport behavior; do not create separate native `overflow-auto` / `overflow-scroll` containers for product content. Keep independent panels in separate `ScrollArea` instances, with controls outside the scrolling viewport.
- **Mobile detection**: Use `@/hooks/useIsMobile` as the default source of truth for mobile viewport checks. Do not introduce new business usage of `@/hooks/use-mobile`; treat it as a compatibility entry only unless a task explicitly requires otherwise.
- **Desktop and mobile coverage**: Every UI or route change must be checked on both desktop and mobile (390px wide) without being asked, and the report must say what was checked. Before finishing, confirm:
  - The page renders correctly at both widths with no horizontal overflow. A wide child (table, matrix) inside a `ScrollArea` stretches the Radix `display: table` wrapper; use `viewportClassName="[&>div]:!block"` so banners and cards keep the viewport width.
  - A new or moved mobile route is registered in `src/pages/superMagicMobile/layout/MainLayout/resolveEmbeddedShellState.ts` (mobile shell, sidebar entry, generic header) and covered by its test. Pages that draw their own header must not also show the generic header; a top-level page needs the `MobileShellSidebarToggleButton`, a detail page needs a back control, and back and sibling navigation go through route names.
  - Rows of controls wrap or stack on narrow screens instead of squeezing text; tap targets are comfortable (about 40px or more); icon-only controls carry an accessible name.
  - Desktop-only hints (keyboard shortcuts, hover text) are not shown on mobile, and mobile-only UI is not mounted on desktop (lazy-load it when its dependencies are heavy).
- When touching MobX stores, ensure actions remain pure and derivations are memoized where necessary.
- Keep business logic out of presentation components—place it in services or hooks.
- **Commentary**: All code contributions must include guiding comments for:
  - **Complex Logic**: Explain *why* a specific approach was taken, especially for edge cases or defensive code.
  - **Layout & CSS**: For non-obvious styling (e.g., specific `z-index`, `overflow` hacks, or mobile-specific positioning), describe the intended visual behavior.
  - **Hooks & Context**: Annotate the purpose and source of injected data (e.g., `useOutletContext`) to help future maintainers understand component dependencies.


## Temporary File URL Lifecycle

临时文件链接包括图片、视频、音频、文档、表格、演示文稿、HTML iframe 内部资源和在线查看器继续使用的文件地址。Media 只是其中一类；判断依据是链接是否会在页面打开后继续被使用。

- 文件链接记录至少保留文件身份、访问范围、文件版本或更新时间、URL、过期时间和当前状态。长期使用的组件不能只保存一个裸 URL，也不能在没有可信过期信息时无限期复用它。
- 项目文件通过绑定访问身份的 `FileApi` 和 `sharedMediaUrlCache` 获取；聊天文件、知识库文件、Canvas 文件和 HTML iframe 内部文件继续使用各自的获取模块，但必须提供等价的「检查当前链接是否可用」和「重新获取链接」入口。
- 长时间使用的链接在再次绑定、打开或播放前检查是否仍可用；正在播放的媒体在失效前刷新，加载失败时最多强制重新获取一次。刷新请求要合并、可取消，并阻止旧请求覆盖较新的链接。
- 重新绑定媒体时保留用户可恢复的状态：视频和音频至少保留播放位置；视频还要保留音量、静音、播放速率和播放意图。刷新失败继续显示原有错误状态，不能循环请求。
- 文本、Blob 或 ArrayBuffer 已成功下载后，后续渲染使用内存内容，不为已经脱离 URL 的内容设置续期计时器。下载、打开新窗口等一次性动作在动作发生时获取当前可用链接，不能提前保存供未来使用的签名 URL。
- URL 缓存键必须包含访问身份和必要的文件版本信息，不能只用 `file_id`。新增临时链接入口时，代码说明必须写清负责获取链接的模块、过期判断点、错误恢复点、取消路径和是否需要播放期间刷新。

## Recovery after browser suspension

- New or changed server-backed views that consume real-time events must define how their current data is reconciled after page visibility returns, bfcache restoration, or network recovery. A WebSocket `OPEN` state or receipt of an event does not prove that missed changes were recovered.
- Reuse the module's existing authorized reads, update queue, and merge logic. Add a recovery trigger at the existing data owner; do not introduce an application-wide scheduler, another store, permanent polling, or migrate unrelated working modules for a local recovery requirement.
- Background reconciliation must retain rendered content until a successful result is ready. Preserve selection, scroll, pagination, open tabs, viewport, local drafts, editing conflicts, and explicitly selected historical versions; do not simulate manual refresh or remount a view to update it.
- Coalesce repeated triggers, retain changes received during reconciliation, and reject stale results after project, account, organization, or access-scope changes. Abort or unsubscribe when the consumer leaves; one consumer must not cancel a shared read still needed by another.
- Notify dependent content only after the recovered data has successfully committed and entered that consumer's context. Request completion, including failure, is not a successful reconciliation. For example, commit the project file snapshot before checking an open canvas version.
- Recovery re-reads state; it must not restart recording, resend queued messages, repeat writes, broaden share permissions, or replay one-time notifications. Preserve existing error handling, resource expiry rules, and normal polling budgets. State any uncovered recovery path instead of claiming global coverage.

## Workflow for Agents
1. **Orient**: Read the user request, applicable parent instructions, this file, and task-specific files. Read `README.md` or `CLAUDE.local.md` only when the task depends on their documented workflow or architecture.
2. **Investigate**: Use `rg`/`pnpm` tooling to locate relevant code; inspect existing patterns before creating new ones.
3. **Plan**: Outline multi-step approaches for non-trivial work; update plan status as steps progress.
4. **Implement**: Prefer minimal, targeted diffs. Annotate complex logic with succinct comments when needed.
5. **Verify**: Run lint/tests that are impacted; if tooling cannot be executed, explain the gap and how to verify manually.
6. **Report**: Summarize changes, reference touched files with line numbers, and call out risks or follow-up work.

## Testing & Quality Gates
- Run focused lint and relevant tests when feasible. Do not run repository-wide type-check or lint commands by default; use them only when the task explicitly requires full validation or a focused check cannot cover the change.
- For utility changes, add or update Vitest specs under `__tests__/`.
- For UI changes, describe manual verification steps (screens navigated, states tested) if automated tests are absent.
- Keep coverage stable; when adding significant logic, include regression tests.

## Task Playbooks
- **UI Adjustments**:
  - For new components: Use shadcn/ui + Tailwind CSS, ensure props are typed, update i18n keys
  - For existing components: Mirror component structure, extend styles via `createStyles`, maintain consistency
  - Never convert existing antd-style components to Tailwind unless explicitly requested
  - Check desktop and mobile layouts as described in "Desktop and mobile coverage" before reporting the change as done; include both in the manual verification notes
- **Data/Store Changes**: Modify MobX/Zustand stores cautiously, update dependent selectors, and add tests or storybook notes if behaviour shifts.
- **Super Magic File-System Performance**: Treat 10k files as the baseline: do not `JSON.stringify`, deep-clone, deep-compare, or log full `attachments` / `attachmentList` / `renderProps` in render paths; use `loadProjectAttachments`, `attachmentIndex` / `treeIndex`, primitive cache keys, abortable requests, and explicit MobX annotations for large input configs.
- **Network file operations**: Copy/cut only records clipboard intent. Actual copy/move writes must use the shared scope confirmation after preparation; show preparation in a centered modal with cancellation. Cancelling preparation is not rollback of already submitted writes. Reuse the existing file menus, upload queues, conflict handling, and operation lifecycle.
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
