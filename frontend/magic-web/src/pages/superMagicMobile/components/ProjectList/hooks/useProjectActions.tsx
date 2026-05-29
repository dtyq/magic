import { useBoolean, useMemoizedFn, useMount } from "ahooks"
import { useEffect, useMemo, useState } from "react"
import { ActionsPopup } from "../../ActionsPopup/types"
import { useTranslation } from "react-i18next"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import ProjectMovePopup from "../components/ProjectMovePopup"
import {
	isCollaborationProject,
	isOtherCollaborationProject,
	isWorkspaceShortcutProject,
	SHARE_WORKSPACE_ID,
} from "@/pages/superMagic/constants"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import useProjectTransferModal from "./useProjectTransferModal"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import magicToast from "@/components/base/MagicToaster/utils"
import { Input } from "@/components/shadcn-ui/input"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MobileDeleteConfirmPopup from "@/pages/superMagicMobile/components/MobileDeleteConfirmPopup"
import { IconX } from "@tabler/icons-react"
import { Check } from "lucide-react"
import useNavigate from "@/routes/hooks/useNavigate"
import {
	shouldShowProjectCollaboratorAction,
	shouldShowProjectTransferAction,
} from "@/pages/superMagicMobile/utils/projectActionVisibility"
import {
	resolveProjectDetailHeaderActions,
	type SharedProjectVisibleActionKey,
} from "@/pages/superMagicMobile/utils/sharedProjectActionPolicy"
import {
	applyProjectDetailExitNavigation,
	applySuperMobileDetailExitNavigation,
	shouldExitChatDetailAfterDelete,
	shouldExitPageAfterProjectMove,
} from "@/pages/superMagicMobile/utils/navigateAfterProjectMove"
import {
	resolveChatDetailDeleteFallback,
	resolvePostMoveBackFallback,
	shouldExitDetailPageAfterDelete,
	shouldExitDetailPageAfterTransfer,
} from "@/pages/superMagicMobile/utils/resolveSuperMobileBackFallback"
import { RouteName } from "@/routes/constants"
import { buildSuperMobileNavigationState } from "@/pages/superMagicMobile/layout/MainLayout/components/MainHeader/backNavigation"
import {
	buildMobileProjectActionGroups,
	sortFilteredProjectActions,
} from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"
import { mergeProjectListItemWithStoreCache } from "@/pages/superMagicMobile/utils/mergeProjectListItemWithStoreCache"

interface UseProjectListActionsOptions {
	onProjectChanged?: () => Promise<void> | void
	/** Custom delete handler after user confirms (e.g. optimistic list removal on swipe). */
	onDeleteProjectConfirmed?: (project: ProjectListItem) => Promise<void>
	mode?: "default" | "chat"
	chatActionContext?: "drawer" | "detail"
	actionContext?: "default" | "project-detail" | "shell-recent"
	deleteSelectedProjectBehavior?: "switch-next" | "navigate-home"
	visibleActionKeys?: ProjectActionKey[]
}

export type ProjectActionKey =
	| "pinProject"
	| "rename"
	| "move"
	| "enterWorkspace"
	| "saveAsProject"
	| "copyCollaborationLink"
	| "setCollaborators"
	| "cancelWorkspaceShortcut"
	| "transfer"
	| "delete"

