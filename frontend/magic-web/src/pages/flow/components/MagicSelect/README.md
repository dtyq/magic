# MagicSelect 组件

一个为流程节点设计的增强版 Select 组件，基于 Ant Design Select 组件封装，提供更丰富的功能和更好的用户体验。

## 特性

- 🎨 **使用 antd-style** - 采用现代化的样式解决方案
- 🎯 **事件总线系统** - 支持流程图节点、边、画布点击事件监听
- 🔍 **自定义下拉渲染** - 支持自定义搜索和选项渲染
- 🖱️ **外部点击关闭** - 点击外部区域自动关闭下拉菜单
- 📱 **拖拽优化** - 防止在流程编辑器中被意外拖拽
- 🎭 **图标集成** - 完美集成 MagicIcon 组件

## 基本用法

```tsx
import MagicSelect from '@/opensource/pages/flow/components/MagicSelect'

const options = [
  { label: '选项1', value: '1' },
  { label: '选项2', value: '2' },
  { label: '选项3', value: '3' },
]

function MyComponent() {
  const [value, setValue] = useState('')

  return (
    <MagicSelect
      value={value}
      onChange={setValue}
      options={options}
      placeholder="请选择"
    />
  )
}
```

## 高级用法

### 自定义下拉渲染

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  dropdownRenderProps={{
    placeholder: '搜索选项...',
    showSearch: true,
    component: CustomDropdownRenderer,
    OptionWrapper: CustomOptionWrapper,
  }}
/>
```

### 事件处理

```tsx
<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  eventHandlers={{
    onNodeSelected: (nodeId) => console.log('节点被选中:', nodeId),
    onEdgeSelected: (edgeId) => console.log('边被选中:', edgeId),
    onCanvasClicked: (position) => console.log('画布被点击:', position),
  }}
/>
```

### 自定义后缀图标

```tsx
import { IconSettings } from '@tabler/icons-react'
import MagicIcon from '@/opensource/components/base/MagicIcon'

<MagicSelect
  value={value}
  onChange={setValue}
  options={options}
  suffixIcon={<MagicIcon component={IconSettings} size={16} />}
/>
```

## API 文档

### MagicSelectProps

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| className | `string` | - | 自定义样式类名 |
| suffixIcon | `React.ReactElement` | `<IconChevronDown />` | 自定义后缀图标 |
| popupClassName | `string` | - | 下拉菜单样式类名 |
| dropdownRenderProps | `DropdownRenderProps` | - | 自定义下拉渲染配置 |
| eventHandlers | `SelectEventHandlers` | - | 事件处理函数 |
| ...其他 | `SelectProps` | - | 继承 Ant Design Select 的所有属性 |

### DropdownRenderProps

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| placeholder | `string` | `'搜索...'` | 搜索框占位符 |
| component | `() => ReactElement` | `BaseDropdownRenderer` | 自定义渲染组件 |
| showSearch | `boolean` | `true` | 是否显示搜索框 |
| OptionWrapper | `React.FC<any>` | - | 选项包装组件 |

### SelectEventHandlers

| 属性名 | 类型 | 说明 |
|--------|------|------|
| onNodeSelected | `(nodeId?: string) => void` | 节点选中回调 |
| onEdgeSelected | `(edgeId?: string) => void` | 边选中回调 |
| onCanvasClicked | `(position?: { x: number; y: number }) => void` | 画布点击回调 |

## 事件总线

组件内置了一个事件总线系统，用于监听流程图的交互事件：

```tsx
import { flowEventBus, FLOW_EVENTS } from '@/opensource/pages/flow/components/MagicSelect'

// 发送事件
flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, nodeId)
flowEventBus.emit(FLOW_EVENTS.EDGE_SELECTED, edgeId)
flowEventBus.emit(FLOW_EVENTS.CANVAS_CLICKED, { x: 100, y: 200 })

// 监听事件
const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, (event) => {
  console.log('节点被选中:', event.detail)
})

// 清理监听器
cleanup()
```

## 样式定制

组件使用 antd-style 创建样式，支持主题变量：

```tsx
// 自定义样式
const useCustomStyles = createStyles(({ token, css }) => ({
  customSelect: css`
    .ant-select-selector {
      border-color: ${token.colorPrimary};
      background: ${token.colorBgContainer};
    }
  `,
}))

function MyComponent() {
  const { styles } = useCustomStyles()
  
  return (
    <MagicSelect
      className={styles.customSelect}
      // ...其他属性
    />
  )
}
```

## 注意事项

1. **仅用于流程节点** - 该组件专为流程编辑器设计，包含了防拖拽等特殊处理
2. **事件清理** - 组件内部会自动清理事件监听器，无需手动处理
3. **性能优化** - 组件使用了 memo 和 useMemoizedFn 进行性能优化
4. **类型安全** - 提供完整的 TypeScript 类型定义

## 迁移指南

从旧版 TsSelect 迁移到 MagicSelect：

```tsx
// 旧版本
import TsSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"

// 新版本
import MagicSelect from "@/opensource/pages/flow/components/MagicSelect"

// 图标需要使用 MagicIcon 包装
// 旧版本
<IconChevronDown />

// 新版本
<MagicIcon component={IconChevronDown} size={16} />
```
