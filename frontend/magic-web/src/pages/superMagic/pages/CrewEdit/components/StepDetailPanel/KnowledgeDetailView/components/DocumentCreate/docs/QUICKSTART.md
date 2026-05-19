# 快速开始指南

## 1. 导入组件

```tsx
import { 
  DocumentCreateRouter, 
  DOCUMENT_TYPES 
} from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/DocumentCreate"
```

## 2. 在父组件中使用

```tsx
function KnowledgeDetailView() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null)

  // 从DocumentAddDropdown的回调中设置文档类型
  const handleCreateCustomContent = () => {
    setSelectedDocType(DOCUMENT_TYPES.CUSTOM)
    setShowCreateModal(true)
  }

  const handleCreateProject = () => {
    setSelectedDocType(DOCUMENT_TYPES.PROJECT)
    setShowCreateModal(true)
  }

  const handleCreateWiki = () => {
    setSelectedDocType(DOCUMENT_TYPES.WIKI)
    setShowCreateModal(true)
  }

  const handleComplete = () => {
    // 完成创建,刷新列表等
    setShowCreateModal(false)
    // TODO: 刷新知识库文档列表
  }

  return (
    <div>
      {/* 添加内容按钮 */}
      <DocumentAddDropdown
        onCustomContent={handleCreateCustomContent}
        onFromProject={handleCreateProject}
        onFromEnterpriseWiki={handleCreateWiki}
        // ... 其他回调
      >
        <Button>添加内容</Button>
      </DocumentAddDropdown>

      {/* 文档创建Modal/Drawer */}
      {showCreateModal && selectedDocType && (
        <div className="fixed inset-0 z-50 bg-background">
          <DocumentCreateRouter
            documentType={selectedDocType}
            knowledgeCode="your_knowledge_code"
            knowledgeName="你的知识库名称"
            onBack={() => setShowCreateModal(false)}
            onClose={() => setShowCreateModal(false)}
            onComplete={handleComplete}
          />
        </div>
      )}
    </div>
  )
}
```

## 3. API集成示例

### 3.1 Custom Content API

```tsx
// custom-content/steps/DataProcessingStep.tsx

// 替换模拟处理为真实API调用
const processCustomContent = async () => {
  try {
    const response = await fetch("/api/v1/knowledge/custom-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgeCode: knowledgeCode,
        documentName: store.documentName,
        content: store.documentContent,
        strategyConfig: store.strategyConfig, // 如果有策略配置
      }),
    })
    
    const data = await response.json()
    store.updateProcessingProgress(100)
  } catch (error) {
    // 错误处理
    console.error("Failed to process custom content:", error)
  }
}
```

### 3.2 Project API

```tsx
// project/steps/ProjectSelectionStep.tsx

// 加载工作区列表
const loadWorkspaces = async () => {
  const response = await fetch("/api/v1/super-agent/collaboration-projects")
  const data = await response.json()
  setWorkspaces(data.workspaces)
}

// 加载项目列表
const loadProjects = async (workspaceId: string) => {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/projects`)
  const data = await response.json()
  setProjects(data.projects)
}
```

### 3.3 Enterprise Wiki API

```tsx
// wiki/steps/WikiSelectionStep.tsx

// 加载企业知识库列表
const loadWikis = async () => {
  const response = await fetch("/api/v1/enterprise-wiki/list")
  const data = await response.json()
  setWikis(data.wikis)
}

// 加载知识库文档列表
const loadWikiDocuments = async (wikiId: string) => {
  const response = await fetch(`/api/v1/enterprise-wiki/${wikiId}/documents`)
  const data = await response.json()
  setDocuments(data.documents)
}
```

## 4. FileSelector集成

### 4.1 Project文件选择

```tsx
// project/steps/ProjectSelectionStep.tsx

import FileSelector from "@/pages/superMagic/components/Share/FileSelector/FileSelector"

