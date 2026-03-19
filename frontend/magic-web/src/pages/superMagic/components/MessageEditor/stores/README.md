# MessageEditor Stores

MessageEditor 组件的状态管理层，使用 MobX 实现。

## 架构概览

```
MessageEditorStore (根 Store)
└── EditorStore (编辑器状态)
```

### 已完成 (Phase 1 - Part 1)

- ✅ **EditorStore**: 管理编辑器核心状态
    - 编辑器内容 (value)
    - TipTap 编辑器实例
    - 输入法状态 (isComposing)
    - OAuth 进度状态
    - 内容为空判断

### 待实现 (Phase 2)

- ⏳ **FileUploadStore**: 文件上传管理
- ⏳ **DraftStore**: 草稿管理和自动保存
- ⏳ **VoiceStore**: 语音输入管理
- ⏳ **AiCompletionStore**: AI 自动补全

## 目录结构

```
stores/
├── EditorStore/
│   ├── index.ts                    # EditorStore 实现
│   └── __tests__/
│       └── EditorStore.test.ts     # 单元测试 (29 个测试用例)
├── MessageEditorStore/
│   ├── index.ts                    # 根 Store 实现
│   └── __tests__/
│       └── MessageEditorStore.test.ts  # 集成测试 (17 个测试用例)
├── types.ts                        # 共享类型定义
├── context.tsx                     # React Context Provider
├── index.ts                        # 统一导出
└── README.md                       # 本文档
```

## 使用指南

### 1. 创建 Store 实例

```typescript
import { MessageEditorStore } from "./stores"

// 创建 store 实例
const store = new MessageEditorStore()
```

### 2. 使用 Context Provider（推荐）

```typescript
import { MessageEditorStoreProvider, useMessageEditorStore } from './stores'

// 在父组件中提供 store
function MessageEditorContainer() {
  const store = useMemo(() => new MessageEditorStore(), [])

  return (
    <MessageEditorStoreProvider store={store}>
      <MessageEditor />
    </MessageEditorStoreProvider>
  )
}

// 在子组件中使用 store
function MessageEditor() {
  const store = useMessageEditorStore()

  // 使用 MobX observer 包装组件以实现响应式更新
  return observer(() => (
    <div>
      <div>Can send: {store.canSendMessage}</div>
      <div>Is empty: {store.editorStore.isEmpty}</div>
    </div>
  ))
}
```

### 3. EditorStore 使用示例

```typescript
import { observer } from 'mobx-react-lite'

const Editor = observer(() => {
  const store = useMessageEditorStore()
  const { editorStore } = store

  // 设置内容
  const handleChange = (content: JSONContent) => {
    editorStore.setValue(content)
  }

  // 清空内容
  const handleClear = () => {
    editorStore.clearContent()
  }

  // 聚焦编辑器
  const handleFocus = () => {
    editorStore.focus()
  }

  // 判断是否为空
  if (editorStore.isEmpty) {
    return <EmptyState />
  }

  return (
    <TiptapEditor
      content={editorStore.value}
      onUpdate={handleChange}
    />
  )
})
```

### 4. 发送消息示例

```typescript
import { observer } from 'mobx-react-lite'

const SendButton = observer(() => {
  const store = useMessageEditorStore()

  const handleSend = async () => {
    if (!store.canSendMessage) return

    store.setIsSending(true)
    try {
      await sendMessage({
        value: store.editorStore.value
      })
      store.clearContent()
    } finally {
      store.setIsSending(false)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={!store.canSendMessage}
    >
      发送
    </button>
  )
})
```

## API 文档

### MessageEditorStore

根 Store，整合所有子 Store。

#### 属性

- `editorStore: EditorStore` - 编辑器状态 Store
- `isSending: boolean` - 是否正在发送
- `isTaskRunning: boolean` - 是否有任务运行中
- `stopEventLoading: boolean` - 停止事件加载状态

#### Computed

