# 同名文件处理功能实现说明

## 概述

实现了文件上传时的同名检测和处理机制，当检测到同名文件时会弹窗让用户选择覆盖或保留两者，支持"全部应用"批量处理。

**重要**: 所有上传（包括文件上传、文件夹上传、拖拽上传）统一使用一个 `duplicateFileHandler`，确保用户在上传混合内容（文件+文件夹）时获得一致的体验，"全部应用"选项能正确应用于所有同名文件。

## 核心模块

### 1. 常量定义
**文件**: `hooks/duplicateFileConstants.ts`

定义了所有枚举常量：
- `UserChoice`: 用户选择类型（REPLACE, KEEP_BOTH, CANCEL）
- `ApplyMode`: 应用模式（ASK_EACH, REPLACE_ALL, KEEP_BOTH_ALL）

### 2. 工具模块
**文件**: `utils/duplicateFileHandler.ts`

提供以下核心功能：
- `detectDuplicateFiles()`: 检测待上传文件中的同名文件
- `generateUniqueFileName()`: 生成唯一文件名（如 `index.html` → `index(1).html`）
- `renameFilesForUpload()`: 批量重命名文件
- `generateRenameMapForDuplicates()`: 为所有同名文件生成重命名映射

### 3. Modal 组件
**文件**: `components/DuplicateFileModal.tsx`

100% 还原 Figma 设计的对话框组件，包含：
- 警告图标（使用 `token.colorWarning`）
- 标题和描述信息（使用 `token.colorText`）
- 三个操作按钮：取消、保留两者、覆盖
- "全部应用" 复选框
- 使用 `prefixCls` 代替硬编码的 ant 前缀
- 所有颜色使用 token 变量

### 4. Hook
**文件**: `hooks/useDuplicateFileHandler.ts`

提供完整的同名文件处理流程控制，包括：
- 检测同名文件
- 逐个或批量处理冲突
- 自动重命名文件
- Modal 状态管理

## 使用方法

### 在组件中集成

所有上传相关的 Hook 已经集成了同名检测功能：

#### 1. 使用 useFileOperations

```tsx
import { DuplicateFileModal } from "./components/DuplicateFileModal"
import { useFileOperations } from "./hooks/useFileOperations"

function YourComponent() {
  const fileOperations = useFileOperations({
    attachments,
    projectId,
    // ... 其他配置
  })

  return (
    <>
      {/* 你的组件内容 */}
      
      {/* 同名文件处理 Modal - 统一处理所有上传 */}
      <DuplicateFileModal
        visible={fileOperations.duplicateFileHandler.modalVisible}
        fileName={fileOperations.duplicateFileHandler.currentFileName}
        onCancel={fileOperations.duplicateFileHandler.handleCancel}
        onReplace={fileOperations.duplicateFileHandler.handleReplace}
        onKeepBoth={fileOperations.duplicateFileHandler.handleKeepBoth}
      />
    </>
  )
}
```

#### 2. 使用 useDragUpload

```tsx
import { DuplicateFileModal } from "./components/DuplicateFileModal"
import { useDragUpload } from "./hooks/useDragUpload"

function YourComponent() {
  const dragUpload = useDragUpload({
    attachments,
    projectId,
    // ... 其他配置
  })

  return (
    <>
      {/* 你的组件内容 */}
      
      {/* 同名文件处理 Modal - 统一处理所有上传 */}
      <DuplicateFileModal
        visible={dragUpload.duplicateFileHandler.modalVisible}
        fileName={dragUpload.duplicateFileHandler.currentFileName}
        onCancel={dragUpload.duplicateFileHandler.handleCancel}
        onReplace={dragUpload.duplicateFileHandler.handleReplace}
        onKeepBoth={dragUpload.duplicateFileHandler.handleKeepBoth}
      />
    </>
  )
}
```

#### 3. 使用 useUploadWithModal

```tsx
import { DuplicateFileModal } from "./components/DuplicateFileModal"
import { useUploadWithModal } from "./hooks/useUploadWithModal"

function YourComponent() {
  const uploadModal = useUploadWithModal({
    attachments,
    projectId,
    // ... 其他配置
  })

  return (
    <>
      {/* 你的组件内容 */}
      
      {/* 同名文件处理 Modal - 统一处理所有上传 */}
      <DuplicateFileModal
        visible={uploadModal.duplicateFileHandler.modalVisible}
        fileName={uploadModal.duplicateFileHandler.currentFileName}
        onCancel={uploadModal.duplicateFileHandler.handleCancel}
        onReplace={uploadModal.duplicateFileHandler.handleReplace}
        onKeepBoth={uploadModal.duplicateFileHandler.handleKeepBoth}
      />
    </>
  )
}
```

