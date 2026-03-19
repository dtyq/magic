import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ChatMobileSkeleton from "./skeleton/ChatMobileSkeleton"
import ChatDesktopSkeleton from "./skeleton/ChatDesktopSkeleton"

const ChatPage = lazy(() => import("@/pages/chatNew"))

function Chat() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ChatMobileSkeleton />}>
				<ChatPage />
			</Suspense>
		)
	}

	// Desktop version handled by ChatPage itself with ChatDesktopSkeleton
	return (
		<Suspense fallback={<ChatDesktopSkeleton />}>
			<ChatPage />
		</Suspense>
	)
}

export default Chat
