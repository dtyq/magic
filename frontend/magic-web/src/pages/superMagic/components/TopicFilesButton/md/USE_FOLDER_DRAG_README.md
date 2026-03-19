# 文件夹拖拽上传 Hook 使用指南

## 概述

`useFolderDragUpload` 是一个专门处理文件夹拖拽上传的 React Hook，它封装了复杂的文件夹检测、递归遍历和文件结构保持逻辑。

## 功能特性

✅ **双重检测机制**: 支持 input[webkitdirectory] 和直接拖拽两种文件夹来源  
✅ **完整目录结构**: 递归获取所有子文件并保持路径关系  
✅ **类型安全**: 完整的 TypeScript 类型定义  
✅ **错误处理**: 完善的权限检查和异常处理  
✅ **调试支持**: 可选的详细调试信息输出  
✅ **性能优化**: 异步递归和分批处理机制  

# 文件夹拖拽上传技术方案

## 概述

本方案实现了一个完整的文件夹拖拽上传功能，支持从操作系统直接拖拽文件夹到项目文件区域，并保持完整的目录结构关系。

## 技术架构

### 1. 核心组件架构

```
TopicFilesPanel.tsx
    ↓ 使用
useFolderDragUpload Hook
    ↓ 集成
useDragUpload Hook (基础拖拽检测)
    ↓ 处理
WebKit File System API (文件夹递归访问)
```

### 2. 关键文件说明

- **`useFolderDragUpload.ts`**: 核心拖拽上传逻辑封装
- **`useDragUpload.ts`**: 基础拖拽事件处理
- **`TopicFilesPanel.tsx`**: UI 组件集成
- **`ProjectFilesDragOverlay.tsx`**: 拖拽覆盖层UI

## 基础用法

```typescript
import { useFolderDragUpload } from './hooks/useFolderDragUpload'

function FileUploadArea() {
  const { isDragOver, dragEvents } = useFolderDragUpload({
    allowEdit: true,
    selectedProject: { id: 'project-123' },
    onFilesSelected: (files, isUploadingFolder) => {
      console.log(`收到 ${files.length} 个文件`)
      console.log(`是否为文件夹上传: ${isUploadingFolder}`)
      
      // 处理文件上传逻辑
      handleFileUpload(files, isUploadingFolder)
    }
  })

  return (
    <div 
      {...dragEvents} 
      style={{ 
        position: 'relative',
        border: isDragOver ? '2px dashed #1890ff' : '2px solid #d9d9d9'
      }}
    >
      <p>拖拽文件或文件夹到此处</p>
      {isDragOver && <DragOverlay />}
    </div>
  )
}
```

## API 参考

### useFolderDragUpload(options)

#### 参数 (options)

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `allowEdit` | `boolean` | ❌ | `true` | 是否允许编辑/上传 |
| `selectedProject` | `{id: string}` | ✅ | - | 当前选中的项目信息 |
| `onFilesSelected` | `function` | ✅ | - | 文件选择完成的回调函数 |
| `debug` | `boolean` | ❌ | `false` | 是否启用调试模式 |

#### 返回值

| 属性 | 类型 | 描述 |
|------|------|------|
| `isDragOver` | `boolean` | 当前是否正在拖拽状态 |
| `dragEvents` | `object` | 拖拽事件处理器集合 |

#### onFilesSelected 回调函数

```typescript
(files: File[], isUploadingFolder: boolean) => void
```

- `files`: 处理后的文件列表，每个文件都包含正确的 `webkitRelativePath`
- `isUploadingFolder`: 是否为文件夹上传（用于后续处理逻辑判断）

## 高级用法

### 开启调试模式

```typescript
const { isDragOver, dragEvents } = useFolderDragUpload({
  // ... 其他配置
  debug: process.env.NODE_ENV === 'development', // 开发环境开启调试
})
```

调试模式会在控制台输出详细信息：

```
📁 开始递归获取文件夹 "my-folder" 内的所有文件...
📁 文件夹 "my-folder" 内共找到 15 个文件
📁 文件夹结构预览:
┌─────────┬──────────────┬────────────────────────────────┐
│ (index) │     name     │         relativePath           │
├─────────┼──────────────┼────────────────────────────────┤
│    0    │  'file1.txt' │    'my-folder/file1.txt'       │
│    1    │  'file2.js'  │ 'my-folder/subfolder/file2.js' │
└─────────┴──────────────┴────────────────────────────────┘
```

### 权限控制

```typescript
const userPermissions = useUserPermissions()

const { isDragOver, dragEvents } = useFolderDragUpload({
  allowEdit: userPermissions.canUpload && userPermissions.canEditProject,
  selectedProject,
  onFilesSelected: handleFiles,
})
```

### 文件处理示例

```typescript
const handleFilesSelected = useCallback((files: File[], isUploadingFolder: boolean) => {
  if (isUploadingFolder) {
    // 文件夹上传 - 使用全局多任务上传
    multiFolderUploadStore.createUploadTask(files, targetPath, {
      projectId: selectedProject.id,
      storageType: "workspace",
      onComplete: () => {
        message.success('文件夹上传完成')
        refreshFileList()
      }
    })
  } else {
    // 单文件上传 - 使用普通上传
    uploadFiles(files).then(() => {
      message.success('文件上传完成')
      refreshFileList()
    })
  }
}, [selectedProject, multiFolderUploadStore])
```

