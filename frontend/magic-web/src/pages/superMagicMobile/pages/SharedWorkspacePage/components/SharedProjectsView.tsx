import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ListFilter, Users } from "lucide-react"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"

import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { cn } from "@/lib/utils"
import { getAvatarUrl } from "@/utils/avatar"
import { formatRelativeTime } from "@/utils/string"

import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import type { SharedWorkspaceProject, SharedWorkspaceTab } from "../types"

interface SharedProjectsViewProps {
	tab: SharedWorkspaceTab
	projects: SharedWorkspaceProject[]
	isLoading: boolean
	isEmpty: boolean
	isSearchEmpty: boolean
	searchValue: string
	canShowFilter: boolean
	activeFilterCount: number
	/** 是否还有更多分页数据，传给 InfiniteScroll */
	hasMore: boolean
	onBack: () => void
	onTabChange: (tab: SharedWorkspaceTab) => void
	onOpenFilter: () => void
	onSearchChange: (value: string) => void
	onOpenProject: (project: SharedWorkspaceProject) => void
	/** 下拉刷新回调 */
	onRefresh: () => Promise<void>
	/** 滚动到底部加载更多回调 */
	loadMore: () => Promise<void>
}

interface SharedProjectRowProps {
	project: SharedWorkspaceProject
	tab: SharedWorkspaceTab
	subtitle: string
	onOpen: (project: SharedWorkspaceProject) => void
}

function formatSharedProjectTime(
	value: string | null | undefined,
	language: string,
	fallback: string,
) {
	if (!value) return fallback

	return formatRelativeTime(language)(value) || fallback
}

/**
 * 提取项目创建者名称，缺字段时用 i18n 兜底而不是展示空白。
 */
function getCreatorName(project: SharedWorkspaceProject, fallback: string) {
	return project.creator?.nickname || fallback
}

function getCreatorAvatarUrl(project: SharedWorkspaceProject) {
	return project.creator?.avatar_url?.trim() || ""
}

function getCreatorInitial(name: string) {
	return name.trim().charAt(0).toUpperCase() || "?"
}

/**
 * 共享人数优先取列表聚合字段，缺失时再回退成员数组长度。
 */
function getSharedMemberCount(project: SharedWorkspaceProject) {
	return project.member_count ?? project.members?.length ?? 0
}

function getTopicCount(project: SharedWorkspaceProject) {
	return project.topic_count ?? 0
}

/**
 * 生成列表副标题，按 Tab 区分“来源创建者”和“已共享人数”，并补齐话题数信息。
 */
function buildSubtitle({
	project,
	tab,
	timeLabel,
	topicCountLabel,
	unknownCreatorLabel,
	sharedWithLabel,
}: {
	project: SharedWorkspaceProject
	tab: SharedWorkspaceTab
	timeLabel: string
	topicCountLabel: string
	unknownCreatorLabel: string
	sharedWithLabel: string
}) {
	if (tab === "sharedWithMe") {
		return [getCreatorName(project, unknownCreatorLabel), topicCountLabel, timeLabel].join(
			" · ",
		)
	}

	return [sharedWithLabel, topicCountLabel, timeLabel].join(" · ")
}

/**
 * 列表项头像：共享项目使用 Folder 图形 + 项目色板（对齐原型 SharedProjectsScreen）。
 */
function ProjectIcon() {
	return <MobileResourceTypeIcon type="sharedProject" />
}

function CreatorAvatar({ project }: { project: SharedWorkspaceProject }) {
	const creatorName = getCreatorName(project, "?")
	const avatarUrl = getCreatorAvatarUrl(project)

	if (avatarUrl) {
		return (
			<img
				src={getAvatarUrl(avatarUrl, 18)}
				alt=""
				aria-hidden
				referrerPolicy="no-referrer"
				className="size-[18px] shrink-0 rounded-full object-cover"
				data-testid={`shared-projects-creator-avatar-${project.id}`}
			/>
		)
	}

	return (
		<span
			className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-medium leading-none text-primary-foreground"
			data-testid={`shared-projects-creator-fallback-${project.id}`}
		>
			{getCreatorInitial(creatorName)}
		</span>
	)
}

