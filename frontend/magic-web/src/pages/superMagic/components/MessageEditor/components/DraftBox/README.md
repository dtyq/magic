# DraftBox 组件

DraftBox 是一个草稿箱组件，用于显示和管理消息编辑器的草稿内容。该组件完全基于 Figma 设计稿实现，提供完美的视觉还原。

## 功能特性

- 📋 显示所有草稿列表（包括当前草稿和历史版本）
- 🗑️ 删除草稿功能
- ✅ 使用草稿功能
- 🎨 完美还原 Figma 设计稿样式
- ⚡ 高性能的数据加载和渲染
- 📱 响应式设计
- 🖱️ 流畅的交互效果

## 使用方式

```tsx
import { DraftBox } from "./components/DraftBox"
import { MessageEditorStore } from "./stores"

function MessageEditor() {
	const store = new MessageEditorStore()

	store.draftStore.setDraftKey({
		workspaceId: "workspace-123",
		projectId: "project-456",
		topicId: "topic-789",
	})

	return (
		<div>
			<DraftBox draftStore={store.draftStore} topicName="我的话题名称" />
		</div>
	)
}
```

## Props 参数

| 参数       | 类型       | 必填 | 默认值     | 说明           |
| ---------- | ---------- | ---- | ---------- | -------------- |
| draftStore | DraftStore | ✅   | -          | 草稿管理 store |
| topicName  | string     | ❌   | "话题名称" | 当前话题名称   |
| iconSize   | number     | ❌   | 20         | 顶部图标尺寸   |

## 设计规范

该组件严格按照 Figma 设计稿实现，包括：

- 🎨 精确的颜色规范 (#ffffff, #f9f9f9, #ff4d3a, #315cec)
- 📏 精确的尺寸和间距
- 🔤 PingFang SC 字体系统
- 🌈 渐变背景图标
- 📜 自定义滚动条样式
- ✨ 微交互动画效果

## 依赖说明

- `@tabler/icons-react` - 图标库
- `antd-style` - 样式系统
- `@tiptap/react` - 富文本编辑器类型
- `DraftStore` - 草稿状态管理

## 注意事项

1. 确保 `draftStore` 已设置正确的 `draftKey`
2. 组件会自动加载对应的草稿数据，无需手动预加载
3. 删除草稿操作不可逆，请在 UI 层面给用户适当的确认提示
4. DraftBox 内部管理显示状态，外层无需控制 visible
