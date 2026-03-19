# MagicDropdown 魔法下拉菜单组件

`MagicDropdown` 是一个基于 shadcn/ui 的下拉菜单组件，提供了与 Ant Design Dropdown API 的完全兼容性，同时使用现代化的 Tailwind CSS 样式和 Radix UI 底层实现。

## 技术栈

- **UI 基础**: shadcn/ui (Radix UI + Tailwind CSS)
- **API 兼容**: Ant Design Dropdown
- **样式系统**: Tailwind CSS
- **可访问性**: 内置 ARIA 支持

## 属性

| 属性名           | 类型                                      | 默认值    | 说明                                                     |
| ---------------- | ----------------------------------------- | --------- | -------------------------------------------------------- |
| menu             | MenuProps                                 | -         | 菜单配置，用于定义下拉菜单的内容和行为                   |
| trigger          | ('click' \| 'hover' \| 'contextMenu')[]   | ['click'] | 触发方式：点击、悬停或右键菜单                           |
| placement        | string                                    | 'bottom'  | 下拉框位置，如 'bottomLeft', 'topRight' 等               |
| open             | boolean                                   | -         | 受控模式下的显示状态                                     |
| onOpenChange     | (open: boolean) => void                   | -         | 显示状态变化时的回调                                     |
| overlayClassName | string                                    | -         | 下拉菜单的自定义类名                                     |
| rootClassName    | string                                    | -         | 根元素的自定义类名                                       |
| popupRender      | (menu?: MenuProps) => ReactNode           | -         | 自定义渲染下拉内容                                       |
| getPopupContainer| () => HTMLElement                         | -         | 指定下拉框的容器元素                                     |
| disabled         | boolean                                   | false     | 是否禁用                                                 |
| children         | ReactNode                                 | -         | 触发元素                                                 |

## 基础用法

```tsx
import MagicDropdown from '@/opensource/components/base/MagicDropdown'
import type { MenuProps } from 'antd'
import { IconSettings, IconUser, IconLogout } from '@tabler/icons-react'

// 定义菜单项
const items: MenuProps['items'] = [
  {
    key: '1',
    label: '个人信息',
    icon: <IconUser size={16} />,
  },
  {
    key: '2',
    label: '设置',
    icon: <IconSettings size={16} />,
  },
  {
    type: 'divider',
  },
  {
    key: '3',
    label: '退出登录',
    icon: <IconLogout size={16} />,
    danger: true,
  },
]

// 基础用法（点击触发）
<MagicDropdown menu={{ items }}>
  <button>点击显示下拉菜单</button>
</MagicDropdown>
```

## 高级用法

### 悬停触发

```tsx
<MagicDropdown menu={{ items }} trigger={['hover']}>
  <button>悬停显示下拉菜单</button>
</MagicDropdown>
```

### 右键菜单

```tsx
<MagicDropdown menu={{ items }} trigger={['contextMenu']}>
  <div>右键点击显示菜单</div>
</MagicDropdown>
```

### 受控模式

```tsx
function ControlledDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <MagicDropdown
      menu={{ items }}
      open={open}
      onOpenChange={setOpen}
    >
      <button>受控下拉菜单</button>
    </MagicDropdown>
  )
}
```

### 带事件处理

```tsx
<MagicDropdown
  menu={{
    items,
    onClick: (e) => {
      console.log('点击了菜单项:', e.key)
    },
  }}
>
  <button>点击菜单项触发事件</button>
</MagicDropdown>
```

### 自定义位置

```tsx
<MagicDropdown menu={{ items }} placement="topLeft">
  <button>向上弹出的菜单</button>
</MagicDropdown>

<MagicDropdown menu={{ items }} placement="bottomRight">
  <button>右对齐的菜单</button>
</MagicDropdown>
```

### 禁用状态

```tsx
<MagicDropdown menu={{ items }} disabled>
  <button>禁用的下拉菜单</button>
</MagicDropdown>
```

### 子菜单

```tsx
const itemsWithSubmenu: MenuProps['items'] = [
  {
    key: '1',
    label: '选项 1',
  },
  {
    key: '2',
    label: '更多选项',
    children: [
      { key: '2-1', label: '子选项 1' },
      { key: '2-2', label: '子选项 2' },
    ],
  },
]

<MagicDropdown menu={{ items: itemsWithSubmenu }}>
  <button>带子菜单</button>
</MagicDropdown>
```

### 分组菜单

