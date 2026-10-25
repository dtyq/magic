import {
	forwardRef,
	useImperativeHandle,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
	type CSSProperties,
} from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { Loader2, MessageCirclePlus, RefreshCw, Search } from "lucide-react"
import { MagicDropdown } from "@/components/base"
import SuperMagicService from "@/pages/superMagic/services"
import { roleStore } from "@/pages/superMagic/stores"
import { resolveProjectModeForCreate } from "@/services/superMagic/DefaultAgentSelectionService"
import { useChatWorkspace } from "@/pages/superMagic/hooks/useChatWorkspace"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useChatConversationList } from "@/pages/superMagicMobile/pages/ChatsPage/hooks/useChatConversationList"
import type { ChatConversationListItem } from "@/pages/superMagicMobile/pages/ChatsPage/hooks/useChatConversationList"
import { useDesktopChatProjectActions } from "@/pages/superMagic/hooks/useDesktopChatProjectActions"
import magicToast from "@/components/base/MagicToaster/utils"
import { subscribeChatConversationListInvalidation } from "@/pages/superMagic/services/chatConversationListInvalidation"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/utils/cn"
import {
	DESKTOP_CHATS_SUBMENU_LIST_CLASS_NAME,
	DESKTOP_CHATS_SUBMENU_POPUP_CLASS_NAME,
} from "./chats-submenu-config"
import ChatConversationSubMenuRow from "./ChatConversationSubMenuRow"
import ProjectNavigationToolbar from "./ProjectNavigationToolbar"
import { useChatSidebarSelection } from "./hooks/useChatSidebarSelection"

type ChatsSubMenuProps = {
	viewportMaxHeight?: CSSProperties["maxHeight"]
	searchKeyword?: string
	children?: ReactNode
	visible?: boolean
	onOpenChange?: (open: boolean) => void
	/** Reuse the popup data/actions in the navigation tab without a dropdown shell. */
	standalone?: boolean
	/** Embedded workspace lists retain loaded pages and use a bounded child viewport. */
	workspace?: boolean
	/** Allow page-level callers to place the same list beside their own trigger. */
	placement?: string
	active?: boolean
	onBusyChange?: (busy: boolean) => void
	onSelect?: () => void
	externalScrollRef?: RefObject<HTMLDivElement | null>
}

export interface ChatsSubMenuHandle {
	create: () => Promise<void>
	refresh: () => Promise<void>
}

const CHAT_SUBMENU_SKELETON_WIDTHS = ["w-[82%]", "w-[68%]", "w-[74%]", "w-[58%]", "w-[88%]"]

/** Renders one loading row with staggered widths so the chat list skeleton resembles real titles. */
function renderChatSubMenuSkeletonRow(widthClassName: string, index: number) {
	return (
		<div
			key={widthClassName}
			className="flex h-8 w-full items-center rounded-md px-2"
			data-testid="sidebar-chats-submenu-skeleton-item"
		>
			<div className="min-w-0 flex-1 space-y-1">
				<Skeleton
					className={cn("h-4 rounded-sm", widthClassName)}
					style={{ animationDelay: `${index * 80}ms` }}
				/>
			</div>
		</div>
	)
}

