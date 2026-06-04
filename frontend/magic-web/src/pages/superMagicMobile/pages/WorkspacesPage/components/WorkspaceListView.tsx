import { useState } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, Ellipsis, Pin, PinOff, Plus, Share2, Trash2 } from "lucide-react"
import { MobileResourceListSkeletonList } from "@/pages/superMagicMobile/components/skeletons"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import {
	MobileShellIconButton,
	MobileShellSidebarToggleButton,
} from "@/pages/superMagicMobile/components/MobileShell"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"

interface WorkspaceItemProps {
	workspace: Workspace
	isOpen: boolean
	onClick: () => void
	onOpen: () => void
	onClose: () => void
	onMoreClick: () => void
	onPinClick: () => void
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
	isOpen,
	onClick,
	onOpen,
	onClose,
	onMoreClick,
	onPinClick,
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
			"data-testid": `workspace-item-${workspace.id}-more-button`,
		},
		{
			id: "pin",
			label: workspace.is_pinned
				? t("workspaceList.swipeUnpin")
				: t("workspaceList.swipePin"),
			icon: workspace.is_pinned ? (
				<PinOff className="size-4 text-primary-foreground" />
			) : (
				<Pin className="size-4 text-primary-foreground" />
			),
			className: "bg-primary",
			labelClassName: "text-primary-foreground",
			onClick: onPinClick,
			"data-testid": `workspace-item-${workspace.id}-pin-button`,
		},
		{
			id: "delete",
			label: t("workspaceList.swipeDelete"),
			icon: <Trash2 className="size-4 text-white" />,
			className: "bg-destructive",
			labelClassName: "text-white",
			onClick: onDeleteClick,
			"data-testid": `workspace-item-${workspace.id}-delete-button`,
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
			{/* Mobile list rows keep a neutral background; selection state is not highlighted. */}
			<div className="flex h-16 w-full items-center gap-2 rounded-lg px-3 transition-opacity">
				<MobileResourceTypeIcon
					type="workspace"
					isRunning={running}
					loaderSizeClass="size-6"
				/>

				<div className="flex min-w-0 flex-1 flex-col items-start">
					<div className="flex h-6 w-full min-w-0 items-center gap-1">
						<p className="min-w-0 shrink truncate text-[16px] font-medium leading-6 text-foreground">
							{workspace.name || "-"}
						</p>
						{workspace.is_pinned ? (
							<MobilePinBadge
								data-testid={`workspace-item-${workspace.id}-pin-badge`}
							/>
						) : null}
					</div>
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
	isLoading: boolean
	searchValue: string
	isWorkspaceEmpty: boolean
	isSearchEmpty: boolean
	/** 是否还有更多分页数据，传给 InfiniteScroll */
	hasMore: boolean
	setSearchValue: (value: string) => void
	onSelectWorkspace: (workspace: Workspace) => void
	onOpenCreateSheet: () => void
	onOpenSharedWorkspace: () => void
	onMoreWorkspace: (workspace: Workspace) => void
	onPinWorkspace: (workspace: Workspace) => void
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
	isLoading,
	searchValue,
	isWorkspaceEmpty,
	isSearchEmpty,
	hasMore,
	setSearchValue,
	onSelectWorkspace,
	onOpenCreateSheet,
	onOpenSharedWorkspace,
	onMoreWorkspace,
	onPinWorkspace,
	onDeleteWorkspace,
	onRefresh,
	loadMore,
}: WorkspaceListViewProps) {
	const { t } = useTranslation("super")
	const showInitialLoading = isLoading && workspaces.length === 0
	const shouldStretchPullToRefresh = !showInitialLoading && (isWorkspaceEmpty || isSearchEmpty)
	/*
	 * 工作区页与对话页保持一致，仅在空态时补齐 PullToRefresh 高度链。
	 * 正常列表继续使用默认滚动结构，避免影响下拉刷新手势与列表滚动表现。
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"
	// 同时只允许一行处于左滑展开状态
	const [openItemId, setOpenItemId] = useState<string | null>(null)
	// 共享工作区入口在重构版中改为更短的说明文案，避免列表首项副标题过长挤压布局。
	const sharedWorkspaceDescription = t("workspace.collaborationProjectsDescV2")

	return (
		<div className="flex h-full min-h-0 flex-col bg-mobile-background">
			{/* Header */}
			<div className="mobile-page-header">
				<MobileShellSidebarToggleButton
					variant="icon"
					testId="workspaces-page-menu-trigger"
				/>

				<p className="min-w-0 flex-1 truncate text-center text-[18px] font-medium leading-6 text-foreground">
					{t("workspace.workspace")}
				</p>

				<MobileShellIconButton
					label={t("workspace.addWorkspace")}
					onClick={onOpenCreateSheet}
					testId="workspaces-page-new-button"
				>
					<Plus size={22} />
				</MobileShellIconButton>
			</div>

			{/* Scrollable list */}
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				contentDeps={[workspaces.length, isLoading, isWorkspaceEmpty, isSearchEmpty]}
			>
				{/* 对齐对话页的单层滚动结构，让下拉提示固定出现在标题栏下方。 */}
				<MagicPullToRefresh
					embedInParentScroll
					onRefresh={onRefresh}
					showSuccessMessage={false}
					containerClassName={cn(
						"relative min-h-0 flex-1",
						shouldStretchPullToRefresh &&
							cn("!overflow-hidden", pullToRefreshStretchClassName),
					)}
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

						{showInitialLoading ? (
							<MobileResourceListSkeletonList testId="workspaces-list-loading" />
						) : null}

						{!showInitialLoading && isWorkspaceEmpty ? (
							<DataEmptyState
								variant="workspace"
								className="min-h-0 flex-1 py-12"
								testId="workspaces-list-empty"
							/>
						) : null}

						{!showInitialLoading && isSearchEmpty ? (
							<DataEmptyState
								variant="search"
								className="min-h-0 flex-1 py-12"
								testId="workspaces-list-search-empty"
							/>
						) : null}

						{/* Workspace list */}
						{!showInitialLoading && !isWorkspaceEmpty && !isSearchEmpty
							? workspaces.map((workspace) => (
									<WorkspaceItem
										key={workspace.id}
										workspace={workspace}
										isOpen={openItemId === workspace.id}
										onClick={() => onSelectWorkspace(workspace)}
										onOpen={() => setOpenItemId(workspace.id)}
										onClose={() => setOpenItemId(null)}
										onMoreClick={() => onMoreWorkspace(workspace)}
										onPinClick={() => onPinWorkspace(workspace)}
										onDeleteClick={() => onDeleteWorkspace(workspace)}
										projectCountLabel={t("workspace.projectCount", {
											count: workspace.cooperate_project_count ?? 0,
										})}
									/>
								))
							: null}

						{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
						{!showInitialLoading && !isWorkspaceEmpty && !isSearchEmpty && (
							<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
						)}
					</div>
				</MagicPullToRefresh>
			</ScrollEdgeFadeContainer>

			{/* 底部搜索条抽成通用 UI 组件后，列表页只保留搜索值和文案等业务输入。 */}
			<MobileBottomSearchBar
				value={searchValue}
				placeholder={t("chatList.searchPlaceholder")}
				clearAriaLabel={t("common.cancel")}
				onValueChange={setSearchValue}
				clearButtonVisibility="focus-or-value"
				testIdPrefix="workspaces-bottom-search"
			/>
		</div>
	)
}

export const WorkspaceListView = observer(WorkspaceListViewInner)
