# SVG 处理示例

## 常见的 SVG 格式和处理方式

### 1. Base64 编码的 SVG Data URL

```typescript
// 正确处理 base64 编码的 SVG
const base64Svg = "data:image/svg+xml;base64,PHN2Zz48Y2lyY2xlIHI9IjUwIi8+PC9zdmc+"

// 组件会自动解码和渲染
<ImageViewer 
  src={base64Svg}
  info={{ ext: { ext: "svg" } }}
  onClose={onClose}
/>
```

### 2. URL 编码的 SVG Data URL

```typescript
// 处理 URL 编码的 SVG（可能包含 % 字符）
const urlEncodedSvg = "data:image/svg+xml,%3Csvg%3E%3Ccircle%20r%3D%2250%22/%3E%3C/svg%3E"

// 组件会安全解码并渲染
<ImageViewer 
  src={urlEncodedSvg}
  info={{ ext: { ext: "svg" } }}
  onClose={onClose}
/>
```

### 3. 包含特殊字符的 SVG 内容

```typescript
// SVG 内容包含可能导致 URI malformed 的字符
const svgWithSpecialChars = `
<svg>
  <use href="data:image%2Fsvg%2Bxml;base64,test"/>
  <use xlink:href="data:image%2Fsvg%2Bxml;base64,test"/>
</svg>
`

// 组件会自动清理和修复 URI 字符
<ImageViewer 
  src={svgWithSpecialChars}
  info={{ ext: { ext: "svg" } }}
  onClose={onClose}
/>
```

### 4. 错误处理示例

```typescript
// 无效的 SVG 内容
const invalidSvg = "<div>This is not SVG</div>"

// 组件会检测到无效格式并降级为普通图片
<ImageViewer 
  src={invalidSvg}
  info={{ ext: { ext: "svg" } }}
  onClose={onClose}
/>
// 结果：渲染为 <img src={invalidSvg} />
```

## 处理流程

1. **格式检测**：
   - 优先使用文件扩展名 (`info.ext.ext`)
   - 检查 data URL 格式
   - 分析内容结构

2. **内容解码**：
   - Base64 解码：`atob(content)`
   - URL 解码：`decodeURIComponent(content)`
   - 错误捕获和降级

3. **URI 清理**：
   - 修复 `href` 属性中的编码问题
   - 处理 `xlink:href` 属性
   - 保持原始格式的同时确保安全

4. **渲染策略**：
   - 成功：使用 `dangerouslySetInnerHTML` 渲染 SVG
   - 失败：降级为 `<img>` 标签渲染
   - 错误日志：记录详细的错误信息

## 最佳实践

### ✅ 推荐做法

```typescript
// 1. 提供准确的文件类型信息
const fileInfo = {
  ext: { ext: "svg" },
  fileName: "icon.svg"
}

// 2. 使用完整的组件 props
<ImageViewer 
  src={svgContent}
  info={fileInfo}
  onClose={onClose}
  loading={false}
  progress={0}
/>

// 3. 处理错误状态
const handleSvgError = (error: string) => {
  console.warn("SVG processing error:", error)
  // 可以显示错误提示或使用默认图片
}
```

### ❌ 避免的做法

```typescript
// 1. 不要省略文件类型信息
<ImageViewer src={svgContent} /> // 缺少 info prop

// 2. 不要手动处理 SVG 内容
const manuallyProcessed = decodeURIComponent(svgContent) // 可能导致错误

// 3. 不要忽略错误处理
// 组件已经内置了错误处理，无需额外处理
```

## 调试技巧

当遇到 SVG 渲染问题时：

1. **检查控制台日志**：
   ```
   SVG processing warning: Invalid SVG format - must start with <svg>
   Error rendering SVG: Failed to decode base64 content
   ```

2. **验证 SVG 内容**：
   ```typescript
   import { processSvgContent } from './utils/svgProcessor'
   
   const result = processSvgContent(yourSvgContent)
   console.log('SVG validation:', result.isValid, result.error)
   ```

3. **测试不同格式**：
   - 尝试不同的编码方式
   - 检查文件扩展名是否正确
   - 验证 SVG 语法是否完整 