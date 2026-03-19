# MagicSelect Migration Guide

## Props Usage Analysis

Based on scanning the codebase, here are all the props currently used:

### Core Props (Fully Supported)
- `value` / `defaultValue` - Current/default value
- `placeholder` - Placeholder text
- `options` - Options array `{ label, value, disabled?, className? }[]`
- `onChange` - Change callback `(value, option) => void`
- `disabled` - Disabled state
- `className` - Root className
- `style` - Inline styles
- `size` - Size variant: `"sm" | "default"`

### Dropdown Control (Fully Supported)
- `open` / `onOpenChange` - Control dropdown visibility
- `popupMatchSelectWidth` - Whether popup matches select width (default: false)

### Search Related (Partially Supported)
- `showSearch` - Show search input (⚠️ Not supported - use custom popupRender)
- `onSearch` - Search callback (⚠️ Not supported)
- `filterOption` - Filter function (⚠️ Not supported)
- `defaultActiveFirstOption` - Auto-select first option (⚠️ Not supported)
- `notFoundContent` - Empty state content (⚠️ Not supported)

### Custom Rendering (Partially Supported)
- `labelRender` - Custom label renderer `(option) => ReactNode` (⚠️ Not supported)
- `optionRender` - Custom option renderer `(option) => ReactNode` (⚠️ Not supported)
- `popupRender` - Full custom dropdown render `() => ReactNode` (⚠️ Not supported)
- `dropdownRender` - Wrap default dropdown `(menu) => ReactNode` (⚠️ Not supported)

### Styling (Partially Supported)
- `styles` - Antd v5 styles object (⚠️ Not supported - use className)
- `classNames` - Antd v5 classNames object (⚠️ Not supported - use className)
- `variant` - Variant type (⚠️ Not supported)
- `placement` - Dropdown placement (⚠️ Not supported)
- `prefix` - Prefix element (⚠️ Not supported)

### Events (Partially Supported)
- `onClick` - Click handler (✅ Supported on trigger)
- `onSelect` - Select callback (⚠️ Use onChange instead)

## Migration Strategy

### Phase 1: Basic Usage (Current Implementation)
Simple selects with options array work out of the box:

```tsx
<MagicSelect
  value={value}
  placeholder="Select..."
  options={[
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" }
  ]}
  onChange={(value) => console.log(value)}
/>
```

### Phase 2: Complex Usage (Needs Refactoring)
For advanced features like search, custom rendering, etc., components need to be refactored to use alternative approaches or stick with the old antd-based MagicSelect.

## Breaking Changes

1. **No `showSearch`** - Custom search needs to be implemented via popupRender (not supported yet)
2. **No `styles` / `classNames`** - Use Tailwind CSS classes via `className` prop
3. **No custom renderers** - `labelRender`, `optionRender`, `dropdownRender`, `popupRender` not supported
4. **Mobile-first** - Automatically renders as popup on mobile devices

## Files Requiring Migration

Files using unsupported props:

1. `src/opensource/components/business/AccountSetting/pages/ScheduledTasks/components/SelectItem.tsx`
   - Uses: `classNames`, `showSearch`, `popupRender`
   - **Status**: ⚠️ Needs migration or keep old component

2. `src/opensource/components/other/PhoneStateCodeSelect/index.tsx`
   - Uses: `styles`, `labelRender`, `optionRender`
   - **Status**: ⚠️ Needs migration

3. `src/pages/magicAdmin/pages/PlatformPackage/components/ModalList/components/ModelSelect/index.tsx`
   - Uses: `showSearch`, `filterOption`, `onSearch`, `dropdownRender`, `notFoundContent`
   - **Status**: ⚠️ Needs migration

4. `src/opensource/layouts/SSOLayout/components/LanguageSelect/index.tsx`
   - Uses: `prefix`, `variant`, `placement`, `classNames`
   - **Status**: ⚠️ Needs migration

## Recommendation

Given the extensive usage of advanced antd props, we recommend:

1. **Keep the current antd-based MagicSelect** for existing complex usage
2. **Create a new `MagicSelectSimple`** component using shadcn for new simple use cases
3. **Gradually migrate** simple selects to the new component
4. **Refactor complex components** to either simplify or continue using antd-based Select

OR

1. **Enhance the shadcn-based MagicSelect** to support more antd props (significant effort)
2. **Add compatibility layer** for most common props
3. **Document unsupported features** and migration paths
