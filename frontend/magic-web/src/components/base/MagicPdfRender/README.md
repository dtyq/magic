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
- ✅ 自适应缩放（首次加载时自动调整到合适大小）
- ✅ 优化的图标和按钮尺寸（更易点击和使用）
- ✅ 移动端触摸手势支持（双指缩放）

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
| autoScale | 是否启用自适应缩放 | `boolean` | `true` |
| enableTouchGestures | 是否启用移动端触摸手势（双指缩放） | `boolean` | `true` |
| onLoadError | 加载失败回调 | `(error: Error) => void` | - |
| onLoadSuccess | 加载成功回调 | `(pdf: any) => void` | - |

## 键盘快捷键

| 快捷键 | 功能 |
| --- | --- |
| `←` / `→` | 上一页 / 下一页 |
| `+` / `-` | 放大 / 缩小 |
| `Ctrl+0` | 重置缩放 |
| `F11` | 全屏切换 |

## 移动端触摸手势

组件支持移动端的触摸手势操作，提供更自然的交互体验：

### 双指缩放（Pinch-to-Zoom）

- **手势**：使用两个手指在 PDF 上进行捏合或张开
- **功能**：实时缩放 PDF 内容
- **范围**：缩放比例受 `minScale` 和 `maxScale` 限制
- **兼容性**：与工具栏缩放控件完全兼容

### 使用示例

```tsx
// 启用触摸手势（默认）
<MagicPdfRender
  file={file}
  enableTouchGestures={true}
  minScale={0.5}
  maxScale={3.0}
/>

// 禁用触摸手势
<MagicPdfRender
  file={file}
  enableTouchGestures={false}
/>
```

### 技术特性

- **防冲突**：自动阻止浏览器默认的缩放行为
- **流畅性**：实时响应手势，无延迟
- **精确性**：基于两指距离变化精确计算缩放比例
- **稳定性**：手势结束后状态正确重置

## 工具栏功能

- **翻页控制**：上一页、下一页、页码输入跳转
- **缩放控制**：放大、缩小、缩放比例输入
- **旋转功能**：顺时针和逆时针旋转 90 度
- **文档操作**：重新加载、下载 PDF
- **显示控制**：全屏预览

## 自适应缩放

组件支持智能的自适应缩放功能，在 PDF 首次加载时会自动计算最合适的缩放比例，确保内容完整显示在容器中。

### 工作原理

1. **自动检测**：当第一页加载完成后，获取页面的原始尺寸
2. **智能计算**：根据容器大小、工具栏高度等因素计算最优缩放比例
3. **边界控制**：确保计算出的缩放比例在 `minScale` 和 `maxScale` 范围内
4. **一次性应用**：每个文档只在首次加载时应用一次，避免重复调整

### 使用示例

```tsx
// 启用自适应缩放（默认）
<MagicPdfRender
  file={file}
  autoScale={true}
  minScale={0.3}
  maxScale={2.0}
/>

// 禁用自适应缩放，使用固定初始缩放
<MagicPdfRender
  file={file}
  autoScale={false}
  initialScale={1.0}
/>
```

### 注意事项

- 自适应缩放只在文档首次加载时触发
- 计算会考虑工具栏高度、容器边距等因素
- 用户手动调整缩放后，不会再次自动调整
- 更换文档时会重新进行自适应缩放

## UI 优化

### 图标和按钮尺寸

组件针对不同屏幕尺寸优化了图标和按钮的大小，确保在各种设备上都有良好的可用性：

- **桌面端（>1024px）**：按钮 36×36px，图标 18px
- **中等屏幕（≤1024px）**：按钮 34×34px，图标 16px  
- **小屏幕（≤800px）**：按钮 32×32px，图标 15px
- **超小屏幕（≤480px）**：按钮 28×28px，图标 14px

### 响应式工具栏

工具栏会根据屏幕大小自动调整：
- 宽屏模式：显示完整的工具栏控件
- 紧凑模式：将部分功能收纳到下拉菜单中
- 自适应高度：工具栏高度随按钮大小调整

### 容器布局优化

- **Flexbox布局**：使用flex布局确保组件高度正确填充
- **高度计算**：viewer区域自动计算剩余高度，避免出现空白区域
- **内容适配**：PDF内容容器根据实际内容高度自适应，不会超出可视范围
- **滚动控制**：内容超出时在viewer内部滚动，保持界面整洁

### 交互体验

- 悬停效果：按钮悬停时有轻微上移和阴影效果
- 禁用状态：不可用按钮有明确的视觉反馈
- 过渡动画：所有交互都有平滑的过渡效果
- 智能滚动：页面导航时保持工具栏可见，避免滚动到视野外

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
// src/opensource/assets/locales/create.ts
ns: ["translation", "common", "interface", "message", "flow", "magicFlow", "component"]
```

### 语言文件

- 中文：`src/opensource/assets/locales/zh_CN/component.json`
- 英文：`src/opensource/assets/locales/en_US/component.json`

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