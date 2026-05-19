# 文档创建功能模块

本模块提供了完整的知识库文档创建功能，支持4种文档类型的创建流程。

## 目录结构

```
DocumentCreate/
├── components/           # 共享组件
│   ├── shared/          # 共享业务组件
│   │   ├── ProcessingProgressSection.tsx  # 处理进度组件
│   │   └── StrategyConfigSection.tsx      # 策略配置组件
│   ├── DocumentCreateHeader.tsx
│   ├── FileUploadCard/
│   ├── StepIndicator/
│   └── StepNavigation/
├── constants/           # 常量定义
│   ├── document-types.ts
│   ├── step-config.ts
│   └── upload-status.ts
├── store/               # 状态管理
│   ├── document-create-store.ts     # 主Store
│   ├── local-document-store.ts      # 本地文档Store
│   ├── custom-content-store.ts      # 自定义内容Store
│   ├── project-document-store.ts    # 项目文档Store
│   └── wiki-document-store.ts       # 企业知识库Store
├── local-documents/     # 本地文档步骤
│   └── steps/
├── custom-content/      # 自定义内容步骤
│   └── steps/
├── project/             # 项目文档步骤
│   ├── components/      # 项目特有组件
│   │   └── SharedWorkspaceDropdown.tsx
│   └── steps/
├── wiki/                # 企业知识库步骤
│   └── steps/
├── DocumentCreateRouter.tsx  # 主路由组件
├── layout.tsx               # 布局组件
└── index.ts                 # 统一导出
```

## 使用方法

### 基本用法

```tsx
import { DocumentCreateRouter, DOCUMENT_TYPES } from "./DocumentCreate"

function KnowledgeDetailView() {
  const handleComplete = () => {
    // 处理完成回调
    console.log("Document creation completed")
  }

  return (
    <DocumentCreateRouter
      documentType={DOCUMENT_TYPES.LOCAL}
      knowledgeCode="kb_123"
      knowledgeName="我的知识库"
      onBack={() => console.log("Back")}
      onClose={() => console.log("Close")}
      onComplete={handleComplete}
    />
  )
}
```

### 支持的文档类型

1. **Local Documents (本地文档)**
   - 4个步骤: 上传文件 → 策略配置 → Chunk预览 → 数据处理
   - Store: `LocalDocumentStore`

2. **Custom Content (自定义内容)**
   - 3个步骤: 输入文本 → 数据处理 → Chunk预览
   - Store: `CustomContentStore`

3. **Project (项目文档)**
   - 3个步骤: 选择项目或文件 → 策略配置 → 数据处理
   - Store: `ProjectDocumentStore`
   - 特有组件: `SharedWorkspaceDropdown`

4. **Enterprise Wiki (企业知识库)**
   - 3个步骤: 选择企业知识库 → 策略配置 → 数据处理
   - Store: `WikiDocumentStore`

## Store说明

### DocumentCreateStore (主Store)

负责整体流程控制和子Store管理：

- `setDocumentType(type)` - 设置文档类型
- `nextStep()` - 进入下一步
- `previousStep()` - 返回上一步
- `goToStep(step)` - 跳转到指定步骤
- `canGoNext()` - 检查是否可以进入下一步
- `reset()` - 重置所有状态

### 子Store

每个文档类型都有对应的子Store，包含特定的状态和方法：

- **LocalDocumentStore**: 管理文件上传、策略配置、预览数据
- **CustomContentStore**: 管理文档名称、内容、处理进度
- **ProjectDocumentStore**: 管理工作区、项目、文件选择
- **WikiDocumentStore**: 管理知识库、文档选择

## 共享组件

### ProcessingProgressSection

显示文件/项目/文档的处理进度：

```tsx
<ProcessingProgressSection
  files={[
    { fileId: "1", fileName: "file.pdf", progress: 50, type: "file" }
  ]}
  isComplete={false}
  title="数据处理"
  description="正在处理您的文档"
  showRealTimeUpdates={true}
/>
```

### FileUploadCard

通用的文件/项目/文档卡片组件：

```tsx
<FileUploadCard
  file={{
    name: "document.pdf",
    status: "uploading",
    progress: 75,
    size: "2.5 MB"
  }}
  type="file"  // "file" | "project" | "document"
  onDelete={() => {}}
  onRetry={() => {}}
  showProgress={true}
/>
```

## 国际化

所有文本都已国际化，支持中英文：

- 中文: `src/assets/locales/zh_CN/crew/create.json`
- 英文: `src/assets/locales/en_US/crew/create.json`

使用方式:
```tsx
const { t } = useTranslation("crew/create")
t("documentCreate.localDocuments.step1")
```

## 数据持久化

Store使用sessionStorage进行会话级持久化（可选）：

```tsx
// 在store中已配置，但当前被注释
// 如需启用，取消注释 makePersistable 相关代码
```

## 扩展指南

### 添加新的文档类型

1. 在 `constants/document-types.ts` 中添加新类型
2. 在 `constants/step-config.ts` 中定义步骤配置
3. 创建对应的Store (extends基础Store模式)
4. 创建步骤组件目录和文件
5. 在 `DocumentCreateRouter.tsx` 中添加路由逻辑
6. 添加国际化翻译

### 自定义步骤组件

所有步骤组件都遵循统一的Props接口：

```tsx
interface StepProps {
  store: YourStore
  onNext: () => void
  onPrevious: () => void
}
```

## 设计稿链接

所有组件都严格按照Figma设计稿实现：

- Local Documents: [node-id=14854-1847144](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-1847144)
- Custom Content: [node-id=14854-2060562](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2060562)
- Project: [node-id=14854-2156256](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2156256)
- Enterprise Wiki: [node-id=14854-2347083](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2347083)

## 注意事项

1. **Mock数据**: 当前步骤组件中使用了Mock数据，需要替换为实际API调用
2. **文件选择器**: Project和Wiki的文件选择功能需要集成`FileSelector`组件
3. **策略配置**: `StrategyConfigSection`需要完整实现配置表单
4. **Chunk预览**: Custom Content的ChunkPreviewStep需要完善预览逻辑
5. **错误处理**: 需要添加完善的错误处理和用户提示
6. **加载状态**: 需要添加API调用的loading状态

## 待办事项

- [ ] 集成实际API接口
- [ ] 完善FileSelector集成
- [ ] 实现完整的策略配置组件
- [ ] 添加错误边界和错误处理
- [ ] 添加单元测试
- [ ] 性能优化（大文件处理）
- [ ] 添加操作日志
