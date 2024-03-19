# @dtyq/user-selector

A React + TypeScript user selection library for organization trees, users, groups, and partner entities.

It ships with:

- A desktop selector (`UserSelector`)
- A mobile-first selector (`MobileUserSelector`)
- Shared building blocks (search, selected panel, permission panel, list panels)
- Strong type exports for host-app integration

## Why this library

`@dtyq/user-selector` is designed for real-world enterprise selection flows:

- Organization hierarchy navigation with breadcrumb path control
- Mixed-entity selection (`department`, `user`, `group`, `userGroup`, `partner`)
- Optional permission editing panel for selected users
- Segmented scenarios such as recent contacts, resigned users, and share flows
- Controlled component APIs for async data and external state management

## Features

- Multi-select and single-select behavior (via `checkbox`)
- Search mode with paginated results (`searchData`)
- Segment mode for scenario-specific data (`segmentData`)
- Permission panel (`useAuthPanel`) with operation types
- Custom right-side rendering hooks (`renderRight*`)
- Light/Dark themes and i18n (`zh_CN`, `en_US`) via `AppearanceProvider`
- Mobile-safe-area support in `MobileUserSelector`

## Installation

```bash
pnpm add @dtyq/user-selector
# or
npm install @dtyq/user-selector
# or
yarn add @dtyq/user-selector
```

Import the packaged stylesheet once in your app entry:

```tsx
import "@dtyq/user-selector/style.css"
```

> This package is styled with Tailwind-style utility classes and CSS variables.  
> Ensure your app does not reset or override the component styles unintentionally.

## Peer Dependencies

Install peer dependencies required by your app runtime:

- `react` / `react-dom` (18+)
- Radix UI primitives used by the package
- `ahooks`
- `lodash-es`
- `@tabler/icons-react`
- `react-infinite-scroll-component`
- `sonner`
- `vaul`

See `package.json` for the exact semver ranges.

## Quick Start

### 1) Basic desktop selector

```tsx
import { useState } from "react"
import {
  AppearanceProvider,
  UserSelector,
  NodeType,
  type TreeNode,
  type OrganizationNode,
} from "@dtyq/user-selector"
import "@dtyq/user-selector/style.css"

const orgData: OrganizationNode[] = [
  { id: "dept-1", name: "Engineering", dataType: NodeType.Department, has_child: true },
  { id: "user-1", name: "Alice", dataType: NodeType.User, real_name: "Alice" },
]

export default function Example() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<TreeNode[]>([])

  return (
    <AppearanceProvider language="en_US" theme="light">
      <button onClick={() => setOpen(true)}>Open selector</button>
      <UserSelector
        open={open}
        data={orgData}
        checkbox
        selectedValues={selected}
        onSelectChange={setSelected}
        onOk={(values) => {
          console.log("Selected:", values)
          setOpen(false)
        }}
        onCancel={() => setOpen(false)}
      />
    </AppearanceProvider>
  )
}
```

### 2) Mobile selector

```tsx
import { useState } from "react"
import { AppearanceProvider, MobileUserSelector, NodeType, type OrganizationNode } from "@dtyq/user-selector"
import "@dtyq/user-selector/style.css"

const data: OrganizationNode[] = [
  { id: "dept-1", name: "Engineering", dataType: NodeType.Department },
]

export default function MobileExample() {
  const [visible, setVisible] = useState(false)

  return (
    <AppearanceProvider language="en_US" theme="light">
      <button onClick={() => setVisible(true)}>Open mobile selector</button>
      <MobileUserSelector
        visible={visible}
        data={data}
        safeAreaBottom="env(safe-area-inset-bottom)"
        onClose={() => setVisible(false)}
        onOk={(values) => {
          console.log(values)
          setVisible(false)
        }}
      />
    </AppearanceProvider>
  )
}
```

## Core Concepts

### Data model

The main input type is `TreeNode`, a union of:

- `Department`
- `User`
- `Group`
- `UserGroup`
- `Partner`
- `Resigned` (user-like entity in resigned segment)

