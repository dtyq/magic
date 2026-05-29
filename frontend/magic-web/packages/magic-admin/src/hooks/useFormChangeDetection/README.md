# useFormChangeDetection Hook

一个通用的表单变更检测Hook，用于检测Ant Design Form是否有未保存的更改。

## 特性

- 🚀 **高性能**: 使用防抖机制，避免频繁检测
- 🔧 **灵活配置**: 支持忽略特定字段、监听特定字段等配置
- 📱 **兼容性好**: 兼容Ant Design Form的各种使用场景
- 🎯 **精确检测**: 支持深度比较，准确识别对象和数组的变更
- 🛡️ **类型安全**: 完整的TypeScript类型定义

## 基本用法

```tsx
import { useFormChangeDetection } from '@/hooks'
import { Form, Modal } from 'antd'

function MyForm() {
  const [form] = Form.useForm()
  
  const initialValues = {
    name: '',
    email: '',
    config: { theme: 'light' }
  }
  
  const { hasChanges, resetChangeDetection } = useFormChangeDetection(
    form, 
    initialValues
  )
  
  const handleClose = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '确认关闭',
        content: '您有未保存的更改，确定要关闭吗？',
        onOk: () => {
          resetChangeDetection()
          onClose()
        }
      })
    } else {
      onClose()
    }
  }
  
  return (
    <Form form={form} initialValues={initialValues}>
      {/* 表单内容 */}
    </Form>
  )
}
```

## API

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `form` | `FormInstance` | ✅ | - | Ant Design Form实例 |
| `initialValues` | `any` | ✅ | - | 表单的初始值 |
| `options` | `UseFormChangeDetectionOptions` | ❌ | `{}` | 配置选项 |

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用变更检测 |
| `compareFn` | `(a: any, b: any) => boolean` | `lodash-es.isEqual` | 自定义比较函数 |
| `watchFields` | `string[]` | `[]` | 要监听的特定字段路径数组，为空则监听所有字段 |
| `ignoreFields` | `string[]` | `[]` | 是否忽略某些字段的变更 |
| `debounceDelay` | `number` | `300` | 变更检测的防抖延迟（毫秒） |
| `usePolling` | `boolean` | `false` | 是否使用轮询方式检测变更 |
| `pollingInterval` | `number` | `1000` | 轮询间隔（毫秒） |

### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `hasChanges` | `boolean` | 表单是否有未保存的更改 |
| `resetChangeDetection` | `() => void` | 重置变更检测状态 |
| `setHasChanges` | `(changed: boolean) => void` | 手动设置变更状态 |
| `getChanges` | `() => Record<string, any>` | 获取当前表单值与初始值的差异 |
| `getInitialValues` | `() => any` | 获取初始值 |
| `checkChanges` | `() => void` | 手动触发变更检测 |

## 高级用法

### 只监听特定字段

```tsx
const { hasChanges } = useFormChangeDetection(form, initialValues, {
  watchFields: ['name', 'email', 'config.theme']
})
```

### 忽略特定字段

```tsx
const { hasChanges } = useFormChangeDetection(form, initialValues, {
  ignoreFields: ['id', 'created_at', 'updated_at']
})
```

### 自定义比较函数

```tsx
const { hasChanges } = useFormChangeDetection(form, initialValues, {
  compareFn: (a, b) => {
    // 自定义比较逻辑
    if (typeof a === 'string' && typeof b === 'string') {
      return a.trim() === b.trim()
    }
    return a === b
  }
})
```

### 使用轮询方式（备选方案）

```tsx
const { hasChanges } = useFormChangeDetection(form, initialValues, {
  usePolling: true,
  pollingInterval: 2000 // 每2秒检测一次
})
```

### 获取变更详情

```tsx
const { getChanges } = useFormChangeDetection(form, initialValues)

const handleSave = () => {
  const changes = getChanges()
  console.log('变更详情:', changes)
  // 输出示例:
  // {
  //   name: { from: 'old name', to: 'new name' },
  //   config: { from: { theme: 'light' }, to: { theme: 'dark' } }
  // }
}
```

## 使用场景

### 1. 弹窗表单关闭确认

```tsx
const handleClose = () => {
  if (hasChanges) {
    Modal.confirm({
      title: '确认关闭',
      content: '您有未保存的更改，确定要关闭吗？',
      onOk: () => {
        resetChangeDetection()
        onClose()
      }
    })
  } else {
    onClose()
  }
}
```

### 2. 页面离开提醒

```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasChanges) {
      e.preventDefault()
      e.returnValue = '您有未保存的更改，确定要离开吗？'
    }
  }
  
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [hasChanges])
```

### 3. 保存按钮状态

```tsx
<Button 
  type="primary" 
  disabled={!hasChanges}
  onClick={handleSave}
>
  保存
</Button>
```

### 4. 表单重置确认

```tsx
const handleReset = () => {
  if (hasChanges) {
    Modal.confirm({
      title: '确认重置',
      content: '重置将丢失所有未保存的更改，确定要继续吗？',
      onOk: () => {
        form.resetFields()
        resetChangeDetection()
      }
    })
  } else {
    form.resetFields()
  }
}
```

## 注意事项

1. **性能考虑**: 默认使用300ms防抖，避免频繁检测。如果表单字段很多，建议使用`watchFields`指定需要监听的字段。

2. **内存管理**: Hook会自动清理定时器和事件监听器，无需手动清理。

3. **初始值更新**: 当`initialValues`发生变化时，会自动重置变更状态。

4. **深度比较**: 默认使用`lodash-es.isEqual`进行深度比较，确保对象和数组的变更能被正确检测。

5. **兼容性**: 优先使用`Form.useWatch`，如果不可用则回退到轮询方式。

