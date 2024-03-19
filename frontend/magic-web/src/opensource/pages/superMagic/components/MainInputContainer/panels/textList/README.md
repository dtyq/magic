# Template Text List Component

垂直列表布局组件，用于展示模板列表。每个模板显示为一个按钮样式的卡片。

## Features

- **垂直列表布局**: 每个模板项占据一行
- **按钮样式**: 使用 shadcn/ui 的 button 样式
- **响应式设计**: 支持点击交互和键盘导航
- **动画效果**: 使用 Framer Motion 实现流畅的入场动画
- **状态管理**: 支持选中状态高亮显示

## Usage

### Basic Usage

```typescript
import TemplateTextList from "./TemplateTextList"
import type { Template } from "../types"

const templates: Template[] = [
  {
    key: "template-1",
    name: "Identify key positions and demands",
  },
  {
    key: "template-2",
    name: "Extract core concepts from this lecture",
  },
]

function MyComponent() {
  const handleTemplateClick = (template: Template) => {
    console.log("Selected:", template)
  }

  return (
    <TemplateTextList
      templates={templates}
      onTemplateClick={handleTemplateClick}
    />
  )
}
```

### With Panel Configuration

```typescript
import { SkillPanelType, TemplateViewType } from "../types"
import type { TemplatePanelConfig } from "../types"

const config: TemplatePanelConfig = {
	type: SkillPanelType.TEMPLATE,
	title: "Quick Start",
	template_view_type: TemplateViewType.TEXT_LIST,
	template_groups: [
		{
			group_key: "quick-start",
			group_name: "Quick Start",
			items: [
				{
					key: "template-1",
					name: "Identify key positions and demands for each speaker",
				},
				{
					key: "template-2",
					name: "Extract core concepts from this lecture",
				},
			],
		},
	],
}
```

## Props

### TemplateTextListProps

| Prop               | Type                           | Required | Description                       |
| ------------------ | ------------------------------ | -------- | --------------------------------- |
| `templates`        | `Template[]`                   | ✅       | Array of templates to display     |
| `selectedTemplate` | `Template`                     | ❌       | Currently selected template       |
| `onTemplateClick`  | `(template: Template) => void` | ❌       | Callback when template is clicked |

## Template Data Structure

```typescript
interface Template {
	key: string // Unique identifier
	name?: string // Display text (primary)
	description?: string // Alternative text (fallback)
	thumbnail_url?: string // Not used in text list view
	icon_url?: string // Not used in text list view
	sub_text?: string // Not used in text list view
}
```

## Styling

The component uses Tailwind CSS with the following key classes:

- `bg-secondary` - Background color
- `text-secondary-foreground` - Text color
- `shadow-sm` - Subtle shadow effect
- `rounded-md` - Rounded corners (8px)
- `h-9` - Fixed height (36px)

## Animation

Uses Framer Motion for stagger animations:

- Container fade-in with staggered children
- Items slide in from left with spring animation
- Smooth transitions on hover and click

## Accessibility

- Semantic `<button>` elements
- Keyboard navigation support
- Focus visible styles with ring
- ARIA-friendly structure

## Related Components

- `TemplateGrid` - Grid layout view
- `TemplateWaterfall` - Masonry layout view
- `TemplateViewSwitcher` - View type selector component
