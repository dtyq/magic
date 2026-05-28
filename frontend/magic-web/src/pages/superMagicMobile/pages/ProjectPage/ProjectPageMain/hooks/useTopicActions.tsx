import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { ActionsPopup } from "../../../../components/ActionsPopup/types"
import { useTranslation } from "react-i18next"
import { useTopicActions } from "../../../../components/HierarchicalWorkspacePopup/hooks"
import { SuperMagicApi } from "@/apis"
import { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { Input } from "@/components/shadcn-ui/input"
import ShareModel from "@/pages/superMagic/components/Share/Modal"
import { ShareType, ResourceType } from "@/pages/superMagic/components/Share/types"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import { buildTopicActionGroups } from "./buildTopicActionGroups"
import { FetchTopicsParams } from "@/pages/superMagic/hooks/useTopics"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import recordSummaryStore from "@/stores/recordingSummary"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { X, Check } from "lucide-react"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"
import { sortTopicsWithPinnedFirst } from "./topicPinSort"
import useNavigate from "@/routes/hooks/useNavigate"
import {
	getMobileTopicPageCapabilities,
	MobileTopicPageKind,
} from "@/pages/superMagicMobile/pages/shared/topicPageCapabilities"
import { applySuperMobileDetailExitNavigation } from "@/pages/superMagicMobile/utils/navigateAfterProjectMove"
import { shouldExitTopicDetailAfterDelete } from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"

interface UseTopicListActionsOptions {
	/** Topic sub-page uses back+fallback; project topics tab keeps in-page topic switching. */
	topicActionContext?: "default" | "topic-detail"
}

/**
 * Use topic list actions hook
 * @returns topic actions
 */
export function useTopicListActions({
	topicActionContext = "default",
}: UseTopicListActionsOptions = {}) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const isTopicDetailActionContext = topicActionContext === "topic-detail"

	// Get data from stores
	const currentTopics = topicStore.topics
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject

	// Store methods
	const setTopics = topicStore.setTopics
	const setSelectedTopic = topicStore.setSelectedTopic

	// Service methods
	const fetchTopics = useMemoizedFn(async (params: FetchTopicsParams) => {
		if (!selectedProject?.id) return
		await SuperMagicService.topic.fetchTopics({
			projectId: params.project?.id || selectedProject.id,
			isAutoSelect: params.isAutoSelect,
			isSelectLast: params.isSelectLast,
			page: params.page,
		})
	})

	const handleCreateTopic = useMemoizedFn(async () => {
		if (!selectedProject) return null
		SuperMagicService.handleCreateTopic({
			selectedProject,
			targetProject: selectedProject,
		})
	})

	const [actionsPopupVisible, { setTrue: _openActionsPopup, setFalse: closeActionsPopup }] =
		useBoolean(false)
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	const [shareModalVisible, setShareModalVisible] = useState(false)
	const [renameModalVisible, setRenameModalVisible] = useState(false)

	const [currentActionItem, updateCurrentActionItem] = useState<{
		topic: Topic | null
		project: ProjectListItem | null
		workspace: Workspace | null
	}>({
		topic: null,
		project: null,
		workspace: null,
	})

	const openActionsPopup = useMemoizedFn(
		(topic: Topic, project: ProjectListItem | null | undefined) => {
			if (!project) return
			updateCurrentActionItem({
				topic,
				project,
				workspace: {
					id: project.workspace_id,
					name: project.workspace_name,
				} as Workspace,
			})
			_openActionsPopup()
		},
	)

	const openShareModal = useMemoizedFn(
		(topic: Topic, project: ProjectListItem | null | undefined) => {
			if (!project) return
			updateCurrentActionItem({
				topic,
				project,
				workspace: {
					id: project.workspace_id,
					name: project.workspace_name,
				} as Workspace,
			})
			setShareModalVisible(true)
		},
	)

	const topicHandlers = useTopicActions({
		currentTopics,
		setTopics: (topicsOrUpdater) => {
			const newTopics =
				typeof topicsOrUpdater === "function"
					? topicsOrUpdater(currentTopics)
					: topicsOrUpdater
			setTopics(newTopics)
		},
		fetchTopics,
		selectedTopic,
		setSelectedTopic,
		setRenameModalVisible,
		setDeleteModalVisible,
		setShareModalVisible,
		selectedProject: selectedProject || undefined,
	})

	const handleDelete = useMemoizedFn(() => {
		if (
			currentActionItem?.topic?.id &&
			recordSummaryStore.isRecordingTopic(currentActionItem?.topic?.id)
		) {
			magicToast.error(t("messageHeader.cannotDeleteCurrentTopicInRecording"))
			closeActionsPopup()
			return
		}
		setDeleteModalVisible(true)
		closeActionsPopup()
	})

	const topicActions = useMemo(() => {
		const actions = [
			{
				key: "rename",
				label: t("hierarchicalWorkspacePopup.rename"),
				onClick: () => {
					setRenameModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
			},
			{
				key: "share",
				label: t("hierarchicalWorkspacePopup.shareTopic"),
				onClick: () => {
					setShareModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
			},
		] as ActionsPopup.ActionButtonConfig[]

		if (currentTopics.length > 1) {
			actions.push({
				key: "delete",
				label: t("hierarchicalWorkspacePopup.deleteTopic"),
				onClick: handleDelete,
				variant: "danger",
			})
		}
		return actions
	}, [closeActionsPopup, currentTopics.length, handleDelete, t])

	const topicActionGroups = useMemo(() => buildTopicActionGroups(topicActions), [topicActions])

	const topicActionPopupTitle = currentActionItem?.topic?.topic_name || t("topic.unnamedTopic")

	const handleDeleteConfirm = useMemoizedFn(async () => {
		const topic = currentActionItem?.topic
		const project = currentActionItem?.project
		if (!topic?.id || !project?.id || !currentActionItem?.workspace?.id) return

		const shouldExitTopicDetailPage = shouldExitTopicDetailAfterDelete({
			deletedTopicId: topic.id,
			selectedTopicId: selectedTopic?.id,
			isTopicDetailActionContext,
		})

		if (shouldExitTopicDetailPage) {
			try {
				const fallback = getMobileTopicPageCapabilities(
					MobileTopicPageKind.ProjectTopic,
				).resolveBackTarget(project.id)
				applySuperMobileDetailExitNavigation({
					navigate,
					fallback,
					clearProjectSelection: false,
					leaveRouteImmediately: true,
				})
				await SuperMagicService.topic.deleteTopic(topic.id)
				magicToast.success(t("hierarchicalWorkspacePopup.deleteSuccess"))
				setDeleteModalVisible(false)
			} catch (error) {
				console.error("删除话题失败:", error)
			}
			return
		}

		topicHandlers.handleDeleteTopic(currentActionItem.workspace.id, topic.id, selectedTopic?.id)
	})

	/**
	 * 左滑直接删除话题：跳过确认弹层，直接调 handleDeleteTopic。
	 * 录音中的话题不允许删除（与操作菜单里的删除行为一致）。
	 */
	const deleteTopicDirect = useMemoizedFn(
		(topic: Topic, project: ProjectListItem | null | undefined) => {
			if (!topic?.id || !project) return

			// 录音中的话题不可删除，给出提示并中止
			if (recordSummaryStore.isRecordingTopic(topic.id)) {
				magicToast.error(t("messageHeader.cannotDeleteCurrentTopicInRecording"))
				return
			}

			topicHandlers.handleDeleteTopic(project.workspace_id, topic.id, selectedTopic?.id)
		},
	)

	/**
	 * 话题置顶切换先以服务端返回为准，再在本地按置顶优先重排，避免 UI 只改标记不改顺序。
	 */
	const toggleTopicPin = useMemoizedFn(async (topic: Topic | null | undefined) => {
		if (!topic?.id) return

		const response = topic.is_pinned
			? await SuperMagicApi.unpinTopic(topic.id)
			: await SuperMagicApi.pinTopic(topic.id)
		const normalizedTopic = normalizeTopicHistoryItem(response.topic)
		const reorderedTopics = sortTopicsWithPinnedFirst(
			topicStore.topics.map((item) =>
				item.id === topic.id ? { ...item, ...normalizedTopic } : item,
			),
		)

		setTopics(reorderedTopics)

		if (topicStore.selectedTopic?.id === topic.id) {
			setSelectedTopic({ ...topicStore.selectedTopic, ...normalizedTopic })
		}
	})

	const handleRename = useMemoizedFn(() => {
		if (currentActionItem?.topic && currentActionItem.workspace && currentActionItem.project) {
			topicHandlers.handleRenameTopic(
				currentActionItem.topic,
				currentActionItem.workspace,
				currentActionItem.project,
			)
		}
	})

	// 处理分享保存
	const handleShareSave = async ({
		type,
		extraData,
	}: {
		type: ShareType
		extraData: unknown
	}) => {
		if (currentActionItem?.topic?.id) {
			await topicHandlers.handleShareTopic({
				type,
				extraData,
				topicId: currentActionItem.topic.id,
			})
		}
	}

	const topicActionComponents = (
		<>
			<ConversationActionsPopup
				visible={actionsPopupVisible}
				title={topicActionPopupTitle}
				subtitle={currentActionItem?.project?.project_name}
				actionGroups={topicActionGroups}
				onClose={closeActionsPopup}
			/>
			<MagicPopup
				visible={renameModalVisible}
				onClose={() => setRenameModalVisible(false)}
				position="bottom"
				title={t("hierarchicalWorkspacePopup.topicRename")}
				headerVariant="actionHeader"
				headerTitle={t("hierarchicalWorkspacePopup.topicRename")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.cancel"),
					onClick: () => setRenameModalVisible(false),
					testId: "topic-rename-popup-close",
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("common.confirm"),
					onClick: () => {
						void handleRename()
					},
					disabled: !currentActionItem?.topic?.topic_name?.trim(),
					tone: "primary",
					testId: "topic-rename-popup-confirm",
				}}
				bodyClassName="max-h-[80dvh] p-0"
				zIndex={1021}
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2">
					<div className="flex flex-col gap-2.5">
						<div className="text-sm font-normal leading-5 text-foreground">
							{t("hierarchicalWorkspacePopup.newName")}
						</div>
						<Input
							className="bg-white"
							placeholder={t("hierarchicalWorkspacePopup.inputTopicName")}
							value={currentActionItem?.topic?.topic_name}
							onChange={(e) => {
								updateCurrentActionItem((pre) => ({
									...pre,
									topic: pre.topic
										? {
												...pre.topic,
												topic_name: e.target.value,
											}
										: null,
								}))
							}}
							autoFocus
						/>
					</div>
				</div>
			</MagicPopup>

			<MagicPopup
				visible={deleteModalVisible}
				onClose={() => setDeleteModalVisible(false)}
				position="bottom"
				headerVariant="actionHeader"
				headerTitle={t("ui.deleteTopicConfirmTitle")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.cancel"),
					onClick: () => setDeleteModalVisible(false),
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("common.confirm"),
					onClick: handleDeleteConfirm,
					tone: "destructive",
				}}
				bodyClassName="max-h-[80dvh] p-0"
				zIndex={1021}
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
					<p className="mx-auto max-w-[680px] text-left text-[16px] leading-6 text-muted-foreground">
						{t("ui.deleteTopicDescription", {
							name: currentActionItem?.topic?.topic_name || t("topic.unnamedTopic"),
						})}
					</p>
				</div>
			</MagicPopup>

			<ShareModel
				open={shareModalVisible}
				types={[ShareType.Public, ShareType.PasswordProtected, ShareType.Organization]}
				shareContext={{
					resource_id: currentActionItem?.topic?.id || "",
					resource_type: ResourceType.Topic,
				}}
				topicTitle={currentActionItem?.topic?.topic_name}
				onCancel={() => setShareModalVisible(false)}
			/>
		</>
	)

	return {
		...topicHandlers,
		handleDeleteConfirm,
		deleteTopicDirect,
		toggleTopicPin,
		handleRename,
		handleShareSave,
		handleCreateTopic,

		topicActions,
		currentActionItem,
		updateCurrentActionItem,
		actionsPopupVisible,
		openActionsPopup,
		closeActionsPopup,

		openShareModal,

		shareModalVisible,
		setShareModalVisible,
		deleteModalVisible,
		setDeleteModalVisible,
		renameModalVisible,
		setRenameModalVisible,

		// Action components
		topicActionComponents,
	}
}