- `canSendMessage: boolean` - 是否可以发送消息
    - 条件：内容不为空 && 未在发送中

#### Actions

- `setIsSending(isSending: boolean)` - 设置发送状态
- `setIsTaskRunning(isRunning: boolean)` - 设置任务运行状态
- `setStopEventLoading(loading: boolean)` - 设置停止事件加载状态
- `clearContent()` - 清空所有内容
- `dispose()` - 清理资源

### EditorStore

管理编辑器核心状态。

#### 属性

- `value: JSONContent | undefined` - 编辑器内容
- `tiptapEditor: Editor | null` - TipTap 编辑器实例
- `isComposing: boolean` - 是否正在输入法输入
- `isOAuthInProgress: boolean` - OAuth 是否进行中
- `placeholder: string` - 占位符文本

#### Computed

- `isEmpty: boolean` - 内容是否为空

#### Actions

- `setValue(content: JSONContent | undefined)` - 设置内容
- `setEditor(editor: Editor | null)` - 设置编辑器实例
- `setPlaceholder(text: string)` - 设置占位符
- `clearContent()` - 清空内容
- `focus()` - 聚焦编辑器
- `updateContent(content: JSONContent | undefined)` - 更新内容并同步到编辑器
- `handleCompositionStart()` - 处理输入法开始
- `handleCompositionEnd()` - 处理输入法结束
- `setOAuthInProgress(inProgress: boolean)` - 设置 OAuth 状态
- `dispose()` - 清理资源

## 测试

所有 Store 都有完整的单元测试覆盖。

### 运行测试

```bash
# 运行所有 Store 测试
pnpm test src/opensource/pages/superMagic/components/MessageEditor/stores

# 运行特定 Store 测试
pnpm test src/opensource/pages/superMagic/components/MessageEditor/stores/EditorStore
pnpm test src/opensource/pages/superMagic/components/MessageEditor/stores/MessageEditorStore
```

### 测试统计

- **EditorStore**: 29 个测试用例
    - 初始化
    - isEmpty 计算属性
    - 内容设置和更新
    - 编辑器操作（清空、聚焦）
    - 输入法处理
    - OAuth 状态
    - 资源清理
    - MobX 响应式

- **MessageEditorStore**: 17 个测试用例
    - 初始化
    - canSendMessage 计算属性
    - 全局状态管理
    - 内容清空
    - 资源清理
    - 集成测试
    - MobX 响应式

## 设计原则

### 1. 单一职责

每个 Store 只负责特定领域的状态管理：

- EditorStore：编辑器状态
- 未来的 FileUploadStore：文件上传
- 未来的 DraftStore：草稿管理

### 2. 依赖注入

Store 之间通过构造函数注入依赖，便于测试和解耦。

### 3. MobX 最佳实践

- 使用 `makeAutoObservable` 自动标记 observables 和 actions
- 使用 `computed` 缓存派生状态
- 使用 `autoBind: true` 自动绑定 this

### 4. 类型安全

所有 API 都有完整的 TypeScript 类型定义。

## 重要说明

### Mention Items

**注意**: 本项目中的 mention 项（@文件、@Agent 等）直接存储在编辑器的 JSONContent 中作为 mention 节点，而不是单独维护一个 mention 列表。因此我们不需要 MentionStore。

要获取所有 mention 项，直接遍历 `editorStore.value` 的 content 树即可。

示例：

```typescript
function extractMentions(content: JSONContent): MentionNode[] {
	const mentions: MentionNode[] = []

	function traverse(node: JSONContent) {
		if (node.type === "mention") {
			mentions.push(node)
		}
		if (node.content) {
			node.content.forEach(traverse)
		}
	}

	traverse(content)
	return mentions
}
```

## 后续计划

### Phase 2: 文件上传和草稿管理

下一阶段将实现：

1. FileUploadStore - 管理文件上传状态、进度和错误处理
2. DraftStore - 管理草稿保存、加载和版本控制

这些 Store 将遵循相同的设计原则和测试标准。
