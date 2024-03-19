# SlashDropdownMenu

一个基于 Tiptap 的斜杠命令下拉菜单组件，支持快速插入内容、格式化和执行各种编辑器命令。

## 特性

- 🚀 **类似 Notion 的体验** - 输入 `/` 即可弹出命令面板
- 🎨 **高度可定制** - 支持自定义菜单项、图标和样式
- 🔍 **智能搜索** - 支持模糊搜索、别名匹配
- 📱 **响应式设计** - 支持移动端和桌面端
- ⌨️ **键盘导航** - 完整的键盘快捷键支持
- 🎯 **可扩展性** - 易于添加自定义命令和功能
- 🌈 **动画效果** - 自然、微妙的UI动画效果

## 快速开始

### 基础用法

```tsx
import MagicNotionLikeEditor from '@/components/MagicNotionLikeEditor'

function MyEditor() {
  return (
    <MagicNotionLikeEditor
      content=""
      placeholder="输入 / 来看看魔法..."
      enableSlashCommands={true}
    />
  )
}
```

### 自定义配置

```tsx
import MagicNotionLikeEditor from '@/components/MagicNotionLikeEditor'
import type { SlashMenuConfig } from '@/components/MagicNotionLikeEditor/SlashDropdownMenu'

const slashConfig: SlashMenuConfig = {
  enabledItems: [
    'text',
    'heading_1',
    'heading_2',
    'bullet_list',
    'ordered_list',
    'quote',
    'code_block',
  ],
  showGroups: true,
  maxItems: 8,
  customItems: [
    {
      id: 'custom-item',
      type: 'text',
      title: '自定义命令',
      subtext: '这是一个自定义命令示例',
      aliases: ['custom', '自定义'],
      icon: <CustomIcon />,
      group: '自定义',
      onSelect: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('自定义内容').run()
      },
    },
  ],
}

function MyEditor() {
  return (
    <MagicNotionLikeEditor
      content=""
      placeholder="输入 / 来使用命令..."
      slashConfig={slashConfig}
    />
  )
}
```

## API 文档

### MagicNotionLikeEditor Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| content | string | - | 编辑器初始内容 |
| placeholder | string | - | 占位符文本 |
| slashConfig | SlashMenuConfig | {} | 斜杠菜单配置 |
| enableSlashCommands | boolean | true | 是否启用斜杠命令 |
| extensions | Extension[] | [] | 额外的 Tiptap 扩展 |

### SlashMenuConfig

```typescript
interface SlashMenuConfig {
  /** 启用的菜单项类型 */
  enabledItems?: SlashMenuItemType[]
  /** 自定义菜单项 */
  customItems?: SuggestionItem[]
  /** 分组配置 */
  itemGroups?: Record<string, string>
  /** 是否显示分组 */
  showGroups?: boolean
  /** 最大显示项目数 */
  maxItems?: number
  /** 空状态占位符 */
  emptyPlaceholder?: string
}
```

### 内置命令类型

- `text` - 普通文本
- `heading_1` - 一级标题
- `heading_2` - 二级标题  
- `heading_3` - 三级标题
- `bullet_list` - 无序列表
- `ordered_list` - 有序列表
- `todo_list` - 待办列表
- `quote` - 引用块
- `code_block` - 代码块
- `divider` - 分割线
- `image` - 图片
- `table` - 表格
- `ai` - AI 助手
- `mention` - 提及
- `emoji` - 表情符号

## 高级用法

### 创建自定义菜单项

```typescript
import { IconCustom } from '@tabler/icons-react'

const customItem: SuggestionItem = {
  id: 'insert-date',
  type: 'text',
  title: '插入当前日期',
  subtext: '插入今天的日期',
  aliases: ['date', 'today', '日期', '今天'],
  icon: <IconCalendar size={18} />,
  group: '工具',
  onSelect: ({ editor, range }) => {
    const today = new Date().toLocaleDateString('zh-CN')
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent(today)
      .run()
  },
  enabled: () => true,
}
```

### 使用 Hook

```typescript
import { useSlashDropdownMenu } from '@/components/MagicNotionLikeEditor/SlashDropdownMenu'

function CustomSlashMenu({ editor }) {
  const { getSlashMenuItems, filterItems } = useSlashDropdownMenu({
    enabledItems: ['text', 'heading_1', 'bullet_list'],
  })

  const items = getSlashMenuItems(editor)
  const filteredItems = filterItems(items, 'head') // 搜索包含 'head' 的项目
  
  return (
    <div>
      {filteredItems.map(item => (
        <div key={item.id} onClick={() => item.onSelect({ editor })}>
          {item.title}
        </div>
      ))}
    </div>
  )
}
```

### 扩展现有编辑器

```typescript
import { addSlashCommand } from '@/components/MagicNotionLikeEditor/SlashDropdownMenu'

const extensions = addSlashCommand([
  StarterKit,
  Highlight,
  // ... 其他扩展
], {
  enabledItems: ['text', 'heading_1', 'bullet_list'],
  showGroups: true,
})
```

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `/` | 打开斜杠命令菜单 |
| `↑` `↓` | 在菜单项间导航 |
| `Enter` | 选择当前高亮的菜单项 |
| `Escape` | 关闭菜单 |
| `Tab` | 关闭菜单并继续输入 |
| `Cmd/Ctrl + /` | 手动触发斜杠命令 |

## 样式定制

组件使用 `antd-style` 进行样式管理，支持主题定制：

```typescript
const useCustomStyles = createStyles(({ token }) => ({
  customMenuItem: css`
    background: ${token.colorPrimary};
    color: ${token.colorWhite};
  `,
}))
```

## 性能优化

- **虚拟化渲染** - 大量菜单项时自动启用虚拟滚动
- **智能搜索** - 模糊匹配算法，支持拼音搜索
- **懒加载** - 按需加载图标和组件
- **缓存机制** - 自动缓存搜索结果和菜单项

## 兼容性

- ✅ Chrome 70+
- ✅ Firefox 65+  
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ 移动端 Safari
- ✅ 移动端 Chrome

## 故障排除

### 常见问题

**Q: 斜杠命令不工作**
A: 确保 `enableSlashCommands` 为 `true`，并且 Tiptap 版本兼容

**Q: 自定义菜单项不显示**
A: 检查 `enabledItems` 配置和 `enabled` 函数返回值

**Q: 样式异常**
A: 确保正确导入了 `antd-style` 相关依赖

**Q: 移动端体验不佳**
A: 可以通过 `config.showGroups = false` 简化移动端显示

### 调试模式

在开发环境下启用调试日志：

```typescript
// 开发环境下会自动启用调试模式
console.log('[SlashCommand] Debug info will be logged')
```

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个组件！

## 许可证

MIT License
