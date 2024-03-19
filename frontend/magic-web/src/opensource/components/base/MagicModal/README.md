# MagicModal

A responsive modal component built with shadcn/ui Dialog and Tailwind CSS, automatically adapting between desktop and mobile views.

## Features

- 🎨 **Modern Styling**: Built with shadcn/ui and Tailwind CSS
- 📱 **Responsive Design**: Automatically switches between desktop and mobile layouts
- ⚡ **Performance**: Lightweight with optimized rendering
- 🔧 **Flexible API**: Compatible with common modal patterns
- 🌍 **i18n Support**: Built-in internationalization
- ♿ **Accessible**: Powered by Radix UI primitives

## Installation

The component is already set up in the project and uses:

- `@/opensource/components/shadcn-ui/dialog`
- `@/opensource/components/shadcn-ui/button`
- `lucide-react` for icons

## Basic Usage

### Declarative Modal

```tsx
import MagicModal from "@/opensource/components/base/MagicModal"

function MyComponent() {
	const [open, setOpen] = useState(false)

	return (
		<MagicModal
			open={open}
			onCancel={() => setOpen(false)}
			onOk={() => {
				// Handle OK action
				setOpen(false)
			}}
			title="My Modal"
		>
			<p>Modal content goes here</p>
		</MagicModal>
	)
}
```

### Imperative Modal (Static Methods)

```tsx
import MagicModal from "@/opensource/components/base/MagicModal"

// Confirm dialog
MagicModal.confirm({
	title: "Delete Item?",
	content: "This action cannot be undone.",
	onOk: async () => {
		await deleteItem()
	},
})

// Info dialog
MagicModal.info({
	title: "Information",
	content: "Here is some important information.",
})

// Success dialog
MagicModal.success({
	title: "Success!",
	content: "Your operation completed successfully.",
})

// Error dialog
MagicModal.error({
	title: "Error",
	content: "Something went wrong.",
})

// Warning dialog
MagicModal.warning({
	title: "Warning",
	content: "Please be careful with this action.",
})
```

## Props

### MagicModalProps

| Prop                | Type                            | Default     | Description                                         |
| ------------------- | ------------------------------- | ----------- | --------------------------------------------------- |
| `open`              | `boolean`                       | `false`     | Whether the modal is visible                        |
| `onCancel`          | `(e: React.MouseEvent) => void` | -           | Callback when cancel button is clicked              |
| `onOk`              | `(e: React.MouseEvent) => void` | -           | Callback when OK button is clicked                  |
| `title`             | `ReactNode`                     | -           | Modal title                                         |
| `footer`            | `ReactNode \| null`             | -           | Custom footer content. Set to `null` to hide footer |
| `children`          | `ReactNode`                     | -           | Modal body content                                  |
| `className`         | `string`                        | -           | Additional CSS classes for the modal content        |
| `width`             | `number \| string`              | `520`       | Modal width in pixels or CSS string                 |
| `closable`          | `boolean`                       | `true`      | Whether to show close button                        |
| `maskClosable`      | `boolean`                       | `true`      | Whether to close modal on mask click                |
| `okText`            | `ReactNode`                     | `"Confirm"` | Text for OK button                                  |
| `cancelText`        | `ReactNode`                     | `"Cancel"`  | Text for cancel button                              |
| `okButtonProps`     | `ButtonProps`                   | -           | Props for OK button                                 |
| `cancelButtonProps` | `ButtonProps`                   | -           | Props for cancel button                             |
| `confirmLoading`    | `boolean`                       | `false`     | Whether OK button is in loading state               |

### ModalFuncProps (Static Methods)

