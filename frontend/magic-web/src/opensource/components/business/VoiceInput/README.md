# VoiceInput 语音输入组件

基于火山引擎语音识别服务的 React 语音输入组件，支持实时语音转文字功能。

## 功能特性

- 🎤 实时语音识别
- 🎯 支持自定义样式
- 🔧 可配置语音参数
- 📱 移动端和桌面端适配
- 🎨 多种状态指示
- 🛡️ TypeScript 支持

## 基础用法

```tsx
import VoiceInput from '@/opensource/components/business/VoiceInput'

function App() {
  const handleResult = (text: string) => {
    console.log('识别结果:', text)
  }

  const handleError = (error: Error) => {
    console.error('语音识别错误:', error)
  }

  return (
    <VoiceInput 
      onResult={handleResult}
      onError={handleError}
    />
  )
}
```

## 高级用法

```tsx
import VoiceInput from '@/opensource/components/business/VoiceInput'
import { useState } from 'react'

function AdvancedExample() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle')

  const handleResult = (result: string) => {
    setText(prev => prev + result)
  }

  const handleStatusChange = (status) => {
    setStatus(status)
    console.log('状态变化:', status)
  }

  return (
    <div>
      <VoiceInput 
        onResult={handleResult}
        onStatusChange={handleStatusChange}
        placeholder="点击开始语音输入"
        config={{
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            bitsPerSample: 16
          }
        }}
      />
      <div>当前状态: {status}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  )
}
```

## 自定义样式

```tsx
import VoiceInput from '@/opensource/components/business/VoiceInput'
import { MicrophoneIcon } from 'your-icon-library'

function CustomStyleExample() {
  return (
    <VoiceInput 
      onResult={console.log}
      className="custom-voice-input"
      style={{ margin: '20px' }}
    >
      <MicrophoneIcon />
    </VoiceInput>
  )
}
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| onResult | `(text: string) => void` | - | 语音识别结果回调 |
| onError | `(error: Error) => void` | - | 错误回调 |
| onStatusChange | `(status: VoiceInputStatus) => void` | - | 状态变化回调 |
| disabled | `boolean` | `false` | 是否禁用 |
| placeholder | `string` | - | 占位符文本 |
| style | `CSSProperties` | - | 自定义样式 |
| className | `string` | - | 自定义类名 |
| children | `ReactNode` | - | 自定义按钮内容 |
| config | `Partial<VoiceInputConfig>` | - | 语音配置 |

### VoiceInputStatus

- `'idle'` - 空闲状态
- `'connecting'` - 连接中
- `'recording'` - 录音中
- `'processing'` - 处理中
- `'error'` - 错误状态

### VoiceInputConfig

```tsx
interface VoiceInputConfig {
  wsUrl: string              // WebSocket URL
  jwtApiUrl: string          // JWT API URL
  resourceId: string         // 资源ID
  authToken?: string         // 认证Token
  organizationCode?: string  // 组织代码
  audio: {
    sampleRate: number       // 采样率 (默认: 16000)
    channelCount: number     // 声道数 (默认: 1)
    bitsPerSample: number    // 位深度 (默认: 16)
  }
}
```

## 注意事项

1. **浏览器兼容性**: 需要支持 Web Audio API 和 getUserMedia
2. **HTTPS 要求**: 在生产环境中需要 HTTPS 协议才能访问麦克风
3. **权限许可**: 首次使用需要用户授权麦克风权限
4. **网络连接**: 需要稳定的网络连接到语音识别服务

## 错误处理

```tsx
const handleError = (error: Error) => {
  switch (error.message) {
    case 'Permission denied':
      console.log('用户拒绝了麦克风权限')
      break
    case 'Network error':
      console.log('网络连接异常')
      break
    default:
      console.log('语音识别服务异常:', error.message)
  }
}
```