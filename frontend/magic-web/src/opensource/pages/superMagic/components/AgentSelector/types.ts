export enum AgentToolType {
	buildIn = 1, //内置
	official = 2, //官方
	Custom = 3, //自定义
}

export enum AgentType {
	buildIn = 1, //内置
	Custom = 2, //自定义
	Public = 3, //公开
}

export enum IconType {
	/**  图标 */
	Icon = 1,
	/**  图片 */
	Image = 2,
}

export interface Agent {
	id: string
	name: string
	description: string
	icon: { type: string; color: string; url: string }
	icon_type: IconType
	type?: AgentType
	visibility_config?: {
		users: Array<{
			id: string
			name?: string
			avatar?: string
			avatar_url?: string
			nickname?: string
		}>
		departments: Array<{
			id: string
			name?: string
		}>
		visibility_type: number
	}
}

export interface DragItem {
	type: string
	agent: Agent
	sourceList: "common" | "all"
	index: number
}

export interface DraggableCommonAgentProps {
	agent: Agent
	index: number
	onRemoveFromFavorites: (agentId: string, e: React.MouseEvent) => void
	onMoveAgent: (
		dragIndex: number,
		hoverIndex: number,
		sourceList: "common" | "all",
		targetList: "common" | "all",
	) => void
	onDropFromOtherList: (item: DragItem, targetIndex: number) => void
	onAgentClick: (agent: Agent) => void
}