Use `NodeType` to define each node’s `dataType`.

### Controlled usage pattern

The selector is designed to be controlled by host state:

- `selectedValues` + `onSelectChange`
- `selectedPath` + `onBreadcrumbClick`
- `searchData` + `onSearchChange`

This allows server-driven search, pagination, and dynamic organization loading.

### Segment mode

Use `segmentData` to provide scenario tabs such as:

- `organization`
- `recent`
- `group`
- `userGroup`
- `partner`
- `resigned`
- `shareToMember`
- `shareToGroup`

## API Overview

### `AppearanceProvider`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `language` | `"zh_CN" \| "en_US"` | `"zh_CN"` | Locale for built-in copy |
| `theme` | `"light" \| "dark"` | `"light"` | Theme variant |

### `UserSelector` (main desktop component)

`UserSelectorProps = Omit<DialogProps, "onOk"> & CommonSelectorProps`

Commonly used props:

- Data: `data`, `searchData`, `segmentData`, `organization`
- Selection: `checkbox`, `selectedValues`, `disabledValues`, `maxCount`, `disableUser`
- Behavior: `useAuthPanel`, `loading`, `departmentToUser`
- Events: `onSearchChange`, `onSelectChange`, `onItemClick`, `onBreadcrumbClick`, `onOk`, `onCancel`
- Custom rendering: `renderRight`, `renderRightTop`, `renderRightBottom`, `renderRightBySegment`

### `MobileUserSelector`

Mobile component with bottom-popup behavior and a subset/superset of common selector props.

Additional mobile-only props:

- `visible`
- `onClose`
- `safeAreaTop`
- `safeAreaBottom`
- `selectedPopupProps`

### Exported utility types and enums

Frequently used exports:

- `NodeType`
- `SegmentType`
- `OperationTypes`
- `TreeNode`
- `OrganizationNode`
- `Pagination<T>`
- `SelectedPath`

## Permission Panel

Enable permission editing with `useAuthPanel`.

When enabled, selected nodes should include permission-related fields:

- `operation?: OperationTypes`
- `canEdit?: boolean`

`OperationTypes`:

- `None = 0`
- `Owner = 1`
- `Admin = 2`
- `Read = 3`
- `Edit = 4`

## Custom Rendering Priority

Right-side rendering priority is:

1. `renderRight` (full override)
2. `renderRightBySegment` (segment-specific override)
3. Built-in `SelectedPanel` + optional `renderRightTop` / `renderRightBottom`

## Exports

Primary package exports from `src/index.ts` include:

- Components: `UserSelector`, `MobileUserSelector`, `OrganizationPanel`, `TagList`, `AuthList`, `SearchContainer`, `SelectedPanel`, `InfiniteList`, `SelectedItemTag`
- Provider: `AppearanceProvider`
- Toast component: `Toaster`
- Utilities: `isDepartment`, `isUserGroup`, `isMember`
- Types/enums from `components/UserSelector/types`

## Development

### Requirements

- Node.js 18+
- pnpm 8+

### Scripts

```bash
pnpm dev        # run Vite demo/dev environment
pnpm lint       # lint source files
pnpm typecheck  # TypeScript checks
pnpm test       # watch tests
pnpm test:ci    # run tests with coverage in CI mode
pnpm build      # lint + typecheck + test:ci + build
```

## Project Structure

```text
src/
  components/
    UserSelector/
    MobileUserSelector/
    OrganizationPanel/
    SearchContainer/
    SelectedPanel/
    AuthList/
    TagList/
    ui/
  context/AppearanceProvider/
  hooks/
  locales/
  styles/
  index.ts
```

## Migration

If you are upgrading from older versions or earlier API styles, check:

- `docs/migration-guide.md`

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Run checks locally (`pnpm lint && pnpm typecheck && pnpm test`)
4. Open a pull request with clear context and test coverage

Please follow Conventional Commit style for commit messages.

## License

Apache License 2.0
