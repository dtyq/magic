import { Loader2, Plus, RefreshCw, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn-ui/input-group"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface ProjectNavigationToolbarProps {
	recent?: boolean
	chats?: boolean
	disabled?: boolean
	isSearchMode: boolean
	searchValue: string
	isInitialWorkspaceListLoading: boolean
	isRefreshing: boolean
	onSearchValueChange: (value: string) => void
	searchWorkspaces: (value: string) => void
	handleSearchOpen: () => void
	handleSearchClose: () => void
	handleRefresh: () => Promise<void>
	handleStartCreateWorkspace: () => void
}

/** 复用原搜索、刷新和创建按钮；查询与创建状态仍归各列表，不与栏目切换绑定。 */
export default function ProjectNavigationToolbar({
	recent = false,
	chats = false,
	disabled = false,
	isSearchMode,
	searchValue,
	isInitialWorkspaceListLoading,
	isRefreshing,
	onSearchValueChange,
	searchWorkspaces,
	handleSearchOpen,
	handleSearchClose,
	handleRefresh,
	handleStartCreateWorkspace,
}: ProjectNavigationToolbarProps) {
	const { t } = useTranslation()
	const searchLabel = chats
		? t("super:chatList.searchPlaceholder")
		: recent
			? t("super:projectNavigation.searchRecent")
			: t("super:workspace.searchWorkspace")
	return (
		<div
			className="sticky top-[var(--project-navigation-tabs-height,0px)] z-20 shrink-0 bg-sidebar"
			data-sidebar-navigation-header="toolbar"
			data-testid={
				chats
					? "sidebar-chats-toolbar"
					: recent
						? "sidebar-recent-projects-toolbar"
						: "sidebar-workspace-list-sticky-header"
			}
		>
			{isSearchMode ? (
				<div className="flex h-9 items-center gap-1 px-2 duration-200 animate-in fade-in">
					<InputGroup className="h-7 flex-1 rounded-md bg-sidebar duration-300 animate-in fade-in slide-in-from-left-4 [&:has([data-slot=input-group-control]:focus-visible)]:border-sidebar-border [&:has([data-slot=input-group-control]:focus-visible)]:ring-0">
						<InputGroupAddon
							align="inline-start"
							className="text-sidebar-foreground/70"
						>
							<Search size={16} />
						</InputGroupAddon>
						<InputGroupInput
							className="h-6"
							placeholder={searchLabel}
							aria-label={searchLabel}
							disabled={disabled}
							value={searchValue}
							onChange={(event) => onSearchValueChange(event.target.value)}
							onValueChangeAfterComposition={searchWorkspaces}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									event.stopPropagation()
									handleSearchClose()
								}
							}}
							autoFocus
							data-testid="sidebar-workspace-list-search-input"
						/>
					</InputGroup>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-6 text-sidebar-foreground/80 duration-300 animate-in fade-in focus-visible:ring-1"
						onClick={handleSearchClose}
						disabled={disabled}
						aria-label={t("common.cancel")}
						data-testid="sidebar-workspace-list-search-close"
					>
						<X className="size-4" />
					</Button>
				</div>
			) : (
				<div className="flex h-8 shrink-0 items-center justify-between gap-2 px-2">
					<span className="min-w-0 flex-1 truncate text-xs leading-4 text-sidebar-foreground/70">
						{chats
							? t("sidebar:chats.title")
							: recent
								? t("super:projectNavigation.recentScope")
								: t("super:projectNavigation.workspaceScope")}
					</span>
					<div
						className={cn(
							"flex items-center gap-0.5 text-sidebar-foreground/80",
							"group-data-[collapsible=icon]:hidden",
							isSearchMode && "hidden",
						)}
						data-testid="sidebar-workspace-list-actions"
					>
						<button
							type="button"
							aria-label={searchLabel}
							disabled={disabled}
							data-testid="sidebar-workspace-list-search"
							className="outline-hidden relative flex size-6 shrink-0 items-center justify-center rounded-md p-0 ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:ring-1 [&>svg]:size-4"
							onClick={handleSearchOpen}
						>
							<Search className="h-4 w-4" />
						</button>
						{isInitialWorkspaceListLoading && (
							<Loader2
								className="h-4 w-4 shrink-0 animate-spin"
								aria-hidden
								data-testid="sidebar-workspace-list-loading"
							/>
						)}
						<button
							type="button"
							aria-label={
								chats ? t("sidebar:chats.refresh") : t("sidebar:workspace.refresh")
							}
							data-testid="sidebar-workspace-list-refresh"
							disabled={disabled || isRefreshing}
							className={cn(
								"outline-hidden relative flex size-6 shrink-0 items-center justify-center rounded-md p-0 ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:ring-1 [&>svg]:size-4",
								"after:absolute after:-inset-2 md:after:hidden",
							)}
							onClick={() => void handleRefresh()}
						>
							<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
						</button>
						<button
							type="button"
							aria-label={
								chats
									? t("sidebar:chats.newChat")
									: recent
										? t("super:sidebarPanels.createProject")
										: t("sidebar:workspace.add")
							}
							disabled={disabled}
							data-testid="sidebar-workspace-list-add"
							className={cn(
								"outline-hidden relative flex size-6 shrink-0 items-center justify-center rounded-md p-0 ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:ring-1 [&>svg]:size-4",
								"after:absolute after:-inset-2 md:after:hidden",
							)}
							onClick={handleStartCreateWorkspace}
						>
							<Plus className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
