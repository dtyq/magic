import { RouteName } from "@/routes/constants"
import type { MobileTopicPageCapabilities } from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"

interface HandleProjectTopicBackParams {
	projectId?: string
	projectTopicCapabilities: MobileTopicPageCapabilities
	setSelectedTopic: (topic: null) => void
	navigate: (target: {
		name: RouteName
		params?: {
			projectId: string
		}
		viewTransition: false
	}) => void
}

export function handleProjectTopicBackNavigation({
	projectId,
	projectTopicCapabilities,
	setSelectedTopic,
	navigate,
}: HandleProjectTopicBackParams): boolean {
	if (!projectId) {
		return false
	}

	// 返回项目入口页时主动解除当前话题绑定，确保入口页首发走“新建话题”而不是误续聊刚退出的话题。
	setSelectedTopic(null)
	navigate({
		...projectTopicCapabilities.resolveBackTarget(projectId),
		viewTransition: false,
	})

	return true
}
