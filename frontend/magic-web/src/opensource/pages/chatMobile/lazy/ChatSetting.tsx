import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ChatSettingMobileSkeleton from "./skeleton/ChatSettingMobileSkeleton"

const ChatSettingMobile = lazy(() => import("@/opensource/pages/chatMobile/setting"))

function ChatSetting() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ChatSettingMobileSkeleton />}>
				<ChatSettingMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default ChatSetting