/**
 * 共享项目列表行只负责展示项目名称、来源信息和进入详情入口。
 */
function SharedProjectRow({ project, tab, subtitle, onOpen }: SharedProjectRowProps) {
	return (
		<button
			type="button"
			onClick={() => onOpen(project)}
			className="flex h-16 w-full shrink-0 items-center rounded-lg px-3 py-[10px] text-left transition-opacity active:opacity-70"
			data-testid={`shared-projects-row-${project.id}`}
		>
			<ProjectIcon />
			<div className="ml-2 flex min-w-0 flex-1 flex-col items-start">
				<p className="w-full truncate text-[16px] font-medium leading-6 text-foreground">
					{project.project_name || "-"}
				</p>
				<div className="flex w-full min-w-0 items-center gap-1">
					{tab === "sharedByMe" ? (
						<Users className="size-3 shrink-0 text-muted-foreground" aria-hidden />
					) : (
						<CreatorAvatar project={project} />
					)}
					<p className="min-w-0 truncate text-[12px] font-light leading-4 text-muted-foreground">
						{subtitle}
					</p>
				</div>
			</div>
			<ChevronRight className="size-4 shrink-0 text-foreground" />
		</button>
	)
}

/**
 * 加载骨架使用固定行高，避免初次加载时页面高度跳变。
 */
function SharedProjectSkeletonList() {
	return (
		<div className="flex flex-col gap-1" data-testid="shared-projects-loading">
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className="flex h-16 items-center gap-2 rounded-lg px-3 py-[10px]">
					<div className="size-9 shrink-0 animate-pulse rounded-[10px] bg-muted" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
						<div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
					</div>
				</div>
			))}
		</div>
	)
}

/**
 * 共享项目页展示层，承接新 UI 的头部、双 Tab、列表、底部搜索与筛选入口。
 */
