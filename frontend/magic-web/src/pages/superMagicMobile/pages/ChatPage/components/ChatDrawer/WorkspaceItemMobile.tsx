import { useEffect } from "react"
import { observer } from "mobx-react-lite"
import { Box, ChevronRight, MoreHorizontal, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import projectStore from "@/pages/superMagic/stores/core/project"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import ProjectItemMobile from "./ProjectItemMobile"

interface WorkspaceItemMobileProps {
	workspace: Workspace
	isActive: boolean
	isExpanded: boolean
	/** 当前全局唯一左滑展开的项目 ID（由父级统一管理） */
	swipedProjectId?: string | null
	/** 左滑状态变化时通知父级（null 表示收起） */
	onProjectSwipeChange?: (projectId: string | null) => void
	/**
	 * 某个项目 touchStart 时同步通知父级（在 onProjectSwipeChange 之前调用），
	 * 父级用于在状态被清空前保存"是否有左滑项"的快照，防止 click 拦截失效。
	 */
	onProjectDragStart?: () => void
	onToggle: () => void
	onWorkspaceActions: (workspace: Workspace) => void
	onProjectActions: (project: ProjectListItem) => void
	onProjectDelete: (project: ProjectListItem) => void
	onNewProject?: (workspace: Workspace) => void
	onDrawerClose: () => void
}

function WorkspaceItemMobile({
	workspace,
	isActive,
	isExpanded,
	swipedProjectId = null,
	onProjectSwipeChange,
	onProjectDragStart,
	onToggle,
	onWorkspaceActions,
	onProjectActions,
	onProjectDelete,
	onNewProject,
	onDrawerClose,
}: WorkspaceItemMobileProps) {
	const { t } = useTranslation("super")

	const projects = projectStore.getProjectsByWorkspace(workspace.id)
	const isLoading = projectStore.isLoadingWorkspace(workspace.id)

	function handleToggle(e: React.MouseEvent<HTMLDivElement>) {
		e.stopPropagation()
		onToggle()
	}

	function handleMoreClick(e: React.MouseEvent<HTMLDivElement>) {
		e.stopPropagation()
		onWorkspaceActions(workspace)
	}

	function handleNewProjectClick(e: React.MouseEvent<HTMLDivElement>) {
		e.stopPropagation()
		onNewProject?.(workspace)
	}

	function handleProjectSwipe(projectId: string, isSwiped: boolean) {
		onProjectSwipeChange?.(isSwiped ? projectId : null)
	}

	function handleProjectDragStart(projectId: string) {
		// 先通知父级保存快照（此时 swipedProjectId 闭包值仍为旧的非 null 值）
		onProjectDragStart?.()
		// 再执行状态清空，避免 click 事件到达时 swipedProjectId 已为 null 导致拦截失效
		if (swipedProjectId !== null && swipedProjectId !== projectId) {
			onProjectSwipeChange?.(null)
		}
	}

	useEffect(() => {
		if (isExpanded && !projectStore.hasLoadedWorkspace(workspace.id)) {
			projectStore.loadProjectsForWorkspace(workspace.id)
		}
	}, [isExpanded, workspace.id])

	// 当工作区收起时，若本工作区有展开项目则通知父级收起
	useEffect(() => {
		if (!isExpanded) {
			const hasSwipedInThisWorkspace = projects.some((p) => p.id === swipedProjectId)
			if (hasSwipedInThisWorkspace) {
				onProjectSwipeChange?.(null)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isExpanded])

	return (
		<div className="flex w-full flex-col">
			{/* Workspace 行 */}
			<div className="flex w-full items-center gap-2 px-4 py-2.5">
				{/* 可点击区域：箭头 + 图标 + 名称 */}
				<div
					className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
					onClick={handleToggle}
				>
					<div className="flex size-4 shrink-0 items-center justify-center">
						<ChevronRight
							className={cn(
								"size-4 text-foreground transition-transform",
								isExpanded && "rotate-90",
							)}
						/>
					</div>
					<div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground">
						<Box className="size-4 text-background" />
					</div>
					<div className="min-w-0 flex-1 truncate text-sm text-foreground">
						{workspace.name || t("super:workspace.unnamedWorkspace")}
					</div>
				</div>

				{/* 操作按钮组 */}
				<div className="flex shrink-0 items-center gap-2">
					<div
						className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
						onClick={handleNewProjectClick}
					>
						<Plus className="size-4 text-foreground" />
					</div>
					<div
						className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
						onClick={handleMoreClick}
					>
						<MoreHorizontal className="size-4 text-foreground" />
					</div>
				</div>
			</div>

			{/* 项目列表 */}
			{isExpanded && (
				<div className="flex w-full flex-col">
					{isLoading ? (
						<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
							{t("common.loading")}
						</div>
					) : projects.length > 0 ? (
						projects.map((project) => (
							<ProjectItemMobile
								key={project.id}
								project={project}
								workspaceId={workspace.id}
								isSwiped={swipedProjectId === project.id}
								onSwipeChange={(isSwiped) =>
									handleProjectSwipe(project.id, isSwiped)
								}
								onDragStart={() => handleProjectDragStart(project.id)}
								disableDelete={projects.length === 1}
								onProjectActions={onProjectActions}
								onProjectDelete={onProjectDelete}
								onDrawerClose={onDrawerClose}
							/>
						))
					) : (
						<div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
							{t("project.noProjects")}
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default observer(WorkspaceItemMobile)
