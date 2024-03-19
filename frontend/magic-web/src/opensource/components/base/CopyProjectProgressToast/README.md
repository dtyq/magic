# CopyProjectProgressToast 复制项目进度条组件

## 概述

CopyProjectProgressToast 是一个用于显示项目复制进度的全局进度条组件，基于 MagicProgressToast 组件构建，提供项目复制状态的轮询和进度显示功能。

## 功能特性

- ✅ 全局进度条显示
- ✅ 自动轮询复制状态
- ✅ 进度条动画效果
- ✅ 完成/错误状态回调
- ✅ 可配置轮询间隔和重试次数
- ✅ 国际化支持
- ✅ TypeScript 类型支持

## 使用方法

### 基础用法

```tsx
import { useState } from "react"
import CopyProjectProgressToast from "@/opensource/components/base/CopyProjectProgressToast"

function YourComponent() {
  const [showProgress, setShowProgress] = useState(false)
  const [projectId, setProjectId] = useState("")

  const handleCopyStart = (copiedProjectId: string) => {
    setProjectId(copiedProjectId)
    setShowProgress(true)
  }

  const handleCopyComplete = (result) => {
    console.log("复制完成:", result)
    setShowProgress(false)
    // 处理复制完成后的逻辑，如跳转到新项目
  }

  const handleCopyError = (error) => {
    console.error("复制失败:", error)
    setShowProgress(false)
    // 处理错误
  }

  return (
    <>
      <button onClick={() => handleCopyStart("project-123")}>
        开始复制项目
      </button>
      
      <CopyProjectProgressToast
        projectId={projectId}
        visible={showProgress}
        onComplete={handleCopyComplete}
        onError={handleCopyError}
      />
    </>
  )
}
```

### 在 CopyProjectModal 中集成

```tsx
import { useState } from "react"
import CopyProjectModal from "./CopyProjectModal"
import CopyProjectProgressToast from "@/opensource/components/base/CopyProjectProgressToast"

function SharePage() {
  const [showModal, setShowModal] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [projectId, setProjectId] = useState("")

  const handleCopySuccess = (copiedProject) => {
    // 复制请求成功，开始显示进度条
    setProjectId(copiedProject.project_id)
    setShowModal(false)
    setShowProgress(true)
  }

  const handleProgressComplete = (result) => {
    // 复制进度完成
    setShowProgress(false)
    message.success("项目复制成功！")
    // 跳转到新项目或其他逻辑
  }

  const handleProgressError = (error) => {
    setShowProgress(false)
    message.error(`复制失败: ${error.message}`)
  }

  return (
    <>
      <CopyProjectModal
        open={showModal}
        onCancel={() => setShowModal(false)}
        projectData={projectData}
        onCopySuccess={handleCopySuccess}
      />
      
      <CopyProjectProgressToast
        projectId={projectId}
        visible={showProgress}
        onComplete={handleProgressComplete}
        onError={handleProgressError}
        position="top"
      />
    </>
  )
}
```

## API

### CopyProjectProgressToastProps

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| projectId | string | ✅ | - | 要轮询的项目ID |
| visible | boolean | ✅ | - | 是否显示进度条 |
| onComplete | (result: CopiedProjectResponse) => void | ❌ | - | 复制完成时的回调 |
| onError | (error: Error) => void | ❌ | - | 错误时的回调 |
| pollInterval | number | ❌ | 2000 | 轮询间隔时间（毫秒） |
| maxRetries | number | ❌ | 60 | 最大重试次数 |
| position | "top" \| "center" \| "bottom" | ❌ | "top" | 进度条位置 |

其他属性继承自 MagicProgressToast 组件，除了 `visible`、`progress`、`text` 这三个属性会被组件内部管理。

### CopiedProjectResponse

| 属性 | 类型 | 说明 |
|------|------|------|
| project_id | string | 复制后的项目ID |
| project_name | string | 复制后的项目名称 |
| workspace_id | string | 目标工作区ID |
| workspace_name | string | 目标工作区名称 |

## 工作流程

1. **开始复制**: 调用 copyProject API 成功后，获得项目ID
2. **显示进度条**: 设置 visible=true，projectId=复制后的项目ID
3. **轮询状态**: 组件自动每2秒调用 getProjectCopyStatus API
4. **更新进度**: 根据API响应更新进度条和文本
5. **完成/错误**: 调用相应的回调函数

## 自定义配置

### 轮询配置

```tsx
<CopyProjectProgressToast
  projectId={projectId}
  visible={showProgress}
  pollInterval={1500}  // 1.5秒轮询一次
  maxRetries={100}     // 最多重试100次
  onComplete={handleComplete}
  onError={handleError}
/>
```

### 样式配置

```tsx
<CopyProjectProgressToast
  projectId={projectId}
  visible={showProgress}
  position="center"    // 居中显示
  width={400}          // 宽度400px
  progressHeight={6}   // 进度条高度6px
  showPercentage={true} // 显示百分比
  onComplete={handleComplete}
/>
```

## 注意事项

1. **项目ID**: 必须传入复制后的项目ID，而不是原项目ID
2. **状态管理**: visible 状态需要外部管理
3. **错误处理**: 建议设置 onError 回调处理超时和网络错误
4. **性能考虑**: 轮询会在组件卸载或 visible=false 时自动停止

## 错误处理

组件会在以下情况下调用 onError 回调：

- 网络请求失败
- 超过最大重试次数
- API 返回错误

建议在 onError 回调中：
- 显示错误提示
- 记录错误日志  
- 重置相关状态
