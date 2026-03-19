import { lazy, Suspense, useEffect, useState } from "react"
import { useUserInfo } from "@/models/user/hooks"
import { WorkspacePage } from "@/pages/superMagic/layouts/MainLayout/types"
import { checkIfGuideTourNeeded, GuideTourElementId } from "./GuideTourManager"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useParams } from "react-router"

// 懒加载引导组件
const LazyGuideTour = lazy(() => import("./LazyGuideTour"))

interface GuideTourWrapperProps {
	isMobile: boolean
}

/**
 * 引导教程包装器
 * 在组件级别进行条件渲染，避免不必要的组件加载
 */
function GuideTourWrapper({ isMobile }: GuideTourWrapperProps) {
	const { userInfo } = useUserInfo()
	const { projectId, topicId } = useParams()
	const workspacePage = topicId && projectId ? WorkspacePage.Chat : WorkspacePage.Home

	const [guideTourElementRefreshCount, setGuideTourElementRefreshCount] = useState(0)

	// 只有在需要引导时才初始化的状态
	const [workspaceGuideTourElementReady, setWorkspaceGuideTourElementReady] = useState<
		Record<string, boolean>
	>({
		[GuideTourElementId.Init]: false,
		[GuideTourElementId.TopicModeTabs]: false,
		[GuideTourElementId.ModelSelector]: false,
		[GuideTourElementId.MCPButton]: false,
	})
	const [projectGuideTourElementReady, setProjectGuideTourElementReady] = useState<
		Record<string, boolean>
	>({
		[GuideTourElementId.ProjectFileSider]: false,
		[GuideTourElementId.MessageHeaderTopicGroup]: false,
	})

	// 提前检查是否需要引导，避免不必要的组件加载
	const { needsGuide, guideType } = checkIfGuideTourNeeded(
		userInfo?.magic_id,
		workspacePage,
		isMobile,
	)

	// 监听元素准备状态
	useEffect(() => {
		const handleElementReady = (element: string) => {
			if (element in workspaceGuideTourElementReady) {
				setWorkspaceGuideTourElementReady((prev) => ({
					...prev,
					[element]: true,
				}))
				setGuideTourElementRefreshCount((prev) => prev + 1)
			} else if (element in projectGuideTourElementReady) {
				setProjectGuideTourElementReady((prev) => ({
					...prev,
					[element]: true,
				}))
				setGuideTourElementRefreshCount((prev) => prev + 1)
			}
		}

		pubsub.subscribe(PubSubEvents.GuideTourElementReady, handleElementReady)

		return () => {
			pubsub.unsubscribe(PubSubEvents.GuideTourElementReady, handleElementReady)
		}
	}, [])

	// 如果不需要引导，直接返回 null，避免加载任何相关组件
	if (!needsGuide) {
		return null
	}

	// 只有在需要引导时才加载引导组件
	return (
		<Suspense fallback={null}>
			<LazyGuideTour
				guideType={guideType}
				workspaceGuideTourElementReady={workspaceGuideTourElementReady}
				projectGuideTourElementReady={projectGuideTourElementReady}
				guideTourElementRefreshCount={guideTourElementRefreshCount}
			/>
		</Suspense>
	)
}

export default GuideTourWrapper
export { GuideTourElementId, setNeedGuideTour } from "./GuideTourManager"
