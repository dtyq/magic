import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import recentProjectsStore from "@/pages/superMagic/stores/core/recentProjects"
import { projectStore } from "@/pages/superMagic/stores/core"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import useProjectWorkspace from "@/pages/superMagic/hooks/useProjectWorkspace"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"
import superMagicService from "@/pages/superMagic/services"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import dayjs from "@/infrastructure/vendors/dayjs"
import SmartTooltip from "@/components/other/SmartTooltip"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useVirtualProjectList } from "./hooks/useVirtualProjectList"
import CollapsedWorkspaceProjectRow from "./CollapsedWorkspaceProjectRow"
import ProjectNavigationToolbar from "./ProjectNavigationToolbar"
import { useRecentProjectSearch } from "./hooks/useRecentProjectSearch"
import { sidebarStore } from "@/stores/layout/SidebarStore"

const RecentProjectRow = observer(function RecentProjectRow({
	project,
	referenceNow,
	onSelect,
	onInteractionChange,
}: {
	project: ProjectListItem
	referenceNow: number
	onSelect?: () => void
	onInteractionChange: (id: string, active: boolean) => void
}) {
	const { i18n } = useTranslation("super")
	const [rowBusy, setRowBusy] = useState(false)
	const onRowInteractionChange = useCallback(
		(_id: string, active: boolean) => setRowBusy(active),
		[],
	)
	const { workspace, locationName } = useProjectWorkspace(project)

	const actions = useProjectItemActionProps({ selectedWorkspace: workspace })
	const tooltipDisabled = rowBusy || actions.isProjectModalOpen
	const lastActive = project.last_active_at ? dayjs(project.last_active_at) : null
	const activeTime = lastActive?.isValid() ? lastActive : null
	const locale = i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en"
	const modalWasOpen = useRef(false)
	useEffect(() => {
		if (modalWasOpen.current && !actions.isProjectModalOpen) recentProjectsStore.invalidate()
		modalWasOpen.current = actions.isProjectModalOpen
	}, [actions.isProjectModalOpen])
	useEffect(() => {
		onInteractionChange(project.id, rowBusy || actions.isProjectModalOpen)
	}, [project.id, rowBusy, actions.isProjectModalOpen, onInteractionChange])
	useEffect(() => () => onInteractionChange(project.id, false), [project.id, onInteractionChange])
	return (
		<>
			<CollapsedWorkspaceProjectRow
				project={project}
				showProjectTypeTag
				workspaceId={workspace.id}
				expandActionsOnHover
				isSelected={projectStore.selectedProject?.id === project.id}
				dndDisabled
				tooltipDisabled={actions.isProjectModalOpen}
				description={
					<div className="flex min-w-0 items-center gap-2">
						{tooltipDisabled ? (
							<span className="min-w-0 flex-1 truncate">{locationName}</span>
						) : (
							<SmartTooltip
								elementType="span"
								className="min-w-0 flex-1 text-[11px] leading-4"
							>
								{locationName}
							</SmartTooltip>
						)}
						{activeTime && (
							<MagicTooltip
								title={activeTime.format("YYYY-MM-DD HH:mm:ss [UTC]Z")}
								disabled={tooltipDisabled}
							>
								<time
									dateTime={activeTime.toISOString()}
									className="shrink-0 whitespace-nowrap"
								>
									{activeTime.locale(locale).from(referenceNow)}
								</time>
							</MagicTooltip>
						)}
					</div>
				}
				onInteractionChange={onRowInteractionChange}
				onSelectProject={async (item) => {
					await superMagicService.switchProjectInDesktop(item)
					onSelect?.()
				}}
				onOpenInNewWindow={openProjectInNewTab}
				onPinProject={actions.handleTogglePinProject}
				onCopyCollaborationLink={actions.handleCopyCollaborationLink}
				onTransferProject={actions.handleTransferProject}
				onMoveProject={actions.handleMoveProject}
				onAddCollaborators={actions.onAddCollaborators}
				onCancelWorkspaceShortcut={actions.handleCancelWorkspaceShortcutByProject}
				onDeleteProject={actions.handleDeleteProjectConfirm}
				onRenameProject={actions.handleRenameProject}
			/>
			{actions.projectModals}
		</>
	)
})

