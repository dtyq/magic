import { memo } from "react"
import { TopicMode, type ModeItem } from "../../../../../../pages/Workspace/types"
import TopicModeTabDesktop from "./TopicModeTab.desktop"
import TopicModeTabMobile from "./TopicModeTab.mobile"
import { useIsMobile } from "@/hooks/useIsMobile"

interface TopicModeTabProps {
	tab: ModeItem
	isActive: boolean
	onModeChange: (topicMode: TopicMode) => void
}

function TopicModeTab({ tab, isActive, onModeChange }: TopicModeTabProps) {
	const isMobile = useIsMobile()
	const TabComponent = isMobile ? TopicModeTabMobile : TopicModeTabDesktop

	return <TabComponent tab={tab} isActive={isActive} onModeChange={onModeChange} />
}

export default memo(TopicModeTab)
