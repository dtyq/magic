import { useChatSidebarSelection } from "./hooks/useChatSidebarSelection"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRequest } from "ahooks"
import { CirclePlus, Loader2, UsersRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import projectStore from "@/pages/superMagic/stores/core/project"
import superMagicService from "@/pages/superMagic/services"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import type { ProjectBrowserSource } from "@/pages/superMagic/components/WorkspacesMenu/components/WorkspaceProjectsPanel"
import SidebarCreateInput from "./components/SidebarCreateInput"
import CollapsedWorkspaceMenuWorkspaceItem from "./CollapsedWorkspaceMenuWorkspaceItem"
import CollapsedWorkspaceChatItem from "./CollapsedWorkspaceChatItem"
import { SidebarMenuButton } from "@/components/shadcn-ui/sidebar"
import { useCollapsedWorkspaceDnd } from "./useCollapsedWorkspaceDnd"
import { useProjectPinBoundaryConfirmation } from "./WorkspaceList/ProjectPinBoundaryConfirmDialog"

const WORKSPACE_PAGE_SIZE = 20
const CHAT_MENU_ID = "sidebar-my-chats"

interface CollapsedWorkspaceMenuProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onOpenManager: (source?: ProjectBrowserSource) => void
	onBusyChange: (busy: boolean) => void
	icon: ReactNode
}