## 文件夹检测
**方法2: DataTransfer.items 检测**
```typescript
async function detectAndExtractFolderFiles(
  dataTransfer: DataTransfer,
  debug = false
): Promise<{ hasDirectory: boolean; folderFiles: File[] }> {
  // 使用 webkitGetAsEntry() API 检测目录类型
  const entry = item.webkitGetAsEntry()
  if (entry && entry.isDirectory) {
    // 递归获取文件夹内容
    folderFiles = await getAllFilesFromDirectory(entry, entry.name)
  }
}
```
- **适用场景**: 直接从操作系统拖拽的文件夹
- **原理**: 使用 WebKit File System API 检测 Entry 类型
- **优势**: 可以处理纯拖拽操作

### 2. 递归文件获取算法

#### 核心递归函数

```typescript
async function getAllFilesFromDirectory(
  dirEntry: WebkitFileSystemDirectoryEntry,
  parentPath = "",
): Promise<File[]> {
  const files: File[] = []

  return new Promise((resolve, reject) => {
    const dirReader = dirEntry.createReader()

    function readEntries() {
      dirReader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(files) // 递归结束条件
          return
        }

        const promises = entries.map(async (entry) => {
          const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name

          if (entry.isFile) {
            // 处理文件: 创建增强的 File 对象
            return await processFileEntry(entry, fullPath)
          } else if (entry.isDirectory) {
            // 处理目录: 递归调用
            return await getAllFilesFromDirectory(entry, fullPath)
          }
          return []
        })

        const results = await Promise.all(promises)
        files.push(...results.flat())
        
        // 继续读取更多条目（分批处理机制）
        readEntries()
      }, reject)
    }

    readEntries()
  })
}
```

#### 关键技术点

1. **分批读取机制**: `readEntries()` 可能分批返回结果，需要循环调用
2. **路径重建**: 为每个文件正确设置 `webkitRelativePath`
3. **异步递归**: 使用 Promise 处理深层目录结构
4. **错误处理**: 完善的异常捕获和传播

### 3. 文件对象增强

#### webkitRelativePath 设置

```typescript
// 创建增强的 File 对象
const enhancedFile = new File([originalFile], originalFile.name, {
  type: originalFile.type,
  lastModified: originalFile.lastModified,
})

// 设置路径属性以保持目录结构
Object.defineProperty(enhancedFile, "webkitRelativePath", {
  value: fullPath,        // 完整相对路径
  writable: false,        // 不可修改
  enumerable: true,       // 可枚举
  configurable: true,     // 可配置
})
```

## 性能优化

### 1. 大文件夹处理

```typescript
// 分批处理机制
function readEntries() {
  dirReader.readEntries(async (entries) => {
    if (entries.length === 0) return // 批次结束
    
    // 处理当前批次
    await processBatch(entries)
    
    // 继续下一批次
    readEntries()
  }, reject)
}
```

## 文件结构保持

Hook 会自动为每个文件设置正确的 `webkitRelativePath` 属性：

```typescript
// 原始文件夹结构:
// my-folder/
//   ├── file1.txt
//   ├── images/
//   │   ├── photo1.jpg
//   │   └── photo2.png
//   └── docs/
//       └── readme.md

// 处理后的文件对象:
[
  { name: 'file1.txt', webkitRelativePath: 'my-folder/file1.txt' },
  { name: 'photo1.jpg', webkitRelativePath: 'my-folder/images/photo1.jpg' },
  { name: 'photo2.png', webkitRelativePath: 'my-folder/images/photo2.png' },
  { name: 'readme.md', webkitRelativePath: 'my-folder/docs/readme.md' }
]
```

## 浏览器兼容性

| 浏览器 | 版本支持 | 状态 |
|--------|----------|------|
| Chrome | 13+ | ✅ 完全支持 |
| Firefox | 50+ | ✅ 完全支持 |
| Safari | 11.1+ | ✅ 完全支持 |
| Edge | 12+ | ✅ 完全支持 |

## 错误处理

Hook 内置了完善的错误处理机制：

```typescript
// 权限检查
if (!allowEdit) {
  message.warning("没有编辑权限")
  return
}

// 项目检查
if (!selectedProject?.id) {
  message.warning("请先选择项目")
  return
}

// 文件系统错误
try {
  folderFiles = await getAllFilesFromDirectory(entry, entry.name)
} catch (error) {
  console.error("文件处理失败:", error)
  message.error("文件处理失败")
}
```

## 性能考虑

1. **异步递归**: 大型文件夹的遍历不会阻塞 UI
2. **分批处理**: 浏览器分批返回文件条目，避免内存溢出
3. **错误恢复**: 部分文件失败不影响其他文件的处理
4. **内存优化**: 及时释放不必要的文件引用

## 注意事项

1. **文件夹大小**: 建议限制单次拖拽文件夹的大小（如 < 1000 个文件）
2. **网络状况**: 大量文件上传时考虑网络稳定性
3. **用户体验**: 提供适当的加载提示和进度反馈
4. **错误边界**: 在上层组件添加错误边界处理

## 相关文档

- [技术方案详细说明](./FOLDER_DRAG_UPLOAD_TECH_SPEC.md)
- [WebKit File System API 文档](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [拖拽 API 文档](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
