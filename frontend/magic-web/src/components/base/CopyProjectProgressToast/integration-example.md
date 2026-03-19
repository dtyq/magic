# 集成示例：在 Share 页面中使用 CopyProjectProgressToast

## 修改 share/index.tsx

在 `src/opensource/pages/share/index.tsx` 中集成进度条组件：

```tsx
// 1. 添加导入
import CopyProjectProgressToast from "@/opensource/components/base/CopyProjectProgressToast"
import { message } from "antd"

// 2. 在组件状态中添加进度相关状态
function Share() {
  // ... 现有状态
  const [isCopyProjectModalOpen, setIsCopyProjectModalOpen] = useState(false)
  
  // 新增进度相关状态
  const [showCopyProgress, setShowCopyProgress] = useState(false)
  const [copyingProjectId, setCopyingProjectId] = useState("")

  // 3. 修改 handleCopySuccess 回调
  const handleCopySuccess = useMemoizedFn((copiedProject: any) => {
    console.log("项目复制请求成功:", copiedProject)
    
    // 关闭模态框
    setIsCopyProjectModalOpen(false)
    
    // 开始显示进度条
    setCopyingProjectId(copiedProject.project_id)
    setShowCopyProgress(true)
  })

  // 4. 新增进度完成回调
  const handleCopyProgressComplete = useMemoizedFn((result: any) => {
    console.log("项目复制完成:", result)
    setShowCopyProgress(false)
    setCopyingProjectId("")
    
    message.success("项目复制成功！")
    
    // 可选：跳转到新项目
    // navigate(`/workspace/${result.workspace_id}/project/${result.project_id}`)
  })

  // 5. 新增进度错误回调
  const handleCopyProgressError = useMemoizedFn((error: Error) => {
    console.error("项目复制失败:", error)
    setShowCopyProgress(false)
    setCopyingProjectId("")
    
    message.error(`项目复制失败: ${error.message}`)
  })

  return (
    <div className={cx(styles.container, isFileShare && styles.fileShareContainer)}>
      {/* 现有的 CopyProjectModal */}
      {copyProjectData && isProjectShare && (
        <CopyProjectModal
          open={isCopyProjectModalOpen}
          onCancel={() => setIsCopyProjectModalOpen(false)}
          projectData={copyProjectData}
          onCopySuccess={handleCopySuccess}
        />
      )}

      {/* 新增的进度条组件 */}
      <CopyProjectProgressToast
        projectId={copyingProjectId}
        visible={showCopyProgress}
        onComplete={handleCopyProgressComplete}
        onError={handleCopyProgressError}
        position="top"
      />

      {/* ... 其余组件 */}
    </div>
  )
}
```

## 修改 CopyProjectModal/index.tsx

需要恢复 onCopySuccess 回调的调用：

```tsx
// 在 handleSubmit 函数中
const handleSubmit = useMemoizedFn(async () => {
  if (!selectedWorkspace || !newProjectName.trim() || !projectData?.projectId) {
    return
  }

  setSubmitting(true)
  try {
    const response = await copyProject({
      source_project_id: projectData.projectId,
      target_workspace_id: selectedWorkspace.id,
      target_project_name: newProjectName.trim(),
    })

    if (response) {
      // 恢复成功回调的调用
      onCopySuccess?.(response)
      // 注释掉直接关闭，让父组件控制
      // handleClose()
    }
  } catch (error) {
    console.error("复制项目失败:", error)
    message.error(t("share.copyProjectFailed"))
  } finally {
    setSubmitting(false)
  }
})
```

## 工作流程

1. **用户点击复制按钮** → 打开 CopyProjectModal
2. **用户填写信息并提交** → 调用 copyProject API
3. **复制请求成功** → 
   - 关闭模态框
   - 显示全局进度条
   - 开始轮询复制状态
4. **轮询过程中** → 显示进度和状态文本
5. **复制完成** → 
   - 隐藏进度条
   - 显示成功消息
   - 可选：跳转到新项目

## 用户体验提升

通过这种方式，用户可以：

- ✅ 看到复制操作的实时进度
- ✅ 在复制过程中继续浏览其他内容
- ✅ 获得明确的完成或失败反馈
- ✅ 避免因为长时间等待而不确定操作状态

## 错误处理

进度条组件会处理以下错误情况：

- 网络连接问题
- API 返回错误
- 超时（默认2分钟）
- 服务器异常

所有错误都会通过 `onError` 回调通知到父组件，确保用户能够获得适当的错误提示。
