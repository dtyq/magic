# MagicSelect Component

A modern, responsive Select component built with shadcn/ui and Tailwind CSS, with compatibility layer for antd props.

## Features

- ✅ **Dual Platform Support**: Desktop (shadcn Select) + Mobile (MagicPopup drawer)
- ✅ **Antd API Compatibility**: Supports most common antd Select props
- ✅ **Custom Rendering**: labelRender, optionRender, dropdownRender support
- ✅ **Responsive by Default**: Automatically switches between desktop/mobile UI
- ✅ **TypeScript**: Full type safety with comprehensive types
- ⚠️ **Search**: Not yet supported (use custom popupRender)

## Basic Usage

```tsx
import MagicSelect from "@/opensource/components/base/MagicSelect"

function MyComponent() {
  const [value, setValue] = useState("1")

  return (
    <MagicSelect
      value={value}
      onChange={setValue}
      placeholder="Select an option"
      options={[
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
        { label: "Option 3", value: "3", disabled: true },
      ]}
    />
  )
}
```

## Supported Props

### Core Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string \| number` | Current selected value |
| `defaultValue` | `string \| number` | Default value |
| `placeholder` | `ReactNode` | Placeholder text |
| `options` | `OptionType[]` | Array of options |
| `onChange` | `(value, option) => void` | Change callback |
| `disabled` | `boolean` | Disabled state |
| `className` | `string` | Root className |
| `style` | `CSSProperties` | Inline styles |
| `size` | `"sm" \| "default"` | Size variant |

### Styling Props (Antd v5 API)

| Prop | Type | Description |
|------|------|-------------|
| `styles` | `{ popup?: { root?: CSSProperties } }` | Custom styles object |
| `classNames` | `{ popup?: { root?: string } }` | Custom classNames object |
| `triggerClassName` | `string` | Trigger button className |
| `popupClassName` | `string` | Popup className |

### Custom Rendering Props

| Prop | Type | Description |
|------|------|-------------|
| `prefix` | `ReactNode` | Prefix element in trigger |
| `labelRender` | `(option) => ReactNode` | Custom label renderer |
| `optionRender` | `(option) => ReactNode` | Custom option renderer |
| `popupRender` | `() => ReactNode` | Full custom popup content |
| `dropdownRender` | `(menu) => ReactNode` | Wrap default dropdown |

### Event Props

| Prop | Type | Description |
|------|------|-------------|
| `onClick` | `(e) => void` | Trigger click handler |
| `onSelect` | `(value, option) => void` | Select callback |
| `open` | `boolean` | Control dropdown visibility |
| `onOpenChange` | `(open) => void` | Dropdown state change |

### Unsupported Props (⚠️ Show warning in dev)

| Prop | Status | Alternative |
|------|--------|-------------|
| `showSearch` | ⚠️ Not supported | Use custom `popupRender` |
| `onSearch` | ⚠️ Not supported | Use custom `popupRender` |
| `filterOption` | ⚠️ Not supported | Use custom `popupRender` |
| `notFoundContent` | ⚠️ Not supported | Use custom `popupRender` |
| `variant` | ⚠️ Not supported | Use Tailwind classes |
| `placement` | ⚠️ Not fully supported | Default positioning |

## Advanced Examples

### With Custom Label Rendering

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={countryOptions}
  labelRender={(option) => (
    <div className="flex items-center gap-2">
      <Flag code={option.value} />
      <span>{option.label}</span>
    </div>
  )}
/>
```

### With Prefix Icon

```tsx
<MagicSelect
  prefix={<IconWorld size={20} />}
  value={lang}
  onChange={setLang}
  options={languageOptions}
  variant="borderless"
/>
```

### With Custom Styles (Antd v5 API)

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  styles={{
    popup: {
      root: { minWidth: "fit-content" },
    },
  }}
  classNames={{
    popup: {
      root: "custom-popup-class",
    },
  }}
/>
```

### With Custom Dropdown Rendering

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  dropdownRender={(menu) => (
    <div>
      {menu}
      <Divider />
      <Button onClick={handleAddNew}>
        <PlusIcon /> Add New Item
      </Button>
    </div>
  )}
/>
```

### With Full Custom Popup (Advanced)

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  open={open}
  onOpenChange={setOpen}
  popupRender={() => (
    <div className="custom-popup">
      <Input
        placeholder="Search..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      <div className="options-list">
        {filteredOptions.map((opt) => (
          <div key={opt.value} onClick={() => handleSelect(opt.value)}>
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  )}
/>
```

## Mobile Behavior

On mobile devices (screen width < md breakpoint), the component automatically renders as a bottom drawer using `MagicPopup`:

- Trigger button styled for mobile
- Options displayed in a drawer that slides up from bottom
- Touch-optimized option height (py-3)
- Safe area support

## Migration from Old MagicSelect

The new component maintains backward compatibility with most antd props. However, some advanced features require refactoring:

### Simple Selects (No Changes Needed)

```tsx
// Works out of the box
<MagicSelect
  value={value}
  onChange={onChange}
  options={options}
  placeholder="Select..."
/>
```

### Complex Selects (May Need Refactoring)

If using `showSearch`, `filterOption`, or other unsupported props, you have two options:

1. **Use custom `popupRender`** to implement the feature
2. **Keep using the old antd-based implementation** for complex cases

See `MIGRATION.md` for detailed migration guide and list of files requiring attention.

## Type Definitions

```typescript
interface OptionType {
  label: React.ReactNode
  value: string | number
  disabled?: boolean
  className?: string
  desc?: string
}

interface MagicSelectProps {
  // ... see type definitions in index.tsx
}
```

## Development

In development mode, the component will log warnings to console when using unsupported props, helping you identify features that need migration or alternative implementation.

```
[MagicSelect] showSearch is not supported yet
[MagicSelect] filterOption is not supported yet
```

## Browser Support

- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Related Components

- `MagicPopup` - Mobile drawer component
- shadcn/ui `Select` - Desktop select component
- `PhoneStateCodeSelect` - Example of extended usage
