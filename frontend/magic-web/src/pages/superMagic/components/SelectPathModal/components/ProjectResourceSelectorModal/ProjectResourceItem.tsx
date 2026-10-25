import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ViewMode } from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import { cn } from "@/utils/cn"
import type { ResourceProject } from "../../resourceProjectTypes"
import { ProjectResourceInfo } from "./ProjectResourceInfo"

interface ProjectResourceItemProps {
	project: ResourceProject
	index?: number
	viewMode?: ViewMode
	variant?: "default" | "compact"
	onClick: (project: ResourceProject) => void
	selection?: { checked: boolean; onCheck: () => void }
}

export function ProjectResourceItem({
	project,
	index,
	viewMode = ViewMode.GRID,
	variant = "compact",
	onClick,
	selection,
}: ProjectResourceItemProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const isList = isMobile || viewMode === ViewMode.LIST
	const name =
		project.project_name?.trim() ||
		(project.resourceType === "agent"
			? t("crew/create:untitledCrew")
			: project.resourcePackageName || t("project.unnamedProject"))
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget) return
		if (event.key === "Enter") onClick(project)
		if (event.key === " ") {
			event.preventDefault()
			selection?.onCheck()
		}
	}

	return (
		<div
			className={cn(
				"relative flex min-w-0 cursor-pointer items-start gap-2 border border-border bg-card transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				isList
					? "min-h-14 w-full rounded-none border-x-0 border-t-0 px-3 py-3"
					: "h-full rounded-lg p-3",
				variant === "default" && !isMobile && "shadow-xs",
				selection?.checked && "border-primary/50 bg-primary/5",
			)}
			role="button"
			tabIndex={0}
			onClick={() => onClick(project)}
			onKeyDown={handleKeyDown}
			data-testid="project-resource-item"
			data-index={index}
			data-view-mode={isList ? ViewMode.LIST : ViewMode.GRID}
			data-resource-type={project.resourceType}
		>
			{selection ? (
				<div
					className="shrink-0 pt-1"
					onClick={(event) => event.stopPropagation()}
					onPointerDown={(event) => event.stopPropagation()}
				>
					<Checkbox
						checked={selection.checked}
						aria-label={t("selectPathModal.selectProject", { name })}
						onCheckedChange={selection.onCheck}
					/>
				</div>
			) : null}
			<ProjectResourceInfo
				project={project}
				name={name}
				mobile={isMobile}
				list={isList}
				titleTrailing={
					<>
						{project.is_pinned && <PinnedTag />}
						{(isWorkspaceShortcutProject(project) ||
							isCollaborationProject(project)) && (
							<CollaborationProjectTag visible project={project} showText={false} />
						)}
					</>
				}
			/>
		</div>
	)
}
