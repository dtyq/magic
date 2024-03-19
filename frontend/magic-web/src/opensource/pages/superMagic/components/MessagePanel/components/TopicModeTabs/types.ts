import type { ReactNode } from "react"
import type { ModeItem, TopicMode } from "../../../../pages/Workspace/types"

export interface TabItem {
	label: string
	value: TopicMode
	icon: ReactNode
	data: ModeItem
}

export interface TopicModeTabsProps {
	/** 当前选中的模式 */
	activeMode: TopicMode
	/** 模式切换回调 */
	onModeChange: (mode: TopicMode) => void
}
