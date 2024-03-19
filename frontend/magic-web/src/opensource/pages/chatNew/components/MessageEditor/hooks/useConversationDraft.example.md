# useConversationDraft Hook 使用示例

`useConversationDraft` 是一个用于管理对话草稿的可复用 React Hook，它封装了草稿的保存、加载、删除等功能。

## 基本使用

```tsx
import { useRef, useState } from "react"
import useConversationDraft from "./useConversationDraft"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"

function MyEditor() {
  // Required states and refs
  const editorRef = useRef<MagicRichEditorRef>(null)
  const [files, setFiles] = useState([])
  const [isEmpty, setIsEmpty] = useState(true)
  const [editorReady, setEditorReady] = useState(false)
  const settingContent = useRef(false)
  const [value, setValue] = useState()

  // Your conversation context
  const conversationId = "conversation-123"
  const topicId = "topic-456"

  // Use the draft hook
  const { 
    writeCurrentDraft, 
    deleteDraft, 
    hasDraft, 
    getDraft 
  } = useConversationDraft({
    editorRef,
    files,
    setFiles,
    setIsEmpty,
    setValue,
    conversationId,
    topicId,
    editorReady,
    settingContent,
    debounceWait: 1000, // Optional: custom debounce time
  })

  // The hook automatically handles:
  // 1. Saving drafts when content changes (debounced)
  // 2. Loading drafts when switching conversations/topics
  // 3. Managing editor content and file states

  return (
    <div>
      {/* Your editor component */}
      <MagicRichEditor ref={editorRef} />
      
      {/* Manual draft operations if needed */}
      <button onClick={() => deleteDraft(conversationId, topicId)}>
        Clear Draft
      </button>
    </div>
  )
}
```

## 高级使用 - 解决循环依赖

如果你的文件上传 hook 需要在文件变化时触发草稿保存，可以使用 ref 来解决循环依赖：

```tsx
function MyEditorWithFileUpload() {
  // Draft callback ref to resolve circular dependency
  const draftCallbackRef = useRef<() => void>(() => {})

  // File upload hook
  const { files, setFiles, onFileChange } = useFileUpload({
    onFilesChange: () => draftCallbackRef.current(), // Use ref callback
    editorRef,
  })

  // Draft hook
  const { writeCurrentDraft } = useConversationDraft({
    editorRef,
    files,
    setFiles,
    // ... other props
  })

  // Update the callback ref
  draftCallbackRef.current = writeCurrentDraft

  return (
    // Your component JSX
  )
}
```

## 发送消息后清理草稿

```tsx
function MessageEditorWithSend() {
  const { deleteDraft } = useConversationDraft({
    // ... your props
  })

  const handleSendMessage = async () => {
    try {
      // Send your message
      await sendMessage(content)
      
      // Clear draft after successful send
      if (conversationId && topicId) {
        deleteDraft(conversationId, topicId)
      }
      
      // Reset editor content
      editorRef.current?.editor?.chain().clearContent().run()
      setFiles([])
      setValue(undefined)
    } catch (error) {
      console.error("Send failed:", error)
    }
  }

  return (
    <div>
      <MagicRichEditor ref={editorRef} />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  )
}
```

## 检查草稿状态

```tsx
function ConversationSwitcher() {
  const { hasDraft, getDraft } = useConversationDraft({
    // ... your props
  })

  const switchToConversation = (newConversationId: string, newTopicId: string) => {
    // Check if the target conversation has a draft
    if (hasDraft(newConversationId, newTopicId)) {
      const draft = getDraft(newConversationId, newTopicId)
    }
    
    // The hook will automatically handle loading the draft
    // when conversationId/topicId props change
  }

  return (
    // Your conversation list UI
  )
}
```

## Hook 返回值

| 方法 | 描述 |
|------|------|
| `writeCurrentDraft()` | 立即写入当前草稿（防抖） |
| `deleteDraft(conversationId, topicId)` | 删除指定对话的草稿 |
| `hasDraft(conversationId, topicId)` | 检查是否存在草稿 |
| `getDraft(conversationId, topicId)` | 获取草稿内容 |
| `writeDraftSync(conversationId, topicId)` | 立即同步写入草稿（无防抖） |

## 注意事项

1. **编辑器准备状态**：确保在编辑器完全初始化后再设置 `editorReady` 为 `true`
2. **防止重复设置内容**：使用 `settingContent` ref 来防止在设置内容时触发多余的更新
3. **错误处理**：Hook 内部已包含错误处理，但建议在组件层面也添加适当的错误边界
4. **性能优化**：草稿保存是防抖的，默认延迟 1000ms，可以通过 `debounceWait` 参数调整

## 集成到现有项目

如果你有现有的编辑器组件，只需要：

1. 添加必要的状态和引用
2. 导入并使用 `useConversationDraft` hook
3. 替换现有的草稿管理逻辑
4. 确保在发送消息后调用 `deleteDraft`

这个 hook 已经在以下组件中成功集成：
- `src/opensource/pages/chatNew/components/MessageEditor/index.tsx`
- `src/opensource/pages/superMagic/pages/Assistant/components/Conversation/components/MessageEditor/index.tsx` 