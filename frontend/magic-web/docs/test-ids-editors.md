# 编辑器组件测试 ID 汇总

本文档汇总了三个主要编辑器组件中添加的所有测试 ID（data-testid），用于自动化测试。

> **重要提示**: 所有 `data-testid` 仅添加在**原生 HTML 元素**上（如 div、span、button 等），不添加在 React 组件上。

## 目录

- [ChatMessageEditor (Assistant 聊天编辑器)](#chatmessageeditor-assistant-聊天编辑器)
- [RecordSummaryEditorPanel (录音总结编辑器)](#recordsummaryeditorpanel-录音总结编辑器)
- [MessageEditor (Super Magic 主编辑器)](#messageeditor-super-magic-主编辑器)
- [测试场景示例](#测试场景示例)

---

## ChatMessageEditor (Assistant 聊天编辑器)

**位置**: `src/opensource/pages/superMagic/pages/Assistant/components/Conversation/components/MessageEditor/index.tsx`

### 元素列表

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `chat-message-editor-container` | div | 编辑器主容器 | 始终显示 | - |
| `chat-message-editor-footer` | div | 底部工具栏容器（FlexBox 组件） | 始终显示 | - |
| `chat-message-editor-footer-left` | div | 工具栏左侧（FlexBox 组件） | 始终显示 | - |
| `chat-message-editor-footer-right` | div | 工具栏右侧（按钮组） | 始终显示 | - |
| `chat-message-editor-upload-button` | div | 上传文件按钮 | 始终显示 | - |
| `chat-message-editor-send-button` | button | 发送按钮 | 始终显示 | `data-sending`<br>`data-disabled` |

### 组件层级

```
chat-message-editor-container
├── <AgentSwitch /> or <CurrentChatAgentTip />
├── <MessageRefer /> (引用消息)
├── <InputFiles /> (文件列表)
├── <EditorContent /> (编辑器内容)
└── chat-message-editor-footer
    ├── chat-message-editor-footer-left
    │   ├── <InstructionActions /> (工具指令)
    │   └── <InstructionActions /> (对话指令)
    └── chat-message-editor-footer-right
        ├── chat-message-editor-upload-button
        ├── <SuperMagicVoiceInput /> (语音输入)
        └── chat-message-editor-send-button
```

---

## RecordSummaryEditorPanel (录音总结编辑器)

**位置**: `src/components/business/RecordingSummary/EditorPanel.tsx`

### 状态说明

该编辑器有三种主要状态：
1. **初始状态** (Initial) - 等待开始录音
2. **录制中状态** (Recording) - 正在录音
3. **其他标签页录制状态** (Other Tab Recording) - 其他地方正在录音

### 初始状态元素

| Test ID | 元素类型 | 描述 | 附加属性 |
|---------|---------|------|----------|
| `recording-editor-initial-state` | div | 初始状态容器（FlexBox 组件） | - |
| `recording-editor-main-content` | div | 主内容区域（FlexBox 组件） | - |
| `recording-editor-warning-text` | div | 警告提示文本 | - |
| `recording-editor-start-button` | button | 开始录音按钮 | `data-disabled`<br>`data-loading` |
| `recording-editor-bottom-controls` | div | 底部控件容器（FlexBox 组件） | - |
| `recording-editor-left-controls` | div | 左侧控件（FlexBox 组件） | - |
| `recording-editor-right-controls` | div | 右侧控件（FlexBox 组件） | - |
| `recording-editor-upload-audio-button` | button | 上传音频按钮 | `data-disabled` |
| `recording-editor-cancel-upload-button` | button | 取消上传按钮 | `data-progress` |

### 录制中状态元素

| Test ID | 元素类型 | 描述 | 附加属性 |
|---------|---------|------|----------|
| `recording-editor-recording-state` | div | 录制状态容器 | - |
| `recording-editor-progress-container` | div | 进度显示容器 | - |
| `recording-editor-time-display` | div | 时间显示 | - |
| `recording-editor-action-buttons` | div | 操作按钮组（FlexBox 组件） | - |
| `recording-editor-cancel-button` | button | 取消录音按钮 | `data-disabled` |
| `recording-editor-summarize-button` | button | 总结按钮 | `data-disabled`<br>`data-loading` |
| `recording-editor-bottom-controls` | div | 底部控件容器（FlexBox 组件） | - |
| `recording-editor-warning-text` | div | 警告提示文本 | - |

### 组件层级

```
# 初始状态
recording-editor-initial-state
├── recording-editor-main-content
│   ├── recording-editor-warning-text
│   └── recording-editor-start-button
└── recording-editor-bottom-controls
    ├── recording-editor-left-controls
    │   ├── <ModeToggle /> (模式切换)
    │   └── {modelSwitch} (模型切换)
    └── recording-editor-right-controls
        ├── {editorModeSwitch} (编辑器模式切换)
        ├── recording-editor-upload-audio-button or recording-editor-cancel-upload-button
        └── <InterruptButton /> (中断按钮)

# 录制中状态
recording-editor-recording-state
├── recording-editor-progress-container
│   ├── <RealtimeWaveform /> (波形显示)
│   └── recording-editor-time-display
├── recording-editor-action-buttons
│   ├── recording-editor-cancel-button
│   └── recording-editor-summarize-button
└── recording-editor-bottom-controls
    ├── recording-editor-warning-text
    └── <InterruptButton />
```

---

## MessageEditor (Super Magic 主编辑器)

**位置**: `src/opensource/pages/superMagic/components/MessageEditor/MessageEditor.tsx`

### 元素列表

| Test ID | 元素类型 | 描述 | 显示条件 | 附加属性 |
|---------|---------|------|----------|----------|
| `super-message-editor-container` | div | 编辑器主容器 | 始终显示 | - |
| `super-message-editor-inner` | div | 内部容器（FlexBox 组件） | 始终显示 | - |
| `super-message-editor-header` | div | 头部区域（FlexBox 组件） | !isMobile | - |
| `super-message-editor-at-button` | div | @ 提及按钮 | enableMentionPanel<br>&& !isMobile | - |
| `super-message-editor-toolbar` | div | 工具栏容器 | 始终显示 | - |
| `super-message-editor-toolbar-left` | div | 工具栏左侧 | 始终显示 | - |
| `super-message-editor-toolbar-right` | div | 工具栏右侧 | 始终显示 | - |
| `super-message-editor-upload-button` | div | 上传文件按钮 | 始终显示 | - |
| `super-message-editor-send-button` | button | 发送按钮 | 始终显示 | `data-disabled`<br>`data-loading`<br>`data-queue-editing` |

### 组件层级

```
super-message-editor-container
└── super-message-editor-inner
    ├── <MentionList />
    │   └── prevEl (头部元素)
    │       └── super-message-editor-header
    │           ├── <DraftBox /> (草稿盒)
    │           └── super-message-editor-at-button
    │               └── <At /> (提及面板)
    ├── <EditorContent /> (编辑器内容)
    ├── <AiCompletionTip /> (AI 补全提示)
    └── super-message-editor-toolbar
        ├── super-message-editor-toolbar-left
        │   ├── <ModeToggle /> (模式切换)
        │   └── {modelSwitch} (模型切换)
        └── super-message-editor-toolbar-right
            ├── <At /> (移动端提及按钮)
            ├── <MCPButton /> (MCP 按钮)
            ├── super-message-editor-upload-button
            ├── <SuperMagicVoiceInput /> (语音输入)
            ├── {editorModeSwitch} (编辑器模式切换)
            └── super-message-editor-send-button or <InterruptButton />
```

---

## 测试场景示例

### 场景 1: 测试 ChatMessageEditor 发送功能

```typescript
// 定位编辑器容器
const editorContainer = screen.getByTestId('chat-message-editor-container')
expect(editorContainer).toBeInTheDocument()

// 定位发送按钮
const sendButton = screen.getByTestId('chat-message-editor-send-button')
expect(sendButton).toBeInTheDocument()

// 验证按钮状态
expect(sendButton).toHaveAttribute('data-disabled', 'false')
expect(sendButton).toHaveAttribute('data-sending', 'false')

// 点击发送
fireEvent.click(sendButton)

// 验证发送状态
await waitFor(() => {
  expect(sendButton).toHaveAttribute('data-sending', 'true')
})
```

### 场景 2: 测试上传文件功能

```typescript
// ChatMessageEditor
const uploadButton = screen.getByTestId('chat-message-editor-upload-button')
fireEvent.click(uploadButton)

// MessageEditor
const superUploadButton = screen.getByTestId('super-message-editor-upload-button')
fireEvent.click(superUploadButton)
```

### 场景 3: 测试录音总结编辑器

```typescript
// 初始状态 - 开始录音
const startButton = screen.getByTestId('recording-editor-start-button')
expect(startButton).toBeInTheDocument()
fireEvent.click(startButton)

// 录制中状态 - 显示时间
await waitFor(() => {
  const timeDisplay = screen.getByTestId('recording-editor-time-display')
  expect(timeDisplay).toBeInTheDocument()
})

// 取消录音
const cancelButton = screen.getByTestId('recording-editor-cancel-button')
fireEvent.click(cancelButton)

// 或完成并总结
const summarizeButton = screen.getByTestId('recording-editor-summarize-button')
fireEvent.click(summarizeButton)

// 验证加载状态
expect(summarizeButton).toHaveAttribute('data-loading', 'true')
```

### 场景 4: 测试 MessageEditor 提及功能

```typescript
// 桌面端 - @ 按钮
const atButton = screen.getByTestId('super-message-editor-at-button')
expect(atButton).toBeInTheDocument()
fireEvent.click(atButton)

// 验证工具栏存在
const toolbar = screen.getByTestId('super-message-editor-toolbar')
expect(toolbar).toBeInTheDocument()
```

### 场景 5: 测试编辑器禁用状态

```typescript
// 发送按钮禁用
const sendButton = screen.getByTestId('super-message-editor-send-button')
expect(sendButton).toHaveAttribute('data-disabled', 'true')
expect(sendButton).toBeDisabled()

// 录音按钮禁用
const recordButton = screen.getByTestId('recording-editor-start-button')
expect(recordButton).toHaveAttribute('data-disabled', 'true')
expect(recordButton).toBeDisabled()
```

### 场景 6: 测试工具栏布局

```typescript
// MessageEditor 工具栏
const toolbarLeft = screen.getByTestId('super-message-editor-toolbar-left')
const toolbarRight = screen.getByTestId('super-message-editor-toolbar-right')

expect(toolbarLeft).toBeInTheDocument()
expect(toolbarRight).toBeInTheDocument()

// ChatMessageEditor 工具栏
const footerLeft = screen.getByTestId('chat-message-editor-footer-left')
const footerRight = screen.getByTestId('chat-message-editor-footer-right')

expect(footerLeft).toBeInTheDocument()
expect(footerRight).toBeInTheDocument()
```

### 场景 7: 测试录音编辑器上传功能

```typescript
// 上传音频
const uploadAudioButton = screen.getByTestId('recording-editor-upload-audio-button')
fireEvent.click(uploadAudioButton)

// 验证上传进度
await waitFor(() => {
  const cancelUploadButton = screen.getByTestId('recording-editor-cancel-upload-button')
  expect(cancelUploadButton).toBeInTheDocument()
  expect(cancelUploadButton).toHaveAttribute('data-progress', expect.any(String))
})

// 取消上传
const cancelUploadButton = screen.getByTestId('recording-editor-cancel-upload-button')
fireEvent.click(cancelUploadButton)
```

### 场景 8: 测试编辑器队列编辑模式

```typescript
// MessageEditor 队列编辑状态
const sendButton = screen.getByTestId('super-message-editor-send-button')

// 普通发送模式
expect(sendButton).toHaveAttribute('data-queue-editing', 'false')
expect(sendButton).toHaveAttribute('data-loading', 'false')

// 队列编辑模式
expect(sendButton).toHaveAttribute('data-queue-editing', 'true')

// 加载状态（添加到队列）
expect(sendButton).toHaveAttribute('data-loading', 'true')
```

---

## 对比表

### 三个编辑器的相同功能对比

| 功能 | ChatMessageEditor | RecordSummaryEditorPanel | MessageEditor |
|------|------------------|-------------------------|---------------|
| **主容器** | `chat-message-editor-container` | `recording-editor-{state}` | `super-message-editor-container` |
| **发送按钮** | `chat-message-editor-send-button` | `recording-editor-summarize-button` | `super-message-editor-send-button` |
| **上传按钮** | `chat-message-editor-upload-button` | `recording-editor-upload-audio-button` | `super-message-editor-upload-button` |
| **工具栏** | `chat-message-editor-footer` | `recording-editor-bottom-controls` | `super-message-editor-toolbar` |
| **语音输入** | `<SuperMagicVoiceInput />` | N/A (录音功能代替) | `<SuperMagicVoiceInput />` |

---

## 注意事项

### ⚠️ 关键规则

1. **仅原生元素**: `data-testid` 只能添加在原生 HTML 元素上（div, span, button, input 等），不能直接添加在 React 组件上
   - **例外情况**: 某些组件（如 antd 的 Flex、Button、Input 等）会将 props 传递到底层原生元素，可以在这些组件上添加 `data-testid`，但文档中会标注实际的底层元素类型
   - **最佳实践**: 优先在原生 HTML 元素上添加，如果必须添加在组件上，确保该组件会将 props 传递到底层元素
2. **状态标识**: 使用 `data-*` 属性标识元素状态（disabled、loading、progress 等）
3. **条件渲染**: 部分元素仅在特定条件下渲染
4. **多状态组件**: RecordSummaryEditorPanel 有多个状态，测试时需要模拟状态切换

### 🎯 最佳实践

1. **使用状态属性**: 优先使用 `data-disabled`, `data-loading` 等属性判断状态
2. **等待异步状态**: 使用 `waitFor` 等待状态变化
3. **模拟用户操作**: 按照真实用户流程编写测试
4. **验证可见性**: 在交互前验证元素可见性

### 📊 统计总结

| 编辑器/组件 | Test ID 数量 | 状态属性数量 | 主要功能 |
|------------|-------------|------------|---------|
| ChatMessageEditor | 6 | 2 | 聊天发送、文件上传 |
| RecordSummaryEditorPanel | 15 | 4 | 录音、上传音频、总结 |
| MessageEditor | 9 | 3 | 消息发送、提及、文件上传 |
| **工具栏子组件** | **7** | **8** | **辅助功能** |
| VoiceInput | 1 | 2 | 语音输入 |
| MCPButton | 2 | 2 | MCP 功能 |
| InterruptButton | 1 | 1 | 中断任务 |
| ModeToggle | 1 | 2 | 模式切换 |
| At | 1 | 2 | 提及功能 |
| DraftBox | 1 | 2 | 草稿管理 |
| **总计** | **37** | **17** | - |

---

---

## 工具栏子组件测试 ID

这些组件是编辑器工具栏中的可交互元素。

### 通用工具组件

| Test ID | 组件 | 元素类型 | 描述 | 附加属性 |
|---------|------|---------|------|----------|
| `voice-input-button` | VoiceInput | button | 语音输入按钮 | `data-status`<br>`data-recording` |
| `mcp-button` | MCPButton | MagicButton | MCP 功能按钮 | `data-count`<br>`data-active` |
| `mcp-button-count` | MCPButton | span | MCP 数量徽章 | - |
| `interrupt-button` | InterruptButton | div | 中断按钮 | `data-size` |
| `mode-toggle-button` | ModeToggle | div | 模式切换按钮 | `data-mode`<br>`data-disabled` |
| `at-mention-button` | div | @ 提及按钮（At 组件，FlexBox 元素） | `data-visible`<br>`data-size` |
| `draft-box-trigger` | DraftBox | div | 草稿箱触发器 | `data-count`<br>`data-visible` |

### VoiceInput 状态说明

| 状态值 | 描述 |
|--------|------|
| `idle` | 空闲状态 |
| `recording` | 录音中 |
| `processing` | 处理中 |
| `connecting` | 连接中 |
| `error` | 错误状态 |

### 使用场景示例

```typescript
// 测试语音输入
const voiceButton = screen.getByTestId('voice-input-button')
expect(voiceButton).toHaveAttribute('data-status', 'idle')
expect(voiceButton).toHaveAttribute('data-recording', 'false')

// 开始录音
fireEvent.click(voiceButton)
await waitFor(() => {
  expect(voiceButton).toHaveAttribute('data-status', 'recording')
  expect(voiceButton).toHaveAttribute('data-recording', 'true')
})

// 测试 MCP 按钮
const mcpButton = screen.getByTestId('mcp-button')
expect(mcpButton).toHaveAttribute('data-count', '3')
expect(mcpButton).toHaveAttribute('data-active', 'true')

// 测试中断按钮
const interruptButton = screen.getByTestId('interrupt-button')
expect(interruptButton).toHaveAttribute('data-size', 'small')
fireEvent.click(interruptButton)

// 测试模式切换
const modeToggle = screen.getByTestId('mode-toggle-button')
expect(modeToggle).toHaveAttribute('data-mode', 'General')
expect(modeToggle).toHaveAttribute('data-disabled', 'false')

// 测试 @ 提及按钮
const atButton = screen.getByTestId('at-mention-button')
expect(atButton).toHaveAttribute('data-visible', 'false')
fireEvent.click(atButton)
await waitFor(() => {
  expect(atButton).toHaveAttribute('data-visible', 'true')
})

// 测试草稿箱
const draftBox = screen.getByTestId('draft-box-trigger')
expect(draftBox).toHaveAttribute('data-count', '5')
expect(draftBox).toHaveAttribute('data-visible', 'false')
```

---

## 更新日志

- **2025-01-XX**: 初始版本，添加三个主要编辑器组件的 test-id
- **重要**: 所有 test-id 仅添加在原生 HTML 元素上，遵循自动化测试最佳实践

