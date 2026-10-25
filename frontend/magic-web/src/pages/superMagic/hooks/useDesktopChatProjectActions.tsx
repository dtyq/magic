import {
	canDeleteRecordingProjects,
	handleRecordingProjectDeletionError,
} from "@/services/recordSummary/projectDeletionRecordingNotice"
import { lazy, Suspense, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import { isOtherCollaborationProject, SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { ChatProjectRenameDialog } from "@/pages/superMagic/pages/ChatProjectPage/components/ChatProjectRenameDialog"
import { loadDeleteDangerModal } from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/projectActionModals"

const DeleteDangerModal = lazy(loadDeleteDangerModal)
const ChatSaveAsProjectModal = lazy(
	() => import("@/pages/superMagic/pages/ChatProjectPage/components/ChatSaveAsProjectModal"),
)

export type DesktopChatProjectActionKey = "pinProject" | "rename" | "saveAsProject" | "delete"

interface DesktopChatProjectAction {
	key: DesktopChatProjectActionKey
	label: string
	onClick: () => void
	variant?: "default" | "danger"
}

interface UseDesktopChatProjectActionsOptions {
	onProjectChanged?: () => Promise<void> | void
	/** Lets list-style callers mirror pin state locally before the server refresh result replaces the order. */
	onProjectPinStateChanged?: (projectId: string, isPinned: boolean) => void
	/** Detail header needs topic sync on rename and home navigation after destructive actions. */
	actionContext?: "list" | "detail"
	selectedTopic?: Topic | null
}

/**
 * Desktop chat project actions backed by PC dialogs instead of mobile bottom sheets.
 */
export function useDesktopChatProjectActions({
	onProjectChanged,
	onProjectPinStateChanged,
	actionContext = "list",
	selectedTopic,
}: UseDesktopChatProjectActionsOptions = {}) {
	const { t } = useTranslation("super")
	const [currentActionItem, setCurrentActionItem] = useState<ProjectListItem | null>(null)
	const [renameDialogOpen, setRenameDialogOpen] = useState(false)
	const [saveAsModalOpen, setSaveAsModalOpen] = useState(false)
	const [deleteModalOpen, setDeleteModalOpen] = useState(false)
	const [isSaveAsSubmitting, setIsSaveAsSubmitting] = useState(false)

	/** Keep popup actions aligned with the row/header project that initiated the menu. */
	const updateCurrentActionItem = useMemoizedFn((project: ProjectListItem | null) => {
		setCurrentActionItem(project)
	})

	/**
	 * Detail actions should always reflect the globally selected project, while list actions
	 * continue using the row-scoped project that opened the menu.
	 */
	const resolveTargetProject = useMemoizedFn(() => {
		if (actionContext === "detail") {
			return projectStore.selectedProject ?? currentActionItem ?? null
		}

		return currentActionItem ?? projectStore.selectedProject ?? null
	})

	const openRenameDialog = useMemoizedFn(() => {
		setRenameDialogOpen(true)
	})

	const openSaveAsModal = useMemoizedFn(() => {
		setSaveAsModalOpen(true)
	})

	const openDeleteConfirm = useMemoizedFn(() => {
		setDeleteModalOpen(true)
	})

	/**
	 * Refresh the target workspace cache after save-as so sidebar workspace lists stay in sync
	 * even when the destination workspace is not the currently selected one.
	 */
	const refreshTargetWorkspaceProjects = useMemoizedFn(async (workspaceId: string) => {
		if (!workspaceId || workspaceId === SHARE_WORKSPACE_ID) return

		await projectStore.loadProjectsForWorkspace(workspaceId, true, true)
	})

	const handlePinProject = useMemoizedFn(async () => {
		const targetProject = resolveTargetProject()
		if (!targetProject?.id) return

		const nextPinnedState = !targetProject.is_pinned

		try {
			await SuperMagicService.project.pinProject(targetProject, nextPinnedState)

			if (projectStore.selectedProject?.id === targetProject.id) {
				projectStore.updateProject({
					...projectStore.selectedProject,
					is_pinned: nextPinnedState,
				})
			}
			// Keep the menu's own action context in sync so reopening the detail menu
			// immediately after pin/unpin shows the next correct label.
			setCurrentActionItem((previousProject) => {
				if (!previousProject || previousProject.id !== targetProject.id) {
					return previousProject
				}

				return {
					...previousProject,
					is_pinned: nextPinnedState,
				}
			})

			onProjectPinStateChanged?.(targetProject.id, nextPinnedState)
			await onProjectChanged?.()
			magicToast.success(t(nextPinnedState ? "chat.pinChatSuccess" : "chat.unpinChatSuccess"))
		} catch (error) {
			console.log("Failed to pin chat project:", error)
			magicToast.error(t(nextPinnedState ? "chat.pinChatFailed" : "chat.unpinChatFailed"))
		}
	})

	/** Delete the targeted chat and return home when the active conversation was removed. */
	const handleDeleteProject = useMemoizedFn(async () => {
		const targetProject = resolveTargetProject()
		if (!targetProject?.id) return

		if (!canDeleteRecordingProjects([targetProject.id])) return
		const deletedProject = targetProject
		const isDeletingSelectedProject = projectStore.selectedProject?.id === deletedProject.id
		const fallbackWorkspaceId = workspaceStore.workspaces.find(
			(workspace) =>
				workspace.id !== SHARE_WORKSPACE_ID && workspace.workspace_type !== "chat",
		)?.id

		try {
			await SuperMagicService.deleteProject(deletedProject, {
				selectedProjectBehavior: isDeletingSelectedProject
					? "navigate-home"
					: "switch-next",
				// Current chat projects live in the hidden chat workspace; return to the same first workspace as Home.
				lastUsedWorkspaceId: isDeletingSelectedProject
					? fallbackWorkspaceId
					: deletedProject.workspace_id,
			})
			magicToast.success(t("chat.deleteChatSuccess"))
			await onProjectChanged?.()
			setDeleteModalOpen(false)
			setCurrentActionItem(null)
		} catch (error) {
			if (handleRecordingProjectDeletionError(error)) return
			console.error("Failed to delete chat project:", error)
			magicToast.error(t("chat.deleteChatFailed"))
		}
	})

	/** Move chat into a workspace as a standalone project, then leave detail when needed. */
	const handleSaveAsProject = useMemoizedFn(
		async ({ workspaceId, projectName }: { workspaceId: string; projectName: string }) => {
			const targetProject = resolveTargetProject()
			if (!targetProject?.id || isSaveAsSubmitting) return

			const movedProject = targetProject
			const sourceWorkspaceId = movedProject.workspace_id
			if (!sourceWorkspaceId) return

			// Sidebar list actions should also leave chat detail when they move the visible chat away.
			const isCurrentChatProject = projectStore.selectedProject?.id === movedProject.id
			const shouldLeaveChatDetail =
				isCurrentChatProject &&
				(actionContext === "detail" ||
					(actionContext === "list" &&
						SuperMagicService.route.isCurrentChatProjectRoute()))

			setIsSaveAsSubmitting(true)
			try {
				await SuperMagicService.project.moveProject({
					projectId: movedProject.id,
					targetWorkspaceId: workspaceId,
					sourceWorkspaceId: isOtherCollaborationProject(movedProject)
						? SHARE_WORKSPACE_ID
						: sourceWorkspaceId,
					targetProjectName: projectName,
				})
				await refreshTargetWorkspaceProjects(workspaceId)

				if (shouldLeaveChatDetail) {
					const targetProject = await SuperMagicService.project
						.getProjectDetail(movedProject.id, {
							enableErrorMessagePrompt: false,
						})
						.catch(() => null)

					// The move API keeps the project id; refresh detail so the next page uses the target workspace.
					await SuperMagicService.switchProjectInDesktop(
						targetProject ?? {
							...movedProject,
							project_name: projectName,
							workspace_id: workspaceId,
						},
					)
				}

				magicToast.success(t("chat.saveAsProjectSuccess"))
				await onProjectChanged?.()
				setSaveAsModalOpen(false)
				setCurrentActionItem(null)
			} catch (error) {
				console.error("Failed to save chat as project:", error)
				magicToast.error(t("chat.saveAsProjectFailed"))
			} finally {
				setIsSaveAsSubmitting(false)
			}
		},
	)

	// Detail entry can open before currentActionItem is populated, so the action label
	// must always derive from the latest fallback target instead of a memoized snapshot.
	const targetProject = resolveTargetProject()
	const projectActions: DesktopChatProjectAction[] = [
		{
			key: "pinProject",
			label: targetProject?.is_pinned ? t("chat.unpinChat") : t("chat.pinChat"),
			onClick: () => {
				void handlePinProject()
			},
		},
		{
			key: "rename",
			label: t("chat.renameChat"),
			onClick: openRenameDialog,
		},
		{
			key: "saveAsProject",
			label: t("chat.saveAsProject"),
			onClick: openSaveAsModal,
		},
		{
			key: "delete",
			label: t("chat.deleteChat"),
			onClick: openDeleteConfirm,
			variant: "danger",
		},
	]

	const projectActionMap = useMemo(
		() => new Map(projectActions.map((action) => [action.key, action])),
		[projectActions],
	)

	const deleteDialogTitle = currentActionItem?.project_name?.trim() || t("chat.unnamedChat")

	const projectActionComponents = (
		<>
			<ChatProjectRenameDialog
				open={renameDialogOpen}
				onOpenChange={setRenameDialogOpen}
				project={currentActionItem}
				selectedTopic={
					actionContext === "detail" ? (selectedTopic ?? topicStore.selectedTopic) : null
				}
				onRenamed={onProjectChanged}
			/>
			{saveAsModalOpen ? (
				<Suspense fallback={null}>
					<ChatSaveAsProjectModal
						open={saveAsModalOpen}
						defaultProjectName={currentActionItem?.project_name || ""}
						sourceWorkspaceId={currentActionItem?.workspace_id}
						isSubmitting={isSaveAsSubmitting}
						onClose={() => setSaveAsModalOpen(false)}
						onConfirm={handleSaveAsProject}
					/>
				</Suspense>
			) : null}
			{deleteModalOpen ? (
				<Suspense fallback={null}>
					<DeleteDangerModal
						title={t("chat.deleteChat")}
						content={deleteDialogTitle}
						description={t("chat.deleteChatDescription")}
						needConfirm={false}
						onSubmit={handleDeleteProject}
						onClose={() => setDeleteModalOpen(false)}
					/>
				</Suspense>
			) : null}
		</>
	)

	return {
		isProjectModalOpen: renameDialogOpen || saveAsModalOpen || deleteModalOpen,
		currentActionItem,
		updateCurrentActionItem,
		projectActions,
		projectActionMap,
		projectActionComponents,
	}
}
