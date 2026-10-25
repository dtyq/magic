import { useChatSidebarSelection } from "../hooks/useChatSidebarSelection"
import ProjectNavigationToolbar from "../ProjectNavigationToolbar"
import ChatWorkspaceItem, { type ChatWorkspaceItemHandle } from "../ChatWorkspaceItem"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from "react"
import { observer } from "mobx-react-lite"
import { toJS } from "mobx"
import { useRequest } from "ahooks"
import { useImmer } from "use-immer"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sidebarStore } from "@/stores/layout"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import superMagicService from "@/pages/superMagic/services"
import { SuperMagicApi } from "@/apis"
import {
	WorkspaceStatus,
	type ProjectListItem,
	type Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import WorkspaceItem from "./WorkspaceItem"
import CreateWorkspaceInput from "./CreateWorkspaceInput"
import { cn } from "@/utils/cn"
import { toTestIdSegment } from "@/utils/testid"
import { SidebarMenu } from "@/components/shadcn-ui/sidebar"
import { SCROLL_HINT_HEIGHTS } from "@/components/shadcn-ui/scroll-area"
import { useWorkspaceListDnd } from "./useWorkspaceListDnd"
import { useProjectPinBoundaryConfirmation } from "./ProjectPinBoundaryConfirmDialog"
import { subscribeWorkspaceSearchInvalidation } from "@/pages/superMagic/services/workspaceListSearchInvalidation"
import { isHomeOnboardingSidebarTopMode } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"

const SEARCH_PAGE_SIZE = 20

interface WorkspaceListProps {
	scrollRef: RefObject<HTMLDivElement>
	scrollAreaRef: RefObject<HTMLDivElement>
	onBusyChange?: (busy: boolean) => void
	beforeItems?: ReactNode
	onSelect?: () => void
	onOpenManager: (workspace: Workspace) => void
}

function WorkspaceList({
	beforeItems,
	onSelect,
	onOpenManager,
	onBusyChange,
	scrollRef,
	scrollAreaRef,
}: WorkspaceListProps) {
	const { t } = useTranslation()
	const isExpanded = sidebarStore.workspacesExpanded
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isSearchMode, setIsSearchMode] = useState(false)
	const [chatSearchKeyword, setChatSearchKeyword] = useState("")
	const chatWorkspaceRef = useRef<ChatWorkspaceItemHandle>(null)
	const [busyWorkspaces, setBusyWorkspaces] = useState<Set<string>>(new Set())
	const onWorkspaceBusyChange = useCallback((id: string, busy: boolean) => {
		setBusyWorkspaces((previous) => {
			if (previous.has(id) === busy) return previous
			const next = new Set(previous)
			if (busy) next.add(id)
			else next.delete(id)
			return next
		})
	}, [])
	const onChatBusyChange = useCallback(
		(busy: boolean) => onWorkspaceBusyChange("sidebar-my-chats", busy),
		[onWorkspaceBusyChange],
	)
	useEffect(() => {
		onBusyChange?.(isCreatingWorkspace || busyWorkspaces.size > 0)
	}, [isCreatingWorkspace, busyWorkspaces, onBusyChange])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])
	const [searchState, updateSearchState] = useImmer({
		value: "",
		workspaces: [] as Workspace[],
		projects: [] as ProjectListItem[],
		page: 1,
		hasMoreWorkspaces: true,
		hasMoreProjects: true,
		failed: false,
	})
	const [isLoadingMoreWorkspaces, setIsLoadingMoreWorkspaces] = useState(false)
	const [workspacePage, setWorkspacePage] = useState(1)
	const [hasMoreWorkspaces, setHasMoreWorkspaces] = useState(true)
	const workspaces = workspaceStore.workspaces
	const hasRequestedInitialLoadRef = useRef(false)
	const isInitialWorkspaceListLoading =
		workspaceStore.isWorkspaceListLoading && workspaces.length === 0
	const { isChatRoute } = useChatSidebarSelection()
	const selectedWorkspaceId = isChatRoute ? undefined : workspaceStore.selectedWorkspace?.id
	const lastLocatedWorkspace = useRef(
		sidebarStore.navigationScrollPositions.has("sidebar-scroll:expanded")
			? selectedWorkspaceId
			: undefined,
	)
	const workspaceListRef = useRef<HTMLDivElement>(null)
	const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
	const isLoadingMoreWorkspacesRef = useRef(false)
	// `useRequest` turns `loading` on only after debounce. This marker prevents
	// a visible sentinel from replacing the queued first search page with page two.
	const isSearchPendingRef = useRef(false)
	const projectsByWorkspaceId = useMemo(() => {
		const result = new Map<string, ProjectListItem[]>()
		for (const project of searchState.projects) {
			const projects = result.get(project.workspace_id) || []
			projects.push(project)
			result.set(project.workspace_id, projects)
		}
		return result
	}, [searchState.projects])
	const projectParentWorkspaces = useMemo(() => {
		const knownWorkspaces = new Map(
			[...workspaces, ...searchState.workspaces].map((workspace) => [
				workspace.id,
				workspace,
			]),
		)

		return Array.from(projectsByWorkspaceId.entries()).map(([workspaceId, projects]) => {
			const knownWorkspace = knownWorkspaces.get(workspaceId)
			if (knownWorkspace) return knownWorkspace

			const project = projects[0]
			// Project search already returns the parent ID and name. Build a search-only
			// projection so an unloaded paginated workspace can still contain its matches.
			return {
				id: workspaceId,
				name: project.workspace_name,
				is_archived: 0,
				current_topic_id: project.current_topic_id || "",
				current_project_id: project.id,
				workspace_status: WorkspaceStatus.WAITING,
				project_count: projects.length,
				workspace_type: "default",
			} satisfies Workspace
		})
	}, [projectsByWorkspaceId, searchState.workspaces, workspaces])
	const displayedWorkspaces = isSearchMode
		? Array.from(
				new Map(
					[...searchState.workspaces, ...projectParentWorkspaces].map((workspace) => [
						workspace.id,
						workspace,
					]),
				).values(),
			)
		: workspaces
	const [projectHeights, setProjectHeights] = useState<Record<string, number>>({})
	const workspaceLayoutKey = displayedWorkspaces
		.map(
			(workspace) =>
				`${workspace.id}:${(isSearchMode && projectsByWorkspaceId.has(workspace.id)) || sidebarStore.expandedWorkspaces.has(workspace.id)}`,
		)
		.join("|")
	useLayoutEffect(() => {
		const list = workspaceListRef.current
		if (!isExpanded || !list) return
		// When mounted in Sheet/portal without StrictMode, scrollAreaRef.current might not yet be
		// populated during the child layout pass. Fall back to finding the enclosing scroll area in DOM.
		const scrollArea =
			scrollAreaRef.current ?? list.closest<HTMLElement>("[data-slot=scroll-area]")
		if (!scrollArea) return
		const layoutContainer = scrollArea.closest<HTMLElement>("[data-sidebar-project-navigation]")
		const measure = () => {
			// A Sheet portal can mount before its flex layout has a usable height.
			// Fall back to window height so virtualization is never blocked with 0 or undefined height.
			const containerHeight =
				scrollArea.clientHeight > 0
					? scrollArea.clientHeight
					: typeof window !== "undefined"
						? Math.max(200, window.innerHeight - 180)
						: 0
			const items = Array.from(
				list.querySelectorAll<HTMLElement>("[data-sidebar-workspace-root]"),
			)
			// Re-read visibility after the floating sidebar settles; the overlapping tab keeps
			// its toolbar mounted even while hidden.
			const navigationHeaders = Array.from(
				scrollArea.querySelectorAll<HTMLElement>("[data-sidebar-navigation-header]"),
			).filter((header) => getComputedStyle(header).visibility !== "hidden")
			// 高度预算扣除双向提示的最大占位；提示显隐不再反过来改变项目高度和溢出状态。
			// 分类和操作栏吸顶后持续占位，项目列表与下一组标题使用剩余高度。
			const stickyHeight = navigationHeaders.reduce(
				(height, header) => height + header.offsetHeight,
				0,
			)
			const availableHeight = Math.max(
				0,
				containerHeight -
					SCROLL_HINT_HEIGHTS.top -
					SCROLL_HINT_HEIGHTS.bottom -
					stickyHeight,
			)
			const headers = items.map((item) =>
				item.querySelector<HTMLElement>("[data-sidebar-workspace-header]"),
			)
			const sizes = items.map(
				(item, index) =>
					(headers[index]?.offsetHeight ?? 0) +
					parseFloat(getComputedStyle(item).marginBottom),
			)
			const heights: Record<string, number> = {}
			items.forEach((item, index) => {
				const next = items[index + 1]
				let reserve = next ? sizes[index + 1] : 0
				// 下一组展开时只预留其标题；折叠且空间足够时，再露出一组标题。
				if (
					next?.dataset.workspaceExpanded === "false" &&
					items[index + 2] &&
					availableHeight - sizes[index] - reserve - sizes[index + 2] >= sizes[index]
				)
					reserve += sizes[index + 2]
				const workspaceId = item.dataset.sidebarDropWorkspaceId
				if (!workspaceId) return
				heights[workspaceId] = Math.max(0, availableHeight - sizes[index] - reserve)
			})
			setProjectHeights((previous) =>
				Object.keys(previous).length === items.length &&
				Object.entries(heights).every(([id, height]) => previous[id] === height)
					? previous
					: heights,
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(scrollArea)
		if (layoutContainer && layoutContainer !== scrollArea) observer.observe(layoutContainer)
		const items = Array.from(
			list.querySelectorAll<HTMLElement>("[data-sidebar-workspace-root]"),
		)
		const navigationHeaders = Array.from(
			scrollArea.querySelectorAll<HTMLElement>("[data-sidebar-navigation-header]"),
		)
		navigationHeaders.forEach((header) => observer.observe(header))
		items.forEach((item) => {
			const header = item.querySelector("[data-sidebar-workspace-header]")
			if (header) observer.observe(header)
		})
		// The first frame runs after Sheet has committed its portal and flex dimensions.
		const frameId = window.requestAnimationFrame(measure)
		return () => {
			window.cancelAnimationFrame(frameId)
			observer.disconnect()
		}
	}, [workspaceLayoutKey, isExpanded, scrollAreaRef])
	const { requestConfirmation, confirmationDialog } = useProjectPinBoundaryConfirmation()
	const {
		rootRef: dndRootRef,
		dropIndicatorRef,
		handleDragStart,
		handleDragMove,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDragEnd,
	} = useWorkspaceListDnd({
		workspaces,
		scrollRef,
		disabled: isSearchMode || !isExpanded,
		requestPinBoundaryConfirmation: requestConfirmation,
	})

	const defaultScrollTop = useRef(
		sidebarStore.navigationScrollPositions.get("sidebar-scroll:expanded") ?? 0,
	)
	const wasSearchModeRef = useRef(isSearchMode)
	useLayoutEffect(() => {
		const exitedSearch = wasSearchModeRef.current && !isSearchMode
		wasSearchModeRef.current = isSearchMode
		if (isExpanded && exitedSearch && scrollRef.current)
			scrollRef.current.scrollTop = defaultScrollTop.current
	}, [isSearchMode, isExpanded, scrollRef])
	useEffect(() => {
		const viewport = scrollRef.current
		if (!viewport || !isExpanded || isSearchMode) return
		const rememberPosition = () => {
			defaultScrollTop.current = viewport.scrollTop
		}
		viewport.addEventListener("scroll", rememberPosition, { passive: true })
		return () => viewport.removeEventListener("scroll", rememberPosition)
	}, [isExpanded, isSearchMode, scrollRef])

	function handleStartCreateWorkspace() {
		sidebarStore.selectNavigationSection("workspaces")
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
			// Keep manual refresh focused on sidebar data caches so the action
			// updates visible workspace/project lists without issuing extra status-only requests.
			await Promise.all([
				superMagicService.silentRefreshSidebarLoadedCaches(),
				chatWorkspaceRef.current?.refresh(),
			])
			if (isSearchMode) searchWorkspaces(searchState.value)
			setWorkspacePage(1)
			setHasMoreWorkspaces(true)
		} finally {
			setIsRefreshing(false)
		}
	}

	const loadMoreWorkspaces = useCallback(async () => {
		if (
			isLoadingMoreWorkspacesRef.current ||
			isLoadingMoreWorkspaces ||
			!hasMoreWorkspaces ||
			workspaceStore.isWorkspaceListLoading
		)
			return

		// IntersectionObserver can invoke its callback again before React commits
		// the loading state; the ref closes that short concurrent-request window.
		isLoadingMoreWorkspacesRef.current = true
		setIsLoadingMoreWorkspaces(true)
		try {
			const nextPage = workspacePage + 1
			const nextWorkspaces = await superMagicService.workspace.fetchWorkspaces({
				page: nextPage,
				pageSize: SEARCH_PAGE_SIZE,
				append: true,
				isAutoSelect: false,
				isSelectLast: false,
			})
			setWorkspacePage(nextPage)
			setHasMoreWorkspaces(nextWorkspaces.length === SEARCH_PAGE_SIZE)
		} finally {
			isLoadingMoreWorkspacesRef.current = false
			setIsLoadingMoreWorkspaces(false)
		}
	}, [hasMoreWorkspaces, isLoadingMoreWorkspaces, workspacePage])

	const {
		run: runSearch,
		cancel: cancelSearch,
		loading: isSearchLoading,
	} = useRequest(
		async ({ keyword, page, append }: { keyword: string; page: number; append: boolean }) => {
			const searchName = keyword.trim()
			return Promise.all([
				searchState.hasMoreWorkspaces || !append
					? SuperMagicApi.getWorkspaces({
							page,
							page_size: SEARCH_PAGE_SIZE,
							workspace_name: searchName,
						})
					: Promise.resolve(null),
				searchState.hasMoreProjects || !append
					? SuperMagicApi.getProjectsWithCollaboration({
							page,
							page_size: 100,
							project_name: searchName,
						})
					: Promise.resolve(null),
			])
		},
		{
			manual: true,
			debounceWait: 300,
			onSuccess: ([workspaceResponse, projectResponse], [{ page, append }]) => {
				isSearchPendingRef.current = false
				const workspaceList = workspaceResponse?.list || []
				const projectList = projectResponse?.list || []
				updateSearchState((draft) => {
					draft.hasMoreWorkspaces = Boolean(
						workspaceResponse && page * SEARCH_PAGE_SIZE < workspaceResponse.total,
					)
					draft.workspaces = append
						? [...draft.workspaces, ...workspaceList]
						: workspaceList
					draft.projects = Array.from(
						new Map(
							[...(append ? draft.projects : []), ...projectList].map((project) => [
								project.id,
								project,
							]),
						).values(),
					)
					draft.hasMoreProjects = Boolean(
						projectResponse &&
						page * 100 < projectResponse.total &&
						projectList.length > 0,
					)
					draft.failed = false
					draft.page = page
				})
			},
			onError: (_error, [{ append }]) => {
				isSearchPendingRef.current = false
				updateSearchState((draft) => {
					draft.failed = true
				})
				if (!append) {
					updateSearchState((draft) => {
						draft.workspaces = []
						draft.projects = []
					})
				}
			},
		},
	)

	const searchWorkspaces = useCallback(
		(workspaceName: string) => {
			setChatSearchKeyword(workspaceName)
			if (!workspaceName.trim()) {
				cancelSearch()
				isSearchPendingRef.current = false
				updateSearchState((draft) => {
					draft.page = 1
					draft.hasMoreWorkspaces = true
					draft.hasMoreProjects = true
					draft.failed = false
					draft.workspaces = toJS(workspaces)
					draft.projects = []
				})
				return
			}

			// Invalidate a previous in-flight request before the next debounced search starts.
			cancelSearch()
			isSearchPendingRef.current = true
			updateSearchState((draft) => {
				draft.page = 1
				draft.hasMoreWorkspaces = true
				draft.hasMoreProjects = true
				draft.failed = false
			})
			runSearch({ keyword: workspaceName, page: 1, append: false })
		},
		[cancelSearch, runSearch, updateSearchState, workspaces],
	)

	useEffect(() => {
		return subscribeWorkspaceSearchInvalidation(() => {
			if (!isSearchMode) return
			// Refetch only after the mutation API has finished so the snapshot matches server state.
			searchWorkspaces(searchState.value)
		})
	}, [isSearchMode, searchState.value, searchWorkspaces])

	const loadNextPage = useCallback(() => {
		if (!isSearchMode) {
			void loadMoreWorkspaces()
			return
		}

		if (
			!searchState.value.trim() ||
			isSearchLoading ||
			isSearchPendingRef.current ||
			(!searchState.hasMoreWorkspaces && !searchState.hasMoreProjects) ||
			searchState.failed
		)
			return

		isSearchPendingRef.current = true
		runSearch({ keyword: searchState.value, page: searchState.page + 1, append: true })
	}, [
		isSearchLoading,
		isSearchMode,
		loadMoreWorkspaces,
		searchState.hasMoreWorkspaces,
		searchState.hasMoreProjects,
		searchState.failed,
		searchState.page,
		searchState.value,
		runSearch,
	])

	useEffect(() => {
		const sentinel = loadMoreSentinelRef.current
		if (!isExpanded || !sentinel || typeof IntersectionObserver === "undefined") return
		const scrollContainer = scrollRef.current
		if (!scrollContainer) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) loadNextPage()
			},
			// Observe the shared sidebar scroll container. An initially visible sentinel
			// naturally loads enough pages to fill tall screens without manual measurements.
			{ root: scrollContainer, threshold: 0 },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [displayedWorkspaces.length, loadNextPage, isExpanded, scrollRef])

	const handleSearchOpen = useCallback(() => {
		sidebarStore.selectNavigationSection("workspaces")
		updateSearchState((draft) => {
			draft.workspaces = toJS(workspaces)
			draft.projects = []
			draft.page = 1
			draft.hasMoreWorkspaces = true
			draft.hasMoreProjects = true
			draft.failed = false
		})
		setIsSearchMode(true)
	}, [updateSearchState, workspaces])

	const handleSearchClose = useCallback(() => {
		setChatSearchKeyword("")
		cancelSearch()
		isSearchPendingRef.current = false
		updateSearchState((draft) => {
			draft.value = ""
			draft.workspaces = []
			draft.projects = []
			draft.page = 1
			draft.hasMoreWorkspaces = true
			draft.hasMoreProjects = true
			draft.failed = false
		})
		setIsSearchMode(false)
	}, [cancelSearch, updateSearchState])

	useEffect(() => {
		if (workspaces.length > 0) return
		if (workspaceStore.isWorkspaceListLoading) return
		if (hasRequestedInitialLoadRef.current) return

		hasRequestedInitialLoadRef.current = true
		void superMagicService.workspace.fetchWorkspaces({
			page: 1,
			pageSize: SEARCH_PAGE_SIZE,
			isAutoSelect: false,
			isSelectLast: false,
		})
	}, [workspaces.length])

	useEffect(() => {
		// Remember the current selection when hiding this tab so reshow does not relocate.
		if (!isExpanded && selectedWorkspaceId) {
			lastLocatedWorkspace.current = selectedWorkspaceId
			return
		}
		if (
			!selectedWorkspaceId ||
			!isExpanded ||
			lastLocatedWorkspace.current === selectedWorkspaceId
		)
			return
		lastLocatedWorkspace.current = selectedWorkspaceId

		sidebarStore.setActiveWorkspace(selectedWorkspaceId)
		sidebarStore.setWorkspaceExpanded(selectedWorkspaceId, true)

		const workspaceIdSegment = toTestIdSegment(selectedWorkspaceId)
		const animationFrameId = window.requestAnimationFrame(() => {
			if (isHomeOnboardingSidebarTopMode()) {
				const scrollContainer = workspaceListRef.current?.closest<HTMLElement>(
					"[data-testid='sidebar-content-root']",
				)
				scrollContainer?.scrollTo({ top: 0, behavior: "auto" })
				return
			}
			const workspaceElement = workspaceListRef.current?.querySelector<HTMLElement>(
				`[data-workspace-id-segment="${workspaceIdSegment}"]`,
			)
			// Workspace items use scroll-margin-top for the sticky list header.
			// Without it, block:start tucks the first project under the workspace title.
			const viewport = scrollRef.current
			if (workspaceElement && viewport)
				viewport.scrollTo({
					top:
						viewport.scrollTop +
						workspaceElement.getBoundingClientRect().top -
						viewport.getBoundingClientRect().top -
						parseFloat(getComputedStyle(workspaceElement).scrollMarginTop),
					behavior: "smooth",
				})
		})

		return () => window.cancelAnimationFrame(animationFrameId)
	}, [selectedWorkspaceId, isExpanded, scrollRef])

	return (
		<div
			ref={dndRootRef}
			onDragStart={handleDragStart}
			onDrag={handleDragMove}
			onDragEnter={(event) => {
				if (event.currentTarget.contains(event.target as Node)) event.preventDefault()
			}}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onDragEnd={handleDragEnd}
			// Stay in flow when inactive so the shared tree scroll does not clamp.
			className="relative flex flex-col"
			data-guide-anchor="sidebar-workspace-list"
		>
			{confirmationDialog}
			<ProjectNavigationToolbar
				disabled={isCreatingWorkspace || busyWorkspaces.size > 0}
				isSearchMode={isSearchMode}
				searchValue={searchState.value}
				isInitialWorkspaceListLoading={isInitialWorkspaceListLoading}
				isRefreshing={isRefreshing}
				onSearchValueChange={(value) =>
					updateSearchState((draft) => {
						draft.value = value
					})
				}
				searchWorkspaces={searchWorkspaces}
				handleSearchOpen={handleSearchOpen}
				handleSearchClose={handleSearchClose}
				handleRefresh={handleRefresh}
				handleStartCreateWorkspace={handleStartCreateWorkspace}
			/>
			<div className="mt-1">
				<SidebarMenu>
					<div className="w-full">
						{beforeItems}
						<ChatWorkspaceItem
							ref={chatWorkspaceRef}
							active={isExpanded}
							searchKeyword={chatSearchKeyword}
							onBusyChange={onChatBusyChange}
							onSelect={onSelect}
						/>
						<div ref={workspaceListRef}>
							{isCreatingWorkspace && (
								<div className="w-full duration-150 animate-in fade-in slide-in-from-top-2">
									<CreateWorkspaceInput
										onCancel={handleCancelCreateWorkspace}
										onCreated={handleWorkspaceCreated}
									/>
								</div>
							)}
							{displayedWorkspaces.map((workspace, index) => (
								<WorkspaceItem
									active={isExpanded}
									key={workspace.id}
									workspace={workspace}
									scrollRef={scrollRef}
									maxProjectHeight={projectHeights[workspace.id]}
									onOpenManager={() => onOpenManager(workspace)}
									onBusyChange={onWorkspaceBusyChange}
									dndDisabled={isSearchMode}
									searchProjects={
										isSearchMode && projectsByWorkspaceId.has(workspace.id)
											? projectsByWorkspaceId.get(workspace.id)
											: undefined
									}
									className={cn(
										"mb-1",
										index === displayedWorkspaces.length - 1 && "mb-0",
									)}
								/>
							))}
							{isSearchLoading && (
								<div className="flex h-8 items-center justify-center text-xs text-muted-foreground">
									<Loader2 className="size-4 animate-spin" />
								</div>
							)}
							{!isSearchMode && isLoadingMoreWorkspaces && (
								<div className="flex h-8 items-center justify-center text-xs text-muted-foreground">
									<Loader2 className="size-4 animate-spin" />
								</div>
							)}
							{isSearchMode && searchState.failed && (
								<button
									type="button"
									className="w-full p-2 text-left text-xs text-muted-foreground"
									onClick={() => {
										isSearchPendingRef.current = true
										runSearch({
											keyword: searchState.value,
											page:
												searchState.projects.length ||
												searchState.workspaces.length
													? searchState.page + 1
													: 1,
											append: Boolean(
												searchState.projects.length ||
												searchState.workspaces.length,
											),
										})
									}}
								>
									{t("super:projectNavigation.retry")}
								</button>
							)}
							<div ref={loadMoreSentinelRef} className="h-px" aria-hidden="true" />
						</div>
					</div>
				</SidebarMenu>
			</div>
			<svg
				ref={dropIndicatorRef}
				aria-hidden="true"
				className="pointer-events-none absolute left-0 top-0 z-50 hidden h-2 overflow-visible text-[#b9dcff]"
			>
				<line x1="4" y1="4" x2="100%" y2="4" stroke="currentColor" strokeWidth="2" />
				<circle cx="4" cy="4" r="4" fill="currentColor" />
			</svg>
		</div>
	)
}

export default observer(WorkspaceList)
