import { useCallback, useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import {
	Box,
	ChevronRight,
	Ellipsis,
	Menu,
	Plus,
	Search,
	Share2,
	Loader,
	Trash2,
} from "lucide-react"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"

import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { MobileShellIconButton } from "@/pages/superMagicMobile/components/MobileShell"
import { cn } from "@/lib/utils"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"

interface WorkspaceItemProps {
	workspace: Workspace
	isSelected: boolean
	isOpen: boolean
	onClick: () => void
	onOpen: () => void
	onClose: () => void
	onMoreClick: () => void
	onDeleteClick: () => void
	projectCountLabel: string
}

/**
 * 统一收敛工作区运行态判定，优先复用真实状态并兼容旧字段。
 */
function isWorkspaceRunning(workspace: Workspace) {
	return (
		workspace.workspace_status === "running" ||
		workspace.status === "running" ||
		(workspace.status as "waiting_for_user") === "waiting_for_user"
	)
}

/**
 * 工作区列表行：支持左滑展示"更多"和"删除"操作按钮。
 * SwipeActionRow 负责手势逻辑与互斥展开，本组件只组装 actions 和行内容。
 */
function WorkspaceItem({
	workspace,
	isSelected,
	isOpen,
	onClick,
	onOpen,
	onClose,
	onMoreClick,
	onDeleteClick,
	projectCountLabel,
}: WorkspaceItemProps) {
	const { t } = useTranslation("super")
	const running = isWorkspaceRunning(workspace)

	const actions: SwipeAction[] = [
		{
			id: "more",
			label: t("workspaceList.swipeMore"),
			icon: <Ellipsis className="size-4 text-secondary-foreground" />,
			className: "bg-secondary",
			labelClassName: "text-secondary-foreground",
			onClick: onMoreClick,
		},
		{
			id: "delete",
			label: t("workspaceList.swipeDelete"),
			icon: <Trash2 className="size-4 text-white" />,
			className: "bg-destructive",
			labelClassName: "text-white",
			onClick: onDeleteClick,
		},
	]

	return (
		<SwipeActionRow
			actions={actions}
			isOpen={isOpen}
			onOpen={onOpen}
			onClose={onClose}
			onRowClick={onClick}
			data-testid={`workspace-item-${workspace.id}`}
		>
			{/* 行内容区：h-16 与 SwipeActionRow 外壳高度保持一致 */}
			<div
				className={cn(
					"flex h-16 w-full items-center gap-2 rounded-lg px-3 transition-opacity",
					isSelected && "bg-accent",
				)}
			>
				<div className="flex size-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px] bg-icon-workspace/[0.08]">
					{running ? (
						<Loader className="size-6 animate-spin text-icon-workspace" aria-hidden />
					) : (
						<Box className="size-6 text-icon-workspace" aria-hidden />
					)}
				</div>

				<div className="flex min-w-0 flex-1 flex-col items-start">
					<p className="truncate text-[16px] font-medium leading-6 text-foreground">
						{workspace.name || "-"}
					</p>
					<p className="truncate text-[12px] font-light leading-4 text-muted-foreground">
						{projectCountLabel}
					</p>
				</div>

				<ChevronRight className="size-4 shrink-0 text-foreground" />
			</div>
		</SwipeActionRow>
	)
}

interface WorkspaceListViewProps {
	workspaces: Workspace[]
	selectedWorkspace: Workspace | null
	isLoading: boolean
	searchValue: string
	debouncedSearchValue: string
	isWorkspaceEmpty: boolean
	isSearchEmpty: boolean
	/** 是否还有更多分页数据，传给 InfiniteScroll */
	hasMore: boolean
	setSearchValue: (value: string) => void
	onSelectWorkspace: (workspace: Workspace) => void
	onOpenCreateSheet: () => void
	onOpenSharedWorkspace: () => void
	onOpenSidebar: () => void
	onMoreWorkspace: (workspace: Workspace) => void
	onDeleteWorkspace: (workspace: Workspace) => void
	/** 下拉刷新回调 */
	onRefresh: () => Promise<void>
	/** 滚动到底部加载更多回调 */
	loadMore: () => Promise<void>
}

/**
 * 工作区列表页视图层专注还原原型布局，并消费容器层提供的显式空态与搜索态。
 */
function WorkspaceListViewInner({
	workspaces,
	selectedWorkspace,
	isLoading,
	searchValue,
	debouncedSearchValue,
	isWorkspaceEmpty,
	isSearchEmpty,
	hasMore,
	setSearchValue,
	onSelectWorkspace,
	onOpenCreateSheet,
	onOpenSharedWorkspace,
	onOpenSidebar,
	onMoreWorkspace,
	onDeleteWorkspace,
	onRefresh,
	loadMore,
}: WorkspaceListViewProps) {
	const { t } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)
	// 同时只允许一行处于左滑展开状态
	const [openItemId, setOpenItemId] = useState<string | null>(null)
	// 共享工作区入口在重构版中改为更短的说明文案，避免列表首项副标题过长挤压布局。
	const sharedWorkspaceDescription = t("workspace.collaborationProjectsDescV2")

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowTopMask(el.scrollTop > 4)
		setShowBottomMask(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
	}, [])

	useEffect(() => {
		const frame = requestAnimationFrame(updateMasks)
		return () => cancelAnimationFrame(frame)
	}, [updateMasks, workspaces.length])

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			{/* Header */}
			<div
				className="relative z-10 flex h-14 shrink-0 items-center gap-2 rounded-b-[14px] px-[10px]"
				style={{ paddingTop: "calc(var(--safe-area-inset-top, 0px) + 4px)" }}
			>
				<MobileShellIconButton
					label={t("mobile.shell.menuAria")}
					onClick={onOpenSidebar}
					testId="workspaces-page-menu-trigger"
				>
					<Menu size={22} />
				</MobileShellIconButton>

				<p className="min-w-0 flex-1 truncate text-center text-[18px] font-medium leading-6 text-foreground">
					{t("workspace.workspace")}
				</p>

				<MobileShellIconButton
					label={t("workspace.addWorkspace")}
					onClick={onOpenCreateSheet}
					testId="workspaces-page-new-button"
				>
					<Plus size={22} strokeWidth={2} />
				</MobileShellIconButton>
			</div>

			{/* Scrollable list */}
			<div
				id="workspaces-list-scroll-container"
				ref={scrollRef}
				onScroll={updateMasks}
				className="relative min-h-0 flex-1 overflow-y-auto"
			>
				{/* 对齐对话页的单层滚动结构，让下拉提示固定出现在标题栏下方。 */}
				<MagicPullToRefresh
					onRefresh={onRefresh}
					showSuccessMessage={false}
					containerClassName="relative min-h-0 flex-1"
				>
					<div
						className="flex min-h-full flex-col gap-1 px-3 pb-4 pt-2"
						data-testid="workspaces-list-scroll"
					>
						{/* Shared workspace entry */}
						<button
							type="button"
							onClick={onOpenSharedWorkspace}
							className="mb-1 flex shrink-0 items-center gap-2 rounded-lg px-3 py-[10px] transition-opacity active:opacity-70"
							data-testid="workspaces-shared-entry"
						>
							<div className="flex size-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px] bg-primary/10">
								<Share2 className="size-5 text-primary" aria-hidden />
							</div>
							<div className="flex min-w-0 flex-1 flex-col items-start">
								<p className="truncate text-[16px] font-medium leading-6 text-foreground">
									{t("workspace.sharedWorkspace")}
								</p>
								<p className="truncate text-[12px] font-light leading-4 text-muted-foreground">
									{sharedWorkspaceDescription}
								</p>
							</div>
							<ChevronRight className="size-4 shrink-0 text-foreground" />
						</button>

						{/* Divider */}
						<div className="mb-1 h-px w-full bg-border" />

						{/* Loading state */}
						{isLoading && workspaces.length === 0 && (
							<div
								className="flex flex-1 items-center justify-center py-8"
								data-testid="workspaces-list-loading"
							>
								<Loader className="size-6 animate-spin text-muted-foreground" />
							</div>
						)}

						{/* Empty state */}
						{isWorkspaceEmpty && (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center"
								data-testid="workspaces-list-empty"
							>
								<Box className="size-10 text-muted-foreground/40" />
								<p className="text-sm text-muted-foreground">
									{t("workspace.noWorkspaces")}
								</p>
							</div>
						)}

						{/* Search empty state */}
						{isSearchEmpty && (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center"
								data-testid="workspaces-list-search-empty"
							>
								<Search className="size-10 text-muted-foreground/40" />
								<p className="text-sm text-muted-foreground">
									{t("workspace.searchNoResults", {
										keyword: debouncedSearchValue,
									})}
								</p>
							</div>
						)}

						{/* Workspace list */}
						{!isWorkspaceEmpty && !isSearchEmpty
							? workspaces.map((workspace) => (
									<WorkspaceItem
										key={workspace.id}
										workspace={workspace}
										isSelected={selectedWorkspace?.id === workspace.id}
										isOpen={openItemId === workspace.id}
										onClick={() => onSelectWorkspace(workspace)}
										onOpen={() => setOpenItemId(workspace.id)}
										onClose={() => setOpenItemId(null)}
										onMoreClick={() => onMoreWorkspace(workspace)}
										onDeleteClick={() => onDeleteWorkspace(workspace)}
										projectCountLabel={t("workspace.projectCount", {
											count: workspace.project_count ?? 0,
										})}
									/>
								))
							: null}

						{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
						{!isWorkspaceEmpty && !isSearchEmpty && (
							<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
						)}
					</div>
				</MagicPullToRefresh>

				{/* Top mask */}
				<div
					className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to bottom, var(--background) 0%, transparent 100%)",
						opacity: showTopMask ? 1 : 0,
					}}
				/>
				{/* Bottom mask */}
				<div
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to top, var(--background) 0%, transparent 100%)",
						opacity: showBottomMask ? 1 : 0,
					}}
				/>
			</div>

			{/* 底部搜索条抽成通用 UI 组件后，列表页只保留搜索值和文案等业务输入。 */}
			<MobileBottomSearchBar
				value={searchValue}
				placeholder={t("searchPlaceholder")}
				clearAriaLabel={t("common.cancel")}
				onValueChange={setSearchValue}
				clearButtonVisibility="focus-or-value"
				testIdPrefix="workspaces-bottom-search"
			/>
		</div>
	)
}

export const WorkspaceListView = observer(WorkspaceListViewInner)
