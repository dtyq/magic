import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ChatConversationMobileSkeleton from "./skeleton/ChatConversationMobileSkeleton"

const ChatConversationMobile = lazy(() => import("@/opensource/pages/chatMobile/current"))

function ChatConversation() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ChatConversationMobileSkeleton />}>
				<ChatConversationMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default ChatConversation
