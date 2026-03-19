# 🔌 OSS上传服务集成指南

## 概述

文件夹上传功能现已集成现有的上传服务，直接使用项目中已有的 `superMagicUploadTokenService` 和 `@dtyq/upload-sdk`。

## 架构设计

### 1. 现有服务集成

- **Token服务**: `superMagicUploadTokenService` - 负责获取上传凭证
- **上传器**: `@dtyq/upload-sdk` 的 `Upload` 类 - 负责文件上传
- **无需额外配置**: 开箱即用，使用现有的上传基础设施

### 2. 服务结构

```typescript
class OSSUploadService {
	private upload: Upload

	async uploadFiles(
		files: FolderUploadFile[],
		projectId: string,
		folderPath: string,
	): Promise<UploadResult[]>
}
```

## 使用方法

### 基本使用

文件夹上传服务会自动使用现有的上传服务：

```typescript
import { ossUploadService } from "@/stores/folderUpload"

// 直接使用，无需额外配置
const results = await ossUploadService.uploadFiles(files, projectId, "folder-uploads")
```

### 在 FolderUploadTask 中的集成

```typescript
// FolderUploadTask.ts 中自动使用
private async uploadFilesToOSS(
  folderFiles: FolderUploadFile[],
  folderPath: string,
): Promise<UploadResult[]> {
  const { ossUploadService } = await import("./uploadService")

  return ossUploadService.uploadFiles(
    folderFiles,
    this.projectId,
    folderPath || this.baseSuffixDir,
  )
}
```

## 类型定义

### FileUploadData

```typescript
interface FileUploadData {
	id: string
	name: string
	file: File
	status: "pending" | "uploading" | "completed" | "error"
	progress: number
	size: number
	suffixDir: string
}
```

### UploadCredentials

```typescript
interface UploadCredentials {
	accessKeyId: string
	accessKeySecret: string
	stsToken: string
	bucket: string
	region: string
	endpoint: string
}
```

### UploadServiceResult

```typescript
interface UploadServiceResult {
	fullfilled: Array<{ value: { key: string; name: string; size: number } }>
	rejected: Array<{ reason: any }>
}
```

## 错误处理

上传服务包含完整的错误处理机制：

1. **上传失败重试**：系统会自动重试失败的批次（最多3次）
2. **部分失败处理**：如果批次中部分文件失败，会记录错误并继续处理成功的文件
3. **取消和暂停**：支持用户取消或暂停上传任务

## 进度监控

上传过程中会实时更新进度信息：

```typescript
// 进度更新回调
onProgress: (taskId: string, state: FolderUploadState) => void
```

## 调试和监控

### 开发环境调试

```typescript
// 启用调试日志
localStorage.setItem("folder-upload-debug", "true")

// 查看上传状态
console.log(multiFolderUploadStore.uploadInfo)
```

### 生产环境监控

```typescript
// 监听上传事件
multiFolderUploadStore.on("taskComplete", (taskId) => {
	// 上传完成统计
})

multiFolderUploadStore.on("taskError", (taskId, error) => {
	// 错误上报
})
```

## 性能优化

1. **批量上传**：默认每批10个文件，可根据需要调整
2. **并发控制**：支持项目级别的并发控制
3. **内存管理**：大文件分片上传，避免内存溢出

## 安全考虑

1. **Token刷新**：支持上传Token的自动刷新
2. **权限验证**：每个文件的上传权限独立验证
3. **文件类型检查**：支持上传前的文件类型和大小检查

## 示例：完整集成代码

```typescript
// main.ts 或 app.ts
import { OSSUploadService } from "@/stores/folderUpload/uploadService"
import { ossClient } from "@/opensource/utils/oss" // 你的OSS客户端
import { uploadAPI } from "@/apis/upload" // 你的上传API

// 创建上传器
const uploader = {
	async upload(files, credentials) {
		// 初始化OSS客户端
		const client = new ossClient(credentials)

		const results = { fullfilled: [], rejected: [] }

		for (const file of files) {
			try {
				const result = await client.put(file.name, file.file)
				results.fullfilled.push({
					value: {
						key: result.name,
						name: file.name,
						size: file.size,
					},
				})
			} catch (error) {
				results.rejected.push({ reason: error })
			}
		}

		return results
	},
}

// 创建Token服务
const tokenService = {
	async getUploadToken(projectId, folderPath, isPublic) {
		const response = await uploadAPI.getToken({
			projectId,
			folderPath,
			isPublic,
		})
		return response.data
	},
}

// 注入服务
OSSUploadService.setGlobalServices(uploader, tokenService)
```

## 迁移指南

如果你之前有其他上传实现，可以按以下步骤迁移：

1. **保留现有实现**：作为fallback方案
2. **逐步切换**：通过特性开关控制使用新的上传服务
3. **监控对比**：对比新旧实现的性能和稳定性
4. **完全切换**：确认无问题后完全使用新服务

## 故障排除

### 常见问题

1. **上传卡住不动**：检查网络连接和Token是否过期
2. **部分文件失败**：检查文件权限和存储空间
3. **进度不更新**：检查进度回调是否正确绑定

### 调试工具

```typescript
// 查看当前上传状态
console.log("Upload Status:", multiFolderUploadStore.globalState)

// 查看队列状态
console.log("Queue Length:", multiFolderUploadStore.queueLength)

// 查看活跃任务
console.log("Active Tasks:", multiFolderUploadStore.activeTasks)
```

这个集成指南确保了上传服务的灵活性和可扩展性，支持各种不同的上传方案！
