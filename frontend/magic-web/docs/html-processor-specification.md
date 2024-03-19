# HTML 内容处理器技术文档

## 概述

`htmlProcessor.ts` 是一个可复用的 HTML 内容处理器，负责将 HTML 文件中的相对路径资源转换为临时下载 URL，并注入必要的脚本和配置。主要用于预览和编辑场景下的 HTML 文件处理。

**文件路径**: `src/opensource/pages/superMagic/components/Detail/contents/HTML/htmlProcessor.ts`

---

## 核心功能

### 1. 资源路径处理

#### 1.1 支持的 HTML 元素和属性

处理器会扫描并转换以下 HTML 元素的资源路径：

| 元素标签   | 属性名 | 用途            | 特殊处理                                   |
| ---------- | ------ | --------------- | ------------------------------------------ |
| `<img>`    | `src`  | 图片资源        | 添加 `data-original-path` 属性保存原始路径 |
| `<link>`   | `href` | 样式表链接      | 仅处理 `rel="stylesheet"` 的链接           |
| `<script>` | `src`  | JavaScript 脚本 | 添加 `data-original-path` 属性             |
| `<iframe>` | `src`  | 内嵌框架        | 支持 PPT 场景下的相对路径处理              |
| `<source>` | `src`  | 媒体源          | 用于 `<video>` 和 `<audio>` 标签           |
| `<video>`  | `src`  | 视频资源        | 添加 `data-original-path` 属性             |
| `<audio>`  | `src`  | 音频资源        | 添加 `data-original-path` 属性             |
| `<object>` | `data` | 嵌入对象        | 直接使用 OSS 链接                          |

#### 1.2 CSS 背景图片处理

- **匹配模式**: `url(path/to/image.png)` 或 `url('path/to/image.png')`
- **处理方式**: 替换为 `/*__ORIGINAL_URL__:原始路径__*/url('OSS链接')`
- **原路径保存**: 使用 CSS 注释保存原始路径，便于后续恢复

#### 1.3 相对路径解析

- 支持基于 `html_relative_path` 的相对路径计算
- 自动从 `attachmentList` 中查找当前 HTML 文件的文件夹路径
- 默认相对路径为 `/`

---

### 2. 特殊场景处理

#### 2.1 幻灯片（PPT）模式

**检测条件**:

- HTML 中包含 `slides` 数组变量
- 或从 `metadata.slides` 中读取

**处理逻辑**:

```typescript
// 从 script 标签中提取 slides 数组
extractedSlides = extractSlidesFromScript(scriptContent)

// 构建 slidesMap: 原始路径 -> fileId
processSlidesArray({
	htmlDoc,
	allFiles,
	fileIdsToFetch,
	urlMap,
	slidesMap,
	htmlRelativeFolderPath,
	metadata,
})
```

**返回数据**:

- `hasSlides`: 是否包含幻灯片
- `slidesMap`: 幻灯片路径到文件ID的映射
- `originalSlidesPaths`: 原始幻灯片路径数组

**特殊处理**:

- 检测是否有 `slide-bridge.js` 脚本
- 在 `<body>` 添加 `data-has-slide-bridge="true"` 标记
- 保留 DOCTYPE 声明

#### 2.2 数据分析仪表板（Dashboard）模式

**检测条件**: `metadata.type === "dashboard"`

**处理内容**:

