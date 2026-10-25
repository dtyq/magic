import { useCallback, useEffect, useRef } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import projectStore from "@/pages/superMagic/stores/core/project"
import { useVirtualProjectList } from "../hooks/useVirtualProjectList"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import ProjectItem from "./ProjectItem"
import CreateProjectInput from "./CreateProjectInput"
import type { ProjectListProps } from "./types"
import { SidebarMenuSub } from "@/components/shadcn-ui/sidebar"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"

function ProjectList({
	isSearchResult,
	active,
	workspace,
	projects,
	workspaceId,
	isLoading,
	isCreatingProject,
	onCancelCreate,
	onProjectCreated,
	dndDisabled,
	maxProjectHeight,
	onBusyChange,
}: ProjectListProps) {
	const { t } = useTranslation(["super", "sidebar"])
	const {
		isProjectModalOpen,
		projectModals,
		handleMoveProject,
		handleTransferProject,
		handleDeleteProjectConfirm,
		handleTogglePinProject,
		handleRenameProject,
		onAddCollaborators,
		handleCopyCollaborationLink,
		handleCancelWorkspaceShortcutByProject,
	} = useProjectItemActionProps({
		selectedWorkspace: workspace,
	})

	const listRef = useRef<HTMLUListElement>(null)
	const page = isSearchResult ? undefined : projectStore.workspacePages.get(workspaceId)
	const loadMore = useCallback(() => {
		void projectStore.loadMoreProjectsForWorkspace(workspaceId)
	}, [workspaceId])
	// Ensure virtualizer is enabled when active, even before maxProjectHeight is first computed.
	// maxProjectHeight limits viewport maxHeight in CSS; it should not disable project rendering.
	const enabled = active && (maxProjectHeight === undefined || maxProjectHeight > 0)
	const {
		scrollRef,
		virtualizer,
		rows,
		scrollMargin,
		onInteractionChange,
		onFocusCapture,
		onBlurCapture,
		hasActiveInteraction,
	} = useVirtualProjectList({
		// 先确定视口高度再恢复滚动位置，避免侧栏重新展开时 DOM 回到顶部、虚拟行仍停在旧位置。
		enabled,
		loadEnabled: active,
		listRef,
		scrollKey: `workspace-projects:${workspaceId}`,
		projects,
		// 与项目行的 32px 点击高度和 4px 行间距一致，创建／重命名也沿用同一高度。
		rowHeight: 36,
		hasMore: page?.hasMore,
		loading: isLoading || page?.loadingMore,
		error: page?.error,
		onLoadMore: loadMore,
	})
	useEffect(() => {
		onBusyChange?.(hasActiveInteraction || isProjectModalOpen || Boolean(isCreatingProject))
	}, [hasActiveInteraction, isProjectModalOpen, isCreatingProject, onBusyChange])
	useEffect(() => () => onBusyChange?.(false), [onBusyChange])

	return (
		<>
			{/* 项目只缩进一层，名称对齐父工作区的图标列；新建和重命名不再叠加第二层缩进。 */}
			{/* 项目列表到达顶部或底部后，继续纵向滚动交给外层工作空间列表；外层负责限制侧栏边界。 */}
			<ScrollArea
				viewportRef={scrollRef}
				className="relative w-full shrink-0 [&>[data-slot=scroll-area-scrollbar]]:w-[2px] [&>[data-slot=scroll-area-scrollbar]]:border-0 [&>[data-slot=scroll-area-scrollbar]]:p-0 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/25"
				viewportClassName="overscroll-x-contain overscroll-y-auto [&>div]:!block"
				viewportStyle={{ maxHeight: maxProjectHeight }}
				viewportProps={{
					"data-project-scroll-container": true,
					onFocusCapture,
					onBlurCapture,
				}}
			>
				<div
					className="relative flex w-full shrink-0 flex-col items-start gap-1 pl-6 pr-0 pt-1"
					data-sidebar-drop-type="project-list"
					data-sidebar-drop-workspace-id={workspaceId}
					data-sidebar-drop-empty={projects.length === 0 ? "true" : undefined}
					data-testid={`sidebar-project-list-${workspaceId}`}
				>
					{isCreatingProject && onCancelCreate && onProjectCreated && (
						<div className="w-full duration-150 animate-in fade-in slide-in-from-top-2">
							<CreateProjectInput
								workspaceId={workspaceId}
								onCancel={onCancelCreate}
								onCreated={onProjectCreated}
							/>
						</div>
					)}
					{isLoading && projects.length === 0 ? (
						// Loading text with fade-in animation
						<div className="px-2 py-1 text-xs text-[#a3a3a3] duration-150 animate-in fade-in slide-in-from-top-2">
							{t("sidebar:project.loading")}
						</div>
					) : projects.length === 0 && !isCreatingProject && !page?.error ? (
						// Empty state with fade-in animation
						<div className="px-2 py-1 text-xs text-[#a3a3a3] duration-150 animate-in fade-in slide-in-from-top-2">
							{t("sidebar:project.empty")}
						</div>
					) : (
						<SidebarMenuSub
							ref={listRef}
							className="relative mx-0 block w-full translate-x-0 border-0 px-0 py-0"
							style={{ height: virtualizer.getTotalSize() }}
						>
							{rows.map((row) => {
								const project = projects[row.index]
								return (
									<li
										key={project.id}
										data-index={row.index}
										data-virtual-project-id={project.id}
										ref={virtualizer.measureElement}
										className="absolute left-0 top-0 w-full pb-1"
										style={{
											transform: `translateY(${row.start - scrollMargin}px)`,
										}}
									>
										<ProjectItem
											project={project}
											onInteractionChange={onInteractionChange}
											dndDisabled={dndDisabled}
											onOpenInNewWindow={openProjectInNewTab}
											onPinProject={handleTogglePinProject}
											onCopyCollaborationLink={handleCopyCollaborationLink}
											onTransferProject={handleTransferProject}
											onMoveProject={handleMoveProject}
											onAddCollaborators={onAddCollaborators}
											onCancelWorkspaceShortcut={
												handleCancelWorkspaceShortcutByProject
											}
											onDeleteProject={handleDeleteProjectConfirm}
											onRenameProject={handleRenameProject}
										/>
									</li>
								)
							})}
						</SidebarMenuSub>
					)}
					{(page?.hasMore || page?.error) && (
						<button
							type="button"
							className="w-full px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
							disabled={isLoading || page.loadingMore}
							onClick={loadMore}
						>
							{page.error
								? t("super:projectNavigation.retry")
								: page.loadingMore
									? t("sidebar:project.loading")
									: t("super:projectNavigation.loadMore")}
						</button>
					)}
					{/* Border line with fade-in animation */}
					<div className="absolute bottom-0 left-4 top-0 w-0 border-l border-[#e5e5e5] duration-300 animate-in fade-in dark:border-[#404040]" />
				</div>
			</ScrollArea>
			{projectModals}
		</>
	)
}

export default observer(ProjectList)
