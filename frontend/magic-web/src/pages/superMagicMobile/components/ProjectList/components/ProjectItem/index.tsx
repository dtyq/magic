import { ChevronRight, Ellipsis, Pin, PinOff, Trash2 } from "lucide-react"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"

function isRunningLikeStatus(status: string | undefined) {
	return status === "running" || status === "waiting_for_user"
}

function getTopicCount(project: ProjectListItem) {
	return project.topic_count ?? 0
}

/**
 * 单个项目行，支持左滑展示"更多 / 置顶 / 删除"操作按钮。
 * SwipeActionRow 负责手势逻辑与互斥展开，本组件只组装 actions 和行内容。
 */
function ProjectItem({
	project,
	onOpen,
	updatedAtLabel,
	isSwipeOpen,
	onSwipeOpen,
	onSwipeClose,
	onMore,
	onPin,
	onDelete,
}: {
	project: ProjectListItem
	onOpen: (project: ProjectListItem) => void
	updatedAtLabel?: string
	isSwipeOpen: boolean
	onSwipeOpen: () => void
	onSwipeClose: () => void
	onMore: (project: ProjectListItem) => void
	onPin: (project: ProjectListItem) => void
	onDelete: (project: ProjectListItem) => void
}) {
	const { t } = useTranslation("super")
	const isRunning =
		isRunningLikeStatus(project.current_topic_status) ||
		isRunningLikeStatus(project.project_status)
	const showCollaborationTag =
		isWorkspaceShortcutProject(project) || isCollaborationProject(project)
	const subtitle = [
		t("sharedProjects.topicCount", { count: getTopicCount(project) }),
		updatedAtLabel || t("project.unnamedProject"),
	].join(" · ")

	const actions: SwipeAction[] = [
		{
			id: "more",
			label: t("projectList.swipeMore"),
			icon: <Ellipsis className="size-4 text-secondary-foreground" />,
			className: "bg-secondary",
			labelClassName: "text-secondary-foreground",
			onClick: () => onMore(project),
		},
		{
			id: "pin",
			label: project.is_pinned ? t("projectList.swipeUnpin") : t("projectList.swipePin"),
			icon: project.is_pinned ? (
				<PinOff className="size-4 text-primary-foreground" />
			) : (
				<Pin className="size-4 text-primary-foreground" />
			),
			className: "bg-primary",
			labelClassName: "text-primary-foreground",
			onClick: () => onPin(project),
		},
		{
			id: "delete",
			label: t("projectList.swipeDelete"),
			icon: <Trash2 className="size-4 text-white" />,
			className: "bg-destructive",
			labelClassName: "text-white",
			onClick: () => onDelete(project),
		},
	]

	return (
		<SwipeActionRow
			actions={actions}
			isOpen={isSwipeOpen}
			onOpen={onSwipeOpen}
			onClose={onSwipeClose}
			onRowClick={() => onOpen(project)}
			data-testid={`workspace-project-row-${project.id}`}
		>
			{/* 行内容区：固定 h-16 对齐 SwipeActionRow 外壳高度 */}
			<div className="flex h-16 w-full items-center gap-2 rounded-lg px-3 py-[10px] text-left">
				{/* 项目图标维持原型的 36x36 视觉节奏，并在运行中切换为加载态。 */}
				<MobileResourceTypeIcon
					type="project"
					isRunning={isRunning}
					loaderSizeClass="size-6"
					iconSizeClass="size-6"
				/>

				<div className="flex min-w-0 flex-1 flex-col items-start">
					<div className="flex h-6 w-full min-w-0 items-center gap-1">
						<p className="min-w-0 shrink truncate text-[16px] font-medium leading-6 text-foreground">
							{project.project_name || t("project.unnamedProject")}
						</p>
						{project.is_pinned ? <MobilePinBadge /> : null}
						{/* 项目行协作图标与 PC 端保持同口径，且放在标题后侧以对齐当前移动端原型。 */}
						{showCollaborationTag ? (
							<CollaborationProjectTag
								visible={showCollaborationTag}
								project={project}
								showText={false}
							/>
						) : null}
					</div>
					<div className="w-full truncate text-[12px] font-light leading-4 text-muted-foreground">
						{subtitle}
					</div>
				</div>

				<ChevronRight className="h-4 w-4 shrink-0 text-foreground" />
			</div>
		</SwipeActionRow>
	)
}
export default ProjectItem
