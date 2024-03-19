# MentionPanel Tiptap Plugin

一个功能强大的 Tiptap 编辑器插件，集成了高级的 MentionPanel 组件，支持多状态、搜索、文件夹导航等功能。

## ✨ 特性

- 🚀 **即时触发**: 输入 `@` 立即显示面板
- 🔍 **智能搜索**: 输入 `@搜索词` 进入搜索模式
- 📁 **文件夹导航**: 支持多级文件夹浏览
- ⌨️ **键盘导航**: 完整的键盘快捷键支持
- 🎨 **自定义样式**: 支持主题定制
- 🌍 **国际化**: 支持多语言
- 📱 **响应式**: 移动端友好
- 🔗 **类型安全**: 完整的 TypeScript 支持

## 📦 安装

由于这是项目内部插件，直接从相对路径导入：

```typescript
import MentionExtension from "./path/to/MentionPanel/tiptap-plugin"
```

## 🚀 快速开始

### 基本使用

```typescript
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import MentionExtension from "./components/business/MentionPanel/tiptap-plugin"

function MyEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      MentionExtension.configure({
        language: "zh-CN",
        searchPlaceholder: "搜索项目文件",
      }),
    ],
    content: "<p>输入 @ 来触发面板</p>",
  })

  return <EditorContent editor={editor} />
}
```

### 高级配置

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    MentionExtension.configure({
      // 界面语言
      language: "zh-CN",
      
      // 搜索框占位符
      searchPlaceholder: "搜索项目文件",
      
      // 允许空格
      allowSpaces: true,
      
      // 允许的前缀字符
      allowedPrefixes: ["@", "#"],
      
      // 渲染文本函数
      renderText: ({ node }) => `@${node.attrs.label}`,
      
      // 父容器获取函数
      getParentContainer: () => document.getElementById("editor-container"),
    }),
  ],
})
```

## 📖 API 文档

### MentionPanelPluginOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `language` | `Language` | `"en"` | 界面语言 |
| `searchPlaceholder` | `string` | - | 搜索输入框占位符 |
| `allowSpaces` | `boolean` | `true` | 是否允许空格 |
| `allowedPrefixes` | `string[]` \| `null` | `null` | 允许的前缀字符 |
| `renderText` | `function` | - | 自定义渲染函数 |
| `getParentContainer` | `function` | - | 获取父容器函数 |

### TiptapMentionAttributes

```typescript
interface TiptapMentionAttributes {
  id: string           // 唯一标识
  label: string        // 显示文本
  type: string         // 类型 (file, folder, agent, etc.)
  description?: string // 描述信息
  icon?: string        // 图标标识
  metadata?: Record<string, any> // 额外数据
}
```

### 扩展命令

插件继承了基本的 Mention 扩展命令：

```typescript
// 插入提及
editor.commands.insertContent([
  {
    type: "mentionPanel",
    attrs: {
      id: "file-123",
      label: "README.md",
      type: "file",
      description: "项目说明文件",
    },
  },
])
```

## 🎯 使用场景

### 1. 文件提及

```typescript
// 用户输入: @README
// 插入结果: @README.md (file mention)
```

### 2. 文件夹导航

```typescript
// 用户输入: @个人云盘
// 显示文件夹内容，支持进入和导航
```

### 3. 智能体提及

```typescript
// 用户输入: @AI助手
// 插入结果: @ChatGPT (agent mention)
```

### 4. 搜索模式

```typescript
// 用户输入: @项目文档
// 自动进入搜索模式，过滤相关项目
```

## 🎨 样式定制

### CSS 变量

```css
:root {
  --mention-panel-bg: #ffffff;
  --mention-panel-border: #e5e7eb;
  --mention-panel-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
  --mention-panel-radius: 8px;
  
  --mention-item-padding: 8px;
  --mention-item-hover-bg: #f3f4f6;
  --mention-item-selected-bg: #eef3fd;
  
  --mention-text-primary: #1f2937;
  --mention-text-secondary: #6b7280;
  --mention-text-hint: #9ca3af;
}
```

### 自定义样式类

```css
.mention-panel {
  /* 面板样式 */
}

.mention-panel-item {
  /* 项目样式 */
}

.mention-panel-item.selected {
  /* 选中项目样式 */
}
```

## ⌨️ 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `↑` / `↓` | 上下导航 |
| `←` | 返回上级 |
| `→` | 进入文件夹 |
| `Enter` | 确认选择 |
| `Escape` | 关闭面板 |

## 🔧 高级功能

### 自定义数据源

```typescript
// 可以通过 MentionPanel 的 dataService 属性自定义数据源
const customDataService = {
  loadDefaultItems: async () => {
    // 加载默认项目
  },
  searchItems: async (query: string) => {
    // 搜索项目
  },
  loadFolderItems: async (folderId: string) => {
    // 加载文件夹内容
  },
}
```

### 事件监听

```typescript
const editor = useEditor({
  extensions: [
    MentionExtension.configure({
      onSelect: (item) => {
        console.log("选中项目:", item)
      },
      onClose: () => {
        console.log("面板关闭")
      },
    }),
  ],
})
```

## 🧪 测试

```bash
# 运行单元测试
npm test -- MentionPanel/tiptap-plugin

# 运行集成测试
npm test -- --testNamePattern="MentionPanel Integration"
```

## 🐛 故障排除

### 常见问题

1. **面板不显示**
   - 检查是否正确配置了扩展
   - 确认 @ 字符前有空格或在行首

2. **搜索不工作**
   - 确认 dataService 正确配置
   - 检查搜索 API 是否正常

3. **样式问题**
   - 检查 CSS 变量是否正确设置
   - 确认没有样式冲突

4. **键盘导航异常**
   - 检查是否有其他插件冲突
   - 确认 onKeyDown 事件正确处理

### 调试模式

```typescript
MentionExtension.configure({
  debug: true, // 开启调试模式
})
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Tiptap 官方文档](https://tiptap.dev/)
- [MentionPanel 组件文档](../README.md)
- [项目 GitHub](https://github.com/your-org/your-repo) 