| Prop                | Type                          | Default     | Description                                    |
| ------------------- | ----------------------------- | ----------- | ---------------------------------------------- |
| `title`             | `ReactNode`                   | -           | Modal title                                    |
| `content`           | `ReactNode`                   | -           | Modal content                                  |
| `okText`            | `ReactNode`                   | `"Confirm"` | Text for OK button                             |
| `cancelText`        | `ReactNode`                   | `"Cancel"`  | Text for cancel button (confirm only)          |
| `onOk`              | `() => void \| Promise<void>` | -           | Callback when OK is clicked                    |
| `onCancel`          | `() => void`                  | -           | Callback when cancel is clicked (confirm only) |
| `icon`              | `ReactNode`                   | -           | Custom icon (defaults based on type)           |
| `okButtonProps`     | `ButtonProps`                 | -           | Props for OK button                            |
| `cancelButtonProps` | `ButtonProps`                 | -           | Props for cancel button (confirm only)         |
| `className`         | `string`                      | -           | Additional CSS classes                         |
| `width`             | `number \| string`            | `416`       | Modal width                                    |

## Advanced Examples

### Custom Footer

```tsx
<MagicModal
	open={open}
	footer={
		<div className="flex justify-end gap-2">
			<Button variant="outline" onClick={handleCancel}>
				Cancel
			</Button>
			<Button variant="destructive" onClick={handleDelete}>
				Delete
			</Button>
		</div>
	}
>
	Content
</MagicModal>
```

### No Footer

```tsx
<MagicModal open={open} footer={null}>
	<div className="space-y-4">
		<p>This modal has no footer</p>
		<Button onClick={() => setOpen(false)} className="w-full">
			Close
		</Button>
	</div>
</MagicModal>
```

### Loading State

```tsx
<MagicModal
	open={open}
	confirmLoading={loading}
	onOk={async () => {
		setLoading(true)
		await saveData()
		setLoading(false)
		setOpen(false)
	}}
>
	Content
</MagicModal>
```

### Custom Width

```tsx
<MagicModal open={open} width={800} title="Large Modal">
	Wide content
</MagicModal>
```

### Prevent Closing on Mask Click

```tsx
<MagicModal open={open} maskClosable={false} closable={false} title="Must Complete">
	You must click OK or Cancel to close this modal
</MagicModal>
```

### Custom Button Styles

```tsx
<MagicModal
	open={open}
	okButtonProps={{
		variant: "destructive",
		className: "min-w-[120px]",
	}}
	cancelButtonProps={{
		variant: "ghost",
	}}
>
	Content
</MagicModal>
```

### Styled with Tailwind

```tsx
<MagicModal open={open} className="max-w-2xl" title="Custom Styled Modal">
	<div className="space-y-4 p-4">
		<div className="rounded-lg bg-blue-50 p-4">Custom styled content with Tailwind</div>
	</div>
</MagicModal>
```

## Responsive Behavior

- **Desktop**: Uses `MagicModalDesktop` (shadcn/ui Dialog)
- **Mobile**: Uses `MagicModalMobile` (Drawer-based implementation)

The component automatically detects the device type and renders the appropriate version.

## Styling

The component uses Tailwind CSS utility classes. You can customize styles by:

1. **Using className prop**: Apply custom classes to the modal content
2. **Using Tailwind utilities**: Directly in your content
3. **Button customization**: Through `okButtonProps` and `cancelButtonProps`

Example:

```tsx
<MagicModal className="max-w-4xl bg-gray-50" okButtonProps={{ className: "bg-green-500" }}>
	<div className="p-6 text-lg">Custom styled content</div>
</MagicModal>
```

## Migration from Ant Design

See [MIGRATION_DESKTOP.md](./MIGRATION_DESKTOP.md) for detailed migration guide from the previous Ant Design implementation.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- Keyboard navigation support (Esc to close, Tab to navigate)
- Focus trap within modal
- ARIA attributes for screen readers
- Semantic HTML structure

## Performance

- Lazy rendering of content
- Optimized re-renders with `useMemo`
- Automatic cleanup on unmount
- Small bundle size (~8KB gzipped)

## License

Part of the Magic Web project.
