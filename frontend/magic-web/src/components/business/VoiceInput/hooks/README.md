# VoiceInput Hooks

## useKeyboardShortcut

用于处理键盘快捷键的自定义 Hook。

### 功能特性

- ✅ 跨平台支持 (Mac / Windows / Linux)
- ✅ 自动检测平台并使用对应的修饰键
- ✅ 可配置的键位组合
- ✅ 自动处理事件监听器的添加和清理
- ✅ 防止默认行为和事件冒泡
- ✅ TypeScript 支持

### 默认快捷键

- **Mac**: `⌘+Shift+E`
- **Windows/Linux**: `Ctrl+Shift+E`

### 基本用法

```tsx
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut"

function MyComponent() {
  const handleShortcut = () => {
    console.log("快捷键被触发!")
  }

  const { hotkeyDisplay } = useKeyboardShortcut({
    enabled: true,
    disabled: false,
    onTrigger: handleShortcut,
  })

  return <div>按下 {hotkeyDisplay} 触发快捷键</div>
}
```

### 自定义快捷键

```tsx
const { hotkeyDisplay } = useKeyboardShortcut({
  enabled: true,
  keys: {
    key: "s",
    ctrlKey: true,
    shiftKey: false,
    metaKey: false,
    altKey: false,
  },
  onTrigger: handleSave,
})
```

### API 参数

#### KeyboardShortcutConfig

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | boolean | true | 是否启用快捷键 |
| disabled | boolean | false | 是否禁用快捷键 |
| keys | KeyConfig | 见下方 | 自定义键位组合 |
| onTrigger | () => void | - | 快捷键触发回调 |

#### KeyConfig

| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 主键 (如: "e", "s", "Enter") |
| metaKey | boolean | 是否需要 Cmd 键 (Mac) |
| ctrlKey | boolean | 是否需要 Ctrl 键 |
| shiftKey | boolean | 是否需要 Shift 键 |
| altKey | boolean | 是否需要 Alt 键 |

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| hotkeyDisplay | string | 当前平台的快捷键显示文本 |

### 工具函数

#### getHotkeyDisplayText()

获取当前平台的默认快捷键显示文本。

```tsx
import { getHotkeyDisplayText } from "./hooks/useKeyboardShortcut"

const displayText = getHotkeyDisplayText() // "⌘+Shift+E" 或 "Ctrl+Shift+E"
```

### 注意事项

1. **事件监听器管理**: Hook 自动管理事件监听器的添加和清理
2. **事件冒泡**: 触发快捷键时会自动阻止默认行为和事件冒泡
3. **性能优化**: 使用 useCallback 优化事件处理函数
4. **平台检测**: 自动检测用户平台并使用相应的修饰键

### 使用场景

- 语音输入组件的快捷键控制
- 保存操作的快捷键
- 搜索功能的快捷键
- 其他需要键盘快捷键的场景

### 完整示例

```tsx
import React, { useState, useCallback } from "react"
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut"

function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  
  const toggleRecording = useCallback(() => {
    setIsRecording(prev => !prev)
  }, [])

  const { hotkeyDisplay } = useKeyboardShortcut({
    enabled: true,
    disabled: false,
    onTrigger: toggleRecording,
  })

  return (
    <div>
      <button onClick={toggleRecording}>
        {isRecording ? "停止录音" : "开始录音"}
      </button>
      <p>快捷键: {hotkeyDisplay}</p>
    </div>
  )
}
``` 