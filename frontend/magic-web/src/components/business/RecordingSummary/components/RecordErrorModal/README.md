# RecordErrorModal

录音错误提示弹窗组件，支持动态调用显示。

## 特性

- 🚀 **动态渲染**: 无需在页面中预先添加组件，通过方法调用动态渲染
- 🎯 **挂载到 body**: 弹窗直接挂载到 body 上，避免层级和样式问题
- 🎨 **美观界面**: 遵循 Magic 设计系统规范
- 📱 **响应式**: 支持不同屏幕尺寸
- 🔄 **Promise 支持**: 支持 async/await 语法
- 🎪 **灵活回调**: 支持自定义关闭回调
- 🔗 **集成反馈**: 内置在线反馈功能

## 快速开始

### 基本用法

```typescript
import showRecordErrorModal from "@/opensource/components/business/RecordingSummary/components/RecordErrorModal"

// 在任意组件或函数中调用
const handleShowError = async () => {
  await showRecordErrorModal()
  // 用户关闭弹窗后执行
  console.log("Modal closed")
}
```

### 带回调的用法

```typescript
import showRecordErrorModal from "@/opensource/components/business/RecordingSummary/components/RecordErrorModal"

const handleShowErrorWithCallback = async () => {
  await showRecordErrorModal({
    onClose: () => {
      // 处理关闭逻辑
      console.log("弹窗已关闭")
    }
  })
}
```

### 作为组件使用

如果需要在组件树中使用，也可以直接导入组件：

```typescript
import { RecordErrorModal } from "@/opensource/components/business/RecordingSummary/components/RecordErrorModal"

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <RecordErrorModal
      open={isOpen}
      onClose={() => setIsOpen(false)}
    />
  )
}
```

## API

### showRecordErrorModal(options?)

打开录音错误提示弹窗。

**参数:**

- `options` (可选): 配置选项
  - `onClose?: () => void` - 弹窗关闭回调

**返回值:** `Promise<void>`

弹窗关闭时 Promise resolve。

### RecordErrorModalProps

组件属性接口：

```typescript
interface RecordErrorModalProps {
  open?: boolean          // 是否显示模态框
  onClose?: () => void    // 关闭回调
}
```

### ShowRecordErrorModalOptions

函数式调用配置接口：

```typescript
interface ShowRecordErrorModalOptions {
  onClose?: () => void    // 模态框关闭时的回调函数
}
```

## 使用场景

1. **录音错误提示**: 录音文件异常时提示用户
2. **任务停止通知**: 通知用户任务已停止
3. **问题反馈入口**: 提供快捷的问题反馈入口

## 注意事项

1. 弹窗会自动挂载到 `document.body`，无需手动处理 DOM
2. 同时只能显示一个弹窗，新的调用会关闭之前的弹窗
3. 组件内部集成了在线反馈功能，点击"反馈问题"会打开反馈弹窗
4. 弹窗不支持点击遮罩层关闭，必须通过按钮操作

## 组件结构

```
RecordErrorModal/
├── component.tsx         # 主组件文件
├── types.ts             # TypeScript 类型定义
├── styles.ts            # 样式定义（antd-style）
├── utils.tsx            # 动态渲染工具方法
├── index.ts             # 模块主入口
└── README.md            # 文档
```

## 依赖

- React 18+
- antd
- antd-style
- react-i18next
- @tabler/icons-react

## 国际化

组件支持中英文双语：

**中文:**
- 标题：提示
- 描述：录音文件异常， 任务已停止
- 反馈按钮：反馈问题
- 关闭按钮：关闭

**英文:**
- 标题：Notice
- 描述：Recording file error, task has been stopped
- 反馈按钮：Report Issue
- 关闭按钮：Close

翻译键路径：`super.recordingSummary.recordErrorModal.*`
