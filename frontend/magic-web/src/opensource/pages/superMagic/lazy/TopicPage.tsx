import { lazy, Suspense } from "react"
import { useParams } from "react-router"
import { Navigate } from "@/opensource/routes/components/Navigate"
import { RouteName } from "@/opensource/routes/constants"
import TopicPageMobileSkeleton from "./skeleton/TopicPageMobileSkeleton"
import TopicPageDesktopSkeleton from "./skeleton/TopicPageDesktopSkeleton"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

const TopicPageDesktop = lazy(
	() => import("@/opensource/pages/superMagic/pages/TopicPage/index.desktop"),
)
const TopicPageMobile = lazy(() => import("@/opensource/pages/superMagicMobile/pages/TopicPage"))

function TopicPage() {
	const isMobile = useIsMobile()
	const { projectId, topicId } = useParams()

	if (isMobile && topicId && projectId) {
		// Redirect to project page with loading state, topic will be displayed in popup
		return (
			<Navigate name={RouteName.SuperWorkspaceProjectState} params={{ projectId }} replace />
		)
	}

	if (isMobile) {
		return (
			<Suspense fallback={<TopicPageMobileSkeleton />}>
				<TopicPageMobile />
			</Suspense>
		)
	}

	return (
		<Suspense fallback={<TopicPageDesktopSkeleton />}>
			<TopicPageDesktop />
		</Suspense>
	)
}

export default TopicPage
