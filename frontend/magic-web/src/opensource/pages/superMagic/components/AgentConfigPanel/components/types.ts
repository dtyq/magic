import { AgentType } from "@/opensource/pages/superMagic/components/AgentSelector/types"

export interface toolItem {
	name: string
	code: string
	icon: string
	description: string
	type?: AgentType
	required?: boolean
}

export interface ToolSelectModalProps {
	/** 是否显示弹窗 */
	visible: boolean
	/** 当前已选工具列表 */
	selectedTools: toolItem[]
	/** 可选工具列表 */
	availableTools?: toolItem[]
	/** 关闭弹窗回调 */
	onCancel: () => void
	/** 确认选择工具回调 */
	onConfirm: (tools: toolItem[]) => void
}

// 官方工具分类数据
export interface ToolCategory {
	id: string
	name: string
	icon: string
	tools: toolItem[]
}
