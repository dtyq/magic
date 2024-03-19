import { observer } from "mobx-react-lite"
import { Box, ChevronsUpDown, Ellipsis } from "lucide-react"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/opensource/components/shadcn-ui/dropdown-menu"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { MagicDropdown } from "@/opensource/components/base"
import { useWorkspaceDelete } from "@/opensource/pages/superMagic/components/WorkspacesMenu/useWorkspaceDelete"
import { useWorkspaceRename } from "@/opensource/pages/superMagic/components/WorkspacesMenu/useWorkspaceRename"
import { useWorkspaceActionMenu } from "@/opensource/pages/superMagic/hooks/useWorkspaceActionMenu"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import { isCollaborationWorkspace } from "@/opensource/pages/superMagic/constants"
import { workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import { getWorkspaceRouteUrl } from "@/opensource/pages/superMagic/utils/route"
import { cn } from "@/opensource/lib/utils"
import { sidebarStore } from "@/opensource/stores/layout"

const WorkspaceSwitcher = observer(function WorkspaceSwitcher() {
	const { t } = useTranslation("super")
	const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
	const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)

	const { selectedWorkspace, workspaces } = workspaceStore

	const { openDeleteModal, renderDeleteModal } = useWorkspaceDelete({
		getDeleteSuccessMessage: () => t("workspace.deleteWorkspaceSuccess"),
		getFallbackWorkspaceName: () => t("workspace.unnamedWorkspace"),
	})
	const { openRenameModal, renderRenameModal } = useWorkspaceRename()

	const { menuProps, nodes } = useWorkspaceActionMenu({
		workspace: selectedWorkspace,
		selectedWorkspace,
		onRename: openRenameModal,
		onDelete: openDeleteModal,
	})

	const workspaceName = useMemo(() => {
		if (isCollaborationWorkspace(selectedWorkspace)) {
			return t("workspace.shareWorkspaceName")
		}
		return selectedWorkspace?.name || t("workspace.unnamedWorkspace")
	}, [selectedWorkspace, t])

	const workspaceLabel = useMemo(
		() => `${t("assistant.workspaceSwitcherPrefix")} / ${workspaceName}`,
		[t, workspaceName],
	)
	const shouldLimitWorkspaceListHeight = loadingWorkspaces || workspaces.length > 8

	useEffect(() => {
		if (!workspaceDropdownOpen) return
		const shouldShowLoading = workspaces.length === 0
		if (shouldShowLoading) {
			setLoadingWorkspaces(true)
		}

		SuperMagicService.workspace
			.fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: false,
				page: 1,
			})
			.finally(() => {
				setLoadingWorkspaces(false)
			})
	}, [workspaceDropdownOpen, workspaces.length])

	const handleWorkspaceMenuClick = (workspaceId: string) => {
		const workspace = workspaces.find((item) => item.id === workspaceId)
		if (!workspace) return

		sidebarStore.setCollapsed(false)
		sidebarStore.setActiveWorkspace(workspace.id)
		sidebarStore.setWorkspaceExpanded(workspace.id, true)
		SuperMagicService.switchWorkspace(workspace)
	}

	function shouldHandleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
		return (
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey
		)
	}

	function handleWorkspaceLinkClick(event: MouseEvent<HTMLAnchorElement>, workspaceId: string) {
		if (!shouldHandleAnchorClick(event)) return
		event.preventDefault()
		setWorkspaceDropdownOpen(false)
		handleWorkspaceMenuClick(workspaceId)
	}

	return (
		<>
			<div className="flex items-center gap-2">
				<DropdownMenu open={workspaceDropdownOpen} onOpenChange={setWorkspaceDropdownOpen}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex h-8 items-center justify-center gap-2 rounded-md bg-secondary px-3 shadow-xs",
								"text-sm leading-5 text-secondary-foreground",
							)}
							data-testid="agents-header-workspace-switcher"
						>
							<span className="flex size-6 items-center justify-center">
								<Box size={16} strokeWidth={1.5} />
							</span>
							<span>{workspaceLabel}</span>
							<span className="flex size-6 items-center justify-center">
								<ChevronsUpDown size={16} strokeWidth={1.5} />
							</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="z-dropdown min-w-[280px] overflow-hidden rounded-md p-0"
						data-testid="agents-workspace-switcher-list-content"
					>
						<ScrollArea
							className={cn(
								"max-h-[300px]",
								shouldLimitWorkspaceListHeight ? "h-[300px]" : "h-auto",
							)}
						>
							<div className={cn("p-1", shouldLimitWorkspaceListHeight && "pr-3")}>
								{loadingWorkspaces && (
									<DropdownMenuItem
										disabled
										className="text-sm text-muted-foreground"
										data-testid="agents-workspace-switcher-list-loading"
									>
										{t("common.loading")}
									</DropdownMenuItem>
								)}
								{!loadingWorkspaces && workspaces.length === 0 && (
									<DropdownMenuItem
										disabled
										className="text-sm text-muted-foreground"
										data-testid="agents-workspace-switcher-list-empty"
									>
										{t("workspace.noWorkspaces")}
									</DropdownMenuItem>
								)}
								{!loadingWorkspaces &&
									workspaces.map((workspace) => {
										const isSelected = selectedWorkspace?.id === workspace.id
										const nextWorkspaceName =
											workspace.name || t("workspace.unnamedWorkspace")
										return (
											<DropdownMenuItem
												asChild
												key={workspace.id}
												className={cn(
													"min-w-[240px] rounded px-2 py-1.5 text-sm",
													isSelected &&
														"bg-accent font-medium text-foreground",
												)}
												data-testid={`agents-workspace-switcher-item-${workspace.id}`}
											>
												<a
													href={getWorkspaceRouteUrl(workspace.id)}
													onClick={(event) =>
														handleWorkspaceLinkClick(
															event,
															workspace.id,
														)
													}
													aria-current={isSelected ? "page" : undefined}
													className="text-current no-underline"
												>
													{nextWorkspaceName}
												</a>
											</DropdownMenuItem>
										)
									})}
							</div>
						</ScrollArea>
					</DropdownMenuContent>
				</DropdownMenu>

				<MagicDropdown
					menu={{ items: menuProps.items }}
					trigger={["click"]}
					placement="bottomLeft"
				>
					<button
						type="button"
						className={cn(
							"flex size-8 items-center justify-center rounded-md bg-secondary shadow-xs",
							"text-secondary-foreground",
						)}
						data-testid="agents-header-workspace-more"
					>
						<Ellipsis size={16} strokeWidth={1.5} />
					</button>
				</MagicDropdown>
			</div>

			{renderRenameModal()}
			{nodes}
			{renderDeleteModal()}
		</>
	)
})

export default WorkspaceSwitcher
