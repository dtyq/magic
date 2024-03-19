import { IconWorkspaceProjectFolderIcon } from "@/opensource/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { IconDots, IconChevronRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import CollaborationProjectTag from "@/opensource/pages/superMagic/components/CollaborationProjectTag"
import { isCollaborationProject } from "@/opensource/pages/superMagic/constants"
import PinnedTag from "@/opensource/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import { cn } from "@/opensource/lib/utils"

function ProjectItem({
	project,
	onOpen,
	onMoreClick,
}: {
	project: ProjectListItem
	onOpen: (project: ProjectListItem) => void
	onMoreClick: (e: React.MouseEvent<HTMLDivElement>, project: ProjectListItem) => void
}) {
	const { t } = useTranslation("super")

	return (
		<div
			className={cn(
				"flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white py-1 pl-1 pr-2 transition-colors",
				"active:bg-accent",
				"transition-transform",
				"active:scale-[0.98]",
			)}
			key={project.id}
			onClick={() => onOpen(project)}
		>
			<div className="flex h-10 w-10 items-center justify-center rounded">
				<IconWorkspaceProjectFolderIcon size={30} />
			</div>
			<div className="flex flex-1 flex-col gap-1" style={{ maxWidth: "calc(100% - 100px)" }}>
				<div className="flex items-center gap-1">
					{project.is_pinned && <PinnedTag showText={false} />}
					<CollaborationProjectTag
						visible={isCollaborationProject(project)}
						project={project}
						showText={false}
					/>
					<span className="max-w-full flex-1 truncate text-xs font-semibold leading-5 text-foreground">
						{project.project_name || t("project.unnamedProject")}
					</span>
				</div>
				<div className="text-[10px] font-normal leading-[13px] text-muted-foreground">
					{t("common.lastUpdatedAt", {
						time: (project.last_active_at || project.updated_at).replaceAll("-", "/"),
					})}
				</div>
			</div>
			<div className="flex h-full items-stretch gap-2">
				<div
					className="flex items-center justify-center"
					onClick={(e) => onMoreClick(e, project)}
				>
					<IconDots size={18} />
				</div>
				<div className="flex items-center justify-center">
					<IconChevronRight size={18} />
				</div>
			</div>
		</div>
	)
}
export default ProjectItem
