# CanvasDesign Modules

CanvasDesign keeps its public root at `src/components/CanvasDesign`, but the implementation is organized by domain. Code should import only from the canonical directories below.

## Directory Map

| Directory | Owns |
| --- | --- |
| `public/` | Host-facing props, refs, host ports, magic config, plugin types, and document types. |
| `app/providers/` | React context providers and provider hooks. |
| `app/hooks/canvas/` | React hooks that observe or expose the canvas instance and canvas events. |
| `app/hooks/resources/` | React hooks that resolve image/video/resource URLs and host data. |
| `app/hooks/layout/` | Floating component positioning and layout observation hooks. |
| `app/shell/` | CanvasDesign provider composition and mounted content shell. |
| `runtime/core/` | Canvas instance, event emitter, magic config, permissions, and runtime coordination. |
| `runtime/document/` | Canvas document types, patch/merge/index/export, validation, and temporary element handling. |
| `runtime/elements/` | Element classes and decorators, split by element domain. |
| `runtime/interaction/` | Input, selection, transform, tools, keyboard, clipboard, history, viewport, crop, extend, eraser, labels, markers, and other interaction managers. |
| `runtime/resources/` | Image/video loading, upload, polling, offline cache, scheduler, visibility, diagnostics, and media resource helpers. |
| `runtime/actions/` | User action registry and command categories. |
| `runtime/plugins/` | Plugin manager and plugin resolution. |
| `runtime/text/` | Text editing overlay, rich text model, text layout, and typography helpers. |
| `runtime/shared/` | Cross-runtime helpers for geometry, placement, path, DOM, media, render, normalization, ids, and throttling. |
| `ui/toolbar/` | Main canvas toolbar and plugin entry button. |
| `ui/element-tools/` | Unified selected-element tool catalog, surfaces, renderers, domain components, and media editor sessions. |
| `ui/layers/` | Layers drawer, previews, button, empty state, and resize handle. |
| `ui/element-tools/editors/` | Image and video generation editor sessions. |
| `ui/panels/` | Crop, extend, eraser, history, source list, menu, rename, tips, action hints, and plugin panels. |
| `ui/fullscreen/` | Fullscreen shells and image/video/audio/media-resource overlays. |
| `ui/previews/` | Reusable media preview UI. |
| `ui/primitives/` | CanvasDesign-local shadcn wrappers, custom primitives, and icons. |
| `ui/canvas-editor/` | Canvas editor chrome such as zoom and generated media action bars. |
| `assets/` | Static images, SVGs, and locale data. |
| `docs/` | Long-form internal documentation. |

## Where To Edit

| Need | Start Here |
| --- | --- |
| Add or change the host API | `public/` |
| Add a prop/ref method exposed to hosts | `public/props.ts`, `public/ref.ts`, `app/hooks/canvas/useCanvasDesignRef.ts` |
| Change provider state or context hooks | `app/providers/` |
| Change canvas startup, teardown, or document loading | `app/shell/CanvasDesignContent.tsx`, `runtime/core/Canvas.ts` |
| Change shell/provider composition | `app/shell/CanvasDesignProviders.tsx` |
| Change document merge/patch/export behavior | `runtime/document/` |
| Add or modify an element class | `runtime/elements/<domain>/` |
| Add a toolbar tool | `ui/toolbar/` or `runtime/interaction/tools/` |
| Change selected-element controls | `ui/element-tools/components/<domain>/` or `ui/element-tools/editors/<domain>/` |
| Change selection, transform, hover, snap, viewport, or keyboard behavior | `runtime/interaction/<domain>/` |
| Change image/video resource loading | `runtime/resources/image/`, `runtime/resources/video/`, `runtime/resources/visibility/` |
| Change upload or polling | `runtime/resources/upload/`, `runtime/resources/polling/` |
| Change offline media cache | `runtime/resources/offline-cache/` |
| Change plugin runtime protocol or bridge | `ui/panels/plugin/runtime-protocol/`, `ui/panels/plugin/runtime-bridge/`, `runtime/plugins/` |
| Change plugin window UI | `ui/panels/plugin/window/` |
| Change message editor reference assets | `ui/editors/message/reference-assets/` |
| Change image generation editor | `ui/element-tools/editors/image/` |
| Change video generation editor | `ui/element-tools/editors/video/` |
| Change fullscreen media UI | `ui/fullscreen/` |
| Change local UI primitives | `ui/primitives/` |

## Removed Compatibility Paths

Old deep paths under `canvas/`, `components/`, `context/`, `hooks/`, `model/`, `lib/`, and `utils/` were removed. Root compatibility files `types.ts` and `types.magic.ts` were also removed.

Use these canonical replacements instead:

- `@/components/CanvasDesign/public/props`
- `@/components/CanvasDesign/public/magic-types`
- `@/components/CanvasDesign/runtime/document/types`
- `@/components/CanvasDesign/runtime/core/Canvas`
- `@/components/CanvasDesign/runtime/document`
- `@/components/CanvasDesign/ui/toolbar`

## Import Rules

- CanvasDesign implementation code should import from canonical `app/`, `runtime/`, `ui/`, or `public/` paths.
- `runtime/` must not import from `ui/`.
- Do not add compatibility re-export directories or import from removed legacy paths.
- CanvasDesign must not import SuperMagic pages, app stores, or models. Host-specific decisions should be passed through `public/` types and `magic.permissions` or `magic.methods`.
- Plugin entry visibility is owned by the host through `MagicPermissions.showPluginEntry`.

## Safety Checks

Run these checks after directory or import boundary changes:

```bash
rg "CanvasDesign/""(canvas|components|context|hooks|model|lib|utils|types|types\.magic)" frontend/magic-web -g '*.{ts,tsx,md,mdx}'
rg "@/pages|@/models|@/stores" frontend/magic-web/src/components/CanvasDesign -g '*.{ts,tsx}'
rg "(from\s+[\"'][^\"']*(/ui/|/components/|@/components/CanvasDesign/ui|@/components/CanvasDesign/""components)|import\(\s*[\"'][^\"']*(/ui/|/components/|@/components/CanvasDesign/ui|@/components/CanvasDesign/""components))" frontend/magic-web/src/components/CanvasDesign/runtime -g '*.{ts,tsx}'
rg "(from\s+[\"'][^\"']*app/|import\(\s*[\"'][^\"']*app/)" frontend/magic-web/src/components/CanvasDesign/runtime frontend/magic-web/src/components/CanvasDesign/public -g '*.{ts,tsx}'
find frontend/magic-web/src/components/CanvasDesign -maxdepth 1 -type f \( -name '*.md' -o -name '*.mdx' -o -name 'types.ts' -o -name 'types.magic.ts' \)
```

The first four commands should print nothing. The `find` command should also print nothing.
