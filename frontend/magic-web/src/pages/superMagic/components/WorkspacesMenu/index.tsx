import SmartTooltip from "@/components/other/SmartTooltip"
import { Dropdown, MenuProps } from "antd"
import SkeletonInput from "antd/es/skeleton/Input"
import { useCallback, useMemo, useRef, useEffect, useState, lazy, Suspense } from "react"
import { IconEdit, IconPlus, IconDots, IconChevronDown } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import StatusIcon from "../MessageHeader/components/StatusIcon"
import CollaborationWorkspace from "./components/CollaborationWorkspace"
import { isCollaborationWorkspace } from "../../constants"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { getWorkspaceRouteUrl } from "../../utils/route"
import { useWorkspaceEditing } from "../../hooks/useWorkspaceEditing"
import { useWorkspaceActionMenu } from "../../hooks/useWorkspaceActionMenu"
import workspaceStore from "../../stores/core/workspace"
import SuperMagicService from "../../services"
import { Workspace } from "../../pages/Workspace/types"
import { preloadCreateWorkspaceModal, preloadWorkspaceProjectsPanel } from "./preload"
import { cn } from "@/utils/cn"
import { useCreateWorkspace } from "../CreateWorkspaceModal/useCreateWorkspace"
import { useWorkspaceDelete } from "./useWorkspaceDelete"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

const WorkspaceProjectsPanel = lazy(() => import("./components/WorkspaceProjectsPanel"))

interface WorkspaceActionButtonsProps {
	workspace: Workspace
	selectedWorkspace: Workspace | null
	onEdit: (e: React.MouseEvent<HTMLDivElement>) => void
	onDelete: (workspaceId: string) => void
	onRename: (workspaceId: string) => void
	onMenuClose: () => void
	onTransferStart?: () => void
}

function WorkspaceActionButtons({
	workspace,
	selectedWorkspace,
	onEdit,
	onDelete,
	onRename,
	onMenuClose,
	onTransferStart,
}: WorkspaceActionButtonsProps) {
	const { t } = useTranslation("super")
	const { menuProps, nodes } = useWorkspaceActionMenu({
		workspace,
		selectedWorkspace,
		onDelete,
		onRename,
		onMenuClose,
		onTransferStart,
	})

	return (
		<>
			<div className="items-center gap-1 [display:var(--actions-display)]">
				<div
					className="flex h-5 w-5 cursor-pointer items-center justify-center rounded hover:bg-accent"
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						onEdit(e)
					}}
					data-testid="on-edit"
				>
					<IconEdit size={14} />
				</div>
				<Dropdown
					menu={{ items: menuProps.items }}
					trigger={menuProps.trigger}
					placement={menuProps.placement as any}
				>
					<div
						className="flex h-5 w-5 cursor-pointer items-center justify-center rounded hover:bg-accent"
						data-testid={`super-workspaces-menu-action-trigger-${workspace.id}`}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
					>
						<IconDots size={14} />
					</div>
				</Dropdown>
			</div>
			{nodes}
		</>
	)
}

