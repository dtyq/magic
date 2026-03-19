import { useState, useCallback } from "react"
import type {
	Workspace,
	ProjectListItem,
	Topic,
} from "@/pages/superMagic/pages/Workspace/types"

interface ActionItem {
	type: "workspace" | "topic" | "project"
	workspace?: Workspace
	topic?: Topic
	project?: ProjectListItem
}

export function useModalStates() {
	const [visible, setVisible] = useState(false)
	const [actionsPopupVisible, setActionsPopupVisible] = useState(false)
	const [currentActionItem, setCurrentActionItem] = useState<ActionItem | null>(null)
	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	const [shareModalVisible, setShareModalVisible] = useState(false)

	// 处理工作区操作按钮点击
	const handleWorkspaceActionClick = useCallback((workspace: Workspace) => {
		setCurrentActionItem({ type: "workspace", workspace })
		setActionsPopupVisible(true)
	}, [])

	// 处理项目操作按钮点击
	const handleProjectActionClick = useCallback(
		(project: ProjectListItem, workspace?: Workspace) => {
			setCurrentActionItem({
				workspace,
				type: "project",
				project,
			})
			setActionsPopupVisible(true)
		},
		[],
	)

	// 处理话题操作按钮点击
	const handleTopicActionClick = useCallback(
		(topic: Topic, workspace?: Workspace, project?: ProjectListItem) => {
			setCurrentActionItem({
				workspace,
				project,
				type: "topic",
				topic,
			})
			setActionsPopupVisible(true)
		},
		[],
	)

	// 关闭操作弹窗
	const closeActionsPopup = useCallback(() => {
		setActionsPopupVisible(false)
		// setCurrentActionItem(null)
	}, [])

	// 更新当前操作项
	const updateCurrentActionItem = useCallback(
		(updater: (prev: ActionItem | null) => ActionItem | null) => {
			setCurrentActionItem(updater)
		},
		[],
	)

	// 显示主弹窗
	const showPopup = useCallback(() => {
		setVisible(true)
	}, [])

	// 关闭主弹窗
	const closePopup = useCallback(() => {
		setVisible(false)
	}, [])

	return {
		// 状态
		visible,
		actionsPopupVisible,
		currentActionItem,
		renameModalVisible,
		deleteModalVisible,
		shareModalVisible,

		// 状态设置器
		setVisible,
		setActionsPopupVisible,
		setCurrentActionItem,
		setRenameModalVisible,
		setDeleteModalVisible,
		setShareModalVisible,

		// 处理函数
		handleWorkspaceActionClick,
		handleProjectActionClick,
		handleTopicActionClick,
		closeActionsPopup,
		updateCurrentActionItem,
		showPopup,
		closePopup,
	}
}
