import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { observer } from "mobx-react-lite"
import { lazy } from "react"

const TopicPage = lazy(() => import("@/opensource/pages/superMagicMobile/pages/TopicPage"))

interface TopicPopupProps {
	open: boolean
	onClose: () => void
	onHistoryClick?: () => void
}

/**
 * Topic detail popup for mobile
 * Wraps TopicPage component in a fullscreen popup
 */
function TopicPopup({ open, onClose, onHistoryClick }: TopicPopupProps) {
	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			position="bottom"
			className="!pb-0"
			bodyClassName="h-[calc(100vh - var(--safe-area-inset-bottom))] !p-0"
		>
			{/* <Suspense fallback={<MessagePanelSkeleton isMobile />}> */}
			<TopicPage
				onHistoryClick={onHistoryClick}
				className="!h-[calc(100vh-124px-var(--safe-area-inset-bottom))]"
			/>
			{/* </Suspense> */}
		</MagicPopup>
	)
}

export default observer(TopicPopup)
