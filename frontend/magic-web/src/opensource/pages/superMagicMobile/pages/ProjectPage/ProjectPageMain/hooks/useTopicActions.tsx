import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { ActionsPopup } from "../../../../components/ActionsPopup/types"
import { useTranslation } from "react-i18next"
import { useTopicActions } from "../../../../components/HierarchicalWorkspacePopup/hooks"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import MagicModal from "@/opensource/components/base/MagicModal"
import { Input } from "@/opensource/components/shadcn-ui/input"
import ShareModel from "@/opensource/pages/superMagic/components/Share/Modal"
import { ShareType, ResourceType } from "@/opensource/pages/superMagic/components/Share/types"
import ActionsPopupComponent from "../../../../components/ActionsPopup"
import { FetchTopicsParams } from "@/opensource/pages/superMagic/hooks/useTopics"
import { workspaceStore, projectStore, topicStore } from "@/opensource/pages/superMagic/stores/core"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

/**
 * Use topic list actions hook
 * @param _ empty params
 * @returns topic actions
 */
export function useTopicListActions() {
	const { t } = useTranslation("super")

	// Get data from stores
	const currentTopics = topicStore.topics
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace

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
		if (!selectedProject || !selectedWorkspace) return null
		SuperMagicService.handleCreateTopic({
			selectedWorkspace,
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

	const handleDeleteConfirm = useMemoizedFn(() => {
		if (!currentActionItem?.topic?.id || !currentActionItem?.workspace?.id) return
		topicHandlers.handleDeleteTopic(
			currentActionItem.workspace.id,
			currentActionItem.topic.id,
			selectedTopic?.id,
		)
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
			<ActionsPopupComponent
				title={currentActionItem?.topic?.topic_name || t("topic.unnamedTopic")}
				visible={actionsPopupVisible}
				onClose={closeActionsPopup}
				actions={topicActions}
			/>
			<MagicModal
				title={t("hierarchicalWorkspacePopup.topicRename")}
				onCancel={() => setRenameModalVisible(false)}
				onOk={handleRename}
				open={renameModalVisible}
				zIndex={1021}
				centered
			>
				<Input
					placeholder={t("hierarchicalWorkspacePopup.inputTopicName")}
					value={currentActionItem?.topic?.topic_name}
					onChange={(val) => {
						updateCurrentActionItem((pre) => ({
							...pre,
							topic: pre.topic
								? {
										...pre.topic,
										topic_name: val.target.value,
									}
								: null,
						}))
					}}
					autoFocus
				/>
			</MagicModal>

			<MagicModal
				title={t("hierarchicalWorkspacePopup.deleteTopic")}
				onCancel={() => setDeleteModalVisible(false)}
				onOk={handleDeleteConfirm}
				open={deleteModalVisible}
				okButtonProps={{ danger: true }}
				zIndex={1021}
				centered
			>
				<div className="mb-4 px-4">
					{t("ui.deleteTopicConfirm", {
						name: currentActionItem?.topic?.topic_name || t("topic.unnamedTopic"),
					})}
				</div>
			</MagicModal>

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