## 功能流程

1. **用户上传文件**
   - 通过文件选择、拖拽或文件夹上传触发

2. **同名检测**
   - 系统检测目标文件夹下是否存在同名文件
   - 如果没有同名，直接上传
   - 如果有同名，进入处理流程

3. **用户选择**
   - **取消**: 中断整个上传流程
   - **覆盖**: 上传的文件覆盖已有文件
   - **保留两者**: 自动重命名新文件（如 `index(1).html`）
   - **全部应用**: 对所有同名文件应用相同的操作

4. **文件重命名规则**
   - 检查 `filename(n).ext` 格式
   - 递增 n 直到无冲突
   - 示例：`index.html` → `index(1).html` → `index(2).html`

## 国际化

已添加中英文翻译，字段位于 `topicFiles.duplicateFile` 下：

### 中文 (`zh_CN/super.json`)
```json
{
  "topicFiles": {
    "duplicateFile": {
      "title": "是否覆盖文件？",
      "message": "此位置已经存在名称为\"{{fileName}}\"的文件。您要使用正在上传的文件进行覆盖吗？",
      "replace": "覆盖",
      "keepBoth": "保留两者",
      "cancel": "取消",
      "applyToAll": "全部应用"
    }
  }
}
```

### 英文 (`en_US/super.json`)
```json
{
  "topicFiles": {
    "duplicateFile": {
      "title": "Replace file?",
      "message": "A file named \"{{fileName}}\" already exists in this location. Do you want to replace it with the one you're uploading?",
      "replace": "Replace",
      "keepBoth": "Keep Both",
      "cancel": "Cancel",
      "applyToAll": "Apply to All"
    }
  }
}
```

### 使用方式
在组件中使用时，需要加上 `topicFiles` 前缀：
```typescript
const { t } = useTranslation("super")

// ✅ 正确
t("topicFiles.duplicateFile.title")
t("topicFiles.duplicateFile.message", { fileName })

// ❌ 错误
t("duplicateFile.title")
t("duplicateFile.message", { fileName })
```

## 代码质量改进

### 1. 枚举常量
所有字符串常量使用 `const` 对象定义，避免硬编码：
```typescript
import { UserChoice } from "./duplicateFileConstants"

// ❌ 错误写法
if (choice === "replace") { ... }

// ✅ 正确写法
if (choice === UserChoice.REPLACE) { ... }
```

### 2. 样式 Token
所有颜色使用 token 变量，不硬编码：
```typescript
// ❌ 错误写法
color: #ff7d00;
color: rgba(28, 29, 35, 0.8);

// ✅ 正确写法
color: ${token.colorWarning};
color: ${token.colorText};
```

### 3. 组件前缀
使用 `prefixCls` 动态获取前缀，不硬编码：
```typescript
// ❌ 错误写法
.ant-modal-content { ... }

// ✅ 正确写法
.${prefixCls}-modal-content { ... }
```

## 注意事项

1. **同名检测范围**: 只检测目标文件夹下的同名文件
2. **文件夹上传**: 文件夹内的文件也会进行同名检测
3. **连续编号**: 多个同名文件会生成连续的编号
4. **Modal 渲染**: 需要在使用 Hook 的组件中添加 DuplicateFileModal 的渲染
5. **统一处理**: 所有上传（文件、文件夹、拖拽）共用一个 `duplicateFileHandler`，确保"全部应用"能正确应用于混合上传场景
6. **使用常量**: 所有枚举值必须使用 `duplicateFileConstants.ts` 中定义的常量
7. **样式规范**: 颜色必须使用 token 变量，不允许硬编码

## 设计优势

### 统一的用户体验
通过使用单一的 `duplicateFileHandler`，用户在以下场景中能获得一致的体验：
- 同时拖拽文件和文件夹
- 先上传文件，再上传文件夹（或反之）
- 使用"全部应用"选项时，能正确应用于所有后续的同名冲突

### 避免的问题
如果使用多个独立的 handler，会导致：
- 用户需要为文件和文件夹分别设置"全部应用"
- 两个 Modal 可能同时出现，造成混淆
- "全部应用"的状态在不同类型上传之间不共享

