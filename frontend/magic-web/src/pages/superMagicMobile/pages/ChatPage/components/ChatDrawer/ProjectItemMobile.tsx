import { useMemo } from "react"
import { Ellipsis, Pin, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import IconWorkspaceProjectFolder from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import { isCollaborationProject } from "@/pages/superMagic/constants"
import SuperMagicService from "@/pages/superMagic/services"
import projectStore from "@/pages/superMagic/stores/core/project"
import magicToast from "@/components/base/MagicToaster/utils"
import { useSwipeActions } from "./hooks/useSwipeActions"
import { SwipeActionButtons } from "./SwipeActionButtons"
import type { SwipeActionButtonConfig } from "./SwipeActionButtons"

export const enum SortType {
	PROJECT_UPDATE_TIME = "updated_at",
	MY_LAST_ACTIVE_TIME = "last_active_at",
	PROJECT_CREATE_TIME = "created_at",
}

interface ProjectItemMobileProps {
	project: ProjectListItem
	workspaceId: string
	sortType?: SortType
	isSwiped?: boolean
	onSwipeChange?: (isSwiped: boolean) => void
	/** 用户手指触碰该列表项时立即触发，用于父级立即收起其他已展开项 */
	onDragStart?: () => void
	/** 工作区只剩一个项目时将删除按钮置为禁用态，防止用户误删唯一项目 */
	disableDelete?: boolean
	onProjectActions: (project: ProjectListItem) => void
	onProjectDelete: (project: ProjectListItem) => void
	onDrawerClose: () => void
}

export default function ProjectItemMobile({
	project,
	workspaceId,
	sortType,
	isSwiped = false,
	onSwipeChange,
	onDragStart,
	disableDelete = false,
	onProjectActions,
	onProjectDelete,
	onDrawerClose,
}: ProjectItemMobileProps) {
	const { t } = useTranslation("super")

	const { offsetX, isDragging, touchHandlers, close } = useSwipeActions({
		syncOpen: isSwiped,
		onSwipeChange,
		onDragStart,
	})

	const handleOpenProject = useMemoizedFn(() => {
		// 已展开操作按钮时，点击主内容先收起
		if (offsetX < 0) {
			close()
			onSwipeChange?.(false)
			return
		}
		onDrawerClose()
		SuperMagicService.switchProjectById(project.id)
	})

	const handleMore = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		onSwipeChange?.(false)
		onProjectActions(project)
	})

	const handlePin = useMemoizedFn(async (e: React.MouseEvent) => {
		e.stopPropagation()
		const isPin = !project.is_pinned
		try {
			await SuperMagicService.project.pinProject(project, isPin)

			SuperMagicService.project.fetchProjects({
				workspaceId: workspaceId,
				clearWhenNoProjects: false,
			})

			projectStore.loadProjectsForWorkspace(workspaceId, true, true)

			onSwipeChange?.(false)
			magicToast.success(
				isPin
					? t("hierarchicalWorkspacePopup.pinProjectSuccess")
					: t("hierarchicalWorkspacePopup.unpinProjectSuccess"),
			)
		} catch (error) {
			magicToast.error(
				isPin
					? t("hierarchicalWorkspacePopup.pinProjectFailed")
					: t("hierarchicalWorkspacePopup.unpinProjectFailed"),
			)
			// Error already handled in service
		}
	})

	const handleDelete = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		onProjectDelete(project)
	})

	const timeRender = useMemo(() => {
		switch (sortType) {
			case SortType.PROJECT_UPDATE_TIME:
				return t("common.lastUpdatedAt", {
					time: (project.last_active_at || project.updated_at).replaceAll("-", "/"),
				})
			case SortType.MY_LAST_ACTIVE_TIME:
				if (!project.last_active_at) {
					return t("common.noActiveTime")
				}
				return t("common.lastActiveAt", {
					time: project.last_active_at?.replaceAll("-", "/"),
				})
			case SortType.PROJECT_CREATE_TIME:
				return t("common.createdAt", {
					time: project.created_at.replaceAll("-", "/"),
				})
			default:
				return t("common.lastUpdatedAt", {
					time: (project.last_active_at || project.updated_at).replaceAll("-", "/"),
				})
		}
	}, [project.updated_at, project.created_at, project.last_active_at, sortType, t])

	const actionButtons: [
		SwipeActionButtonConfig,
		SwipeActionButtonConfig,
		SwipeActionButtonConfig,
	] = [
			{
				label: t("common.moreActions"),
				icon: <Ellipsis size={16} className="text-white" />,
				bgClassName: "bg-[#9ca3af]",
				labelClassName: "text-white",
				onClick: handleMore,
			},
			{
				label: project.is_pinned
					? t("hierarchicalWorkspacePopup.unpinProject")
					: t("hierarchicalWorkspacePopup.pinProject"),
				icon: <Pin size={16} className="text-primary-foreground" />,
				bgClassName: "bg-primary",
				labelClassName: "text-primary-foreground",
				onClick: handlePin,
			},
			{
				label: t("common.delete"),
				icon: <Trash2 size={16} className="text-destructive-foreground" />,
				bgClassName: "bg-destructive",
				labelClassName: "text-destructive-foreground",
				onClick: handleDelete,
				disabled: disableDelete,
			},
		]

	const snapTransition = isDragging ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)"

	return (
		<div className="relative flex w-full shrink-0 items-center overflow-hidden">
			<SwipeActionButtons offsetX={offsetX} isDragging={isDragging} buttons={actionButtons} />

			{/* 主内容层 */}
			<div
				className={cn(
					"relative z-10 flex w-full cursor-pointer items-center gap-2 bg-background px-4 py-2.5",
				)}
				style={{
					transform: `translateX(${offsetX}px)`,
					transition: snapTransition,
					willChange: "transform",
				}}
				onTouchStart={touchHandlers.onTouchStart}
				onTouchMove={touchHandlers.onTouchMove}
				onTouchEnd={touchHandlers.onTouchEnd}
				onClick={handleOpenProject}
			>
				{/* 文件夹图标容器 */}
				<div className="flex size-8 shrink-0 items-center justify-center">
					<IconWorkspaceProjectFolder isHovered={false} size={24} />
				</div>

				{/* 项目信息容器 */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* 第一行：置顶图标 + 项目名称 */}
					<div className="flex h-6 items-center gap-1">
						{project.is_pinned && <PinnedTag showText={false} />}
						<CollaborationProjectTag
							visible={isCollaborationProject(project)}
							project={project}
							showText={false}
						/>
						<div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
							{project.project_name || t("project.unnamedProject")}
						</div>
					</div>

					{/* 第二行：更新时间 */}
					<div className="truncate text-xs font-light text-muted-foreground">
						{timeRender}
					</div>
				</div>
			</div>

			{/* 左侧渐变遮罩 */}
			{offsetX < 0 && (
				<div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-12 bg-gradient-to-r from-background from-50% to-transparent" />
			)}
		</div>
	)
}
