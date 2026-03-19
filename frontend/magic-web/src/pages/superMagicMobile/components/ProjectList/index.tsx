import { observer } from "mobx-react-lite"
import { ProjectListItem, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import IconWorkspaceProjectStar from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectStar"
import { useTranslation } from "react-i18next"
import { IconPlus } from "@tabler/icons-react"
import { useProjectListActions } from "./hooks/useProjectActions"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import ProjectItem from "./components/ProjectItem"
import ProjectItemSkeleton from "./components/ProjectItemSkeleton"
import { workspaceStore, projectStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import magicToast from "@/components/base/MagicToaster/utils"

const ProjectList = observer(() => {
	const { t } = useTranslation("super")

	const projects = projectStore.projects
	const isFetchingProjects = projectStore.isFetchingProjects
	const selectedWorkspace = workspaceStore.selectedWorkspace

	const { projectActionComponents, openActionsPopup } = useProjectListActions()

	const handleProjectOpen = useMemoizedFn((project: ProjectListItem) => {
		if (!project?.id) return
		SuperMagicService.switchProjectInMobile(project)
	})

	const handleProjectEdit = useMemoizedFn(
		(e: React.MouseEvent<HTMLDivElement>, project: ProjectListItem) => {
			e.preventDefault()
			e.stopPropagation()
			openActionsPopup(project)
		},
	)

	const handleCreateProject = useMemoizedFn(async () => {
		if (!selectedWorkspace) return
		try {
			const res = await SuperMagicService.handleCreateProject({
				projectMode: TopicMode.Empty,
				isAutoSelect: false,
			})
			if (res) {
				SuperMagicService.switchProjectInMobile(res.project)
				magicToast.success(t("project.createProjectSuccess"))
			}
		} catch (error) {
			console.log("创建项目失败，失败原因：", error)
		}
	})

	const { run: handleCreateProjectDebounced } = useDebounceFn(handleCreateProject, {
		wait: 300,
		leading: true,
		trailing: false,
	})

	// Refresh project list
	const handleRefreshProjects = useMemoizedFn(async () => {
		if (!selectedWorkspace?.id) return
		await SuperMagicService.project.fetchProjects({
			workspaceId: selectedWorkspace.id,
			page: 1,
		})
	})

	return (
		<MagicPullToRefresh onRefresh={handleRefreshProjects} showSuccessMessage={false}>
			<div className="flex flex-col gap-2">
				<div
					className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-white px-2 py-1 pl-1 transition-opacity active:opacity-80"
					onClick={handleCreateProjectDebounced}
				>
					<div className="flex h-10 w-10 items-center justify-center">
						<div className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-primary text-white">
							<IconPlus size={24} stroke={2} />
						</div>
					</div>
					<div className="flex flex-1 flex-col gap-0.5 text-sm font-semibold leading-5 text-foreground">
						{t("project.createNewProject")}
					</div>
				</div>
				{isFetchingProjects ? (
					<>
						<ProjectItemSkeleton />
						<ProjectItemSkeleton />
						<ProjectItemSkeleton />
					</>
				) : (
					projects.map((project) => (
						<ProjectItem
							key={project.id}
							project={project}
							onOpen={handleProjectOpen}
							onMoreClick={handleProjectEdit}
						/>
					))
				)}
			</div>
			{projectActionComponents}
		</MagicPullToRefresh>
	)
})

export default ProjectList
