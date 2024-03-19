# 📁 MultiFolderUploadStore 配置化重构完成

## 🎯 重构概述

成功将MultiFolderUploadStore的文件大小限制从硬编码改为可配置属性，支持动态变更，提高了系统的灵活性和可维护性。

## ✨ 新增功能

### 1. 可配置的上传限制
```typescript
interface UploadConfig {
  /** 单文件最大大小限制（字节） */
  maxFileSize: number
  /** 单次上传最大文件数量 */
  maxTotalFiles: number
  /** 允许的文件扩展名（空数组表示不限制） */
  allowedExtensions: string[]
  /** 禁止的文件扩展名 */
  blockedExtensions: string[]
}
```

### 2. 默认配置
```typescript
uploadConfig: UploadConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxTotalFiles: 10000,
  allowedExtensions: [], // 不限制
  blockedExtensions: [".exe", ".bat", ".cmd", ".scr"], // 安全考虑
}
```

## 🔧 API 使用方法

### 基本配置更新

#### 1. 更新文件大小限制
```typescript
// 设置为50MB
multiFolderUploadStore.updateMaxFileSize(50 * 1024 * 1024)

// 设置为200MB
multiFolderUploadStore.updateMaxFileSize(200 * 1024 * 1024)

// 设置为1GB
multiFolderUploadStore.updateMaxFileSize(1024 * 1024 * 1024)
```

#### 2. 更新文件数量限制
```typescript
// 限制单次最多上传5000个文件
multiFolderUploadStore.updateMaxTotalFiles(5000)

// 限制单次最多上传1000个文件
multiFolderUploadStore.updateMaxTotalFiles(1000)
```

#### 3. 设置允许的文件类型
```typescript
// 只允许图片文件
multiFolderUploadStore.updateAllowedExtensions(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

// 只允许文档文件
multiFolderUploadStore.updateAllowedExtensions(['.pdf', '.doc', '.docx', '.txt', '.md'])

// 清除限制（允许所有类型）
multiFolderUploadStore.updateAllowedExtensions([])
```

#### 4. 设置禁止的文件类型
```typescript
// 禁止可执行文件和脚本
multiFolderUploadStore.updateBlockedExtensions(['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs'])

// 禁止大型媒体文件
multiFolderUploadStore.updateBlockedExtensions(['.avi', '.mkv', '.mov', '.mp4'])
```

### 批量配置更新

```typescript
// 批量更新多个配置
multiFolderUploadStore.updateUploadConfig({
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxTotalFiles: 5000,
  allowedExtensions: ['.jpg', '.png', '.pdf', '.doc'],
  blockedExtensions: ['.exe', '.bat', '.cmd']
})
```

### 配置重置

```typescript
// 重置为默认配置
multiFolderUploadStore.resetUploadConfig()
```

### 获取当前配置

```typescript
// 获取当前配置
const config = multiFolderUploadStore.currentUploadConfig
console.log('当前文件大小限制:', config.maxFileSizeMB + 'MB')
console.log('当前配置:', config)

// 输出示例:
// {
//   maxFileSize: 104857600,
//   maxFileSizeMB: 100,
//   maxTotalFiles: 10000,
//   allowedExtensions: [],
//   blockedExtensions: [".exe", ".bat", ".cmd", ".scr"]
// }
```

## 🎮 实际使用场景

### 场景1：不同项目不同限制
```typescript
// 普通文档项目 - 较小限制
if (projectType === 'document') {
  multiFolderUploadStore.updateUploadConfig({
    maxFileSize: 20 * 1024 * 1024, // 20MB
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.md']
  })
}

// 设计项目 - 较大限制
if (projectType === 'design') {
  multiFolderUploadStore.updateUploadConfig({
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedExtensions: ['.psd', '.ai', '.sketch', '.fig', '.jpg', '.png']
  })
}

// 开发项目 - 中等限制但排除可执行文件
if (projectType === 'development') {
  multiFolderUploadStore.updateUploadConfig({
    maxFileSize: 100 * 1024 * 1024, // 100MB
    blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.msi', '.dmg']
  })
}
```

### 场景2：用户权限级别
```typescript
// VIP用户 - 更高限制
if (userLevel === 'vip') {
  multiFolderUploadStore.updateMaxFileSize(1024 * 1024 * 1024) // 1GB
  multiFolderUploadStore.updateMaxTotalFiles(50000)
}

// 普通用户 - 标准限制
if (userLevel === 'normal') {
  multiFolderUploadStore.updateMaxFileSize(100 * 1024 * 1024) // 100MB
  multiFolderUploadStore.updateMaxTotalFiles(10000)
}

// 试用用户 - 较低限制
if (userLevel === 'trial') {
  multiFolderUploadStore.updateMaxFileSize(10 * 1024 * 1024) // 10MB
  multiFolderUploadStore.updateMaxTotalFiles(1000)
}
```

### 场景3：动态调整
```typescript
// 根据服务器负载动态调整
function adjustUploadLimitsBasedOnLoad(serverLoad: number) {
  if (serverLoad > 80) {
    // 高负载 - 降低限制
    multiFolderUploadStore.updateUploadConfig({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxTotalFiles: 5000
    })
  } else if (serverLoad < 30) {
    // 低负载 - 提高限制
    multiFolderUploadStore.updateUploadConfig({
      maxFileSize: 200 * 1024 * 1024, // 200MB
      maxTotalFiles: 20000
    })
  } else {
    // 正常负载 - 标准限制
    multiFolderUploadStore.resetUploadConfig()
  }
}
```

## 🔄 与现有功能的集成

### 1. useFileOperations 自动同步
```typescript
// useFileOperations 现在自动使用 store 的配置
const { addFiles, uploading, removeFile } = useFileUpload({
  // ...其他配置
  maxUploadSize: multiFolderUploadStore.uploadConfig.maxFileSize, // 自动同步
})
```

### 2. 实时配置更新
由于使用了MobX的响应式系统，配置更新会自动反映到所有使用该配置的组件中：

```typescript
// 更新配置
multiFolderUploadStore.updateMaxFileSize(50 * 1024 * 1024)

// 所有使用该配置的地方都会自动更新：
// - createUploadTask 中的文件大小验证
// - useFileOperations 中的 maxUploadSize
// - 错误提示信息中的大小显示
```

## 🎯 优势总结

### 1. 灵活性
- ✅ 支持运行时动态调整
- ✅ 不需要重启应用
- ✅ 可以根据不同场景设置不同限制

### 2. 可维护性
- ✅ 配置集中管理
- ✅ 类型安全的API
- ✅ 清晰的方法命名和文档

### 3. 扩展性
- ✅ 易于添加新的配置项
- ✅ 支持批量更新
- ✅ 支持配置重置

### 4. 一致性
- ✅ 文件夹上传和普通文件上传使用相同配置
- ✅ 所有相关组件自动同步
- ✅ 错误提示信息自动更新

## 🚀 下一步扩展建议

1. **配置持久化**：将配置保存到localStorage或服务端
2. **配置预设**：提供常用的配置模板
3. **配置验证**：添加更严格的配置验证逻辑
4. **配置历史**：记录配置变更历史
5. **配置导入导出**：支持配置的导入和导出

---

**🎉 重构完成！现在MultiFolderUploadStore具有完全可配置的文件上传限制，支持动态调整，大大提高了系统的灵活性！**