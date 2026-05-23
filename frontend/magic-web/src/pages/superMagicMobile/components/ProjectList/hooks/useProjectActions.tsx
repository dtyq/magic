import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { ActionsPopup } from "../../ActionsPopup/types"
import { useTranslation } from "react-i18next"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { HandleRenameProjectParams } from "@/pages/superMagic/hooks/useProjects"
import ProjectMovePopup from "../components/ProjectMovePopup"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import useProjectTransferModal from "./useProjectTransferModal"
import { canManageProject, isOwner } from "@/pages/superMagic/utils/permission"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import magicToast from "@/components/base/MagicToaster/utils"
import { Input } from "@/components/shadcn-ui/input"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { IconX } from "@tabler/icons-react"
import { Check } from "lucide-react"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import {
	shouldShowProjectCollaboratorAction,
	shouldShowProjectTransferAction,
} from "@/pages/superMagicMobile/utils/projectActionVisibility"
import { buildSharedProjectActionPolicy } from "@/pages/superMagicMobile/utils/sharedProjectActionPolicy"

interface UseProjectListActionsOptions {
	onProjectChanged?: () => Promise<void> | void
	mode?: "default" | "chat"
	chatActionContext?: "drawer" | "detail"
	actionContext?: "default" | "project-detail"
	deleteSelectedProjectBehavior?: "switch-next" | "navigate-home"
	visibleActionKeys?: ProjectActionKey[]
}

export type ProjectActionKey =
	| "pinProject"
	| "rename"
	| "move"
	| "saveAsProject"
	| "copyCollaborationLink"
	| "setCollaborators"
	| "cancelWorkspaceShortcut"
	| "transfer"
	| "delete"

