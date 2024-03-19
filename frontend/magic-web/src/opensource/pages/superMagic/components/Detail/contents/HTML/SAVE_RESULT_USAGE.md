# SaveResult Usage Examples

## Overview

`editorRef.current.save()` 现在返回 `SaveResult` 对象，包含以下信息：

```typescript
interface SaveResult {
  /** 清理后的 HTML 内容 */
  cleanContent: string
  /** 原始 HTML 内容（带编辑器标记） */
  rawContent: string
  /** 文件 ID */
  fileId?: string
  /** 保存是否成功 */
  success: boolean
}
```

## Usage Examples

### Example 1: 基本使用 - 检查保存是否成功

```typescript
const handleSave = async () => {
  if (editorRef.current) {
    const result = await editorRef.current.save()
    
    if (result.success) {
      message.success('保存成功')
      console.log('新内容长度:', result.cleanContent.length)
    } else {
      message.error('保存失败')
    }
  }
}
```

### Example 2: 获取保存后的内容用于其他业务逻辑

```typescript
const handleSaveAndPreview = async () => {
  if (editorRef.current) {
    const result = await editorRef.current.save()
    
    if (result.success) {
      // 使用保存后的内容进行预览
      previewContent(result.cleanContent)
      
      // 或者进行内容分析
      analyzeContent(result.cleanContent)
      
      // 或者记录版本历史
      recordVersion({
        fileId: result.fileId,
        content: result.cleanContent,
        timestamp: Date.now()
      })
    }
  }
}
```

### Example 3: 在 PPT 场景中使用

```typescript
const handleSaveSlide = async () => {
  if (editorRef.current) {
    const result = await editorRef.current.save()
    
    if (result.success) {
      // 更新 PPT slide 内容
      setSlideContents((prev) => {
        const newMap = new Map(prev)
        newMap.set(currentSlideIndex, result.cleanContent)
        return newMap
      })
      
      message.success(`幻灯片 ${currentSlideIndex + 1} 保存成功`)
    }
  }
}
```

### Example 4: 保存并导出

```typescript
const handleSaveAndExport = async () => {
  if (editorRef.current) {
    const result = await editorRef.current.save()
    
    if (result.success) {
      // 创建下载链接
      const blob = new Blob([result.cleanContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${result.fileId || 'export'}.html`
      a.click()
      URL.revokeObjectURL(url)
      
      message.success('导出成功')
    }
  }
}
```

### Example 5: 错误处理

```typescript
const handleSaveWithErrorHandling = async () => {
  try {
    if (!editorRef.current) {
      throw new Error('编辑器未初始化')
    }
    
    const result = await editorRef.current.save()
    
    if (!result.success) {
      // 根据不同情况处理失败
      if (!result.fileId) {
        message.error('文件ID缺失，无法保存')
      } else if (result.cleanContent.length === 0) {
        message.error('内容为空，无法保存')
      } else {
        message.error('保存失败，请重试')
      }
      return
    }
    
    // 保存成功的后续处理
    message.success('保存成功')
    console.log('保存的内容:', result.cleanContent)
    
  } catch (error) {
    console.error('保存过程中发生错误:', error)
    message.error('保存失败')
  }
}
```

### Example 6: 在 `onSaveReady` 回调中使用

```typescript
<IsolatedHTMLRenderer
  content={htmlContent}
  isEditMode={true}
  onSaveReady={(triggerSave) => {
    // triggerSave 现在返回 SaveResult | undefined
    saveButtonRef.current = async () => {
      const result = await triggerSave()
      
      if (result?.success) {
        // 使用返回的内容
        updateUIWithNewContent(result.cleanContent)
      }
    }
  }}
  {...otherProps}
/>
```

## Benefits

使用 `SaveResult` 的优势：

1. **明确的成功/失败状态**: 通过 `success` 字段可以明确知道保存是否成功
2. **获取保存后的内容**: 可以直接获取保存后的内容，无需再次请求
3. **便于日志记录**: 包含文件ID等信息，方便记录和追踪
4. **支持更多业务场景**: 可以基于保存结果进行更多后续操作

## Migration Guide

如果之前代码是这样的：

```typescript
// 旧代码
await editorRef.current.save()
// 无法获取保存后的内容
```

现在可以改为：

```typescript
// 新代码
const result = await editorRef.current.save()
if (result.success) {
  // 可以使用 result.cleanContent 等信息
  console.log('保存的内容:', result.cleanContent)
}
```
