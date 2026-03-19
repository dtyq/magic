import MagicIcon from "@/components/base/MagicIcon"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import CollaborationShortCut from "@/pages/superMagic/components/CollaborationShortCut"
import {
	isCollaborationProject,
	isCollaborationWorkspace,
	isSelfCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import { IconDots } from "@tabler/icons-react"
import { memo } from "react"
import { cn } from "@/lib/utils"
import type { ProjectListItemProps } from "./types"
import ProjectIcon from "../ProjectIcon"

function ProjectListItem({
	project,
	workspace,
	userInfo,
	isSelected,
	onSelect,
	onActionClick,
	emptyText,
}: ProjectListItemProps) {
	const isCollaborationWorkspaceStatus = isCollaborationWorkspace(workspace)
	const isWorkspaceShortcutProjectStatus = isWorkspaceShortcutProject(project)
	const isSelfCollaborationProjectStatus = isSelfCollaborationProject(project, userInfo)

	return (
		<div
			className={cn(
				"relative mx-2.5 mb-0.5 flex h-11 cursor-pointer overflow-hidden rounded-lg bg-background px-3 py-3 pl-2 transition-all duration-200 last:mb-0",
				isSelected && "bg-primary-10",
			)}
			onClick={() => onSelect(project)}
		>
			<div className="flex w-full flex-1 items-center justify-between">
				<div className="flex w-full min-w-0 items-center gap-2">
					<ProjectIcon />
					<div className="flex max-w-[calc(100%-30px)] flex-1 items-center gap-1">
						{project.is_pinned && <PinnedTag className="shrink-0" showText={false} />}
						{isWorkspaceShortcutProjectStatus && !isSelfCollaborationProjectStatus ? (
							<CollaborationShortCut />
						) : (
							!isCollaborationWorkspaceStatus && (
								<CollaborationProjectTag
									visible={isCollaborationProject(project)}
									project={project}
									showText={false}
								/>
							)
						)}
						<div className="min-w-0 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal text-foreground">
							{project.project_name || emptyText}
						</div>
					</div>
				</div>
				<div className="ml-0 flex items-center gap-3.5">
					<MagicIcon
						size={18}
						component={IconDots}
						onClick={(e) => {
							e.stopPropagation()
							onActionClick(project)
						}}
					/>
				</div>
			</div>
		</div>
	)
}

export default memo(ProjectListItem)
