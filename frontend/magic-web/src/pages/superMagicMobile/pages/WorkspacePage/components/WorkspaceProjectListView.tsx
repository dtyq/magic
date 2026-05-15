import { useCallback, useEffect, useId, useState } from "react"
import { Box, ChevronLeft, Ellipsis, Plus, Search } from "lucide-react"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import ProjectList from "@/pages/superMagicMobile/components/ProjectList"

interface WorkspaceProjectListViewProps {
	selectedWorkspace: Workspace | null
	projects: ProjectListItem[]
	isLoading: boolean
	searchValue: string
	debouncedSearchValue: string
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
	debouncedSearchValue,
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
	const scrollContainerId = useId()
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)

	/**
	 * 渐变遮罩直接监听真实滚动容器，保证列表上下边缘的视觉反馈与原型一致。
	 */
	const updateMasks = useCallback(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return

		setShowTopMask(scrollElement.scrollTop > 4)
		setShowBottomMask(
			scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 4,
		)
	}, [scrollContainerId])

	/**
	 * 原型使用滚动蒙层提示列表上下还有内容，这里在挂载后同步一次并订阅滚动事件。
	 */
	useEffect(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return

		updateMasks()
		scrollElement.addEventListener("scroll", updateMasks, { passive: true })

		return () => {
			scrollElement.removeEventListener("scroll", updateMasks)
		}
	}, [projects.length, isLoading, isProjectEmpty, isSearchEmpty, scrollContainerId, updateMasks])

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			data-testid="workspace-project-page-root"
		>
			{/* 顶栏采用原型的左右操作胶囊布局，让标题保持绝对居中。 */}
			<div
				className="relative z-10 flex h-14 shrink-0 items-center gap-2 rounded-b-[14px] px-[10px]"
				style={{ paddingTop: "calc(var(--safe-area-inset-top, 0px) + 4px)" }}
			>
				<button
					type="button"
					onClick={onBack}
					className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
					aria-label={t("common.back")}
					data-testid="workspace-project-page-back-button"
				>
					<ChevronLeft className="h-[22px] w-[22px] text-foreground" strokeWidth={2} />
				</button>

				<p className="pointer-events-none absolute inset-x-0 truncate px-[114px] text-center text-[18px] font-medium leading-6 text-foreground">
					{selectedWorkspace?.name || t("workspace.unnamedWorkspace")}
				</p>

				<div className="ml-auto flex h-12 shrink-0 items-center overflow-hidden rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]">
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
						<Plus className="h-[22px] w-[22px] text-foreground" strokeWidth={2} />
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

			{/* 列表区使用与对话页一致的单层滚动容器，让下拉提示落点稳定。 */}
			<div id={scrollContainerId} className="relative min-h-0 flex-1 overflow-y-auto">
				<MagicPullToRefresh
					onRefresh={onRefresh}
					showSuccessMessage={false}
					containerClassName="relative min-h-0 flex-1"
				>
					<div
						className="flex min-h-full flex-col gap-1 px-3 pb-4 pt-2"
						data-testid="workspace-project-page-scroll"
					>
						{isProjectEmpty ? (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center"
								data-testid="workspace-project-page-empty"
							>
								<Box className="size-10 text-muted-foreground/50" />
								<p className="text-[15px] font-medium leading-6 text-foreground">
									{t("project.noProjects")}
								</p>
								<p className="text-sm leading-5 text-muted-foreground">
									{t("project.createNewProject")}
								</p>
							</div>
						) : null}

						{isSearchEmpty ? (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center"
								data-testid="workspace-project-page-search-empty"
							>
								<Search className="size-10 text-muted-foreground/50" />
								<p className="text-[15px] font-medium leading-6 text-foreground">
									{t("workspace.searchNoResults", {
										keyword: debouncedSearchValue,
									})}
								</p>
							</div>
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

				{/* 顶部渐变遮罩用于提示列表上方仍有内容，符合原型的滚动反馈。 */}
				<div
					className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to bottom, var(--color-background) 0%, transparent 100%)",
						opacity: showTopMask ? 1 : 0,
					}}
				/>
				{/* 底部渐变遮罩用于提示列表下方仍可继续滚动。 */}
				<div
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to top, var(--color-background) 0%, transparent 100%)",
						opacity: showBottomMask ? 1 : 0,
					}}
				/>
			</div>

			{/* 通用底部搜索条统一承接浮动样式，项目页只指定占位文案和清除按钮策略。 */}
			<MobileBottomSearchBar
				value={searchValue}
				placeholder={t("chatList.searchPlaceholder")}
				clearAriaLabel={t("common.cancel")}
				onValueChange={setSearchValue}
				clearButtonVisibility="value-only"
				testIdPrefix="workspace-project-page-search"
			/>
		</div>
	)
}