// 在ProjectSelectionStep中
<FileSelector
  attachments={projectFiles}
  selectedFileIds={store.selectedFileIds}
  onSelectionChange={(fileIds) => store.setSelectedFiles(fileIds)}
  disabled={store.isWholeProjectSelected}
  allowSetDefaultOpen={false}
  className="mt-4"
/>
```

### 4.2 Wiki文档选择

```tsx
// wiki/steps/WikiSelectionStep.tsx

import FileSelector from "@/pages/superMagic/components/Share/FileSelector/FileSelector"

// 在WikiSelectionStep中
<FileSelector
  attachments={wikiDocuments}
  selectedFileIds={store.selectedFileIds}
  onSelectionChange={(fileIds) => store.setSelectedFiles(fileIds)}
  disabled={store.isWholeWikiSelected}
  allowSetDefaultOpen={false}
  className="mt-4"
/>
```

## 5. 启用数据持久化

```tsx
// store/document-create-store.ts

// 取消注释以下代码
import { makePersistable } from "mobx-persist-store"

constructor(knowledgeCode: string) {
  // ... 其他代码

  // 启用持久化
  makePersistable(this, {
    name: `DocumentCreateStore_${knowledgeCode}`,
    properties: ["documentType", "currentStep"],
    storage: window.sessionStorage,
  })
}
```

## 6. 错误处理

```tsx
// 在各个步骤组件中添加错误处理

const [error, setError] = useState<string | null>(null)

const handleProcessing = async () => {
  try {
    setError(null)
    await processData()
  } catch (err) {
    setError(err.message)
    // 显示错误提示
    magicToast.error(t("documentCreate.error.processingFailed"))
  }
}

// 渲染错误信息
{error && (
  <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
    {error}
  </div>
)}
```

## 7. Loading状态

```tsx
// 添加loading状态

const [loading, setLoading] = useState(false)

const handleNext = async () => {
  setLoading(true)
  try {
    // 执行操作
    await someAsyncOperation()
    onNext()
  } catch (error) {
    // 错误处理
  } finally {
    setLoading(false)
  }
}

// 在StepNavigation中使用
<StepNavigation
  onNext={handleNext}
  nextLoading={loading}
  nextDisabled={!canGoNext || loading}
/>
```

## 8. 测试清单

### 功能测试
- [ ] Custom Content: 输入文本→处理→预览→完成
- [ ] Project: 选择工作区→选择项目→配置→处理→完成
- [ ] Enterprise Wiki: 选择知识库→配置→处理→完成
- [ ] Local Documents: 上传→配置→预览→处理→完成(已有)

### 边界测试
- [ ] 空输入验证
- [ ] 字符数限制
- [ ] 文件数量限制
- [ ] 网络错误处理
- [ ] 刷新恢复(如启用持久化)

### UI测试
- [ ] 响应式布局
- [ ] 步骤指示器状态
- [ ] 进度条动画
- [ ] 加载状态
- [ ] 错误提示

## 9. 常见问题

### Q: 如何添加新的文档类型?
A: 参考README.md的"扩展指南"部分

### Q: 如何自定义步骤内容?
A: 每个步骤组件都可以独立修改,只需保持Props接口一致

### Q: 如何禁用某个文档类型?
A: 在DocumentAddDropdown中不传对应的回调函数即可

### Q: 如何自定义策略配置?
A: 修改StrategyConfigSection组件或各步骤的StrategyConfigStep

## 10. 调试技巧

```tsx
// 在开发环境中查看Store状态
import { reaction } from "mobx"

// 监听状态变化
useEffect(() => {
  const disposer = reaction(
    () => store.currentStep,
    (step) => {
      console.log("Current step:", step)
      console.log("Can go next:", store.canGoNext())
      console.log("Active store:", store.activeStore)
    }
  )
  return disposer
}, [store])
```

---

**祝开发顺利!** 如有问题请查看README.md或SUMMARY.md 🚀