```tsx
const groupedItems: MenuProps['items'] = [
  {
    type: 'group',
    label: '用户操作',
    children: [
      { key: '1', label: '个人信息' },
      { key: '2', label: '设置' },
    ],
  },
  {
    type: 'group',
    label: '系统操作',
    children: [
      { key: '3', label: '退出登录', danger: true },
    ],
  },
]

<MagicDropdown menu={{ items: groupedItems }}>
  <button>分组菜单</button>
</MagicDropdown>
```

### 自定义渲染

```tsx
<MagicDropdown
  menu={{ items }}
  popupRender={(menu) => (
    <div className="p-4">
      <div className="mb-2 font-bold">自定义标题</div>
      {/* 这里可以放任何自定义内容 */}
      <div>自定义内容</div>
    </div>
  )}
>
  <button>自定义内容</button>
</MagicDropdown>
```

### 自定义容器

```tsx
<MagicDropdown
  menu={{ items }}
  getPopupContainer={() => document.getElementById('custom-container')!}
>
  <button>指定容器</button>
</MagicDropdown>
```

## 菜单项配置

### 基础菜单项

```tsx
{
  key: '1',
  label: '菜单项',
  icon: <IconUser size={16} />,
  disabled: false,
}
```

### 危险操作项

```tsx
{
  key: 'delete',
  label: '删除',
  danger: true,  // 显示为红色警告样式
}
```

### 分隔线

```tsx
{
  type: 'divider',
}
```

### 分组

```tsx
{
  type: 'group',
  label: '分组标题',
  children: [
    { key: '1', label: '选项 1' },
    { key: '2', label: '选项 2' },
  ],
}
```

## 特点

1. **完全兼容**: 与 Ant Design Dropdown API 100% 兼容，无需修改现有代码
2. **现代化样式**: 使用 Tailwind CSS，支持暗色模式
3. **更好的性能**: 基于 Radix UI，比 Ant Design 更轻量
4. **可访问性**: 内置完整的 ARIA 支持和键盘导航
5. **优化的样式**: 10px 圆角、优化的间距和悬停效果
6. **智能触发**: 自动根据 trigger 类型选择 DropdownMenu 或 ContextMenu
7. **灵活定制**: 支持自定义渲染、容器和样式

## 样式定制

组件使用 Tailwind CSS 类名，可以通过 `overlayClassName` 和 `rootClassName` 进行定制：

```tsx
<MagicDropdown
  menu={{ items }}
  overlayClassName="custom-dropdown-overlay"
  rootClassName="custom-dropdown-root"
>
  <button>自定义样式</button>
</MagicDropdown>
```

默认样式包括：
- 圆角: `10px`
- 菜单项间距: `gap-1` (4px)
- 菜单项内边距: `px-2 py-2.5` (8px 水平, 10px 垂直)
- 悬停背景: 使用主题色
- 危险项: 红色文本和背景

## 与 Ant Design 的差异

虽然 API 完全兼容，但有以下细微差异：

1. **样式系统**: 使用 Tailwind CSS 而非 Less
2. **底层实现**: 使用 Radix UI 而非 rc-dropdown
3. **动画效果**: 使用 Radix UI 的动画，与 Ant Design 略有不同
4. **Context Menu**: 右键菜单不支持 `open` 受控属性（Radix UI 限制）

## 何时使用

- 需要在页面上放置一个下拉菜单时
- 需要为用户提供多个操作选项但不想占用太多空间时
- 需要分组展示相关操作时
- 需要在下拉菜单中包含危险操作时
- 需要右键菜单功能时
- 需要更现代化的样式和更好的可访问性时

## 迁移指南

如果你正在从旧版 MagicDropdown（基于 Ant Design）迁移，无需修改任何代码。新版本保持了完全的 API 兼容性。

唯一需要注意的是样式可能会有细微差异，如果需要完全匹配原有样式，可以通过 `overlayClassName` 进行调整。

## TypeScript 支持

组件提供完整的 TypeScript 类型定义：

```tsx
import type { MagicDropdownProps } from '@/opensource/components/base/MagicDropdown'
import type { MenuProps } from 'antd'

const props: MagicDropdownProps = {
  menu: {
    items: [...],
    onClick: (info) => {
      // info.key 有完整的类型推断
    },
  },
  trigger: ['click'],
  placement: 'bottomLeft',
}
```

## 测试

组件包含完整的单元测试，覆盖所有使用场景：

```bash
pnpm test src/opensource/components/base/MagicDropdown/__tests__/index.test.tsx
```

测试覆盖：
- 基础渲染
- 菜单项类型（普通、危险、禁用、分隔线、分组、子菜单）
- 触发方式（点击、悬停、右键）
- 受控模式
- 事件处理
- 位置定位
- 自定义渲染
- 样式定制
