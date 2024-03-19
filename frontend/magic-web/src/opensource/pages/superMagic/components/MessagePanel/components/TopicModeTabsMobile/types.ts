import type { ReactNode } from "react"
import type { TopicMode } from "../../../../pages/Workspace/types"

export interface TabItem {
	label: string
	value: TopicMode
	icon: ReactNode
}

export interface TopicModeTabsProps {
	/** 模式切换回调 */
	onModeChange: (mode: TopicMode) => void
	/** 是否显示组件 */
	visible: boolean
}