export function SharedProjectsView({
	tab,
	projects,
	isLoading,
	isEmpty,
	isSearchEmpty,
	searchValue,
	canShowFilter,
	activeFilterCount,
	hasMore,
	onBack,
	onTabChange,
	onOpenFilter,
	onSearchChange,
	onOpenProject,
	onRefresh,
	loadMore,
}: SharedProjectsViewProps) {
	const { t, i18n } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)
	const shouldStretchPullToRefresh = !isLoading && (isEmpty || isSearchEmpty)
	/*
	 * 共享项目页复用对话页的空态策略：只在空态时拉满 PullToRefresh 高度链。
	 * 正常列表保留默认滚动结构，避免影响分页滚动和下拉刷新时机。
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	/**
	 * 根据滚动位置更新上下渐变遮罩，让长列表边界反馈与原型一致。
	 */
	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return

		setShowTopMask(el.scrollTop > 4)
		setShowBottomMask(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
	}, [])

	useEffect(() => {
		const frame = requestAnimationFrame(updateMasks)
		return () => cancelAnimationFrame(frame)
	}, [projects.length, isLoading, isEmpty, isSearchEmpty, updateMasks])

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-mobile-background"
			data-testid="shared-projects-page"
		>
			<div className="mobile-page-header">
				<button
					type="button"
					onClick={onBack}
					className="mobile-page-header-btn transition-transform active:scale-95"
					aria-label={t("common.back")}
					data-testid="shared-projects-back-button"
				>
					<ChevronLeft className="size-[22px] text-foreground" />
				</button>

				<p className="mobile-page-header-title">{t("sharedProjects.title")}</p>

				{canShowFilter ? (
					<button
						type="button"
						onClick={onOpenFilter}
						className="mobile-page-header-btn ml-auto transition-transform active:scale-95"
						aria-label={t("sharedProjects.filter.title")}
						data-testid="shared-projects-filter-trigger"
					>
						<span className="relative">
							<ListFilter className="size-[22px] text-foreground" />
							{activeFilterCount > 0 ? (
								<span
									className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-[3px] text-[10px] font-bold leading-none text-primary-foreground"
									data-testid="shared-projects-filter-badge"
								>
									{activeFilterCount}
								</span>
							) : null}
						</span>
					</button>
				) : (
					<div className="ml-auto size-12 shrink-0" aria-hidden />
				)}
			</div>

			<div className="shrink-0 px-3 pb-2 pt-3">
				<div className="relative flex h-9 rounded-full bg-muted p-[3px]">
					<div
						className={cn(
							"absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%_-_3px)] rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-transform duration-300",
							tab === "sharedByMe" && "translate-x-full",
						)}
						aria-hidden
					/>
					{(["sharedWithMe", "sharedByMe"] as const).map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => onTabChange(item)}
							className={cn(
								"relative z-[1] flex flex-1 items-center justify-center rounded-full px-4 text-[14px] leading-5 transition-colors",
								tab === item
									? "font-medium text-foreground"
									: "font-normal text-muted-foreground",
							)}
							data-testid={`shared-projects-tab-${item}`}
						>
							{item === "sharedWithMe"
								? t("sharedProjects.tabSharedWithMe")
								: t("sharedProjects.tabSharedByMe")}
						</button>
					))}
				</div>
			</div>

			<div
				id="shared-projects-scroll-container"
				ref={scrollRef}
				onScroll={updateMasks}
				className="relative min-h-0 flex-1 overflow-y-auto"
			>
				{/* 对齐对话页的单层滚动结构，让下拉提示稳定落在标题与 Tab 之后。 */}
				<MagicPullToRefresh
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
						data-testid="shared-projects-scroll"
					>
						{isLoading && projects.length === 0 ? <SharedProjectSkeletonList /> : null}

						{isEmpty || isSearchEmpty ? (
							<DataEmptyState
								variant="sharedProject"
								className="min-h-0 flex-1 py-12"
								testId={
									isSearchEmpty
										? "shared-projects-search-empty"
										: "shared-projects-empty"
								}
							/>
						) : null}

						{!isEmpty && !isSearchEmpty
							? projects.map((project) => {
									const rawTime =
										project.last_active_at ||
										project.updated_at ||
										project.created_at
									const timeLabel = formatSharedProjectTime(
										rawTime,
										i18n.language,
										t("sharedProjects.unknownTime"),
									)
									const subtitle = buildSubtitle({
										project,
										tab,
										timeLabel,
										topicCountLabel: t("sharedProjects.topicCount", {
											count: getTopicCount(project),
										}),
										unknownCreatorLabel: t("sharedProjects.unknownCreator"),
										sharedWithLabel: t("sharedProjects.sharedWith", {
											count: getSharedMemberCount(project),
										}),
									})

									return (
										<SharedProjectRow
											key={project.id}
											project={project}
											tab={tab}
											subtitle={subtitle}
											onOpen={onOpenProject}
										/>
									)
								})
							: null}

						{/* InfiniteScroll 放在列表末尾，向上滑动到底部时自动加载下一页 */}
						{!isEmpty && !isSearchEmpty && (
							<InfiniteScroll hasMore={hasMore} loadMore={loadMore} />
						)}
					</div>
				</MagicPullToRefresh>

				<div
					className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to bottom, var(--mobile-background) 0%, transparent 100%)",
						opacity: showTopMask ? 1 : 0,
					}}
				/>
				<div
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to top, var(--mobile-background) 0%, transparent 100%)",
						opacity: showBottomMask ? 1 : 0,
					}}
				/>
			</div>

			<MobileBottomSearchBar
				value={searchValue}
				placeholder={t("sharedProjects.searchPlaceholder")}
				clearAriaLabel={t("common.cancel")}
				onValueChange={onSearchChange}
				clearButtonVisibility="focus-or-value"
				testIdPrefix="shared-projects-search"
			/>
		</div>
	)
}
