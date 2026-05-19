import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sidebarStore } from "@/stores/layout"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import superMagicService from "@/pages/superMagic/services"
import WorkspaceItem from "./WorkspaceItem"
import CreateWorkspaceInput from "./CreateWorkspaceInput"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"
import { toTestIdSegment } from "@/utils/testid"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
} from "@/components/shadcn-ui/sidebar"
import statusPollingService from "@/pages/superMagic/services/statusPollingService"

function WorkspaceList() {
	const { t } = useTranslation()
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const workspaces = workspaceStore.workspaces
	const hasRequestedInitialLoadRef = useRef(false)
	const isInitialWorkspaceListLoading =
		workspaceStore.isWorkspaceListLoading && workspaces.length === 0
	const selectedWorkspaceId = workspaceStore.selectedWorkspace?.id
	const workspaceListRef = useRef<HTMLDivElement>(null)

	function handleStartCreateWorkspace() {
		setIsCreatingWorkspace(true)
	}

	function handleCancelCreateWorkspace() {
		setIsCreatingWorkspace(false)
	}

	function handleWorkspaceCreated() {
		setIsCreatingWorkspace(false)
	}

	async function handleRefresh() {
		if (isRefreshing) return
		setIsRefreshing(true)
		try {
			await statusPollingService.refreshResourceStatus()
		} finally {
			setIsRefreshing(false)
		}
	}

	useEffect(() => {
		if (workspaces.length > 0) return
		if (workspaceStore.isWorkspaceListLoading) return
		if (hasRequestedInitialLoadRef.current) return

		hasRequestedInitialLoadRef.current = true
		void superMagicService.workspace.fetchWorkspaces({
			page: 1,
			isAutoSelect: false,
			isSelectLast: false,
		})
	}, [workspaces.length])

	useEffect(() => {
		if (!selectedWorkspaceId) return

		sidebarStore.setActiveWorkspace(selectedWorkspaceId)
		sidebarStore.setWorkspaceExpanded(selectedWorkspaceId, true)

		const workspaceIdSegment = toTestIdSegment(selectedWorkspaceId)
		const animationFrameId = window.requestAnimationFrame(() => {
			const workspaceElement = workspaceListRef.current?.querySelector<HTMLElement>(
				`[data-workspace-id-segment="${workspaceIdSegment}"]`,
			)
			workspaceElement?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			})
		})

		return () => window.cancelAnimationFrame(animationFrameId)
	}, [selectedWorkspaceId, workspaces.length])

	return (
		<SidebarGroup
			className="flex min-h-0 w-full flex-col py-0 pl-2 pr-0"
			data-testid="sidebar-workspace-list"
		>
			<SidebarGroupLabel className="h-8 px-2 text-xs font-medium leading-4 text-[#737373] opacity-70 dark:text-[#a3a3a3] dark:opacity-100">
				{t("sidebar:workspace.title")}
			</SidebarGroupLabel>
			<div
				className={cn(
					"absolute right-3.5 top-1.5 z-10 flex items-center gap-0.5 opacity-70",
					"group-data-[collapsible=icon]:hidden",
				)}
				data-testid="sidebar-workspace-list-actions"
			>
				{isInitialWorkspaceListLoading && (
					<Loader2
						className="h-4 w-4 shrink-0 animate-spin text-[rgb(var(--muted-foreground-rgb))] opacity-70"
						aria-hidden
						data-testid="sidebar-workspace-list-loading"
					/>
				)}
				<button
					type="button"
					aria-label={t("sidebar:workspace.refresh")}
					data-testid="sidebar-workspace-list-refresh"
					disabled={isRefreshing}
					className={cn(
						"outline-hidden relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4",
						"after:absolute after:-inset-2 md:after:hidden",
					)}
					onClick={() => void handleRefresh()}
				>
					<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
				</button>
				<button
					type="button"
					aria-label={t("sidebar:workspace.add")}
					data-testid="sidebar-workspace-list-add"
					className={cn(
						"outline-hidden relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4",
						"after:absolute after:-inset-2 md:after:hidden",
					)}
					onClick={handleStartCreateWorkspace}
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
			<SidebarGroupContent className="flex min-h-0">
				<SidebarMenu className="h-full min-h-0">
					<ScrollArea
						className={cn(
							"h-full min-h-0 w-full scroll-smooth [&_[data-slot='scroll-area-scrollbar']]:bg-transparent",
							"[&_[data-slot='scroll-area-viewport']>div]:!block",
							"pr-3",
						)}
						viewportClassName="overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
					>
						<div ref={workspaceListRef}>
							{isCreatingWorkspace && (
								<div className="w-full duration-150 animate-in fade-in slide-in-from-top-2">
									<CreateWorkspaceInput
										onCancel={handleCancelCreateWorkspace}
										onCreated={handleWorkspaceCreated}
									/>
								</div>
							)}
							{workspaces.map((workspace, index) => (
								<WorkspaceItem
									key={workspace.id}
									workspace={workspace}
									className={cn(
										"mb-[2px]",
										index === workspaces.length - 1 && "mb-0",
									)}
								/>
							))}
						</div>
					</ScrollArea>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}

export default observer(WorkspaceList)
