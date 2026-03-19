import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import ProjectItem from "./ProjectItem"
import CreateProjectInput from "./CreateProjectInput"
import type { ProjectListProps } from "./types"
import { SidebarMenuSub, SidebarMenuSubItem } from "@/components/shadcn-ui/sidebar"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import { openProjectInNewTab } from "@/pages/superMagic/utils/project"

function ProjectList({
	workspace,
	projects,
	workspaceId,
	isLoading,
	isCreatingProject,
	onCancelCreate,
	onProjectCreated,
}: ProjectListProps) {
	const { t } = useTranslation(["super", "sidebar"])

	const {
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

	return (
		<>
			<div
				className="relative flex w-full shrink-0 flex-col items-start gap-1 py-0.5 pl-6 pr-0"
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
				{isLoading ? (
					// Loading text with fade-in animation
					<div className="px-2 py-1 text-xs text-[#a3a3a3] duration-150 animate-in fade-in slide-in-from-top-2">
						{t("sidebar:project.loading")}
					</div>
				) : projects.length === 0 && !isCreatingProject ? (
					// Empty state with fade-in animation
					<div className="px-2 py-1 text-xs text-[#a3a3a3] duration-150 animate-in fade-in slide-in-from-top-2">
						{t("sidebar:project.empty")}
					</div>
				) : (
					<SidebarMenuSub className="mx-0 w-full translate-x-0 border-0 px-0 py-0">
						{projects.map((project, index) => (
							<SidebarMenuSubItem
								key={project.id}
								className="w-full duration-150 animate-in fade-in slide-in-from-top-2"
								style={{
									animationDelay: `${index * 30}ms`,
									animationFillMode: "backwards",
								}}
							>
								<ProjectItem
									project={project}
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
							</SidebarMenuSubItem>
						))}
					</SidebarMenuSub>
				)}
				{/* Border line with fade-in animation */}
				<div className="absolute bottom-0 left-4 top-0 w-0 border-l border-[#e5e5e5] duration-300 animate-in fade-in dark:border-[#404040]" />
			</div>
			{projectModals}
		</>
	)
}

export default observer(ProjectList)
