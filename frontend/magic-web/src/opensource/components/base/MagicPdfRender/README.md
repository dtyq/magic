# MagicPdfRender

基于 `react-pdf` 实现的 PDF 预览组件，支持文件和 URL 渲染，提供完整的交互功能。

## 功能特性

- ✅ 支持本地文件（File 对象）和网络 URL
- ✅ 完整的工具栏：翻页、缩放、旋转、下载、全屏等
- ✅ 键盘快捷键支持
- ✅ 响应式设计
- ✅ 错误处理和加载状态
- ✅ TypeScript 支持
- ✅ 自定义样式（基于 antd-style）
- ✅ 国际化支持（中文/英文）

## 基本用法

```tsx
import MagicPdfRender from './components/base/MagicPdfRender'

function App() {
  const [file, setFile] = useState<File | string | null>(null)
  
  return (
    <MagicPdfRender
      file={file}
      height={600}
      showToolbar
      enableKeyboard
      onLoadSuccess={(pdf) => console.log('加载成功', pdf)}
      onLoadError={(error) => console.error('加载失败', error)}
    />
  )
}
```

## API

### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| file | PDF 文件源，可以是 File 对象或 URL 字符串 | `File \| string \| null` | - |
| showToolbar | 是否显示工具栏 | `boolean` | `true` |
| initialScale | 初始缩放比例 | `number` | `1.0` |
| minScale | 最小缩放比例 | `number` | `0.5` |
| maxScale | 最大缩放比例 | `number` | `3.0` |
| scaleStep | 缩放步长 | `number` | `0.1` |
| height | 容器高度 | `string \| number` | `600` |
| width | 容器宽度 | `string \| number` | `'100%'` |
| enableKeyboard | 是否启用键盘快捷键 | `boolean` | `true` |
| onLoadError | 加载失败回调 | `(error: Error) => void` | - |
| onLoadSuccess | 加载成功回调 | `(pdf: any) => void` | - |

## 键盘快捷键

| 快捷键 | 功能 |
| --- | --- |
| `←` / `→` | 上一页 / 下一页 |
| `+` / `-` | 放大 / 缩小 |
| `Ctrl+0` | 重置缩放 |
| `F11` | 全屏切换 |

## 工具栏功能

- **翻页控制**：上一页、下一页、页码输入跳转
- **缩放控制**：放大、缩小、缩放比例输入
- **旋转功能**：顺时针和逆时针旋转 90 度
- **文档操作**：重新加载、下载 PDF
- **显示控制**：全屏预览

## 文件支持

### 本地文件
```tsx
const handleFileUpload = (file: File) => {
  setFile(file)
}

// 在 Upload 组件中使用
<Upload beforeUpload={handleFileUpload}>
  <Button>上传 PDF</Button>
</Upload>
```

### 网络 URL
```tsx
const pdfUrl = 'https://example.com/document.pdf'
setFile(pdfUrl)
```

## 样式自定义

组件使用 `antd-style` 进行样式管理，可以通过 CSS-in-JS 的方式自定义样式：

```tsx
const useCustomStyles = createStyles(({ token }) => ({
  customContainer: {
    border: `2px solid ${token.colorPrimary}`,
    borderRadius: '12px',
  }
}))
```

## 依赖要求

- React 18+
- antd 5+
- react-pdf 9+
- antd-style 3+

## 注意事项

1. **PDF.js Worker**: 组件会自动配置 PDF.js worker，无需额外设置
2. **CORS 问题**: 加载跨域 PDF 时，服务器需要正确配置 CORS 头
3. **文件大小**: 大文件可能会影响加载性能，建议进行适当的优化
4. **浏览器兼容性**: 依赖现代浏览器的 PDF 渲染能力

## 错误处理

组件提供了完整的错误处理机制：

```tsx
<MagicPdfRender
  file={file}
  onLoadError={(error) => {
    console.error('PDF 加载失败:', error)
    // 可以在这里显示用户友好的错误信息
    message.error('PDF 加载失败，请检查文件格式或网络连接')
  }}
/>
```

## 国际化

组件支持中文和英文两种语言，使用 `react-i18next` 进行国际化管理。

### 配置

确保在项目的国际化配置中包含 `component` 命名空间：

```typescript
// src/assets/locales/create.ts
ns: ["translation", "common", "interface", "message", "flow", "magicFlow", "component"]
```

### 语言文件

- 中文：`src/assets/locales/zh_CN/component.json`
- 英文：`src/assets/locales/en_US/component.json`

### 切换语言

```tsx
import { useTranslation } from "react-i18next"

function App() {
  const { i18n } = useTranslation()
  
  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }
  
  return (
    <div>
      <Button onClick={() => switchLanguage("zh_CN")}>中文</Button>
      <Button onClick={() => switchLanguage("en_US")}>English</Button>
      <MagicPdfRender file={file} />
    </div>
  )
}
```

### 支持的文本

组件的所有用户界面文本都支持国际化，包括：

- 工具栏按钮提示
- 页面导航信息
- 错误和状态消息
- 下拉菜单选项
- 占位符文本