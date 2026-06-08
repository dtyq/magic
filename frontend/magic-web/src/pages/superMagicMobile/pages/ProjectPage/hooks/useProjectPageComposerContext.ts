import { useMemoizedFn } from "ahooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import superMagicService from "@/pages/superMagic/services"
import TopicService from "@/pages/superMagic/services/topicService"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import { topicNeedsChatDetailRestore } from "./projectPageComposerUtils"

/**
 * Project detail entry composer: create topic with full chat mapping before send,
 * then navigate to topic sub-route only after a successful send.
 */
export function useProjectPageComposerContext() {
	const navigate = useNavigate()

	/** Creates topic via TopicService and backfills chat ids from topic detail when sidebar row is incomplete. */
	const createTopicForProjectSend = useMemoizedFn(
		async ({ selectedProject }: { selectedProject?: ProjectListItem | null }) => {
			if (!selectedProject?.id) return null

			const topicService = new TopicService({ store: topicStore })
			let created = await topicService.createTopic({
				projectId: selectedProject.id,
				topicName: "",
			})
			if (!created?.id) return null

			if (topicNeedsChatDetailRestore(created)) {
				const detail = await superMagicService.topic.getTopicDetail(created.id)
				if (detail?.id) {
					created = detail
					topicStore.setSelectedTopic(detail)
				}
			}

			return created
		},
	)

	/** Marks topic/project running optimistically after a successful send, aligned with ChatPage. */
	const handleSendComplete = useMemoizedFn(
		({
			success,
			currentProject,
			currentTopic,
		}: {
			success: boolean
			currentProject: ProjectListItem | null
			currentTopic: Topic | null
		}) => {
			if (!success) return

			applyOptimisticTopicRunningState({
				topicStore,
				topic: currentTopic ?? topicStore.selectedTopic,
				project: currentProject ?? projectStore.selectedProject,
				workspace: workspaceStore.selectedWorkspace,
			})
		},
	)

	/** Navigates to project topic sub-page after send succeeds so message list uses the same chat ids. */
	const handleSendSuccess = useMemoizedFn(
		({
			currentProject,
			currentTopic,
		}: {
			currentProject: ProjectListItem | null
			currentTopic: Topic | null
		}) => {
			if (!currentProject?.id || !currentTopic?.id) return

			navigate({
				name: RouteName.SuperWorkspaceProjectTopicState,
				params: {
					projectId: currentProject.id,
					topicId: currentTopic.id,
				},
			})
		},
	)

	return {
		createTopicForProjectSend,
		handleSendComplete,
		handleSendSuccess,
	}
}
