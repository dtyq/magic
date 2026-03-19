# Transform Data Worker

此模块将 `transformData` 函数的数据转换逻辑移到 Web Worker 中执行，避免阻塞主线程，提升用户体验。

## 功能特性

- ✅ **非阻塞处理**: 使用 Web Worker 在后台处理大文件转换
- ✅ **自动回退**: 当 Worker 不可用时自动回退到主线程处理
- ✅ **并发控制**: 支持配置最大并发任务数（默认 3）
- ✅ **超时处理**: 内置超时机制（默认 30 秒）
- ✅ **进度监控**: 支持转换进度回调
- ✅ **错误处理**: 完善的错误处理和任务清理机制
- ✅ **DOM 兼容**: 使用 xmldom 在 Worker 环境中处理 XML/HTML 解析

## 技术实现

### DOM Parser 兼容性

由于 Web Worker 环境中没有 DOM API，本模块使用 `@xmldom/xmldom` 包来提供 DOMParser 功能：

- **浏览器环境**: 使用原生 `DOMParser`
- **Worker 环境**: 使用 `@xmldom/xmldom` 的 `DOMParser`
- **测试环境**: 自动回退到 `xmldom`

```typescript
// 自动选择合适的 DOMParser 实现
const parser = getDOMParser()
const doc = parser.parseFromString(xmlContent, "text/xml")
```

### Worker 架构

```
主线程                    Web Worker
  ↓                          ↓
transformData()          worker.ts
  ↓                          ↓
Worker 消息              transformDataInWorker()
  ↓                          ↓
Promise<结果>            textUtils (with xmldom)
```

## 使用方式

### 方式一：使用增强的 transformData 函数（推荐）

现有的 `transformData` 函数已经自动集成了 Worker 支持：

```typescript
import { transformData } from '../utils/transformUtils'

// 使用方式与之前完全相同，但现在会自动使用 Worker 处理
const result = await transformData(fileData, 'sheet', 'example.xlsx')
```

### 方式二：直接使用 Worker Hook

如果需要更精细的控制，可以直接使用 Worker Hook：

```typescript
import { useTransformWorker } from './workers/transform-data'

function MyComponent() {
  const transformWorker = useTransformWorker({
    timeout: 60000, // 60 秒超时
    maxConcurrentTasks: 5 // 最大 5 个并发任务
  })

  const handleFileUpload = async (file: File) => {
    try {
      const result = await transformWorker.transformData(file, 'sheet', file.name)
      console.log('转换完成:', result)
    } catch (error) {
      console.error('转换失败:', error)
    }
  }

  return (
    <div>
      <p>待处理任务: {transformWorker.getPendingTasksCount()}</p>
      <button onClick={() => transformWorker.terminateWorker()}>
        停止 Worker
      </button>
    </div>
  )
}
```

## 配置选项

```typescript
interface TransformWorkerOptions {
  timeout?: number // 超时时间（毫秒），默认 30000
  maxConcurrentTasks?: number // 最大并发任务数，默认 3
}
```

## 支持的文件类型

- **Excel 文件**: `.xlsx`, `.xls` - 完整的样式、合并单元格、公式支持
- **CSV 文件**: `.csv` - 自动解析和转换
- **文档文件**: 其他文本文件 - 根据 `fileType` 参数转换

## 性能优势

- **大文件处理**: Worker 避免主线程阻塞，UI 保持响应
- **并行处理**: 支持多个文件同时转换
- **内存管理**: Worker 独立内存空间，不影响主线程
- **XML 处理**: 在 Worker 中正确解析 Excel 富文本和 HTML 内容

## 兼容性

- ✅ 现代浏览器支持 Web Workers
- ✅ 自动回退到主线程处理（兼容旧浏览器）
- ✅ 保持原有 API 完全兼容
- ✅ Worker 环境中的 DOM 解析支持

## 依赖项

```json
{
  "dependencies": {
    "@xmldom/xmldom": "^0.9.8"
  }
}
```

## 错误处理

```typescript
try {
  const result = await transformData(data, 'sheet', 'file.xlsx')
} catch (error) {
  if (error.message.includes('超时')) {
    console.log('处理超时，请尝试较小的文件')
  } else if (error.message.includes('并发任务数限制')) {
    console.log('当前有太多任务在处理，请稍后重试')
  } else if (error.message.includes('Worker 遇到错误')) {
    console.log('Worker 环境出现问题，已回退到主线程处理')
  } else {
    console.log('转换失败:', error.message)
  }
}
```

## 进度监控

Worker 会自动在控制台输出处理进度，可以通过监听 Worker 消息来实现自定义进度显示：

```
[Worker] 任务 abc123: 10% - 开始处理数据
[Worker] 任务 abc123: 40% - 正在解析Excel文件
[Worker] 任务 abc123: 80% - 正在转换为Univer格式
[Worker] 任务 abc123: 100% - 转换完成
```

## 开发和调试

在开发模式下，可以通过浏览器开发者工具的 Sources 标签查看 Worker 的执行情况。Worker 文件位于：

```
src/opensource/components/UniverComponent/workers/transform-data/worker.ts
```

### 测试 XML 解析

可以在浏览器控制台中测试 DOM 解析功能：

```javascript
// 测试富文本 XML 解析
const richTextXml = `<r><rPr><b/></rPr><t>Bold Text</t></r>`
const result = processExcelRichText(richTextXml)
console.log('解析结果:', result)
```

## 故障排除

### 常见问题

1. **"DOMParser is not defined" 错误**
   - 确保已安装 `@xmldom/xmldom` 包
   - 检查导入路径是否正确

2. **Worker 初始化失败**
   - 检查浏览器是否支持 Web Workers
   - 确认 Worker 文件路径正确
   - 查看控制台是否有模块加载错误

3. **XML 解析失败**
   - 检查 XML 格式是否正确
   - 确认特殊字符已正确转义

### 调试技巧

1. 使用浏览器开发者工具的 Application > Service Workers 面板查看 Worker 状态
2. 在 Worker 代码中添加 `console.log` 来追踪执行流程
3. 使用 `transformDataInMainThread` 函数在主线程中测试相同逻辑 