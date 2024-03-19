# MagicModalDesktop Migration Guide

## Overview

The `MagicModalDesktop` component has been migrated from Ant Design Modal to shadcn/ui Dialog with Tailwind CSS styling. This document outlines the changes and migration path.

## What Changed

### Technology Stack

- **Before**: Ant Design Modal + antd-style (CSS-in-JS)
- **After**: shadcn/ui Dialog (Radix UI) + Tailwind CSS

### File Changes

- ✅ `MagicModalDesktop.tsx` - Rewritten using shadcn/ui Dialog
- ✅ `index.tsx` - Updated type imports
- ❌ `styles.ts` - Removed (replaced with Tailwind CSS)

## API Compatibility

### Props Interface

The component maintains the same core API for backward compatibility:

```typescript
interface MagicModalDesktopProps {
	open?: boolean // ✅ Same
	onCancel?: (e: React.MouseEvent) => void // ✅ Same
	onOk?: (e: React.MouseEvent) => void // ✅ Same
	title?: ReactNode // ✅ Same
	footer?: ReactNode | null // ✅ Same
	children?: ReactNode // ✅ Same
	className?: string // ✅ Same
	width?: number | string // ✅ Same
	closable?: boolean // ✅ Same
	maskClosable?: boolean // ✅ Same
	okText?: ReactNode // ✅ Same
	cancelText?: ReactNode // ✅ Same
	okButtonProps?: ButtonProps // ⚠️ Changed (now shadcn/ui Button props)
	cancelButtonProps?: ButtonProps // ⚠️ Changed (now shadcn/ui Button props)
	confirmLoading?: boolean // ✅ Same
}
```

### Static Methods

All static methods remain the same:

```typescript
MagicModalDesktop.confirm(config: ModalFuncProps)  // ✅ Same
MagicModalDesktop.info(config: ModalFuncProps)     // ✅ Same
MagicModalDesktop.success(config: ModalFuncProps)  // ✅ Same
MagicModalDesktop.error(config: ModalFuncProps)    // ✅ Same
MagicModalDesktop.warning(config: ModalFuncProps)  // ✅ Same
```

### Removed Props

The following Ant Design-specific props are no longer supported:

- ❌ `classNames` (use `className` instead)
- ❌ `zIndex` (uses fixed z-index via Tailwind)
- ❌ `centered` (always centered)
- ❌ `destroyOnClose` (handled automatically)

## Migration Examples

### Basic Modal

```tsx
// Before & After - No changes needed! ✅
<MagicModalDesktop open={isOpen} onCancel={handleCancel} onOk={handleOk} title="My Modal">
	Content here
</MagicModalDesktop>
```

### Custom Footer

```tsx
// Before & After - No changes needed! ✅
<MagicModalDesktop
	open={isOpen}
	footer={
		<>
			<Button onClick={handleCancel}>Cancel</Button>
			<Button onClick={handleOk}>OK</Button>
		</>
	}
>
	Content here
</MagicModalDesktop>
```

### No Footer

```tsx
// Before & After - No changes needed! ✅
<MagicModalDesktop open={isOpen} footer={null}>
	Content here
</MagicModalDesktop>
```

### Confirm Dialog

```tsx
// Before & After - No changes needed! ✅
MagicModalDesktop.confirm({
	title: "Delete Item?",
	content: "This action cannot be undone.",
	onOk: handleDelete,
})
```

### Custom Styling

```tsx
// Before: Using classNames prop
<MagicModalDesktop
  classNames={{
    header: 'custom-header',
    content: 'custom-content',
  }}
>
  Content
</MagicModalDesktop>

// After: Use className (applies to content wrapper)
<MagicModalDesktop className="custom-modal">
  Content
</MagicModalDesktop>

// For more control, use Tailwind classes directly
<MagicModalDesktop className="max-w-2xl">
  <div className="space-y-4">
    Content with custom spacing
  </div>
</MagicModalDesktop>
```

### Button Props

```tsx
// Before: Ant Design Button props
<MagicModalDesktop
  okButtonProps={{
    type: 'primary',
    danger: true,
  }}
/>

// After: shadcn/ui Button props
<MagicModalDesktop
  okButtonProps={{
    variant: 'destructive',
  }}
/>
```

## Styling Changes

### Before (antd-style)

```typescript
const { styles } = useStyles()
<div className={styles.header} />
```

### After (Tailwind CSS)

```tsx
<div className="border-b border-border px-5 py-2.5" />
```

## Breaking Changes

### 1. Button Props Structure

**Impact**: Medium  
**Action Required**: Update button customization

```tsx
// Before
okButtonProps={{
  type: 'primary',
  danger: true,
  loading: true,
}}

// After
okButtonProps={{
  variant: 'destructive',
}}
// Note: confirmLoading prop handles loading state
```

### 2. ClassNames Prop Removed

**Impact**: Low  
**Action Required**: Use `className` prop for content styling

```tsx
// Before
<MagicModalDesktop classNames={{ content: 'custom' }} />

// After
<MagicModalDesktop className="custom" />
```

### 3. Fixed Modal Position

**Impact**: Very Low  
**Action Required**: None (modals are always centered)

```tsx
// Before
<MagicModalDesktop centered={false} /> // Could be non-centered

// After
<MagicModalDesktop /> // Always centered
```

## Testing Recommendations

After migration, test the following scenarios:

- ✅ Modal open/close behavior
- ✅ onOk and onCancel callbacks
- ✅ Custom footer rendering
- ✅ Footer-less modals (footer={null})
- ✅ Loading state (confirmLoading)
- ✅ Mask click behavior (maskClosable)
- ✅ Static methods (confirm, info, success, error, warning)
- ✅ Icon display in static methods
- ✅ Responsive width on mobile

## Benefits of Migration

1. **Smaller Bundle Size**: No Ant Design Modal dependency
2. **Better Performance**: Lighter Radix UI primitives
3. **Modern Styling**: Tailwind CSS utilities
4. **Improved Accessibility**: Radix UI's built-in a11y features
5. **Type Safety**: Better TypeScript inference
6. **Consistency**: Aligns with new component architecture

## Support

If you encounter issues during migration:

1. Check this migration guide
2. Review the component source code
3. Test with simplified props first
4. Gradually add custom configurations

## Version History

- **v2.0.0** (Dec 2024): Migrated to shadcn/ui + Tailwind CSS
- **v1.0.0**: Original Ant Design implementation
