import { lazy, Suspense } from "react"
import { useParams } from "react-router"
import Navigate from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import { useIsMobile } from "@/hooks/useIsMobile"
import ChatProjectPageMobileSkeleton from "./skeleton/ChatProjectPageMobileSkeleton"

const ChatProjectPageMobile = lazy(() => import("@/pages/superMagicMobile/pages/ChatProjectPage"))

function ChatProjectPage() {
	const isMobile = useIsMobile()
	const { projectId } = useParams()

	if (!isMobile && projectId) {
		return (
			<Navigate name={RouteName.SuperWorkspaceProjectState} params={{ projectId }} replace />
		)
	}

	return (
		<Suspense fallback={<ChatProjectPageMobileSkeleton />}>
			<ChatProjectPageMobile />
		</Suspense>
	)
}

export default ChatProjectPage