function RecentProjects({
	active,
	externalScrollRef,
	fitContent = false,
	onSelect,
	onBusyChange,
	onCreate,
}: {
	active: boolean
	externalScrollRef?: RefObject<HTMLDivElement>
	fitContent?: boolean
	onSelect?: () => void
	onBusyChange?: (busy: boolean) => void
	onCreate?: () => void
}) {
	const { t } = useTranslation("super")
	const [searchMode, setSearchMode] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [keyword, setKeyword] = useState("")
	const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
	const searching = Boolean(keyword.trim())
	const search = useRecentProjectSearch(keyword, active, busyIds.size > 0)
	const defaultScrollTop = useRef(
		sidebarStore.navigationScrollPositions.get(
			externalScrollRef ? "sidebar-scroll:expanded" : "recent-projects",
		) ?? 0,
	)
	const [referenceNow, setReferenceNow] = useState(() => Date.now())
	useEffect(() => {
		if (!active) return
		let timer: ReturnType<typeof setInterval> | undefined
		// 全列表共享显示时钟；隐藏时停止，重新可见立即校时，不请求或重排项目。
		const updateVisibility = () => {
			clearInterval(timer)
			if (document.visibilityState !== "visible") return
			setReferenceNow(Date.now())
			timer = setInterval(() => setReferenceNow(Date.now()), 60_000)
		}
		updateVisibility()
		document.addEventListener("visibilitychange", updateVisibility)
		return () => {
			clearInterval(timer)
			document.removeEventListener("visibilitychange", updateVisibility)
		}
	}, [active])
	const panelRef = useRef<HTMLDivElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const [contentHeight, setContentHeight] = useState(0)
	useLayoutEffect(() => {
		const content = contentRef.current
		if (!fitContent || !active || !content) return
		// 浮层按完整虚拟高度和状态区收缩；只测内容，避免受限视口反过来缩短列表。
		const measure = () => setContentHeight(content.offsetHeight)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(content)
		return () => observer.disconnect()
	}, [active, fitContent])
	const { items, stale, error, hasMore } = searching ? search : recentProjectsStore
	const loading = searching ? search.loading || search.pending : recentProjectsStore.loading
	const loadMore = searching ? search.loadMore : recentProjectsStore.loadMore
	const list = useVirtualProjectList({
		externalScrollRef,
		listRef: externalScrollRef ? listRef : undefined,
		enabled: active,
		projects: items,
		// 两行信息使用 48px 点击区域，加上 4px 行间距，与实际虚拟行高度一致。
		rowHeight: 52,
		loadEnabled: active && busyIds.size === 0,
		scrollKey: searching ? "recent-project-search" : "recent-projects",
		hasMore,
		loading,
		error,
		onLoadMore: loadMore,
	})
	const viewportRef = externalScrollRef ?? list.scrollRef
	const wasSearchingRef = useRef(searching)
	useLayoutEffect(() => {
		const viewport = viewportRef.current
		const exitedSearch = wasSearchingRef.current && !searching
		wasSearchingRef.current = searching
		if (!active || !viewport) return
		if (searching) {
			// Shared scroll starts at this panel so search does not hide the toolbar.
			const searchTop =
				externalScrollRef && panelRef.current
					? viewport.scrollTop +
						panelRef.current.getBoundingClientRect().top -
						viewport.getBoundingClientRect().top -
						parseFloat(getComputedStyle(panelRef.current).scrollMarginTop)
					: 0
			viewport.scrollTop = Math.max(0, searchTop)
			return
		}
		// Shared tree: restore only after search. Private popover restores whenever shown.
		if (!externalScrollRef || exitedSearch) viewport.scrollTop = defaultScrollTop.current
	}, [active, keyword, searching, viewportRef, externalScrollRef])
	useEffect(() => {
		const viewport = viewportRef.current
		if (!active || searching || !viewport) return
		const rememberPosition = () => {
			defaultScrollTop.current = viewport.scrollTop
		}
		viewport.addEventListener("scroll", rememberPosition, { passive: true })
		return () => viewport.removeEventListener("scroll", rememberPosition)
	}, [active, searching, viewportRef])
	useLayoutEffect(() => {
		if (active && !searching && !recentProjectsStore.stale) recentProjectsStore.invalidate()
	}, [active, searching])

	useEffect(() => {
		if (active && !searching && stale && !loading && !error && busyIds.size === 0)
			void recentProjectsStore.loadMore()
	}, [active, searching, stale, loading, error, busyIds.size])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])
	useEffect(() => {
		onBusyChange?.(busyIds.size > 0)
	}, [busyIds, onBusyChange])
	const setListInteraction = list.onInteractionChange
	const onInteractionChange = useMemo(
		() => (id: string, busy: boolean) => {
			setListInteraction(id, busy)
			setBusyIds((previous) => {
				if (previous.has(id) === busy) return previous
				const next = new Set(previous)
				if (busy) next.add(id)
				else next.delete(id)
				return next
			})
		},
		[setListInteraction],
	)
	const content = (
		<div ref={contentRef} className={cn(fitContent && "min-h-[76px] px-1")}>
			<div
				ref={listRef}
				className="relative w-full"
				style={{ height: list.virtualizer.getTotalSize() }}
			>
				{list.rows.map((row) => (
					<div
						key={row.key}
						ref={list.virtualizer.measureElement}
						data-index={row.index}
						data-virtual-project-id={items[row.index].id}
						className="absolute left-0 top-0 w-full pb-1"
						style={{ transform: `translateY(${row.start - list.scrollMargin}px)` }}
					>
						<RecentProjectRow
							project={items[row.index]}
							referenceNow={referenceNow}
							onSelect={onSelect}
							onInteractionChange={onInteractionChange}
						/>
					</div>
				))}
			</div>
			{loading && (
				<div className="p-2 text-xs text-muted-foreground">
					{t("projectNavigation.loading")}
				</div>
			)}
			{!loading && !error && !stale && items.length === 0 && (
				<div className="p-2 text-xs text-muted-foreground">
					{searching
						? t("sidebarPanels.noMatchingProjects")
						: t("projectNavigation.emptyRecent")}
				</div>
			)}
			{error && (
				<button
					type="button"
					className="w-full p-2 text-left text-xs text-muted-foreground"
					onClick={loadMore}
				>
					{t("projectNavigation.retry")}
				</button>
			)}
			{!loading && !error && hasMore && items.length > 0 && (
				<button
					type="button"
					className="w-full p-2 text-left text-xs text-muted-foreground"
					onClick={loadMore}
				>
					{t("projectNavigation.loadMore")}
				</button>
			)}
		</div>
	)
	return (
		<div
			ref={panelRef}
			className={cn(
				"min-h-0 scroll-mt-[var(--project-navigation-tabs-height,0px)]",
				!externalScrollRef && "flex flex-col",
				fitContent && "shrink",
			)}
		>
			{onCreate && (
				<ProjectNavigationToolbar
					recent
					disabled={busyIds.size > 0}
					isSearchMode={searchMode}
					searchValue={searchValue}
					isInitialWorkspaceListLoading={loading && items.length === 0}
					isRefreshing={loading}
					onSearchValueChange={setSearchValue}
					searchWorkspaces={setKeyword}
					handleSearchOpen={() => setSearchMode(true)}
					handleSearchClose={() => {
						setSearchMode(false)
						setSearchValue("")
						setKeyword("")
					}}
					handleRefresh={async () => {
						if (searching) search.refresh()
						else {
							recentProjectsStore.invalidate()
							await recentProjectsStore.loadMore()
						}
					}}
					handleStartCreateWorkspace={onCreate}
				/>
			)}
			{externalScrollRef ? (
				<div
					ref={list.scrollRef}
					onFocusCapture={list.onFocusCapture}
					onBlurCapture={list.onBlurCapture}
					data-testid="sidebar-recent-projects-list"
				>
					{content}
				</div>
			) : (
				<ScrollArea
					viewportRef={list.scrollRef}
					className={cn(
						"min-h-0 overflow-hidden [&>[data-slot=scroll-area-scrollbar]]:w-1.5 [&>[data-slot=scroll-area-scrollbar]]:border-l-0",
						fitContent ? "shrink" : "flex-1",
						!fitContent && "bg-muted/20",
					)}
					style={fitContent ? { height: contentHeight } : undefined}
					viewportClassName="overscroll-contain [&>div]:!block"
					onFocusCapture={list.onFocusCapture}
					onBlurCapture={list.onBlurCapture}
					data-testid="sidebar-recent-projects-list"
				>
					{content}
				</ScrollArea>
			)}
		</div>
	)
}

export default observer(RecentProjects)
