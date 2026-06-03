import { useMemo, useState } from "react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"
import { useTopicListActions } from "@/pages/superMagicMobile/pages/ProjectPage/ProjectPageMain/hooks"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import {
	MOBILE_CHAT_DETAIL_ACTION_KEYS,
	MOBILE_CHAT_PIN_ENABLED,
} from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"

interface UseChatConversationActionsParams {
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	onOpenConversationFeedback?: () => void
}

/**
 * 将聊天详情页的“查看文件 / 分享 / 项目动作”统一编排成单一底部操作弹层，
 * 同时继续复用已有的项目动作和话题分享实现，避免在 chat detail 再分叉出第二套能力。
 */
export function useChatConversationActions({
	selectedProject,
	selectedTopic,
	onOpenConversationFeedback,
}: UseChatConversationActionsParams) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const [actionSheetVisible, { setTrue: showActionSheet, setFalse: hideActionSheet }] =
		useBoolean(false)
	const [filesDrawerOpen, setFilesDrawerOpen] = useState(false)
	const { projectActions, projectActionComponents, updateCurrentActionItem } =
		useProjectListActions({
			mode: "chat",
			chatActionContext: "detail",
			visibleActionKeys: MOBILE_CHAT_DETAIL_ACTION_KEYS,
		})
	const { openShareModal, topicActionComponents } = useTopicListActions()

	const projectActionMap = useMemo(
		() => new Map(projectActions.map((action) => [action.key, action])),
		[projectActions],
	)

	/**
	 * 打开统一操作面板前先同步当前项目上下文，确保重命名/删除/另存为项目等既有弹层都能拿到目标项目。
	 */
	const openConversationActionSheet = useMemoizedFn(() => {
		if (!selectedProject) return
		updateCurrentActionItem(selectedProject)
		showActionSheet()
	})

	/**
	 * 统一包装既有项目动作：先关闭聊天详情自己的 Action Sheet，再交给已有项目能力继续执行。
	 */
	const runProjectAction = useMemoizedFn(
		(actionKey: "rename" | "saveAsProject" | "delete") => {
			hideActionSheet()
			projectActionMap.get(actionKey)?.onClick?.()
		},
	)

	/**
	 * “查看文件”继续复用 TopicFilesPopup，只是把入口从头部直出按钮收回到统一操作面板。
	 */
	const openFilesDrawerFromSheet = useMemoizedFn(() => {
		hideActionSheet()
		setFilesDrawerOpen(true)
	})

	/** Open conversation feedback sheet after closing the action panel. */
	const openConversationFeedbackFromSheet = useMemoizedFn(() => {
		if (!selectedTopic || !selectedProject || !onOpenConversationFeedback) return

		hideActionSheet()
		onOpenConversationFeedback()
	})

	/** “分享”复用移动端已有话题分享能力。 */
	const openTopicShareFromSheet = useMemoizedFn(() => {
		if (!selectedTopic || !selectedProject) return

		hideActionSheet()
		openShareModal(selectedTopic, selectedProject)
	})

	/** Replace current chat detail with the chats list route. */
	const openChatListFromSheet = useMemoizedFn(() => {
		hideActionSheet()
		navigate({
			name: RouteName.SuperChatsList,
			replace: true,
			viewTransition: false,
		})
	})

	const conversationActionGroups = useMemo<ActionGroup[]>(
		() => [
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
					...(MOBILE_CHAT_PIN_ENABLED
						? [
								{
									key: "pin-chat",
									label:
										projectActionMap.get("pinProject")?.label ||
										t("chat.pinChat"),
									onClick: () => {
										hideActionSheet()
										projectActionMap.get("pinProject")?.onClick?.()
									},
								},
							]
						: []),
					{
						key: "share-topic",
						label: t("share.shareConversation"),
						onClick: openTopicShareFromSheet,
						disabled: !selectedTopic || !selectedProject,
					},
					{
						key: "back-to-chat-list",
						label: t("chat.backToChatList"),
						onClick: openChatListFromSheet,
					},
				],
			},
			{
				actions: [
					{
						key: "rename-chat",
						label: projectActionMap.get("rename")?.label || t("chat.renameChat"),
						onClick: () => runProjectAction("rename"),
					},
					{
						key: "save-as-project",
						label:
							projectActionMap.get("saveAsProject")?.label || t("chat.saveAsProject"),
						onClick: () => runProjectAction("saveAsProject"),
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
			{
				actions: [
					{
						key: "delete-chat",
						label: projectActionMap.get("delete")?.label || t("chat.deleteChat"),
						onClick: () => runProjectAction("delete"),
						variant: "danger",
					},
				],
			},
		],
		[
			onOpenConversationFeedback,
			openChatListFromSheet,
			openConversationFeedbackFromSheet,
			openFilesDrawerFromSheet,
			openTopicShareFromSheet,
			projectActionMap,
			runProjectAction,
			selectedProject,
			selectedTopic,
			t,
		],
	)

	const conversationActionPopupTitle = useMemo(() => {
		return (
			selectedTopic?.topic_name?.trim() ||
			selectedProject?.project_name?.trim() ||
			t("chat.unnamedChat")
		)
	}, [selectedProject?.project_name, selectedTopic?.topic_name, t])

	return {
		actionSheetVisible,
		filesDrawerOpen,
		setFilesDrawerOpen,
		openConversationActionSheet,
		closeConversationActionSheet: hideActionSheet,
		conversationActionGroups,
		conversationActionPopupTitle,
		conversationActionPopupSubtitle: t("chatList.title"),
		projectActionComponents,
		topicActionComponents,
	}
}