1. **旧版页面结构**: 处理 `data-analyst-dashboard` 属性

    ```typescript
    // 替换 url: 'path' 为 url: 'OSS链接'
    const urlRegex = /url\s*:\s*['"`]原始路径['"`]/g
    ```

2. **新版页面结构**: 注入 `magic.project.js` 配置

    ```javascript
    // 构建配置对象
    magicProjectJSConfig = {
      geo: [{ name: '地图名', url: 'OSS链接' }],
      dataSources: [{ name: '数据源名', url: 'OSS链接' }]
    }

    // 注入到 <head> 末尾
    <script data-injected="true">
      if (window.magicProjectConfigure) {
        window.magicProjectConfigure(配置对象);
      }
    </script>
    ```

**资源类型映射**:

- `geo` 类型 → `magicProjectJSConfig.geo[]`
- `cleaned_data` 类型 → `magicProjectJSConfig.dataSources[]`

#### 2.3 音视频模式

**检测条件**: `metadata.type === "audio"` 或 `metadata.type === "video"`

**处理方式**:

1. 处理 `audio`/`video` 数组配置
2. 注入媒体拦截器脚本
3. 创建预加载的 URL 映射

```typescript
const preloadedMapping = createPreloadedUrlMapping(allFiles, urlMap, relativeFolderPath)

injectMediaInterceptorScript(content, {
	enableRelativePathInterception: true,
	preloadedUrlMapping: preloadedMapping,
})
```

---

### 3. 脚本注入

#### 3.1 window.location.reload 替换

**目的**: 防止页面刷新导致编辑状态丢失

**替换规则**:

```javascript
// 原始代码
window.location.reload()
window.location.reload(true)
window.location.reload(false)

// 替换为
/*__ORIGINAL_RELOAD__:原始代码__*/ window.Magic.reload()
```

**注释标记**: 使用 `/*__ORIGINAL_RELOAD__:...*/` 保存原始代码，便于保存时恢复

#### 3.2 at() Polyfill 注入

**目的**: 兼容不支持 `Array.prototype.at()` 的浏览器

**注入位置**: HTML 文档的 `<head>` 标签开头

**注入方式**:

```typescript
processedContent = injectAtPolyfillScript(processedContent)
```

#### 3.3 CDN URL 处理

**功能**: 处理 `ht-cdn.com` 域名的资源链接

**处理函数**: `handleHtCdnUrl(htmlContent)`

---

### 4. 批量处理优化

#### 4.1 文件 ID 收集函数

```typescript
export function collectFileIdsFromHtml(input: ProcessHtmlContentInput): Set<string>
```

**用途**:

- 在批量处理前预先收集所有需要的文件 ID
- 避免重复请求相同的文件 URL
- 支持批量获取临时下载链接

**工作流程**:

1. 解析 HTML 文档
2. 扫描所有资源引用
3. 收集需要的文件 ID
4. 返回去重后的 ID 集合

#### 4.2 预加载 URL 映射

```typescript
interface ProcessHtmlContentInput {
	preloadedUrlMapping?: Map<string, string>
}
```

**使用场景**:

- 批量处理多个 HTML 文件时
- 先统一收集所有文件 ID
- 一次性获取所有临时下载 URL
- 传入 `preloadedUrlMapping` 避免重复请求

**优势**:

- 减少 API 调用次数
- 提高批量处理性能
- 降低服务器压力

---

## 核心接口

### 输入接口 (ProcessHtmlContentInput)

```typescript
interface ProcessHtmlContentInput {
	content: string // HTML内容字符串
	attachments?: any[] // 附件数组
	fileId?: string // 当前文件ID
	fileName?: string // 文件名
	attachmentList?: any[] // 完整附件列表
	html_relative_path?: string // 相对文件夹路径（用于PPT iframe）
	metadata?: any // 文件元数据（type, slides等）
	preloadedUrlMapping?: Map<string, string> // 预加载的URL映射（批量处理优化）
}
```

### 输出接口 (ProcessHtmlContentOutput)

```typescript
interface ProcessHtmlContentOutput {
	processedContent: string // 处理后的HTML内容
	hasSlides: boolean // 是否包含幻灯片
	filePathMapping: Map<string, string> // OSS URL -> 原始文件路径映射
	slidesMap: Map<string, string> // 幻灯片路径 -> 文件ID映射
	originalSlidesPaths: string[] // 原始幻灯片路径数组
}
```

---

## 处理流程

### 主流程图

```
开始
  ↓
检查内容是否为空 → 是 → 返回空结果
  ↓ 否
检查是否有附件 → 否 → 应用脚本替换 → 返回
  ↓ 是
获取HTML相对文件夹路径
  ↓
检测并标记 slide-bridge.js
  ↓
处理 ht-cdn.com URL
  ↓
扫描HTML元素收集资源引用
  ├─ <img>, <link>, <script>
  ├─ <iframe>, <video>, <audio>
  ├─ <source>, <object>
  ├─ CSS url()
  ├─ slides 数组
  ├─ dashboard 配置
  └─ audio/video 配置
  ↓
构建 fileIdsToFetch 列表
  ↓
获取临时下载URL
  ├─ 使用预加载映射（如果提供）
  └─ 或调用 getTemporaryDownloadUrl API
  ↓
替换HTML中的资源路径
  ├─ 添加 data-original-path 属性
  ├─ 处理 CSS url()
  ├─ 注入 dashboard 配置
  └─ 注入媒体拦截器
  ↓
应用脚本替换
  ├─ window.location.reload
  └─ at() polyfill
  ↓
返回处理结果
```

---

## 关键技术细节

### 1. 原始路径保存策略

为支持内容保存时恢复原始路径，处理器采用多种方式保存原始信息：

| 保存方式                  | 适用场景               | 格式示例                                               |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| `data-original-path` 属性 | HTML 元素的 src/href   | `<img src="oss://..." data-original-path="./img.png">` |
| CSS 注释                  | CSS 背景图片           | `/*__ORIGINAL_URL__:./bg.png__*/url('oss://...')`      |
| JavaScript 注释           | window.location.reload | `/*__ORIGINAL_RELOAD__:window.location.reload()__*/`   |
| 标记属性                  | slide-bridge.js 检测   | `<body data-has-slide-bridge="true">`                  |

### 2. 正则表达式转义

在构建替换正则时，需要转义特殊字符：

```typescript
const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
```

### 3. DOM 解析与序列化

```typescript
// 解析
const parser = new DOMParser()
const htmlDoc = parser.parseFromString(content, "text/html")

// 序列化
const serializer = new XMLSerializer()
const modifiedContent = serializer.serializeToString(htmlDoc)
```

**注意**: 需要保留 DOCTYPE 声明

### 4. 错误处理

```typescript
try {
	// 获取临时URL并替换
} catch (error) {
	console.error("Error fetching resource URLs:", error)
	// 即使出错也要替换脚本，确保基本功能
	processedContent = replaceLocationReload(content)
	processedContent = injectAtPolyfillScript(processedContent)
}
```

---

## 依赖的工具函数

### 来自 `./utils`

| 函数名                         | 功能                           |
| ------------------------------ | ------------------------------ |
| `extractSlidesFromScript`      | 从 script 标签提取 slides 数组 |
| `flattenAttachments`           | 扁平化附件数组（处理嵌套结构） |
| `processElementsWithAttribute` | 处理特定属性的HTML元素         |
| `processSlidesArray`           | 处理幻灯片数组配置             |
| `processStyleUrls`             | 处理CSS中的URL                 |
| `processAudioArray`            | 处理音视频数组配置             |
| `handleHtCdnUrl`               | 处理CDN URL                    |

### 来自 `./dashboard/utils`

| 函数名                  | 功能                   |
| ----------------------- | ---------------------- |
| `processDashboardArray` | 处理数据分析仪表板配置 |

### 来自 `./utils/mediaInterceptor`

| 函数名                         | 功能                |
| ------------------------------ | ------------------- |
| `createPreloadedUrlMapping`    | 创建预加载的URL映射 |
| `injectMediaInterceptorScript` | 注入媒体拦截器脚本  |

### 来自 `./utils/polyfill`

| 函数名                   | 功能                    |
| ------------------------ | ----------------------- |
| `injectAtPolyfillScript` | 注入 at() 方法 polyfill |

---

## 使用示例

### 基本用法

```typescript
const result = await processHtmlContent({
	content: htmlString,
	attachments: fileAttachments,
	fileId: "file123",
	fileName: "example.html",
	attachmentList: allAttachments,
})

console.log(result.processedContent) // 处理后的HTML
console.log(result.hasSlides) // 是否包含幻灯片
console.log(result.filePathMapping) // 文件URL映射
```

### 批量处理优化

```typescript
// 第一步：收集所有文件ID
const allFileIds = new Set<string>()
htmlFiles.forEach((file) => {
	const ids = collectFileIdsFromHtml({
		content: file.content,
		attachments: file.attachments,
	})
	ids.forEach((id) => allFileIds.add(id))
})

// 第二步：批量获取URL
const urlMapping = await fetchUrlsInBatch(Array.from(allFileIds))

// 第三步：处理每个HTML文件
const results = await Promise.all(
	htmlFiles.map((file) =>
		processHtmlContent({
			...file,
			preloadedUrlMapping: urlMapping, // 复用URL映射
		}),
	),
)
```

### PPT 场景

```typescript
const result = await processHtmlContent({
	content: pptHtmlContent,
	attachments: slideImages,
	fileId: "ppt_file_id",
	metadata: {
		slides: ["slide1.png", "slide2.png", "slide3.png"],
	},
	html_relative_path: "/ppt/slides/",
})

// 使用幻灯片数据
result.slidesMap.forEach((fileId, slidePath) => {
	console.log(`${slidePath} -> ${fileId}`)
})
```

### 数据分析仪表板

```typescript
const result = await processHtmlContent({
	content: dashboardHtml,
	attachments: [
		{ fileName: "china.json", type: "geo", file_id: "geo1" },
		{ fileName: "sales.csv", type: "cleaned_data", file_id: "data1" },
	],
	metadata: { type: "dashboard" },
})

// 自动注入的配置
// window.magicProjectConfigure({
//   geo: [{ name: 'china', url: 'oss://...' }],
//   dataSources: [{ name: 'sales', url: 'oss://...' }]
// })
```

---

## 性能优化建议

1. **批量处理**: 使用 `collectFileIdsFromHtml` + `preloadedUrlMapping` 减少API调用
2. **缓存映射**: 相同附件列表可复用 URL 映射
3. **按需处理**: 根据 `metadata.type` 只执行必要的处理逻辑
4. **增量更新**: 只在资源变化时重新处理

---

## 已知限制

1. **不支持内联样式中的背景图片**: 仅处理 `<style>` 标签和外部CSS中的 `url()`
2. **相对路径计算**: 依赖正确的 `html_relative_path` 或 `attachmentList`
3. **动态加载资源**: 无法处理 JavaScript 动态创建的资源引用
4. **特殊字符转义**: 文件名包含特殊正则字符时可能匹配失败

---

## 维护注意事项

1. **原始路径标记格式**: 修改保存逻辑时需同步更新标记格式
2. **新增元素支持**: 需同时更新 `collectFileIdsFromHtml` 和 `processHtmlContent`
3. **错误边界**: 确保任何环节失败都能返回可用的HTML（至少包含脚本替换）
4. **测试覆盖**:
    - 各种HTML元素的路径替换
    - PPT/Dashboard/Audio 等特殊场景
    - 批量处理的性能
    - 原始路径恢复的准确性

---

## 相关文件

- `./utils.ts` - 工具函数集合
- `./dashboard/utils.ts` - 数据分析相关处理
- `./utils/mediaInterceptor.ts` - 媒体拦截器
- `./utils/polyfill.ts` - Polyfill 脚本注入
- `@/opensource/pages/superMagic/utils/api.ts` - API 调用函数

---

**最后更新**: 2026-01-27  
**版本**: 1.0.0
