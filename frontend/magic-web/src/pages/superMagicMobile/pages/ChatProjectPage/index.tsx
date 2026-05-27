import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useParams } from "react-router"
import { ChatProjectDetailLayout } from "@/pages/superMagicMobile/pages/ProjectPage/chat-mode/ChatProjectDetailLayout"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import { shouldRefreshChatProjectState } from "@/pages/superMagic/services/topicProjectConsistency"

/**
 * 对话详情路由容器负责从 URL 恢复项目状态，避免直接进入 `/super/chat/:projectId`
 * 时子组件拿不到 `selectedProject` 而无法打开项目操作菜单。
 */
function ChatProjectPage() {
	const { projectId, topicId } = useParams()
	const selectedProjectId = projectStore.selectedProject?.id
	const selectedWorkspaceId = workspaceStore.selectedWorkspace?.id
	const selectedTopic = topicStore.selectedTopic

	useEffect(() => {
		if (
			!shouldRefreshChatProjectState({
				projectId,
				routeTopicId: topicId,
				selectedProjectId,
				selectedWorkspaceId,
				selectedTopic,
				loadedProjects: projectStore.projects,
			})
		) {
			return
		}

		// `/super/chat/:projectId/:topicId?` 允许把当前话题显式写入 URL；
		// 刷新时优先按 URL 还原项目和话题，避免仅凭 project 推导出错误或半恢复的话题。
		void SuperMagicService.refreshState({ projectId, topicId })
	}, [projectId, topicId, selectedProjectId, selectedWorkspaceId, selectedTopic])

	return <ChatProjectDetailLayout />
}

export default observer(ChatProjectPage)
