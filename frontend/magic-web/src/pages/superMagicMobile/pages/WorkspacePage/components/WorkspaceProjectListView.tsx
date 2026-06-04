import { ChevronLeft, Ellipsis, Plus } from "lucide-react"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { cn } from "@/lib/utils"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import ProjectList from "@/pages/superMagicMobile/components/ProjectList"

interface WorkspaceProjectListViewProps {
	selectedWorkspace: Workspace | null
	projects: ProjectListItem[]
	isLoading: boolean
	searchValue: string
	setSearchValue: (value: string) => void
	projectTimeLabels: Record<string, string>
	isProjectEmpty: boolean
	isSearchEmpty: boolean
	/** 是否还有更多分页数据，传给 InfiniteScroll */
	hasMore: boolean
	onBack: () => void
	onOpenMoreSheet: (workspace: Workspace) => void
	onRefresh: () => Promise<void>
	onOpenCreateProjectSheet: () => void
	onOpenProject: (project: ProjectListItem) => void
	onMoreProject: (project: ProjectListItem) => void
	onPinProject: (project: ProjectListItem) => void
	onDeleteProject: (project: ProjectListItem) => void
	/** 滚动到底部加载更多回调 */
	loadMore: () => Promise<void>
}

/**
 * 负责工作区内项目页的纯展示层，统一承接头部、列表、空状态与搜索条。
 */
export function WorkspaceProjectListView({
	selectedWorkspace,
	projects,
	isLoading,
	searchValue,
	setSearchValue,
	projectTimeLabels,
	isProjectEmpty,
	isSearchEmpty,
	hasMore,
	onBack,
	onOpenMoreSheet,
	onRefresh,
	onOpenCreateProjectSheet,
	onOpenProject,
	onMoreProject,
	onPinProject,
	onDeleteProject,
	loadMore,
}: WorkspaceProjectListViewProps) {
	const { t } = useTranslation("super")
	const shouldStretchPullToRefresh = isProjectEmpty || isSearchEmpty
	/*
	 * 仅在空态时补齐 PullToRefresh 的高度链，让空内容可以保持垂直居中。
	 * 正常列表持续保留原始滚动结构，避免共享高度链把下拉手势和滚动状态改坏。
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-mobile-background"
			data-testid="workspace-project-page-root"
		>
			{/* 顶栏采用原型的左右操作胶囊布局，让标题保持绝对居中。 */}
			<div className="mobile-page-header">
				<button
					type="button"
					onClick={onBack}
					className="mobile-page-header-btn transition-transform active:scale-95"
					aria-label={t("common.back")}
					data-testid="workspace-project-page-back-button"
				>
					<ChevronLeft className="h-[22px] w-[22px] text-foreground" />
				</button>

				<p className="mobile-page-header-title">
					{selectedWorkspace?.name || t("workspace.unnamedWorkspace")}
				</p>

				<div className="ml-auto flex h-12 shrink-0 items-center overflow-hidden rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] dark:shadow-[0px_8px_25px_0px_rgba(0,0,0,0.32)]">
					<button
						type="button"
						onClick={() => {
							onOpenCreateProjectSheet()
						}}
						className="flex h-12 w-12 shrink-0 items-center justify-center active:opacity-70"
						aria-label={t("project.createNewProject")}
						data-testid="workspace-project-page-create-button"
					>
						{/* 使用统一图标而非文本字符，避免字体基线导致加号在胶囊内视觉下沉。 */}
						<Plus className="h-[22px] w-[22px] text-foreground" />
					</button>
					<button
						type="button"
						onClick={() => {
							if (!selectedWorkspace) return
							onOpenMoreSheet(selectedWorkspace)
						}}
						disabled={!selectedWorkspace}
						className="flex h-12 w-12 shrink-0 items-center justify-center active:opacity-70 disabled:opacity-40"
						aria-label={t("common.more")}
						data-testid="workspace-project-page-more-button"
					>
						<Ellipsis className="h-[22px] w-[22px] text-foreground" />
					</button>
				</div>
			</div>

			{/* 列表区：ScrollEdgeFade 双层结构，遮罩与滚动口为兄弟节点（对齐原型 ProjectListScreen）。 */}
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				contentDeps={[projects.length, isLoading, isProjectEmpty, isSearchEmpty]}
			>
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
						data-testid="workspace-project-page-scroll"
					>
						{isProjectEmpty ? (
							<DataEmptyState
								variant="project"
								className="min-h-0 flex-1 py-12"
								testId="workspace-project-page-empty"
							/>
						) : null}

						{isSearchEmpty ? (
							<DataEmptyState
								variant="search"
								className="min-h-0 flex-1 py-12"
								testId="workspace-project-page-search-empty"
							/>
						) : null}

						{!isProjectEmpty && !isSearchEmpty ? (
							<>
								<ProjectList
									projects={projects}
									isLoading={isLoading}
									projectTimeLabels={projectTimeLabels}
									onOpen={onOpenProject}
									onMore={onMoreProject}
									onPin={onPinProject}
									onDelete={onDeleteProject}
								/>
								{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
								<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
							</>
						) : null}
					</div>
				</MagicPullToRefresh>
			</ScrollEdgeFadeContainer>

			{/* 通用底部搜索条统一承接浮动样式，项目页只指定占位文案和清除按钮策略。 */}
			<MobileBottomSearchBar
				value={searchValue}
				placeholder={t("chatList.searchPlaceholder")}
				clearAriaLabel={t("common.cancel")}
				onValueChange={setSearchValue}
				// 工作区列表与工作区详情保持同一搜索交互：聚焦后立即给出清除入口。
				clearButtonVisibility="focus-or-value"
				testIdPrefix="workspace-project-page-search"
			/>
		</div>
	)
}
