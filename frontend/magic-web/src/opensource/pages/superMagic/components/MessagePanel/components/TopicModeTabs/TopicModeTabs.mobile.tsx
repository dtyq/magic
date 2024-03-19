import { useMemoizedFn } from "ahooks"
import { type ModeItem, TopicMode } from "../../../../pages/Workspace/types"
import TopicModeTab from "./components/TopicModeTab"
import { GuideTourElementId } from "@/opensource/pages/superMagic/components/LazyGuideTour"

interface TopicModeTabsMobileProps {
	activeMode: string
	modeList: ModeItem[]
	onModeChange: (mode: TopicMode) => void
}

function TopicModeTabsMobile({ activeMode, modeList, onModeChange }: TopicModeTabsMobileProps) {
	// Handle mode change
	const handleModeChange = useMemoizedFn((mode: TopicMode) => {
		onModeChange(mode)
	})

	return (
		<div
			className="mb-3 flex min-h-[36px] max-w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pl-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			data-testid="topic-mode-tabs"
			id={GuideTourElementId.TopicModeTabs}
		>
			{/* Display all tabs in mobile */}
			{modeList.map((tab: ModeItem) => {
				// 移动端不显示聊天模式
				if (tab?.mode.identifier === TopicMode.Chat) {
					return null
				}
				return (
					<TopicModeTab
						key={tab.mode.identifier}
						tab={tab}
						isActive={activeMode === tab.mode.identifier}
						onModeChange={handleModeChange}
					/>
				)
			})}
		</div>
	)
}

export default TopicModeTabsMobile