export function useProjectListActions({
	onProjectChanged,
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
	const isChatMode = mode === "chat"
	const isProjectDetailActionContext = actionContext === "project-detail"
	const shouldShowSaveAsProject =
		isChatMode && (chatActionContext === "detail" || chatActionContext === "drawer")

	const [currentActionItem, updateCurrentActionItem] = useState<ProjectListItem | null>(null)

	const [actionsPopupVisible, { setTrue: _openActionsPopup, setFalse: closeActionsPopup }] =
		useBoolean(false)

	const [renameModalVisible, setRenameModalVisible] = useState(false)
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	/** 是否打开移动项目弹窗 */
	const [moveProjectModalVisible, setMoveProjectModalVisible] = useState(false)
	/** 是否移动项目中 */
	const [isMoveProjectLoading, setIsMoveProjectLoading] = useState(false)

	const { openManageModal, CollaboratorUpdatePanel, canManageCollaborators } =
		useCollaboratorUpdatePanel({
			selectedProject: currentActionItem,
		})

	// 转让弹层由 hook 决定是否提供真实交互，列表层只消费稳定接口。
	const { openTransferModal, TransferModalComponent, canTransferProject } =
		useProjectTransferModal(currentActionItem)

	const openActionsPopup = useMemoizedFn((project: ProjectListItem) => {
		updateCurrentActionItem(project)
		_openActionsPopup()
	})

	/**
	 * 聊天详情里的“另存为项目”在当前产品口径下仍然是移动。
	 * 成功后显式切到目标工作区对应路由，避免页面停留在旧工作区上下文。
	 */
	const navigateAfterMoveInChatDetail = useMemoizedFn(
		(targetWorkspaceId: string, nextProjectName?: string) => {
			if (!currentActionItem || chatActionContext !== "detail") return

			const targetWorkspace =
				workspaceStore.workspaces.find((workspace) => workspace.id === targetWorkspaceId) ||
				null
			if (targetWorkspace) {
				workspaceStore.setSelectedWorkspace(targetWorkspace)
			}

			// 先乐观更新当前项目名称和归属工作区，保证路由落地前的头部文案不闪回旧值。
			projectStore.setSelectedProject({
				...currentActionItem,
				project_name: nextProjectName?.trim() || currentActionItem.project_name,
				workspace_id: targetWorkspaceId,
			})

			if (selectedTopic?.id) {
				navigate({
					name: RouteName.SuperWorkspaceProjectTopicState,
					params: {
						projectId: currentActionItem.id,
						topicId: selectedTopic.id,
					},
				})
				return
			}

			navigate({
				name: RouteName.SuperWorkspaceProjectState,
				params: {
					projectId: currentActionItem.id,
				},
			})
		},
	)

	/**
	 * 统一处理普通移动与“另存为项目”的确认提交。
	 * 这里把原型里的项目名作为可选参数透传给移动接口，后端若暂未支持会按 API_LIMITATIONS 降级。
	 */
	const handleMoveProject = useMemoizedFn(
		async ({ workspaceId, projectName }: { workspaceId: string; projectName?: string }) => {
			if (!currentActionItem?.id || isMoveProjectLoading) return
			// 在对话列表页 selectedWorkspace 可能为 null（未选中任何工作区），
			// 此时回退到项目自身的 workspace_id 作为移动源，确保操作能正常发起。
			const sourceWorkspaceId = selectedWorkspace?.id ?? currentActionItem.workspace_id
			if (!sourceWorkspaceId) return
			setIsMoveProjectLoading(true)
			try {
				await SuperMagicService.project.moveProject(
					currentActionItem.id,
					workspaceId,
					sourceWorkspaceId,
					projectName,
				)
				if (shouldShowSaveAsProject) {
					navigateAfterMoveInChatDetail(workspaceId, projectName)
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

	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(currentActionItem)
	const isCollaborationProjectStatus = isCollaborationProject(currentActionItem)
	const sharedProjectActionPolicy = buildSharedProjectActionPolicy(currentActionItem)

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
					userRole: currentActionItem?.user_role,
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
					userRole: currentActionItem?.user_role,
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
		return actions.filter((action) => {
			if (!action.visible) return false
			if (simplifiedActionKeySet) {
				return simplifiedActionKeySet.has(action.key)
			}
			if (!visibleActionKeySet) return true
			return visibleActionKeySet.has(action.key)
		})
	}, [
		currentActionItem,
		t,
		isWorkspaceShortcutProjectStatus,
		isCollaborationProjectStatus,
		handlePinProject,
		closeActionsPopup,
		handleCopyCollaborationLink,
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
	])

	const handleDeleteProject = useMemoizedFn(async () => {
		if (!currentActionItem?.id) return
		await SuperMagicService.deleteProject(currentActionItem, {
			selectedProjectBehavior: deleteSelectedProjectBehavior,
			lastUsedWorkspaceId: selectedWorkspace?.id,
		})
		await onProjectChanged?.()
		setDeleteModalVisible(false)
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

	/** 原型把重命名/移动合并为一张卡片，其余操作各自独立成组。 */
	const projectActionGroups = useMemo(() => {
		// Shared grouping keys for both default and project-detail contexts.
		// rename + move/saveAsProject are always a single card (no gap between them),
		// matching the prototype's MenuGroup layout.
		const groupedKeys = [
			["rename", shouldShowSaveAsProject ? "saveAsProject" : "move"],
			["setCollaborators", "copyCollaborationLink"],
			["cancelWorkspaceShortcut"],
			["transfer"],
			["delete"],
		]

		return groupedKeys
			.map((keys) => projectActions.filter((action) => keys.includes(action.key)))
			.filter((group) => group.length > 0)
	}, [projectActions, shouldShowSaveAsProject])

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
		isChatMode ? "chat.deleteChatDescription" : "ui.deleteProjectDescription",
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
					icon: <IconX className="size-5" />,
					ariaLabel: t("common.cancel"),
					onClick: closeActionsPopup,
					testId: "project-actions-popup-close",
				}}
				className="border-none bg-muted"
				bodyClassName="max-h-[80vh] bg-muted p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col gap-2 overflow-y-auto px-3 pb-[max(var(--safe-area-inset-bottom),16px)] pt-3">
					{projectActionGroups.map(renderProjectActionGroup)}
				</div>
			</MagicPopup>

			<MagicPopup
				visible={renameModalVisible}
				onClose={() => setRenameModalVisible(false)}
				position="bottom"
				title={t(
					isChatMode ? "chat.renameChat" : "hierarchicalWorkspacePopup.projectRename",
				)}
				headerVariant="actionHeader"
				headerTitle={t(
					isChatMode ? "chat.renameChat" : "hierarchicalWorkspacePopup.projectRename",
				)}
				headerLeadingAction={{
					icon: <IconX className="size-5" />,
					ariaLabel: t("common.cancel"),
					onClick: () => setRenameModalVisible(false),
				}}
				headerTrailingAction={{
					icon: <Check className="size-[22px]" strokeWidth={2.5} />,
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
				bodyClassName="max-h-[80vh] p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2">
					<div className="flex flex-col gap-2.5">
						<div className="text-sm font-normal leading-5 text-foreground">
							{t("hierarchicalWorkspacePopup.newName")}
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

			<MagicPopup
				visible={deleteModalVisible}
				onClose={() => setDeleteModalVisible(false)}
				position="bottom"
				title={t(
					isChatMode ? "chat.deleteChat" : "hierarchicalWorkspacePopup.deleteProject",
				)}
				headerVariant="actionHeader"
				headerTitle={t(
					isChatMode ? "chat.deleteChat" : "hierarchicalWorkspacePopup.deleteProject",
				)}
				headerLeadingAction={{
					icon: <IconX className="size-5" />,
					ariaLabel: t("common.cancel"),
					onClick: () => setDeleteModalVisible(false),
				}}
				headerTrailingAction={{
					icon: <Check className="size-[22px]" strokeWidth={2.5} />,
					ariaLabel: t("common.confirm"),
					onClick: () => {
						void handleDeleteProject()
					},
					tone: "destructive",
				}}
				bodyClassName="max-h-[80vh] p-0"
			>
				<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
					{/* 删除态正文按“实体名强调 + 后果说明弱化”排版，更贴近移动端原型的风险提示层级。 */}
					<p className="mx-auto max-w-[680px] text-left text-[16px] leading-6">
						<span className="font-semibold text-foreground">{deleteActionName}</span>
						<span className="text-muted-foreground"> {deleteActionDescription}</span>
					</p>
				</div>
			</MagicPopup>

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

			{CollaboratorUpdatePanel}
			{TransferModalComponent}
		</>
	)

	return {
		projectActions,
		currentActionItem,
		updateCurrentActionItem,
		actionsPopupVisible,
		openActionsPopup,
		closeActionsPopup,
		openManageModal,
		renameModalVisible,
		setRenameModalVisible,
		handlePinProject,
		// 操作组件
		projectActionComponents,
	}
}
