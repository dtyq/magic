import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import { useTopicListActions } from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { topicStore } from "@/pages/superMagic/stores/core"
import { isCollaborationProject } from "@/pages/superMagic/constants"
import { buildSuperMobileNavigationState } from "@/pages/superMagicMobile/layout/MainLayout/components/MainHeader/backNavigation"
import { resolveSuperMobileProjectDetailBackFallback } from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"

interface UseProjectTopicConversationActionsParams {
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	topics: Topic[]
	onOpenConversationFeedback?: () => void
}

export function useProjectTopicConversationActions({
	selectedProject,
	selectedTopic,
	topics,
	onOpenConversationFeedback,
}: UseProjectTopicConversationActionsParams) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const [actionSheetVisible, { setTrue: showActionSheet, setFalse: hideActionSheet }] =
		useBoolean(false)
	const [filesDrawerOpen, setFilesDrawerOpen] = useState(false)
	const { topicActions, updateCurrentActionItem, topicActionComponents, toggleTopicPin } =
		useTopicListActions({ topicActionContext: "topic-detail" })

	const topicActionMap = useMemo(
		() => new Map(topicActions.map((action) => [action.key, action])),
		[topicActions],
	)

	/**
	 * 打开操作面板前先同步当前话题上下文，确保后续话题弹层标题和提交对象都指向当前话题。
	 */
	const openConversationActionSheet = useMemoizedFn(() => {
		if (!selectedTopic || !selectedProject) return
		syncCurrentTopicActionItem({ selectedTopic, selectedProject, updateCurrentActionItem })
		showActionSheet()
	})

	/**
	 * “查看文件”属于页面级状态：关闭 Action Sheet 后打开当前话题文件弹层。
	 */
	const openFilesDrawerFromSheet = useMemoizedFn(() => {
		hideActionSheet()
		setFilesDrawerOpen(true)
	})

	/**
	 * 执行既有话题动作前重新写入上下文，避免用户在面板打开期间切换话题后误操作旧目标。
	 */
	const runTopicAction = useMemoizedFn((actionKey: "rename" | "share" | "delete") => {
		if (!selectedTopic || !selectedProject) return

		syncCurrentTopicActionItem({ selectedTopic, selectedProject, updateCurrentActionItem })
		hideActionSheet()
		topicActionMap.get(actionKey)?.onClick?.()
	})

	/** Open conversation feedback sheet after closing the action panel. */
	const openConversationFeedbackFromSheet = useMemoizedFn(() => {
		if (!selectedTopic || !selectedProject || !onOpenConversationFeedback) return

		hideActionSheet()
		onOpenConversationFeedback()
	})

	/**
	 * 项目话题子页的置顶只能作用在当前话题本身，不能退化成项目置顶。
	 */
	const toggleConversationTopicPin = useMemoizedFn(async () => {
		if (!selectedTopic) return

		hideActionSheet()
		await toggleTopicPin(selectedTopic)
	})

	/**
	 * Leave the topic conversation and open project entry; back from project detail returns to workspace project list.
	 */
	const openProjectEntryFromSheet = useMemoizedFn(() => {
		if (!selectedProject?.id) return

		const isSharedProjectDetail = isCollaborationProject(selectedProject)
		const returnTo = resolveSuperMobileProjectDetailBackFallback({
			workspaceId: selectedProject.workspace_id,
			isSharedProjectDetail,
		})
		if (!returnTo) return

		hideActionSheet()
		topicStore.setSelectedTopic(null)
		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: { projectId: selectedProject.id },
			state: buildSuperMobileNavigationState(returnTo),
			viewTransition: false,
		})
	})

	const conversationActionGroups = useMemo<ActionGroup[]>(() => {
		const groups: ActionGroup[] = [
			{
				actions: [
					{
						key: "view-files",
						label: t("playbackControl.viewFiles"),
						onClick: openFilesDrawerFromSheet,
					},
				],
			},
			{
				actions: [
					{
						key: "pin-topic",
						label: selectedTopic?.is_pinned
							? t("messageHeader.unpin")
							: t("topic.pinTopic"),
						onClick: () => {
							void toggleConversationTopicPin()
						},
						disabled: !selectedTopic,
					},
					{
						key: "share-topic",
						label:
							topicActionMap.get("share")?.label ||
							t("hierarchicalWorkspacePopup.shareTopic"),
						onClick: () => runTopicAction("share"),
						disabled: !selectedTopic || !selectedProject,
					},
				],
			},
			{
				actions: [
					{
						key: "rename-topic",
						label:
							topicActionMap.get("rename")?.label ||
							t("hierarchicalWorkspacePopup.rename"),
						onClick: () => runTopicAction("rename"),
						disabled: !selectedTopic || !selectedProject,
					},
					{
						key: "enter-project",
						label: t("share.enterProject"),
						onClick: openProjectEntryFromSheet,
						disabled: !selectedProject,
					},
				],
			},
			{
				actions: [
					{
						key: "feedback-conversation",
						label: t("topic.feedbackConversation"),
						onClick: openConversationFeedbackFromSheet,
						disabled: !selectedTopic || !selectedProject || !onOpenConversationFeedback,
					},
				],
			},
		]

		if (topics.length > 1) {
			groups.push({
				actions: [
					{
						key: "delete-topic",
						label:
							topicActionMap.get("delete")?.label ||
							t("hierarchicalWorkspacePopup.deleteTopic"),
						onClick: () => runTopicAction("delete"),
						disabled: !selectedTopic || !selectedProject,
						variant: "danger",
					},
				],
			})
		}

		return groups
	}, [
		onOpenConversationFeedback,
		openConversationFeedbackFromSheet,
		openFilesDrawerFromSheet,
		openProjectEntryFromSheet,
		runTopicAction,
		selectedProject,
		selectedTopic,
		t,
		toggleConversationTopicPin,
		topicActionMap,
		topics.length,
	])

	const conversationActionPopupTitle = useMemo(() => {
		return selectedTopic?.topic_name?.trim() || t("topic.unnamedTopic")
	}, [selectedTopic?.topic_name, t])

	return {
		actionSheetVisible,
		filesDrawerOpen,
		setFilesDrawerOpen,
		openConversationActionSheet,
		closeConversationActionSheet: hideActionSheet,
		conversationActionGroups,
		conversationActionPopupTitle,
		conversationActionPopupSubtitle: selectedProject?.project_name || t("topic.projectTopics"),
		topicActionComponents,
	}
}

/**
 * 把通用话题动作 hook 的当前对象同步为项目话题子页正在查看的话题。
 */
function syncCurrentTopicActionItem({
	selectedTopic,
	selectedProject,
	updateCurrentActionItem,
}: {
	selectedTopic: Topic
	selectedProject: ProjectListItem
	updateCurrentActionItem: Dispatch<
		SetStateAction<{
			topic: Topic | null
			project: ProjectListItem | null
			workspace: Workspace | null
		}>
	>
}) {
	updateCurrentActionItem({
		topic: selectedTopic,
		project: selectedProject,
		workspace: {
			id: selectedProject.workspace_id,
			name: selectedProject.workspace_name,
		} as Workspace,
	})
}