const CollapsedWorkspaceMenu = observer(function CollapsedWorkspaceMenu({
	open: isOpen,
	onOpenChange: setIsOpen,
	onOpenManager,
	onBusyChange,
	icon,
}: CollapsedWorkspaceMenuProps) {
	const { t } = useTranslation()
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [chatBusy, setChatBusy] = useState(false)
	const [workspaceName, setWorkspaceName] = useState("")
	const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false)
	const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null)
	const [busyWorkspaceIds, setBusyWorkspaceIds] = useState<Set<string>>(new Set())
	const handleProjectBusyChange = useCallback((workspaceId: string, busy: boolean) => {
		setBusyWorkspaceIds((previous) => {
			if (previous.has(workspaceId) === busy) return previous
			const next = new Set(previous)
			if (busy) next.add(workspaceId)
			else next.delete(workspaceId)
			return next
		})
	}, [])
	const handleProjectMenuChange = (workspaceId: string | null) => {
		if ((chatBusy || busyWorkspaceIds.size > 0) && workspaceId !== openProjectMenuId) return
		setOpenProjectMenuId(workspaceId)
	}

	const [workspacePage, setWorkspacePage] = useState(1)
	const [hasMoreWorkspaces, setHasMoreWorkspaces] = useState(true)
	const workspaceScrollRef = useRef<HTMLDivElement>(null)

	const selectedWorkspace = workspaceStore.selectedWorkspace
	const workspaces = workspaceStore.workspaces
	const { isChatRoute } = useChatSidebarSelection()
	const isShareWorkspaceActive = !isChatRoute && isCollaborationWorkspace(selectedWorkspace)
	const { requestConfirmation, confirmationDialog, isConfirmationOpen } =
		useProjectPinBoundaryConfirmation()
	const { rootRef: dndRootRef } = useCollapsedWorkspaceDnd({
		workspaces,
		enabled: isOpen,
		openProjectMenuId,
		onProjectMenuChange: handleProjectMenuChange,
		requestPinBoundaryConfirmation: requestConfirmation,
	})

	function handleProjectClick(projectId: string, workspaceId: string) {
		const projects = projectStore.getProjectsByWorkspace(workspaceId)
		const project = projects.find((p) => p.id === projectId)
		if (project) {
			superMagicService.switchProjectInDesktop(project)
			setIsOpen(false)
		}
	}

	function handleCloseAllPopovers() {
		setOpenProjectMenuId(null)
		setIsOpen(false)
	}

	function openProjectManager(source?: ProjectBrowserSource) {
		if (isConfirmationOpen || isCreatingWorkspace || chatBusy || busyWorkspaceIds.size > 0)
			return
		handleCloseAllPopovers()
		onOpenManager(source)
	}

	useEffect(() => {
		onBusyChange(
			isConfirmationOpen || isCreatingWorkspace || chatBusy || busyWorkspaceIds.size > 0,
		)
	}, [isConfirmationOpen, isCreatingWorkspace, chatBusy, busyWorkspaceIds, onBusyChange])
	useEffect(() => () => onBusyChange(false), [onBusyChange])
	useEffect(() => {
		if (!isOpen) setOpenProjectMenuId(null)
	}, [isOpen])

	const { run: fetchWorkspacePage, loading: isLoadingMoreWorkspaces } = useRequest(
		(page: number, append: boolean) =>
			superMagicService.workspace.fetchWorkspaces({
				page,
				pageSize: WORKSPACE_PAGE_SIZE,
				append,
				isAutoSelect: false,
				isSelectLast: false,
			}),
		{
			manual: true,
			onSuccess: (items, [page]) => {
				setWorkspacePage(page)
				setHasMoreWorkspaces(items.length === WORKSPACE_PAGE_SIZE)
			},
		},
	)

	useEffect(() => {
		const scrollElement = workspaceScrollRef.current?.querySelector(
			"[data-slot='scroll-area-viewport']",
		) as HTMLElement

		if (!scrollElement) return

		const handleScroll = () => {
			if (openProjectMenuId && !chatBusy && busyWorkspaceIds.size === 0) {
				setOpenProjectMenuId(null)
			}
			if (
				scrollElement.scrollTop + scrollElement.clientHeight >=
				scrollElement.scrollHeight - 40
			) {
				if (!isLoadingMoreWorkspaces && hasMoreWorkspaces) {
					fetchWorkspacePage(workspacePage + 1, true)
				}
			}
		}

		scrollElement.addEventListener("scroll", handleScroll)
		return () => scrollElement.removeEventListener("scroll", handleScroll)
	}, [
		isOpen,
		chatBusy,
		busyWorkspaceIds,
		fetchWorkspacePage,
		hasMoreWorkspaces,
		isLoadingMoreWorkspaces,
		openProjectMenuId,
		workspacePage,
		workspaces.length,
	])

	async function handleCreateWorkspace() {
		const trimmedName = workspaceName.trim()
		if (!trimmedName || isSubmittingWorkspace) return

		setIsSubmittingWorkspace(true)
		try {
			await superMagicService.createWorkspace(trimmedName)
			setIsCreatingWorkspace(false)
			setWorkspaceName("")
			setIsOpen(false)
		} catch (error) {
			console.error("Failed to create workspace in collapsed menu:", error)
		} finally {
			setIsSubmittingWorkspace(false)
		}
	}

	function handleCancelCreateWorkspace() {
		setIsCreatingWorkspace(false)
		setWorkspaceName("")
	}

	function handleWorkspacePopoverOpenChange(open: boolean) {
		setIsOpen(open)
		if (open) {
			setWorkspacePage(1)
			setHasMoreWorkspaces(true)
			fetchWorkspacePage(1, false)
		}
	}

	const renderWorkspaceItems = () =>
		workspaces.map((workspace) => {
			const isActive = !isChatRoute && selectedWorkspace?.id === workspace.id
			return (
				<CollapsedWorkspaceMenuWorkspaceItem
					key={workspace.id}
					workspace={workspace}
					isActive={isActive}
					onProjectClick={handleProjectClick}
					openProjectMenuId={openProjectMenuId}
					onProjectMenuChange={handleProjectMenuChange}
					onBusyChange={handleProjectBusyChange}
					onRequestCloseAll={handleCloseAllPopovers}
					keepPopoverOpen={isConfirmationOpen}
					onOpenManager={() => openProjectManager({ type: "workspace", workspace })}
				/>
			)
		})

	return (
		<div
			className="flex shrink-0 flex-col items-center"
			data-testid="sidebar-collapsed-workspace-menu"
		>
			{confirmationDialog}
			<div className="flex w-8 shrink-0 flex-col items-start gap-1">
				<Popover
					open={isOpen}
					onOpenChange={(open) => {
						if (
							!open &&
							(isConfirmationOpen ||
								isCreatingWorkspace ||
								chatBusy ||
								busyWorkspaceIds.size > 0)
						)
							return
						handleWorkspacePopoverOpenChange(open)
					}}
					modal={false}
				>
					<PopoverTrigger asChild>
						<span>
							<SidebarMenuButton
								tooltip={t("super:projectNavigation.workspaces")}
								aria-label={t("super:projectNavigation.workspaces")}
								data-testid="sidebar-collapsed-workspace-menu-button"
								className="text-sidebar-foreground"
							>
								{icon}
							</SidebarMenuButton>
						</span>
					</PopoverTrigger>
					<PopoverContent
						side="right"
						align="start"
						className="flex max-h-[var(--radix-popover-content-available-height)] w-[240px] flex-col p-1 shadow-xs"
						data-testid="sidebar-collapsed-workspace-popover"
						onEscapeKeyDown={(e) => {
							if (isCreatingWorkspace) {
								e.preventDefault()
							}
						}}
					>
						<div className="flex h-8 shrink-0 items-center rounded-md px-2">
							<span className="truncate text-sm font-normal leading-5 text-sidebar-foreground">
								{t("sidebar:workspace.title")}
							</span>
						</div>
						<button
							type="button"
							className="flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
							onClick={() => setIsCreatingWorkspace(true)}
							data-testid="sidebar-collapsed-workspace-add"
						>
							<CirclePlus className="h-4 w-4 shrink-0 text-sidebar-foreground" />
							<span className="flex-1 truncate text-left text-sm leading-5 text-sidebar-foreground">
								{t("sidebar:workspace.add")}
							</span>
						</button>
						<div className="my-1 h-px w-full shrink-0 bg-border" />
						{isCreatingWorkspace && (
							<div className="mb-1 shrink-0">
								<SidebarCreateInput
									value={workspaceName}
									onValueChange={setWorkspaceName}
									onSubmit={handleCreateWorkspace}
									onCancel={handleCancelCreateWorkspace}
									placeholder={t("super:workspace.createWorkspaceTip")}
									disabled={isSubmittingWorkspace}
									inputTestId="sidebar-collapsed-workspace-create-input"
									submitButtonTestId="sidebar-collapsed-workspace-create-submit-button"
									cancelButtonTestId="sidebar-collapsed-workspace-create-cancel-button"
									submitButtonAriaLabel={t("common.confirm")}
									cancelButtonAriaLabel={t("common.cancel")}
									stopKeyboardPropagation
								/>
							</div>
						)}
						{/* Shared entries scroll together with ordinary workspaces, in the same order as the expanded sidebar. */}
						<ScrollArea
							ref={workspaceScrollRef}
							className="min-h-0 w-full [&_[data-slot='scroll-area-viewport']>div]:!block"
							viewportClassName="max-h-[min(60vh,500px)]"
						>
							<div
								ref={dndRootRef}
								className="space-y-1"
								data-collapsed-sidebar-dnd-workspace-list
							>
								<Button
									variant={isShareWorkspaceActive ? "secondary" : "ghost"}
									size="sm"
									className="h-8 w-full justify-start gap-2 px-2 font-normal text-sidebar-foreground"
									data-testid="sidebar-collapsed-workspace-share"
									onClick={() => openProjectManager({ type: "collaboration" })}
								>
									<UsersRound size={16} className="shrink-0" />
									<span className="truncate">
										{t("super:workspace.shareWorkspaceName")}
									</span>
								</Button>
								<CollapsedWorkspaceChatItem
									open={isOpen && openProjectMenuId === CHAT_MENU_ID}
									onOpenChange={(open) =>
										handleProjectMenuChange(open ? CHAT_MENU_ID : null)
									}
									onBusyChange={setChatBusy}
									onSelect={handleCloseAllPopovers}
									keepPopoverOpen={isConfirmationOpen}
								/>
								{workspaces.length > 0 ? (
									renderWorkspaceItems()
								) : (
									<div
										className="px-2 py-1 text-sm leading-none text-[#a3a3a3]"
										data-testid="sidebar-collapsed-workspace-empty"
									>
										{t("super:workspace.noWorkspaces")}
									</div>
								)}
								{isLoadingMoreWorkspaces && (
									<div className="flex h-6 items-center justify-center">
										<Loader2 className="size-4 animate-spin text-muted-foreground" />
									</div>
								)}
							</div>
						</ScrollArea>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	)
})

export default CollapsedWorkspaceMenu