function WorkspacesMenu() {
	const { t } = useTranslation("super")
	const inputRef = useRef<HTMLInputElement>(null)
	const [open, setOpen] = useState(false)
	const [shareProjectsPanelOpen, setShareProjectsPanelOpen] = useState(false)
	const [loading, setLoading] = useState(false)

	// Get workspace state from store
	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace

	// Create workspace hook
	const { openCreateWorkspaceModal, renderCreateWorkspaceModal } = useCreateWorkspace()

	// Delete workspace hook
	const { openDeleteModal, renderDeleteModal } = useWorkspaceDelete({
		getDeleteSuccessMessage: () => t("workspace.deleteWorkspaceSuccess"),
		getFallbackWorkspaceName: () => t("workspace.unnamedWorkspace"),
	})

	// Workspace editing hook
	const {
		editingWorkspaceId,
		editingWorkspaceName,
		handleWorkspaceInputChange,
		handleWorkspaceInputKeyDown,
		handleWorkspaceInputBlur,
		handleStartEditWorkspace,
	} = useWorkspaceEditing({
		selectedWorkspace,
		workspaces,
		onSave: async (workspaceId: string, workspaceName: string) => {
			await SuperMagicService.workspace.renameWorkspace(workspaceId, workspaceName)
		},
		onSaveSuccess: async () => {
			// After editing, need to update workspace list
			await SuperMagicService.workspace.fetchWorkspaces({
				isSelectLast: false,
				page: 1,
			})
		},
	})

	// Handle workspace menu click - switch workspace, fetch projects and navigate
	const handleWorkspaceMenuClick = useMemoizedFn((workspace: Workspace) => {
		SuperMagicService.switchWorkspace(workspace)
	})

	useEffect(() => {
		if (open) {
			console.log("open", open)
			const showLoading = workspaces.length <= 0

			if (showLoading) {
				setLoading(true)
			}

			// Preload modals when dropdown opens
			preloadCreateWorkspaceModal()
			preloadWorkspaceProjectsPanel()

			SuperMagicService.workspace
				.fetchWorkspaces({
					page: 1,
					isAutoSelect: false,
					isSelectLast: false,
				})
				.finally(() => {
					setLoading(false)
				})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	// Keep text navigation keys within the workspace name input.
	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			// Avoid forwarding cursor navigation to the dropdown menu.
			if (
				e.key === "ArrowLeft" ||
				e.key === "ArrowRight" ||
				e.key === "Home" ||
				e.key === "End"
			) {
				e.stopPropagation()
				return
			}

			// Delegate other keys to the workspace editing hook.
			handleWorkspaceInputKeyDown(e)
		},
		[handleWorkspaceInputKeyDown],
	)

	const handleInnerWorkspaceMenuClick = useMemoizedFn(
		(e: React.MouseEvent<HTMLAnchorElement>, workspace: Workspace) => {
			e.preventDefault()
			handleWorkspaceMenuClick(workspace)
		},
	)

	// Select the entire name when editing begins.
	useEffect(() => {
		if (editingWorkspaceId && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [editingWorkspaceId])

	// Workspace dropdown entries.
	const workspaceItems = useMemo(() => {
		const items = [
			{
				key: "workspaceList",
				className: "[--magic-control-item-bg-hover:transparent]",
				label: (
					<ScrollArea
						className="mx-[10px] mt-[10px] rounded bg-muted"
						viewportClassName="max-h-[275px] p-[5px] [&>div]:!block"
						viewportProps={{
							// Let the focused viewport scroll instead of navigating the outer menu.
							onKeyDown: (event) => {
								if (
									event.target === event.currentTarget &&
									[
										"ArrowUp",
										"ArrowDown",
										"PageUp",
										"PageDown",
										"Home",
										"End",
									].includes(event.key)
								)
									event.stopPropagation()
							},
						}}
					>
						{loading
							? Array.from({ length: 3 }).map((_, index) => (
									<SkeletonInput
										key={index}
										active
										className="!mt-1 !h-[18px] !w-full first:!mt-0 last:!mb-0"
									/>
								))
							: workspaces.map((workspace, index) => {
									const isEditing = editingWorkspaceId === workspace.id
									const isActive = selectedWorkspace?.id === workspace.id
									return (
										<a
											key={workspace.id}
											href={getWorkspaceRouteUrl(workspace.id)}
											className={cn(
												"mb-1 flex h-8 w-full cursor-pointer select-none items-center justify-between gap-1 rounded px-2.5 py-1.5 font-normal leading-5 text-foreground [--actions-display:none] last:mb-0",
												"hover:bg-gray-200 hover:text-foreground hover:[--actions-display:flex]",
												"active:bg-muted active:text-foreground",
												isActive &&
													"bg-blue-100 bg-opacity-50 font-semibold text-primary",
											)}
											onClick={(e) =>
												handleInnerWorkspaceMenuClick(e, workspace)
											}
											draggable={false}
											data-testid={`super-workspace-menu-item-${index}`}
											data-workspace-id={workspace.id}
											data-workspace-name={
												workspace.name || t("workspace.unnamedWorkspace")
											}
										>
											<div className="flex min-w-0 flex-1 items-center gap-1">
												<StatusIcon status={workspace.workspace_status} />
												{isEditing ? (
													<input
														ref={inputRef}
														type="text"
														className="h-full w-full rounded border border-primary bg-background px-1.5 py-0.5 text-foreground outline-none focus:border-primary"
														value={editingWorkspaceName}
														onChange={handleWorkspaceInputChange}
														onKeyDown={handleInputKeyDown}
														onBlur={handleWorkspaceInputBlur}
														autoFocus
														onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()
														}}
														onDragStart={(e) => {
															e.preventDefault()
															e.stopPropagation()
														}}
														onMouseDown={(e) => {
															e.stopPropagation()
														}}
														style={{ userSelect: "text" }}
														data-testid="handle-workspace-input-change"
													/>
												) : (
													<SmartTooltip maxWidth={320} placement="bottom">
														{workspace.name ||
															t("workspace.unnamedWorkspace")}
													</SmartTooltip>
												)}
											</div>
											{!isEditing && (
												<WorkspaceActionButtons
													workspace={workspace}
													selectedWorkspace={selectedWorkspace}
													onEdit={(e) => {
														handleStartEditWorkspace(workspace, e)
													}}
													onDelete={openDeleteModal}
													onRename={() =>
														handleStartEditWorkspace(
															workspace,
															{} as React.MouseEvent<HTMLDivElement>,
														)
													}
													onMenuClose={() => setOpen(false)}
													onTransferStart={() => setOpen(false)}
												/>
											)}
										</a>
									)
								})}
					</ScrollArea>
				),
			},
			{
				key: "addWorkspace",
				className: "[--magic-control-item-bg-hover:transparent]",
				style: { margin: "0 10px" },
				label: (
					<div
						className="mb-1 flex h-8 w-full cursor-pointer select-none items-center gap-1 rounded px-2.5 py-1.5 font-normal leading-5 text-foreground last:mb-0 hover:bg-accent active:bg-muted active:text-foreground"
						onClick={openCreateWorkspaceModal}
						data-testid="super-workspaces-menu-add-workspace-button"
					>
						<IconPlus size={16} />
						<div>{t("workspace.addWorkspace")}</div>
					</div>
				),
			},
		] as Exclude<MenuProps["items"], undefined>

		items.push(
			{
				type: "divider",
				style: { margin: "6px 0" },
			},
			{
				key: "shareWorkspace",
				style: { margin: "6px" },
				label: (
					<div
						onClick={() => {
							setOpen(false)
							setShareProjectsPanelOpen(true)
						}}
						data-testid="super-workspaces-menu-collaboration-workspace-button"
					>
						<CollaborationWorkspace />
					</div>
				),
			},
		)

		return items
	}, [
		loading,
		workspaces,
		t,
		editingWorkspaceId,
		selectedWorkspace?.id,
		editingWorkspaceName,
		handleWorkspaceInputChange,
		handleInputKeyDown,
		handleWorkspaceInputBlur,
		handleInnerWorkspaceMenuClick,
		handleStartEditWorkspace,
		openCreateWorkspaceModal,
		openDeleteModal,
	])

	const workspaceName = useMemo(() => {
		if (isCollaborationWorkspace(selectedWorkspace)) {
			return t("workspace.shareWorkspaceName")
		}
		return selectedWorkspace?.name || t("workspace.unnamedWorkspace")
	}, [selectedWorkspace, t])

	/** Keep workspace breadcrumb clicks within the dropdown. */
	const handleWorkspaceClick = useMemoizedFn((e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault()
		e.stopPropagation()
	})

	return (
		<>
			<Dropdown
				menu={{ items: workspaceItems }}
				overlayClassName="z-dropdown [&_.magic-dropdown-menu]:!w-[300px] [&_.magic-dropdown-menu]:!p-0 [&_.magic-dropdown-menu-item]:!p-0 [&_.magic-dropdown-menu-item]:!mb-1.5 [&_.magic-dropdown-menu-title-content]:!w-full"
				trigger={["click"]}
				open={open}
				onOpenChange={setOpen}
			>
				<a
					href={selectedWorkspace ? getWorkspaceRouteUrl(selectedWorkspace.id) : "#"}
					className={cn(
						"flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-foreground",
						"hover:bg-accent hover:text-foreground",
					)}
					onClick={handleWorkspaceClick}
					data-testid="super-breadcrumb-workspace"
					data-workspace-id={selectedWorkspace?.id}
					data-workspace-name={workspaceName}
				>
					<SmartTooltip maxWidth={320} placement="right">
						{workspaceName}
					</SmartTooltip>
					<div className="flex items-center justify-center text-muted-foreground">
						<IconChevronDown size={16} />
					</div>
				</a>
			</Dropdown>

			{renderCreateWorkspaceModal()}

			{renderDeleteModal()}

			{shareProjectsPanelOpen && (
				<Suspense fallback={null}>
					<WorkspaceProjectsPanel
						open={shareProjectsPanelOpen}
						initialSource={{ type: "collaboration" }}
						onClose={() => setShareProjectsPanelOpen(false)}
					/>
				</Suspense>
			)}
		</>
	)
}

export default observer(WorkspacesMenu)
