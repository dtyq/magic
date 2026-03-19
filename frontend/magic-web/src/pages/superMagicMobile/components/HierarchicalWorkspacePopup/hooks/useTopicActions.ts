import { useCallback, SetStateAction, Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import pubsub from "@/utils/pubsub"
import type {
	Topic,
	Workspace,
	ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { ResourceType, ShareType } from "@/pages/superMagic/components/Share/types"
import { handleShareFunction } from "@/pages/superMagic/utils/share"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { FetchTopicsParams } from "@/pages/superMagic/hooks/useTopics"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseTopicActionsParams {
	currentTopics?: Topic[]
	setTopics: Dispatch<SetStateAction<Topic[]>>
	fetchTopics: (params: FetchTopicsParams) => void
	setSelectedTopic?: (topic: Topic) => void
	setRenameModalVisible: (visible: boolean) => void
	setDeleteModalVisible: (visible: boolean) => void
	setShareModalVisible: (visible: boolean) => void
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem
}

export function useTopicActions({
	currentTopics: topics,
	setTopics,
	fetchTopics,
	setSelectedTopic,
	setRenameModalVisible,
	setDeleteModalVisible,
	setShareModalVisible,
	selectedTopic,
	selectedProject,
}: UseTopicActionsParams) {
	const { t } = useTranslation("super")
	// const [topics, setTopics] = useState<Topic[]>(currentTopics || [])

	// useUpdateEffect(() => {
	// 	setTopics(currentTopics || [])
	// }, [currentTopics])

	const handleRenameTopic = useMemoizedFn(
		(topic: Topic, workspace: Workspace, project: ProjectListItem) => {
			if (!topic || !workspace || !project) {
				magicToast.error(t("hierarchicalWorkspacePopup.topicNameRequired"))
				return
			}

			SuperMagicApi.editTopic({
				id: topic?.id,
				topic_name: topic?.topic_name,
				// workspace_id: workspace?.id,
				project_id: project?.id || "",
			})
				.then(() => {
					magicToast.success(t("hierarchicalWorkspacePopup.renameSuccess"))
					setRenameModalVisible(false)
					setTopics((prevTopics) => {
						return prevTopics.map((prevTopic) => {
							if (prevTopic.id === topic?.id) {
								return topic
							}
							return prevTopic
						})
					})
					if (selectedTopic?.id === topic?.id) {
						setSelectedTopic?.(topic)
					}
				})
				.catch((err) => {
					magicToast.error(t("hierarchicalWorkspacePopup.renameFailed"))
					console.error("重命名话题失败:", err)
				})
		},
	)

	const handleDeleteTopic = useCallback(
		(workspaceId: string, threadId: string, currentTopicId?: string) => {
			SuperMagicApi.deleteTopic({
				id: threadId,
				// workspace_id: workspaceId
			})
				.then(() => {
					// 只有在删除的是当前选中的话题时，才自动选中第一个话题
					const newTopicList = topics?.filter((topic: any) => topic.id !== threadId)
					if (threadId === currentTopicId && setSelectedTopic) {
						if (newTopicList && newTopicList.length > 0) {
							setSelectedTopic(newTopicList?.[0] || null)
							routeManageService.navigateToState({
								topicId: newTopicList?.[0]?.id || null,
							})
						} else {
							// 当工作区没有剩余话题时，将选中的话题设置为null
							setSelectedTopic(null as any)
							routeManageService.navigateToState({
								topicId: null,
							})
						}
					}
					magicToast.success(t("hierarchicalWorkspacePopup.deleteSuccess"))
					setTopics((prevTopics) => {
						return prevTopics.filter((topic) => topic.id !== threadId)
					})
					setDeleteModalVisible(false)
				})
				.catch((err) => {
					console.log(err, "err")
				})
		},
		[setSelectedTopic, t, topics, setDeleteModalVisible],
	)

	const handleAddTopic = useMemoizedFn(async (workspace: string, projectId: string) => {
		const loadingMessage = magicToast.loading({ content: "处理中...", duration: 0 })
		try {
			const defaultTopicName = ""
			const res = await SuperMagicApi.createTopic({
				topic_name: defaultTopicName,
				// workspace_id: workspace,
				project_id: projectId,
			})
			const topicsResponse = (await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})) as { list: Topic[] }
			const newTopic = topicsResponse?.list.find((topic) => topic?.id === res?.id)
			if (setSelectedTopic && newTopic) {
				setSelectedTopic(newTopic)
				routeManageService.navigateToState({
					topicId: newTopic?.id || null,
				})
			}

			if (newTopic) {
				setTopics((prevTopics) => [...prevTopics, newTopic])
				if (selectedProject?.id === projectId) {
					pubsub.publish("super_magic_add_topic", newTopic)
				}
			}

			return newTopic
		} catch (error) {
			console.error(error)
			return undefined
		} finally {
			magicToast.destroy(loadingMessage)
		}
	})

	const handleTopicClick = useCallback(
		(
			topic: Topic,
			workspace: Workspace,
			project: ProjectListItem,
			setSelectedWorkspace?: (workspace: Workspace) => void,
			setSelectedProject?: (project: ProjectListItem) => void,
			onClose?: () => void,
		) => {
			if (workspace && project && setSelectedTopic) {
				setSelectedWorkspace?.(workspace)
				setSelectedProject?.(project)
				setSelectedTopic(topic)
				routeManageService.navigateToState({
					workspaceId: workspace?.id,
					projectId: project?.id,
					topicId: topic?.id,
				})
				onClose?.()
			}
		},
		[setSelectedTopic],
	)

	const handleShareTopic = useCallback(
		async ({
			type,
			extraData,
			topicId,
		}: {
			type: ShareType
			extraData: any
			topicId: string
		}) => {
			if (!topicId) return

			handleShareFunction({
				type,
				extraData,
				topicId,
				resourceType: ResourceType.Topic,
			})
		},
		[],
	)

	return {
		topics,
		setTopics,
		handleRenameTopic,
		handleDeleteTopic,
		handleAddTopic,
		handleTopicClick,
		handleShareTopic,
	}
}
