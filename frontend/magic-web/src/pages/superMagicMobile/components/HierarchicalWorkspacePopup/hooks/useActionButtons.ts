import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type {
	ProjectListItem,
	Workspace,
	Topic,
} from "@/pages/superMagic/pages/Workspace/types"
import { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup"
import {
	isCollaborationProject,
	isOtherCollaborationProject,
	isWorkspaceShortcutProject,
	isCollaborationWorkspace,
} from "@/pages/superMagic/constants"
import { canManageProject } from "@/pages/superMagic/utils/permission"

interface ActionItem {
	type: "workspace" | "topic" | "project"
	workspace?: Workspace
	topic?: Topic
	project?: ProjectListItem
}

interface UseActionButtonsParams {
	currentActionItem: ActionItem | null
	setRenameModalVisible: (visible: boolean) => void
	setDeleteModalVisible: (visible: boolean) => void
	closeActionsPopup: () => void
	handleDeleteConfirm: () => void
	handlePinProject: (project?: ProjectListItem) => void
	handleCopyCollaborationLink: (project?: ProjectListItem) => void
	openManageModal: () => void
	onAddWorkspaceShortcut?: (project: ProjectListItem) => void
	shortcutNavigateToWorkspace: (project: ProjectListItem) => void
	cancelWorkspaceShortcut: (project: ProjectListItem) => void
	currentProjects?: ProjectListItem[]
	currentWorkspace?: Workspace
}

export function useActionButtons({
	currentActionItem,
	setRenameModalVisible,
	setDeleteModalVisible,
	closeActionsPopup,
	handleDeleteConfirm,
	handlePinProject,
	handleCopyCollaborationLink,
	openManageModal,
	onAddWorkspaceShortcut,
	shortcutNavigateToWorkspace,
	cancelWorkspaceShortcut,
	currentProjects,
	currentWorkspace,
}: UseActionButtonsParams) {
	const { t } = useTranslation("super")

	const inCollaborationPanel = isCollaborationWorkspace(currentWorkspace)

	const actionButtonList = useMemo(() => {
		if (!currentActionItem) return []

		if (currentActionItem.type === "workspace") {
			return [
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
					key: "delete",
					label: t("hierarchicalWorkspacePopup.deleteWorkspace"),
					onClick: () => {
						handleDeleteConfirm()
						closeActionsPopup()
					},
					variant: "danger",
				},
			] as ActionsPopup.ActionButtonConfig[]
		} else if (currentActionItem.type === "project") {
			const isOtherCollaborationProjectStatus = isOtherCollaborationProject(
				currentActionItem.project,
			)

			const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(
				currentActionItem.project,
			)

			const isCollaborationProjectStatus = isCollaborationProject(currentActionItem.project)

			const allActions = [
				{
					key: "pinProject",
					label: currentActionItem.project?.is_pinned
						? t("hierarchicalWorkspacePopup.unpinProject")
						: t("hierarchicalWorkspacePopup.pinProject"),
					onClick: () => {
						handlePinProject(currentActionItem.project)
						closeActionsPopup()
					},
					variant: "default",
					visible: true,
				},
				{
					key: "copyCollaborationLink",
					label: t("hierarchicalWorkspacePopup.copyCollaborationLink"),
					onClick: () => {
						handleCopyCollaborationLink(currentActionItem.project)
						closeActionsPopup()
					},
					variant: "default",
					visible: isCollaborationProjectStatus,
				},
				{
					key: "setCollaborators",
					label: t("hierarchicalWorkspacePopup.setCollaborators"),
					onClick: () => {
						openManageModal()
						closeActionsPopup()
					},
					variant: "default",
					visible: canManageProject(currentActionItem.project?.user_role),
				},
				{
					key: "addWorkspaceShortcut",
					label: t("project.addWorkspaceShortcut"),
					onClick: () => {
						if (currentActionItem.project) {
							onAddWorkspaceShortcut?.(currentActionItem.project)
						}
						closeActionsPopup()
					},
					variant: "default",
					visible:
						isOtherCollaborationProject(currentActionItem.project) &&
						!currentActionItem.project?.is_bind_workspace &&
						!!onAddWorkspaceShortcut,
				},
				{
					key: "shortcutNavigateToWorkspace",
					label: t("project.shortcutNavigateToWorkspace"),
					onClick: () => {
						if (currentActionItem.project) {
							shortcutNavigateToWorkspace(currentActionItem.project)
						}
					},
					variant: "default",
					visible:
						isWorkspaceShortcutProjectStatus &&
						(inCollaborationPanel
							? currentActionItem.project?.bind_workspace_id &&
							currentActionItem.project?.bind_workspace_id !== "0"
							: false),
				},
				{
					key: "rename",
					label: t("hierarchicalWorkspacePopup.rename"),
					onClick: () => {
						setRenameModalVisible(true)
						closeActionsPopup()
					},
					variant: "default",
					visible:
						!isWorkspaceShortcutProjectStatus && !isOtherCollaborationProjectStatus,
				},
				{
					key: "cancelWorkspaceShortcut",
					label: t("project.cancelWorkspaceShortcut"),
					onClick: () => {
						if (currentActionItem.project) {
							cancelWorkspaceShortcut(currentActionItem.project)
						}
						closeActionsPopup()
					},
					variant: "danger",
					visible:
						isWorkspaceShortcutProjectStatus &&
						(inCollaborationPanel
							? currentActionItem.project?.bind_workspace_id &&
							currentActionItem.project?.bind_workspace_id !== "0"
							: true),
				},
				{
					key: "delete",
					label: t("hierarchicalWorkspacePopup.deleteProject"),
					onClick: () => {
						setDeleteModalVisible(true)
						closeActionsPopup()
					},
					variant: "danger",
					visible:
						!isWorkspaceShortcutProjectStatus &&
						currentProjects != null &&
						currentProjects.length > 1,
				},
			] as (ActionsPopup.ActionButtonConfig & { visible: boolean })[]

			return allActions
				.filter((action) => action.visible)
				.map((action) => {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { visible, ...actionWithoutVisible } = action
					return actionWithoutVisible
				})
		} else {
			return []
		}
	}, [
		currentActionItem,
		t,
		setRenameModalVisible,
		closeActionsPopup,
		handleDeleteConfirm,
		onAddWorkspaceShortcut,
		inCollaborationPanel,
		currentProjects,
		handlePinProject,
		handleCopyCollaborationLink,
		openManageModal,
		shortcutNavigateToWorkspace,
		cancelWorkspaceShortcut,
		setDeleteModalVisible,
	])

	return actionButtonList
}
