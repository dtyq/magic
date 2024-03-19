import { useMount } from "ahooks"
import type { TopicModeTabsProps } from "./types"
import { useModeList } from "../../hooks/usePatternTabs"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { GuideTourElementId } from "@/opensource/pages/superMagic/components/LazyGuideTour"
import { useIsMobile } from "@/opensource/hooks/use-mobile"
import TopicModeTabsDesktop from "./TopicModeTabs.desktop"
import TopicModeTabsMobile from "./TopicModeTabs.mobile"

const TopicModeTabs = ({ activeMode, onModeChange }: TopicModeTabsProps) => {
	const { modeList } = useModeList({ includeGeneral: true, includeChat: true })
	const isMobile = useIsMobile()

	useMount(() => {
		pubsub.publish(PubSubEvents.GuideTourElementReady, GuideTourElementId.TopicModeTabs)
	})

	if (isMobile) {
		return (
			<TopicModeTabsMobile
				activeMode={activeMode}
				modeList={modeList}
				onModeChange={onModeChange}
			/>
		)
	}

	return (
		<TopicModeTabsDesktop
			activeMode={activeMode}
			modeList={modeList.filter((tab) => tab?.agent?.category === "frequent")}
			onModeChange={onModeChange}
		/>
	)
}

export default TopicModeTabs
