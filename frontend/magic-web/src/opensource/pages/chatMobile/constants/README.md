# ChatMobile Constants

## Z-Index Management

为了避免 z-index 层级冲突和维护困难，我们统一管理所有的 z-index 值。

### 层级定义

```typescript
export const CHAT_MOBILE_Z_INDEX = {
  // Base content layer (1-10)
  CHAT_CONTENT: 1,
  
  // Message list and containers (5-15)
  PINNED_MESSAGE_LIST: 5,
  
  // Sticky elements (10-20)
  PINNED_MESSAGE_HEADER: 10,
  
  // Navigation and controls (15-25)
  SEGMENTED_CONTAINER: 15,
  
  // Modals and overlays (100+)
  MODAL_BACKDROP: 100,
  MODAL_CONTENT: 101,
  
  // Tooltips and popovers (200+)
  TOOLTIP: 200,
  POPOVER: 201,
  
  // Toast notifications (300+)
  TOAST: 300,
  
  // Loading indicators (400+)
  LOADING_OVERLAY: 400,
}
```

### 使用方式

1. **在 CSS-in-JS 中使用**：
```typescript
import { CHAT_MOBILE_Z_INDEX } from "./constants"

const styles = css`
  z-index: ${CHAT_MOBILE_Z_INDEX.PINNED_MESSAGE_HEADER};
`
```

2. **在普通样式对象中使用**：
```typescript
const style = {
  zIndex: CHAT_MOBILE_Z_INDEX.CHAT_CONTENT,
}
```

### 添加新的 z-index

1. 在 `zIndex.ts` 中添加新的常量
2. 确保值不与现有层级冲突
3. 添加适当的注释说明用途
4. 在这个 README 中更新文档

### 层级规划原则

- **1-10**: 基础内容层
- **10-20**: 粘性/固定元素
- **20-50**: 导航和控制元素
- **100+**: 模态框和遮罩层
- **200+**: 提示和弹出框
- **300+**: 通知消息
- **400+**: 加载指示器

### 注意事项

- 修改 z-index 值时要考虑对其他组件的影响
- 新增层级时遵循现有的分组规则
- 保持合理的间隔，避免过度密集的数值 