/** Shared desktop conversation list for the legacy popup and the navigation tab. */
const ChatsSubMenu = forwardRef<ChatsSubMenuHandle, ChatsSubMenuProps>(function ChatsSubMenu(
	{
		children,
		visible = true,
		onOpenChange,
		standalone = false,
		workspace = false,
		placement = "rightTop",
		active = false,
		onBusyChange,
		onSelect,
		externalScrollRef,
		searchKeyword,
		viewportMaxHeight,
	},
	ref,
) {
	const { t } = useTranslation(["sidebar", "super", "common", "interface"])
	const { projectId: activeConversationProjectId } = useChatSidebarSelection()
	const [open, setOpen] = useState(false)
	const [isSearchMode, setIsSearchMode] = useState(false)
	// Keep IME text local until the shared toolbar commits a complete search value.
	const [searchInput, setSearchInput] = useState("")
	useEffect(() => {
		onOpenChange?.(open)
	}, [open, onOpenChange])
	useEffect(() => () => onOpenChange?.(false), [onOpenChange])
	const [isCreatingChat, setIsCreatingChat] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const isCreatingChatRef = useRef(false)
	const isRefreshingRef = useRef(false)
	const listScrollViewportRef = useRef<HTMLDivElement | null>(null)
	const { chatWorkspace, createProjectInChatWorkspace, ensureChatWorkspace } = useChatWorkspace()
	const currentRole = roleStore.currentRole
	const {
		items,
		isInitialChatListLoading,
		isLoadingMore,
		searchValue,
		setSearchValue,
		isEmpty,
		isSearchEmpty,
		hasMore,
		loadMore,
		reload,
		optimisticUpdatePin,
	} = useChatConversationList()
	// The workspace toolbar commits IME input; the shared list hook retains its server debounce.
	useEffect(() => {
		if (searchKeyword !== undefined) setSearchValue(searchKeyword)
	}, [searchKeyword, setSearchValue])

	/** Mirror mobile InfiniteScroll: append the next page when the sentinel enters view. */
	const handleAutoLoadMore = useMemoizedFn(() => {
		void loadMore()
	})
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: externalScrollRef ?? listScrollViewportRef,
		disabled: (standalone && !active) || !hasMore || isLoadingMore || items.length === 0,
		onLoadMore: handleAutoLoadMore,
	})

	/** Refresh on open so sidebar order matches the latest mobile ChatsPage snapshot. */
	const handleSubMenuOpenChange = useMemoizedFn((nextOpen: boolean) => {
		setOpen(nextOpen)
		if (nextOpen) void reload({ silent: true })
	})

	/** Manual refresh mirrors mobile pull-to-refresh without replacing the visible list with skeleton. */
	const handleRefreshList = useMemoizedFn(async () => {
		if (isRefreshingRef.current) return

		isRefreshingRef.current = true
		setIsRefreshing(true)

		try {
			await reload({ silent: true })
		} finally {
			isRefreshingRef.current = false
			setIsRefreshing(false)
		}
	})
	useEffect(() => {
		return subscribeChatConversationListInvalidation(() => {
			void handleRefreshList()
		})
	}, [handleRefreshList])
	const { projectActions, projectActionComponents, updateCurrentActionItem, isProjectModalOpen } =
		useDesktopChatProjectActions({
			actionContext: "list",
			onProjectPinStateChanged: optimisticUpdatePin,
			onProjectChanged: () => reload({ silent: true }),
		})
	const [rowMenuOpen, setRowMenuOpen] = useState(false)
	useEffect(() => {
		onBusyChange?.(isCreatingChat || isRefreshing || rowMenuOpen || Boolean(isProjectModalOpen))
	}, [isCreatingChat, isRefreshing, rowMenuOpen, isProjectModalOpen, onBusyChange])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])
	// Refresh when returning from another section; keep the current search and cached rows.
	const refreshActivePanel = useMemoizedFn(() => void reload({ silent: true }))
	useEffect(() => {
		if (standalone && active && !workspace) refreshActivePanel()
	}, [standalone, active, workspace, refreshActivePanel])
	const projectActionMap = useMemo(
		() => new Map(projectActions.map((action) => [action.key, action])),
		[projectActions],
	)

	useEffect(() => {
		if (!visible) setOpen(false)
	}, [visible])

	/** Open a chat detail route using the shared chat project switcher. */
	const handleOpenConversation = useMemoizedFn(async (item: ChatConversationListItem) => {
		setOpen(false)
		const resolvedChatWorkspace = chatWorkspace ?? (await ensureChatWorkspace())
		await SuperMagicService.switchChatProject(item.project, null, {
			chatWorkspace: resolvedChatWorkspace,
		})
		onSelect?.()
	})

	/** Create a new chat project with the current home role/mode selection. */
	const handleCreateChat = useMemoizedFn(async () => {
		if (isCreatingChatRef.current) return

		isCreatingChatRef.current = true
		setIsCreatingChat(true)

		try {
			const createdProject = await createProjectInChatWorkspace({
				projectMode: resolveProjectModeForCreate(currentRole),
			})

			if (!createdProject?.project || !createdProject.topic) {
				magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
				return
			}

			setOpen(false)
			await reload({ silent: true })
			const resolvedChatWorkspace = chatWorkspace ?? (await ensureChatWorkspace())
			await SuperMagicService.switchChatProject(
				createdProject.project,
				createdProject.topic,
				{
					chatWorkspace: resolvedChatWorkspace,
				},
			)
			onSelect?.()
		} catch {
			magicToast.error(t("super:hierarchicalWorkspacePopup.createProjectFailed"))
		} finally {
			isCreatingChatRef.current = false
			setIsCreatingChat(false)
		}
	})

	useImperativeHandle(ref, () => ({ create: handleCreateChat, refresh: handleRefreshList }), [
		handleCreateChat,
		handleRefreshList,
	])

	/** Sync project context then run the mapped sidebar list action. */
	const runProjectAction = useMemoizedFn(
		(actionKey: "pinProject" | "rename" | "saveAsProject" | "delete") => {
			projectActionMap.get(actionKey)?.onClick?.()
		},
	)

	const handleRowMenuOpenChange = useMemoizedFn(
		(nextOpen: boolean, item: ChatConversationListItem) => {
			setRowMenuOpen(nextOpen)
			if (nextOpen) updateCurrentActionItem(item.project)
		},
	)

	/** Render loading, empty, loaded rows, and the infinite-scroll sentinel in one scroll viewport. */
	const renderListContent = () => (
		<div className={cn("box-border w-full space-y-1", !workspace && "mx-1 pr-1")}>
			{isInitialChatListLoading ? (
				<div className="flex flex-col gap-1" data-testid="sidebar-chats-submenu-skeleton">
					{CHAT_SUBMENU_SKELETON_WIDTHS.map(renderChatSubMenuSkeletonRow)}
				</div>
			) : null}

			{!isInitialChatListLoading && (isEmpty || isSearchEmpty) ? (
				<div
					className="px-2 py-6 text-center text-sm text-muted-foreground"
					data-testid="sidebar-chats-submenu-empty"
				>
					{t("sidebar:chats.empty")}
				</div>
			) : null}

			{items.map((item) => (
				<ChatConversationSubMenuRow
					key={item.id}
					item={item}
					isSelected={activeConversationProjectId === item.id}
					moreAriaLabel={t("sidebar:appsMenu.more")}
					pinLabel={projectActionMap.get("pinProject")?.label || t("super:chat.pinChat")}
					renameLabel={
						projectActionMap.get("rename")?.label || t("super:chat.renameChat")
					}
					saveAsLabel={
						projectActionMap.get("saveAsProject")?.label ||
						t("super:chat.saveAsProject")
					}
					deleteLabel={
						projectActionMap.get("delete")?.label || t("super:chat.deleteChat")
					}
					onOpen={(targetItem) => void handleOpenConversation(targetItem)}
					onMenuOpenChange={handleRowMenuOpenChange}
					onPin={() => runProjectAction("pinProject")}
					onRename={() => runProjectAction("rename")}
					onSaveAsProject={() => runProjectAction("saveAsProject")}
					onDelete={() => runProjectAction("delete")}
				/>
			))}

			{items.length > 0 && hasMore ? (
				<div
					ref={loadMoreSentinelRef}
					className="flex h-8 items-center justify-center py-1"
					data-testid="sidebar-chats-submenu-load-more-sentinel"
				>
					{isLoadingMore ? (
						<Loader2
							className="size-4 animate-spin text-muted-foreground"
							data-testid="sidebar-chats-submenu-load-more-loading"
						/>
					) : null}
				</div>
			) : null}
		</div>
	)

	/** Compose the fixed popup chrome around a separately scrollable conversation list. */
	const renderPopup = () => (
		<div
			className={cn(
				"flex flex-col gap-1",
				standalone
					? "w-full bg-transparent p-0"
					: "rounded-md border border-border bg-popover p-1 shadow-xs",
				!standalone && DESKTOP_CHATS_SUBMENU_POPUP_CLASS_NAME,
			)}
			data-testid={standalone ? "sidebar-chats-panel" : "sidebar-chats-submenu-popup"}
		>
			{workspace ? null : standalone ? (
				<ProjectNavigationToolbar
					chats
					disabled={isCreatingChat || rowMenuOpen || Boolean(isProjectModalOpen)}
					isSearchMode={isSearchMode}
					searchValue={searchInput}
					isInitialWorkspaceListLoading={isInitialChatListLoading}
					isRefreshing={isRefreshing}
					onSearchValueChange={setSearchInput}
					searchWorkspaces={setSearchValue}
					handleSearchOpen={() => setIsSearchMode(true)}
					handleSearchClose={() => {
						setSearchInput("")
						setSearchValue("")
						setIsSearchMode(false)
					}}
					handleRefresh={handleRefreshList}
					handleStartCreateWorkspace={() => void handleCreateChat()}
				/>
			) : (
				<div className="flex shrink-0 flex-col gap-1">
					<div className="flex items-center justify-between gap-2 rounded-md px-2 py-0.5">
						<span className="min-w-0 truncate text-sm font-normal leading-5 text-sidebar-foreground">
							{t("sidebar:chats.title")}
						</span>
						<div className="flex shrink-0 items-center gap-0.5">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="!size-7 shrink-0"
								onClick={() => void handleRefreshList()}
								disabled={isRefreshing}
								aria-label={t("sidebar:chats.refresh")}
								data-testid="sidebar-chats-submenu-refresh-button"
							>
								<RefreshCw
									className={cn("size-4", isRefreshing && "animate-spin")}
								/>
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="!size-7 shrink-0"
								onClick={() => void handleCreateChat()}
								disabled={isCreatingChat}
								aria-label={t("sidebar:chats.newChat")}
								data-testid="sidebar-chats-submenu-new-chat-button"
							>
								{isCreatingChat ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<MessageCirclePlus className="size-4" />
								)}
							</Button>
						</div>
					</div>

					<div className="pb-1 pl-1 pr-2">
						<div className="relative w-full">
							<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
								placeholder={t("super:chatList.searchPlaceholder")}
								aria-label={t("super:chatList.searchPlaceholder")}
								className="h-8 w-full pl-7 text-sm"
								data-testid="sidebar-chats-submenu-search-input"
							/>
						</div>
					</div>
				</div>
			)}

			{/* Tabs share the sidebar viewport; popups retain their own bounded viewport. */}
			{standalone && !workspace ? (
				renderListContent()
			) : (
				<ScrollArea
					viewportRef={listScrollViewportRef}
					className={cn(
						"w-full shrink-0",
						workspace
							? "[&>[data-slot=scroll-area-scrollbar]]:w-[2px] [&>[data-slot=scroll-area-scrollbar]]:border-0 [&>[data-slot=scroll-area-scrollbar]]:p-0"
							: "[&_[data-slot='scroll-area-scrollbar']]:-mr-1 [&_[data-slot='scroll-area-viewport']>div]:pr-2",
						!workspace && DESKTOP_CHATS_SUBMENU_LIST_CLASS_NAME,
					)}
					viewportClassName={cn(
						"overscroll-y-auto overscroll-x-contain [&>div]:!block",
						// Chrome 100 uses vh; newer browsers can follow the dynamic viewport.
						workspace &&
							!viewportMaxHeight &&
							"max-h-[min(40vh,400px)] supports-[height:100dvh]:max-h-[min(40dvh,400px)]",
					)}
					viewportStyle={
						workspace && viewportMaxHeight
							? { maxHeight: viewportMaxHeight }
							: undefined
					}
				>
					{renderListContent()}
				</ScrollArea>
			)}

			{projectActionComponents}
		</div>
	)

	if (standalone) return renderPopup()

	return (
		<MagicDropdown
			placement={placement}
			popupRender={renderPopup}
			open={open}
			onOpenChange={handleSubMenuOpenChange}
			overlayClassName="p-0"
			trigger={["click"]}
		>
			<span className="inline-flex w-full" data-testid="sidebar-chats-submenu-trigger">
				{children}
			</span>
		</MagicDropdown>
	)
})

export default observer(ChatsSubMenu)
