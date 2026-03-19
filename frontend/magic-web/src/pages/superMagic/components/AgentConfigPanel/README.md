# AgentConfigPanel 智能体配置组件

一个用于配置智能体基本信息和工具的组件，包含图标选择、名称编辑、描述编辑和工具管理功能。

## 📁 文件结构

```
AgentConfigPanel/
├── index.tsx                    # 主组件
├── components/
│   ├── IconSelectModal.tsx      # 图标选择弹窗
│   └── ToolSelectModal.tsx      # 工具选择弹窗
├── example.tsx                  # 使用示例
└── README.md                    # 组件文档
```

## 🎯 功能特性

- ✅ **图标管理**: 点击头像可以更换图标，支持表情符号和默认头像
- ✅ **信息编辑**: 智能体名称和描述的实时编辑
- ✅ **工具管理**: 可视化展示已选工具，支持添加和删除
- ✅ **响应式设计**: 适配不同屏幕尺寸
- ✅ **TypeScript支持**: 完整的类型定义

## 🚀 基础用法

```tsx
import AgentConfigPanel from "@/components/business/AgentConfigPanel"
import { AiManage } from "@/opensource/pages/magicAdmin/types/aiManage"
import { IMCPItem } from "@/opensource/components/Agent/MCP/types"

function YourComponent() {
	const [agent, setAgent] = useState<Partial<AiManage.Agent>>({
		robot_name: "我的智能助手",
		robot_avatar: "🤖",
		robot_description: "这是一个智能助手",
	})

	const [tools, setTools] = useState<IMCPItem[]>([])

	return (
		<div className="container">
			{/* 智能体配置面板 - 放在编辑器上方 */}
			<AgentConfigPanel
				agent={agent}
				tools={tools}
				onNameChange={(name) => setAgent((prev) => ({ ...prev, robot_name: name }))}
				onDescriptionChange={(desc) =>
					setAgent((prev) => ({ ...prev, robot_description: desc }))
				}
				onAvatarChange={(avatar) => setAgent((prev) => ({ ...prev, robot_avatar: avatar }))}
				onToolAdd={(tool) => setTools((prev) => [...prev, tool])}
				onToolRemove={(toolId) => setTools((prev) => prev.filter((t) => t.id !== toolId))}
			/>

			{/* 您的编辑器组件 */}
			<YourEditor />
		</div>
	)
}
```

## 📝 API 接口

### Props

| 属性名              | 类型                            | 默认值 | 说明               |
| ------------------- | ------------------------------- | ------ | ------------------ |
| agent               | `Partial<AiManage.Agent>`       | `{}`   | 智能体数据         |
| tools               | `IMCPItem[]`                    | `[]`   | 可用工具列表       |
| onNameChange        | `(name: string) => void`        | -      | 智能体名称变化回调 |
| onDescriptionChange | `(description: string) => void` | -      | 智能体描述变化回调 |
| onAvatarChange      | `(avatar: string) => void`      | -      | 图标变化回调       |
| onToolAdd           | `(tool: IMCPItem) => void`      | -      | 工具添加回调       |
| onToolRemove        | `(toolId: string) => void`      | -      | 工具删除回调       |

### 数据类型

```typescript
// 智能体数据结构
interface Agent {
	id: string
	robot_name: string
	robot_avatar: string
	robot_description: string
	// ... 其他字段
}

// 工具数据结构
interface IMCPItem {
	id: string
	name: string
	description: string
	icon: string
	enabled: boolean
	user_operation: string
}
```

## 🎨 样式定制

组件使用 `antd-style` 构建，样式会自动适配当前主题。如需自定义样式，可以通过覆盖 CSS 类名的方式：

```css
.magic-agent-config-panel {
	/* 自定义容器样式 */
}

.magic-agent-config-header {
	/* 自定义头部样式 */
}
```

## 📱 响应式设计

组件支持响应式设计，在不同屏幕尺寸下会自动调整布局：

- **桌面端**: 完整功能展示
- **平板端**: 适当缩放图标和间距
- **移动端**: 简化布局，优化触控体验

## 🔧 开发说明

### 图标选择功能

支持两种类型的图标：

1. **表情符号**: 内置常用表情符号
2. **默认头像**: 使用 dicebear API 生成的头像
3. **自定义上传**: 预留接口，可扩展文件上传功能

### 工具管理功能

- 工具列表展示已选择的工具
- 点击添加按钮可以从预设工具库中选择
- 支持工具的删除操作
- 工具数据可以来自 API 或本地配置

## 🛠️ 扩展功能

组件预留了扩展接口，可以根据需要添加：

1. **图标上传**: 在 `IconSelectModal` 中实现文件上传
2. **工具API**: 在 `ToolSelectModal` 中接入真实的工具 API
3. **表单验证**: 添加名称和描述的验证规则
4. **批量操作**: 支持工具的批量添加和删除

## 📋 注意事项

1. 组件依赖 `@/opensource/pages/magicAdmin/types/aiManage` 和 `@/opensource/components/Agent/MCP/types` 类型定义
2. 确保项目中已安装 `antd-style` 依赖
3. 图标选择弹窗中的默认头像依赖外部 API，请确保网络连接正常
4. 工具选择功能目前使用模拟数据，实际使用时需要接入真实 API
