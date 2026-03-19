# CodeEditor 组件

一个可复用的代码编辑器组件，支持语法高亮和代码编辑功能。

## 功能特性

- 🎨 **语法高亮**：支持多种编程语言的语法高亮显示
- ✏️ **代码编辑**：基于 Monaco Editor 的代码编辑功能
- 🔧 **自动语言检测**：根据文件名自动检测编程语言
- 📱 **响应式设计**：适配不同屏幕尺寸
- 🎭 **主题支持**：支持明暗主题切换
- ⚙️ **可配置**：丰富的配置选项

## 使用示例

### 基础用法

```tsx
import CodeEditor from "@/opensource/components/base/CodeEditor"

function MyComponent() {
	const [code, setCode] = useState("console.log('Hello World')")

	return (
		<CodeEditor
			content={code}
			fileName="example.js"
			onChange={setCode}
		/>
	)
}
```

### 编辑模式

```tsx
<CodeEditor
	content={code}
	fileName="example.ts"
	isEditMode={true}
	onChange={(value) => setCode(value)}
	height="400px"
	theme="vs-dark"
/>
```

### 只读模式（语法高亮）

```tsx
<CodeEditor
	content={code}
	fileName="example.py"
	isEditMode={false}
	showLineNumbers={true}
/>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | `string` | - | 文件内容（必填） |
| `fileName` | `string` | `"file.html"` | 文件名，用于语言检测 |
| `isEditMode` | `boolean` | `false` | 是否为编辑模式 |
| `onChange` | `(value: string) => void` | - | 内容变化回调 |
| `height` | `string \| number` | `"100%"` | 编辑器高度 |
| `showLineNumbers` | `boolean` | `true` | 是否显示行号 |
| `theme` | `"vs-dark" \| "light"` | `"vs-dark"` | 编辑器主题 |
| `style` | `React.CSSProperties` | - | 自定义样式 |
| `editorOptions` | `any` | - | Monaco Editor 配置选项 |
| `highlighterStyle` | `any` | - | SyntaxHighlighter 自定义样式 |

## 支持的语言

组件支持以下编程语言的语法高亮：

- HTML/HTM
- CSS
- JavaScript/JSX
- TypeScript/TSX
- JSON
- XML
- Markdown
- Python
- Java
- PHP
- SQL
- Go
- C/C++
- C#
- Ruby
- Swift
- Kotlin
- Rust
- Scala
- Shell/Bash
- YAML
- TOML
- INI

## 工作模式

### 编辑模式 (`isEditMode: true`)
- 使用 Monaco Editor
- 支持代码编辑、自动补全、语法检查
- 实时内容更新

### 只读模式 (`isEditMode: false`)
- 使用 SyntaxHighlighter
- 仅支持语法高亮显示
- 更轻量，性能更好

## 自定义配置

### Monaco Editor 选项

```tsx
<CodeEditor
	content={code}
	fileName="example.ts"
	isEditMode={true}
	editorOptions={{
		fontSize: 16,
		wordWrap: "off",
		minimap: { enabled: true },
		scrollBeyondLastLine: true,
	}}
/>
```

### SyntaxHighlighter 样式

```tsx
<CodeEditor
	content={code}
	fileName="example.js"
	isEditMode={false}
	highlighterStyle={{
		padding: "30px",
		backgroundColor: "#1e1e1e",
		borderRadius: "8px",
	}}
/>
```

## 注意事项

1. 确保项目中已安装依赖：`@monaco-editor/react` 和 `react-syntax-highlighter`
2. 编辑模式下会自动检测语言并配置 Monaco Editor
3. 只读模式下使用 `tomorrow` 主题的语法高亮
4. 组件已使用 `React.memo` 进行性能优化 