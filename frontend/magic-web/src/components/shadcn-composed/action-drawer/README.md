# ActionDrawer Component

A generic two-level action drawer component built with shadcn/ui. Automatically uses Drawer on mobile devices and Dialog on desktop.

## Features

- 📱 **Responsive**: Automatically switches between Drawer (mobile) and Dialog (desktop)
- 🎨 **Themed**: Follows Figma design specifications with proper styling
- 🔧 **Flexible**: Supports custom children with ActionGroup and ActionItem components
- ♿ **Accessible**: Built on Radix UI primitives with proper ARIA attributes
- 🌍 **i18n Ready**: Full internationalization support
- 🎯 **High z-index**: Default z-index of 1001 for proper overlay stacking

## Basic Usage

```tsx
import { ActionDrawer, ActionGroup, ActionItem } from "@/opensource/components/shadcn-composed/action-drawer"
import { TrashIcon, DownloadIcon, ShareIcon } from "lucide-react"

function MyComponent() {
  const [open, setOpen] = useState(false)

  return (
    <ActionDrawer open={open} onOpenChange={setOpen} title="批量操作">
      <ActionGroup>
        <ActionItem label="移动至" onClick={() => console.log("Move to")} />
      </ActionGroup>

      <ActionGroup>
        <ActionItem
          label="下载已选文件 (3)"
          icon={<DownloadIcon />}
          onClick={() => console.log("Download files")}
        />
        <ActionItem
          label="下载为 PDF 文件"
          onClick={() => console.log("Download as PDF")}
        />
        <ActionItem
          label="下载为 PPT 文件"
          onClick={() => console.log("Download as PPT")}
        />
      </ActionGroup>

      <ActionGroup>
        <ActionItem
          label="分享"
          icon={<ShareIcon />}
          onClick={() => console.log("Share")}
        />
      </ActionGroup>

      <ActionGroup>
        <ActionItem
          label="删除"
          icon={<TrashIcon />}
          variant="destructive"
          onClick={() => console.log("Delete")}
        />
      </ActionGroup>
    </ActionDrawer>
  )
}
```

## Components

### ActionDrawer

Main container component that renders as Drawer or Dialog based on screen size.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controls the open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when open state changes |
| `title` | `ReactNode` | - | Title displayed in the header |
| `children` | `ReactNode` | - | Content (typically ActionGroup components) |
| `showCancel` | `boolean` | `true` | Whether to show the cancel button |
| `cancelText` | `string` | `"取消"` | Text for the cancel button |
| `onCancel` | `() => void` | - | Callback when cancel button is clicked |
| `className` | `string` | - | Additional class name for the container |
| `contentClassName` | `string` | - | Additional class name for the content area |
| `mode` | `"drawer" \| "dialog" \| "auto"` | `"auto"` | Force specific display mode or auto-detect |

### ActionGroup

Container for grouping related action items. Each group is visually separated.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | ActionItem components |
| `className` | `string` | Additional class name for the group |

### ActionItem

Individual action button within a group.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | - | Label text or element |
| `icon` | `ReactNode` | - | Optional icon element |
| `onClick` | `() => void` | - | Click handler |
| `disabled` | `boolean` | `false` | Whether the item is disabled |
| `variant` | `"default" \| "destructive"` | `"default"` | Visual variant (destructive shows red text) |
| `className` | `string` | - | Additional class name for the item |

## Examples

### With Icons

```tsx
<ActionDrawer open={open} onOpenChange={setOpen} title="文件操作">
  <ActionGroup>
    <ActionItem
      label="下载"
      icon={<DownloadIcon />}
      onClick={handleDownload}
    />
    <ActionItem
      label="分享"
      icon={<ShareIcon />}
      onClick={handleShare}
    />
  </ActionGroup>
</ActionDrawer>
```

### Desktop Only (Dialog)

```tsx
<ActionDrawer mode="dialog" open={open} onOpenChange={setOpen} title="选项">
  <ActionGroup>
    <ActionItem label="选项 1" onClick={handleOption1} />
    <ActionItem label="选项 2" onClick={handleOption2} />
  </ActionGroup>
</ActionDrawer>
```

### Mobile Only (Drawer)

```tsx
<ActionDrawer mode="drawer" open={open} onOpenChange={setOpen} title="选项">
  <ActionGroup>
    <ActionItem label="选项 1" onClick={handleOption1} />
    <ActionItem label="选项 2" onClick={handleOption2} />
  </ActionGroup>
</ActionDrawer>
```

### Without Cancel Button

```tsx
<ActionDrawer
  open={open}
  onOpenChange={setOpen}
  title="选择操作"
  showCancel={false}
>
  <ActionGroup>
    <ActionItem label="操作 1" onClick={handleAction1} />
    <ActionItem label="操作 2" onClick={handleAction2} />
  </ActionGroup>
</ActionDrawer>
```

### With Destructive Action

```tsx
<ActionDrawer open={open} onOpenChange={setOpen} title="确认操作">
  <ActionGroup>
    <ActionItem
      label="删除所有文件"
      variant="destructive"
      onClick={handleDelete}
    />
  </ActionGroup>
</ActionDrawer>
```

### Disabled Items

```tsx
<ActionDrawer open={open} onOpenChange={setOpen} title="操作">
  <ActionGroup>
    <ActionItem label="可用操作" onClick={handleAction} />
    <ActionItem label="禁用操作" onClick={handleAction} disabled />
  </ActionGroup>
</ActionDrawer>
```

### Custom Content

You can also pass custom content instead of ActionGroup/ActionItem:

```tsx
<ActionDrawer open={open} onOpenChange={setOpen} title="自定义内容">
  <div className="rounded-md bg-popover p-4">
    <p>Your custom content here</p>
  </div>
</ActionDrawer>
```

## Styling

The component uses Tailwind CSS and follows the project's design tokens. You can customize styles using:

- `className` prop for the outer container
- `contentClassName` prop for the content area
- `ActionGroup` `className` for individual groups
- `ActionItem` `className` for individual items

## Accessibility

- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader announcements

## Design Reference

Based on Figma design: [Magic - SuperMagic Shadcn](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=1264-72595)