export function useProjectListActions({
	onProjectChanged,
	onDeleteProjectConfirmed,
	mode = "default",
	chatActionContext = "drawer",
	actionContext = "default",
	deleteSelectedProjectBehavior = "switch-next",
	visibleActionKeys,
}: UseProjectListActionsOptions = {}) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedTopic = topicStore.selectedTopic
	const selectedProjectId = projectStore.selectedProject?.id
	const isChatMode = mode === "chat"
	const isProjectDetailActionContext = actionContext === "project-detail"
	const isShellRecentActionContext = actionContext === "shell-recent"
	const shouldShowSaveAsProject =
		isChatMode && (chatActionContext === "detail" || chatActionContext === "drawer")

	const [currentActionItem, updateCurrentActionItem] = useState<ProjectListItem | null>(null)

	/** Enrich recent-menu rows with store role/tag so sidebar menus match project detail permissions. */
	const actionProject = useMemo(
		() => mergeProjectListItemWithStoreCache(currentActionItem),
		[currentActionItem],
	)

	const [actionsPopupVisible, { setTrue: _openActionsPopup, setFalse: closeActionsPopup }] =
		useBoolean(false)

	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	/** 是否打开移动项目弹窗 */
	const [moveProjectModalVisible, setMoveProjectModalVisible] = useState(false)
	/** 是否移动项目中 */
	const [isMoveProjectLoading, setIsMoveProjectLoading] = useState(false)
	/** Pre-mount collaborator panel on project detail (ChatPage-style idle init) to avoid first-open flicker. */
	const [isCollaboratorPanelInitialized, setIsCollaboratorPanelInitialized] = useState(false)

	// On project detail, keep panel bound to the route project so lazy chunk can load before first open.
	const collaboratorPanelProject = isProjectDetailActionContext
		? (actionProject ?? projectStore.selectedProject)
		: actionProject

	/** Same source as collaborator panel — used for menu visibility before currentActionItem is set. */
	const permissionProject = collaboratorPanelProject

	const { openManageModal, CollaboratorUpdatePanel, canManageCollaborators } =
		useCollaboratorUpdatePanel({
			selectedProject: collaboratorPanelProject,
		})

	/** Ensures collaborator lazy subtree is mounted before openManageModal (click-time fallback). */
	const ensureCollaboratorPanelInitialized = useMemoizedFn(() => {
		setIsCollaboratorPanelInitialized((initialized) => initialized || true)
	})

	useMount(() => {
		if (!isProjectDetailActionContext) return

		const initializeCollaboratorPanel = () => {
			ensureCollaboratorPanelInitialized()
		}

		if ("requestIdleCallback" in window) {
			requestIdleCallback(() => {
				initializeCollaboratorPanel()
			})
			return
		}

		setTimeout(initializeCollaboratorPanel, 0)
	})

	/** Drop stale popup target when route project changes so permissions follow selectedProject. */
	useEffect(() => {
		if (!isProjectDetailActionContext) return

		updateCurrentActionItem(null)
	}, [isProjectDetailActionContext, selectedProjectId])

	/**
	 * 项目详情页转让成功后退回工作区项目列表，与删除/移动详情页退出逻辑一致。
	 */
	const handleProjectTransferSuccess = useMemoizedFn(
		async (transferredProject: ProjectListItem) => {
			const shouldExitProjectDetailPage = shouldExitDetailPageAfterTransfer({
				deletedProjectId: transferredProject.id,
				selectedProjectId: projectStore.selectedProject?.id,
				isProjectDetailActionContext,
			})
			const workspaceId = transferredProject.workspace_id
			if (!shouldExitProjectDetailPage || !workspaceId) return

			closeActionsPopup()
			await applyProjectDetailExitNavigation({
				workspaceId,
				project: transferredProject,
				navigate,
			})
		},
	)

	// 转让弹层由 hook 决定是否提供真实交互，列表层只消费稳定接口。
	const { openTransferModal, TransferModalComponent, canTransferProject } =
		useProjectTransferModal(permissionProject, {
			onTransferSuccess: handleProjectTransferSuccess,
		})

	const openActionsPopup = useMemoizedFn((project: ProjectListItem) => {
		const mergedProject = mergeProjectListItemWithStoreCache(project) ?? project
		const headerPolicy = resolveProjectDetailHeaderActions(mergedProject, {
			canManageCollaborators,
		})
		if (isProjectDetailActionContext && !headerPolicy.hasMenuActions) return

		updateCurrentActionItem(mergedProject)
		_openActionsPopup()
	})

	/**
	 * 统一处理普通移动与“另存为项目”的确认提交。
	 * 另存为场景将用户输入的项目名写入 move 接口的 target_project_name。
	 */
	const handleMoveProject = useMemoizedFn(
		async ({ workspaceId, projectName }: { workspaceId: string; projectName?: string }) => {
			if (!currentActionItem?.id || isMoveProjectLoading) return
			// 在对话列表页 selectedWorkspace 可能为 null（未选中任何工作区），
			// 此时回退到项目自身的 workspace_id 作为移动源，确保操作能正常发起。
			const sourceWorkspaceId = selectedWorkspace?.id ?? currentActionItem.workspace_id
			if (!sourceWorkspaceId) return
			const movedProject = currentActionItem
			const shouldExitAfterMove = shouldExitPageAfterProjectMove({
				movedProjectId: movedProject.id,
				selectedProjectId: projectStore.selectedProject?.id,
				isProjectDetailActionContext,
				shouldShowSaveAsProject,
				chatActionContext,
			})
			setIsMoveProjectLoading(true)
			try {
				await SuperMagicService.project.moveProject({
					projectId: movedProject.id,
					targetWorkspaceId: workspaceId,
					sourceWorkspaceId,
					targetProjectName: shouldShowSaveAsProject
						? projectName?.trim() || undefined
						: undefined,
				})
				if (shouldExitAfterMove) {
					await applyProjectDetailExitNavigation({
						workspaceId,
						project: movedProject,
						navigate,
					})
				}
				magicToast.success(
					t(
						shouldShowSaveAsProject
							? "chat.saveAsProjectSuccess"
							: "project.moveProjectSuccess",
					),
				)
				await onProjectChanged?.()
			} catch (error) {
				// Error already handled in service
			} finally {
				setIsMoveProjectLoading(false)
				setMoveProjectModalVisible(false)
			}
		},
	)

	const cancelWorkspaceShortcut = useMemoizedFn(async (project: ProjectListItem | null) => {
		if (!project || !selectedWorkspace?.id) return
		try {
			await SuperMagicService.project.cancelWorkspaceShortcut(
				project.id,
				selectedWorkspace.id,
			)
			await onProjectChanged?.()
		} catch (error) {
			// Error already handled in service
		}
	})

	const handleCopyCollaborationLink = useMemoizedFn(async (project?: ProjectListItem | null) => {
		if (!project) return
		const success = await SuperMagicService.project.copyCollaborationLink(project)
		if (success) {
			magicToast.success(t("collaborators.copySuccess"))
		}
	})

	/**
	 * Open workspace project list from project detail; back on that page returns to workspace list.
	 */
	const handleEnterWorkspace = useMemoizedFn((project?: ProjectListItem | null) => {
		if (!project) return

		const isSharedProject = isCollaborationProject(project)
		const workspaceId = isOtherCollaborationProject(project)
			? SHARE_WORKSPACE_ID
			: project.workspace_id
		if (!workspaceId) return

		const returnTo = { name: RouteName.SuperWorkspacesList }
		const navigationState = buildSuperMobileNavigationState(returnTo)

		if (isSharedProject) {
			navigate({
				name: RouteName.SuperSharedWorkspace,
				state: navigationState,
				viewTransition: false,
			})
			return
		}

		navigate({
			name: RouteName.SuperWorkspaceProjects,
			params: { workspaceId },
			state: navigationState,
			viewTransition: false,
		})
	})

	const handlePinProject = useMemoizedFn(async (project?: ProjectListItem | null) => {
		if (!project) return
		try {
			await SuperMagicService.project.pinProject(project, !project.is_pinned)

			// 父级 onProjectChanged 已负责静默刷新列表，避免重复请求与整表 loading
			if (!onProjectChanged) {
				await SuperMagicService.project.fetchProjects({
					workspaceId: project.workspace_id,
					clearWhenNoProjects: false,
				})
			}

			magicToast.success(
				project.is_pinned
					? t(
							isChatMode
								? "chat.unpinChatSuccess"
								: "hierarchicalWorkspacePopup.unpinProjectSuccess",
						)
					: t(
							isChatMode
								? "chat.pinChatSuccess"
								: "hierarchicalWorkspacePopup.pinProjectSuccess",
						),
			)
			await onProjectChanged?.()

			closeActionsPopup()
		} catch (error) {
			// Error already handled in service
		}
	})

	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(permissionProject)
	const isCollaborationProjectStatus = isCollaborationProject(permissionProject)
	const sharedProjectActionPolicy = resolveProjectDetailHeaderActions(permissionProject, {
		canManageCollaborators,
	})

	const projectActions = useMemo(() => {
		const actions = [
			{
				key: "pinProject",
				label: currentActionItem?.is_pinned
					? t(isChatMode ? "chat.unpinChat" : "hierarchicalWorkspacePopup.unpinProject")
					: t(isChatMode ? "chat.pinChat" : "hierarchicalWorkspacePopup.pinProject"),
				onClick: () => {
					handlePinProject(currentActionItem)
					closeActionsPopup()
				},
				variant: "default",
				visible: !isProjectDetailActionContext,
				"data-testid": "project-actions-pin-project",
			},
			{
				key: "rename",
				label: t(isChatMode ? "chat.renameChat" : "hierarchicalWorkspacePopup.rename"),
				onClick: () => {
					setRenameModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
				visible: !isWorkspaceShortcutProjectStatus,
				"data-testid": "project-actions-rename-project",
			},
			{
				key: shouldShowSaveAsProject ? "saveAsProject" : "move",
				label: t(
					shouldShowSaveAsProject
						? "chat.saveAsProject"
						: isProjectDetailActionContext
							? "project.moveTo"
							: "hierarchicalWorkspacePopup.moveProjectTo",
				),
				onClick: () => {
					setMoveProjectModalVisible(true)
					closeActionsPopup()
				},
				variant: "default",
				visible:
					(shouldShowSaveAsProject || mode !== "chat") &&
					!isWorkspaceShortcutProjectStatus,
				"data-testid": shouldShowSaveAsProject
					? "project-actions-save-as-project"
					: "project-actions-move-project",
			},
			{
				key: "enterWorkspace",
				label: t("share.enterWorkspace"),
				onClick: () => {
					handleEnterWorkspace(currentActionItem)
					closeActionsPopup()
				},
				variant: "default",
				visible:
					(isProjectDetailActionContext || isShellRecentActionContext) &&
					!isWorkspaceShortcutProjectStatus,
				"data-testid": "project-actions-enter-workspace",
			},
			{
				key: "copyCollaborationLink",
				label: t("hierarchicalWorkspacePopup.copyCollaborationLink"),
				onClick: () => {
					handleCopyCollaborationLink(currentActionItem)
					closeActionsPopup()
				},
				variant: "default",
				visible:
					mode !== "chat" &&
					(isCollaborationProjectStatus || isWorkspaceShortcutProjectStatus),
				"data-testid": "project-actions-copy-collaboration-link",
			},
			{
				key: "setCollaborators",
				label: t("project.addCollaborators"),
				onClick: () => {
					openManageModal()
					closeActionsPopup()
				},
				variant: "default",
				visible: shouldShowProjectCollaboratorAction({
					mode,
					isCollaborationProject: isCollaborationProjectStatus,
					userRole: permissionProject?.user_role,
					canManageCollaborators,
				}),
				"data-testid": "project-actions-set-collaborators",
			},
			{
				key: "cancelWorkspaceShortcut",
				label: t("project.cancelWorkspaceShortcut"),
				onClick: () => {
					cancelWorkspaceShortcut(currentActionItem)
					closeActionsPopup()
				},
				variant: "danger",
				visible: mode !== "chat" && isWorkspaceShortcutProjectStatus,
				"data-testid": "project-actions-cancel-workspace-shortcut",
			},
			{
				key: "transfer",
				label: t("project.transfer"),
				onClick: () => {
					openTransferModal()
					closeActionsPopup()
				},
				variant: "default",
				visible: shouldShowProjectTransferAction({
					mode,
					userRole: permissionProject?.user_role,
					isWorkspaceShortcutProject: isWorkspaceShortcutProjectStatus,
					canTransferProject,
				}),
				"data-testid": "project-actions-transfer-project",
			},
			{
				key: "delete",
				label: t(isChatMode ? "chat.deleteChat" : "project.deleteProject"),
				onClick: () => {
					setDeleteModalVisible(true)
					closeActionsPopup()
				},
				variant: "danger",
				visible: !isWorkspaceShortcutProjectStatus,
				"data-testid": "project-actions-delete-project",
			},
		] as ((ActionsPopup.ActionButtonConfig & { visible: boolean }) & {
			key: ProjectActionKey
		})[]
		const visibleActionKeySet = visibleActionKeys ? new Set(visibleActionKeys) : null
		const simplifiedActionKeySet = sharedProjectActionPolicy.useSimplifiedSharedProjectActions
			? new Set(sharedProjectActionPolicy.visibleActionKeys)
			: null
		const filtered = actions.filter((action) => {
			if (!action.visible) return false
			if (simplifiedActionKeySet) {
				return simplifiedActionKeySet.has(action.key as SharedProjectVisibleActionKey)
			}
			if (!visibleActionKeySet) return true
			return visibleActionKeySet.has(action.key)
		})

		return sortFilteredProjectActions(filtered, { isChatMode })
	}, [
		permissionProject,
		currentActionItem,
		t,
		isWorkspaceShortcutProjectStatus,
		isCollaborationProjectStatus,
		handlePinProject,
		closeActionsPopup,
		handleCopyCollaborationLink,
		handleEnterWorkspace,
		openManageModal,
		canManageCollaborators,
		cancelWorkspaceShortcut,
		openTransferModal,
		canTransferProject,
		mode,
		isChatMode,
		shouldShowSaveAsProject,
		visibleActionKeys,
		sharedProjectActionPolicy,
		isProjectDetailActionContext,
		isShellRecentActionContext,
	])

	const handleDeleteProject = useMemoizedFn(async () => {
		if (!currentActionItem?.id) return
		const deletedProject = currentActionItem
		const deleteWorkspaceId = isOtherCollaborationProject(deletedProject)
			? SHARE_WORKSPACE_ID
			: (selectedWorkspace?.id ?? deletedProject.workspace_id)
		const shouldExitProjectDetailPage = shouldExitDetailPageAfterDelete({
			deletedProjectId: deletedProject.id,
			selectedProjectId: projectStore.selectedProject?.id,
			isProjectDetailActionContext,
		})
		const shouldExitChatDetailPage = shouldExitChatDetailAfterDelete({
			deletedProjectId: deletedProject.id,
			selectedProjectId: projectStore.selectedProject?.id,
			isChatMode,
			chatActionContext,
		})

		try {
			if (onDeleteProjectConfirmed) {
				await onDeleteProjectConfirmed(deletedProject)
			} else if (shouldExitChatDetailPage && deleteWorkspaceId) {
				applySuperMobileDetailExitNavigation({
					navigate,
					fallback: resolveChatDetailDeleteFallback(),
					leaveRouteImmediately: true,
				})
				await SuperMagicService.project.deleteProject(deletedProject.id, deleteWorkspaceId)
				void SuperMagicService.project.fetchProjects({
					workspaceId: deleteWorkspaceId,
					page: 1,
				})
			} else if (shouldExitProjectDetailPage && deleteWorkspaceId) {
				const cachedWorkspace = workspaceStore.workspaces.find(
					(workspace) => workspace.id === deleteWorkspaceId,
				)
				if (cachedWorkspace) {
					workspaceStore.setSelectedWorkspace(cachedWorkspace)
				}
				const fallback = resolvePostMoveBackFallback({
					targetWorkspaceId: deleteWorkspaceId,
					movedProject: deletedProject,
				})
				applySuperMobileDetailExitNavigation({
					navigate,
					fallback,
					leaveRouteImmediately: true,
				})
				await SuperMagicService.project.deleteProject(deletedProject.id, deleteWorkspaceId)
				void SuperMagicService.project.fetchProjects({
					workspaceId: deleteWorkspaceId,
					page: 1,
				})
			} else {
				await SuperMagicService.deleteProject(deletedProject, {
					selectedProjectBehavior: deleteSelectedProjectBehavior,
					lastUsedWorkspaceId: selectedWorkspace?.id,
				})
			}
			await onProjectChanged?.()
			setDeleteModalVisible(false)
		} catch {
			// Keep the confirm sheet open so the user can retry after a failed delete.
		}
	})

	/** Open delete confirmation for a project (e.g. list swipe delete). */
	const openProjectDeleteConfirm = useMemoizedFn((project: ProjectListItem) => {
		updateCurrentActionItem(project)
		setDeleteModalVisible(true)
	})

	const handleRenameProject = useMemoizedFn(
		async (params: HandleRenameProjectParams): Promise<void> => {
			const targetWorkspaceId = currentActionItem?.workspace_id || selectedWorkspace?.id
			if (!targetWorkspaceId) return
			try {
				await SuperMagicService.project.renameProject(
					params.projectId,
					params.projectName,
					targetWorkspaceId,
					isChatMode && selectedTopic?.project_id === params.projectId
						? { topicId: selectedTopic.id }
						: undefined,
				)
				magicToast.success(
					t(isChatMode ? "chat.renameChatSuccess" : "project.renameProjectSuccess"),
				)
				await onProjectChanged?.()
			} catch (error) {
				// Error already handled in service
			}
		},
	)

	/** 单个操作按钮保持整行触摸区域，外层分组负责圆角与分隔线。 */
	const renderProjectActionButton = (
		action: ActionsPopup.ActionButtonConfig,
		showDivider: boolean,
	) => (
		<button
			key={action.key}
			type="button"
			onClick={action.onClick}
			disabled={action.disabled}
			data-testid={action["data-testid"]}
			className={[
				"flex h-[55px] w-full items-center bg-card px-3.5 text-left text-base transition-colors",
				showDivider ? "border-b border-border/70" : "",
				action.variant === "danger" ? "text-destructive" : "text-foreground",
				action.disabled ? "cursor-not-allowed opacity-50" : "active:bg-accent/60",
			].join(" ")}
		>
			<span className="flex-1 truncate">{action.label}</span>
		</button>
	)

	/** Prototype four-card layout; extras (copy link / shortcut cancel) get their own cards. */
	const projectActionGroups = useMemo(
		() => buildMobileProjectActionGroups(projectActions, { shouldShowSaveAsProject }),
		[projectActions, shouldShowSaveAsProject],
	)

	/** 渲染一组动作卡片，确保多按钮组只有内部按钮之间出现分割线。 */
	const renderProjectActionGroup = (
		group: ActionsPopup.ActionButtonConfig[],
		groupIndex: number,
	) => (
		<div
			key={group.map((action) => action.key).join("-") || groupIndex}
			className="overflow-hidden rounded-xl bg-card"
		>
			{group.map((action, actionIndex) =>
				renderProjectActionButton(action, actionIndex < group.length - 1),
			)}
		</div>
	)

	const actionPopupTitle =
		currentActionItem?.project_name ||
		t(isChatMode ? "chat.unnamedChat" : "project.unnamedProject")
	const deleteActionName = actionPopupTitle
	const deleteActionDescription = t(
		isChatMode ? "chat.deleteChatDescription" : "ui.deleteProjectDescriptionWithoutName",
	)

	const projectActionComponents = (
		<>
			<MagicPopup
				visible={actionsPopupVisible}
				onClose={closeActionsPopup}
				position="bottom"
				title={actionPopupTitle}
				headerVariant="actionHeader"
				headerTitle={actionPopupTitle}
				headerLeadingAction={{
					icon: <IconX />,
					ariaLabel: t("common.cancel"),
					onClick: closeActionsPopup,
					testId: "project-actions-popup-close",
				}}
				className="border-none bg-muted"
				bodyClassName="max-h-[80dvh] bg-muted p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col gap-2 overflow-y-auto px-3 pb-[max(var(--safe-area-inset-bottom),16px)] pt-3">
					{projectActionGroups.map(renderProjectActionGroup)}
				</div>
			</MagicPopup>

			<MagicPopup
				visible={renameModalVisible}
				onClose={() => setRenameModalVisible(false)}
				position="bottom"
				title={t(isChatMode ? "chat.renameChat" : "project.rename")}
				headerVariant="actionHeader"
				headerTitle={t(isChatMode ? "chat.renameChat" : "project.rename")}
				headerLeadingAction={{
					icon: <IconX />,
					ariaLabel: t("common.cancel"),
					onClick: () => setRenameModalVisible(false),
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("common.confirm"),
					onClick: () => {
						void handleRenameProject({
							projectId: currentActionItem?.id || "",
							projectName: currentActionItem?.project_name || "",
						})
						setRenameModalVisible(false)
					},
					disabled: !currentActionItem?.project_name?.trim(),
					tone: "primary",
				}}
				bodyClassName="max-h-[80dvh] p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2">
					<div className="flex flex-col gap-2.5">
						{/* Field label above input; sheet title stays the generic "Rename" action. */}
						<div className="text-sm font-normal leading-5 text-foreground">
							{t(
								isChatMode
									? "chat.chatNameFieldLabel"
									: "chat.projectNameFieldLabel",
							)}
						</div>
						<Input
							className="bg-white"
							placeholder={t(
								isChatMode
									? "chat.inputChatName"
									: "hierarchicalWorkspacePopup.inputProjectName",
							)}
							value={currentActionItem?.project_name}
							onChange={(e) => {
								if (!currentActionItem) return
								updateCurrentActionItem({
									...currentActionItem,
									project_name: e.target.value,
								})
							}}
							autoFocus
						/>
					</div>
				</div>
			</MagicPopup>

			<MobileDeleteConfirmPopup
				visible={deleteModalVisible}
				onClose={() => setDeleteModalVisible(false)}
				title={t(
					isChatMode ? "chat.deleteChat" : "hierarchicalWorkspacePopup.deleteProject",
				)}
				entityName={deleteActionName}
				descriptionSuffix={deleteActionDescription}
				onConfirm={handleDeleteProject}
				cancelAriaLabel={t("common.cancel")}
				confirmAriaLabel={t("common.confirm")}
				testIdPrefix="mobile-project-delete-confirm"
			/>

			<ProjectMovePopup
				open={moveProjectModalVisible}
				onClose={() => setMoveProjectModalVisible(false)}
				onConfirm={handleMoveProject}
				mode={shouldShowSaveAsProject ? "saveAsProject" : "move"}
				defaultProjectName={currentActionItem?.project_name || ""}
				sourceWorkspaceId={currentActionItem?.workspace_id}
				title={t(
					shouldShowSaveAsProject
						? "chat.saveAsNewProjectTitle"
						: "hierarchicalWorkspacePopup.moveToWorkspace",
				)}
				confirmText={t(
					shouldShowSaveAsProject
						? "chat.confirmSaveAsProject"
						: "hierarchicalWorkspacePopup.confirmMoveProject",
				)}
			/>

			{(!isProjectDetailActionContext || isCollaboratorPanelInitialized) &&
				CollaboratorUpdatePanel}
			{TransferModalComponent}
		</>
	)

	const hasVisibleProjectActions = projectActions.length > 0

	return {
		projectActions,
		hasVisibleProjectActions,
		currentActionItem,
		updateCurrentActionItem,
		actionsPopupVisible,
		openActionsPopup,
		openProjectDeleteConfirm,
		closeActionsPopup,
		openManageModal,
		ensureCollaboratorPanelInitialized,
		renameModalVisible,
		setRenameModalVisible,
		handlePinProject,
		// 操作组件
		projectActionComponents,
	}
}
