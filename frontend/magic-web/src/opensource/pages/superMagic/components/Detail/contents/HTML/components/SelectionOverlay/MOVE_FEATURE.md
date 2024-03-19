# Element Position Move Feature

## Overview
实现了基于 relative 定位的元素位置移动功能，允许用户在 iframe 中拖动选中的元素。

## Implementation Details

### 1. Message Type (`messages.ts`)
添加了新的消息类型和 Payload：
- `EditorMessageType.SET_ELEMENT_POSITION`: 设置元素位置的命令类型
- `SetElementPositionPayload`: 包含 selector, top, left 参数

### 2. Move Handle Hook (`useMoveHandle.ts`)
完全参考 `useResizeHandles` 和 `useRotateHandle` 的实现模式：

**核心功能：**
- `startMove()`: 开始移动操作
- `stopMove()`: 停止移动操作
- `updateMove()`: 更新移动状态
- `scheduleMoveUpdate()`: 使用 RAF 批量更新样式

**事件处理：**
- 使用 `useEffect` 在 document 级别监听事件（capture phase）
- 监听 pointermove、pointerup、pointercancel
- 监听 window blur 事件自动停止移动
- 设置 document.body 样式（userSelect: none, cursor: grabbing）

**状态管理：**
- 监听 selectedInfo 变化，自动停止移动操作
- 检查 `event.buttons === 0` 处理边缘情况
- 使用指针捕获确保拖动流畅
- 存储初始位置值（initialPositionRef）进行增量计算

**关键特性：**
- 考虑缩放比例 (scaleRatio) 进行坐标转换
- 使用 relative 定位，基于初始 top/left 值进行增量移动
- 拖动时禁用 hover 和 selection mode，避免干扰
- 完整的清理逻辑（release pointer capture, cancel RAF, restore styles）

### 3. Selection Overlay (`SelectionOverlay.tsx`)
集成了移动手势：
- 在选中元素**左上角**添加专门的移动手柄（带 Move 图标的圆形按钮）
- 只有通过移动手柄才能拖动元素，避免误操作
- 拖动时显示 "grabbing" 光标，平时显示 "grab" 光标
- hover 时手柄有缩放动画效果

**结构：**
```tsx
<div> {/* 选中边框容器 */}
  <div> {/* Move handle - 左上角 */}
  {resizeHandles.map(...)} {/* Resize handles - 8个角/边 */}
  <div> {/* Rotate handle - 顶部中心 */}
</div>
```

**视觉设计：**
- 移动手柄：蓝色圆形按钮，白色边框，Move 图标
- 位置：左上角（top: -12px, left: -12px）
- 尺寸：24px (h-6 w-6)
- 图标：lucide-react 的 Move 图标 (12px)

### 4. HTML Editor V2 Hook (`useHTMLEditorV2.ts`)
在 `HTMLEditorV2Ref` 接口中添加了新方法：
- `setElementPosition(selector, top, left)`: 设置元素位置

### 5. Iframe Runtime (`iframe-runtime/src/index.ts`)
在 StyleManager 中实现了位置设置逻辑：
- `setElementPosition()`: 应用 position: relative 和 top/left 样式
- 记录到命令历史，支持撤销/重做
- 在 `applyCommand()` 和 `restoreState()` 中添加处理逻辑
- 在 GET_COMPUTED_STYLES 响应中包含 position, top, left, right, bottom 属性

## User Experience

### 使用方式
1. 选中一个元素（点击）
2. 找到元素左上角的蓝色圆形移动手柄（带 Move 图标）
3. 在移动手柄上按下鼠标/触摸
4. 拖动到目标位置
5. 松开鼠标/触摸

### 交互特点
- 专用移动手柄避免误触发移动操作
- 拖动时元素实时跟随光标移动
- 支持 PPT 渲染模式下的缩放坐标转换
- 不会与 resize handles 和 rotate handle 冲突
- 支持撤销/重做操作
- 手柄 hover 时有缩放动画反馈

## Technical Notes

### Coordinate Transform
考虑了以下坐标转换：
- iframe 相对于父窗口的偏移
- 容器（container）的偏移
- PPT 模式下的缩放比例

### Position Strategy
采用 relative 定位而非 absolute：
- 保持元素在文档流中的位置
- 基于元素原始位置进行偏移
- 更符合常见的 UI 编辑需求

### Performance Optimization
- 使用 RAF 批量处理样式更新
- 使用指针捕获确保拖动流畅
- 拖动时禁用不必要的交互反馈
- Document 级别的事件监听（capture phase）确保事件优先级
- 检查 `event.buttons === 0` 处理边缘情况

### Implementation Pattern
完全遵循 `useResizeHandles` 和 `useRotateHandle` 的实现模式：
- 独立的 start/stop/update 函数
- useEffect 中的全局事件监听
- 自动监听 selectedInfo 变化并停止操作
- 完整的清理逻辑和错误处理
- Document body 样式设置（userSelect, cursor）

## Browser Compatibility
- 使用现代 Pointer Events API
- 降级处理：如果 pointer capture 不可用会记录日志但不影响功能

## Bug Fixes

### 边框不重合问题 (2026-01-21)
**问题：** 多次移动/缩放/旋转后，选中边框与实际元素位置不重合。

**原因：** 操作结束后，本地计算的 rect 与 iframe 中元素的实际边界框不同步。

**解决方案：**
1. 添加 `REFRESH_SELECTED_ELEMENT` 消息类型
2. 在 iframe-runtime 中实现 `REFRESH_SELECTED_ELEMENT` 请求处理
3. 在 `stopMove()` / `stopResize()` / `stopRotate()` 中：
   - 等待所有 pending RAF 更新完成
   - 执行最终的样式更新
   - 调用 `refreshSelectedElement()` 重新获取元素信息
4. iframe 重新触发 `ELEMENT_SELECTED` 事件，包含更新后的 rect 和 styles

**影响范围：**
- `useMoveHandle.ts`: 移动结束后刷新
- `useResizeHandles.ts`: 缩放结束后刷新
- `useRotateHandle.ts`: 旋转结束后刷新
- `useHTMLEditorV2.ts`: 添加 `refreshSelectedElement()` API
- `iframe-runtime/src/index.ts`: 实现刷新请求处理

## Future Enhancements
可能的改进方向：
- 支持键盘微调（方向键）
- 添加网格对齐功能
- 显示坐标提示
- 支持多选拖动
