import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"
import type {
	CollaborationProjectType,
	CreatedProject,
	ProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import routeManageService from "@/opensource/pages/superMagic/services/routeManageService"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { SHARE_WORKSPACE_ID } from "@/opensource/pages/superMagic/constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseProjectActionsParams {
	currentProject?: ProjectListItem
	currentProjects?: ProjectListItem[]
	setRenameModalVisible: (visible: boolean) => void
	setDeleteModalVisible: (visible: boolean) => void
	setSelectedProject?: (project: ProjectListItem | null) => void
	collaborationTabKey?: CollaborationProjectType
}

export function useProjectActions({
	currentProject,
	currentProjects,
	setRenameModalVisible,
	setDeleteModalVisible,
	setSelectedProject,
	collaborationTabKey,
}: UseProjectActionsParams) {
	const { t } = useTranslation("super")
	const [projects, setProjects] = useState<ProjectListItem[]>(currentProjects || [])

	useUpdateEffect(() => {
		setProjects(currentProjects || [])
	}, [currentProjects])

	const handleRenameProject = useMemoizedFn((project: ProjectListItem, workspaceId: string) => {
		if (!project?.project_name || !workspaceId) {
			magicToast.error(t("hierarchicalWorkspacePopup.projectNameRequired"))
			return
		}

		SuperMagicApi.editProject({
			id: project?.id,
			workspace_id: workspaceId,
			project_name: project?.project_name,
		}).then(() => {
			magicToast.success(t("hierarchicalWorkspacePopup.renameSuccess"))
			pubsub.publish(PubSubEvents.Update_Project_Name, project?.id, project?.project_name)
			setProjects((prevProjects) => {
				return prevProjects.map((p) => {
					if (p.id !== project?.id) return p
					return {
						...p,
						project_name: project?.project_name,
					}
				})
			})
			setRenameModalVisible(false)
		})
	})

	const handleDeleteProject = useMemoizedFn(
		async (
			projectId: string,
			deleteProjectApi: (id: string, isAutoSelect?: boolean) => Promise<void>,
		) => {
			await deleteProjectApi(projectId, false)

			if (currentProjects?.length === 1) {
				setProjects([])
				setSelectedProject?.(null)
				routeManageService.navigateToState({
					projectId: null,
				})
				setDeleteModalVisible(false)
				return
			}

			const targetIndex = projects.findIndex((p) => p.id === projectId)

			const nextIndex = targetIndex === projects.length - 1 ? targetIndex - 1 : targetIndex

			const newProjects = projects.filter((p) => p.id !== projectId)

			setProjects(newProjects)

			// 如果删除的是当前选中的项目，则选中下一个项目
			if (!currentProject || currentProject?.id === projectId) {
				const nextProject = newProjects[nextIndex]
				setSelectedProject?.(nextProject)
				routeManageService.navigateToState({
					projectId: nextProject.id,
				})
			}

			setDeleteModalVisible(false)
		},
	)

	const handleAddProject = useCallback(
		async (workspaceId: string) => {
			if (!workspaceId) return null

			const loadingMessage = magicToast.loading({ content: t("ui.processing"), duration: 0 })
			const defaultProjectName = ""
			const res = await SuperMagicApi.createProject({
				workspace_id: workspaceId,
				project_name: defaultProjectName,
				project_description: "",
				project_mode: "",
			})
				.then((res: CreatedProject) => {
					if (res?.project) {
						setProjects((prevProjects) => {
							return [...prevProjects, res.project]
						})
					}
					return res
				})
				.catch((err) => {
					console.log(err, "err")
					return null
				})
				.finally(() => {
					magicToast.destroy(loadingMessage)
				})

			return res
		},
		[t],
	)

	const loadProjects = useCallback(
		async ({
			workspaceId,
			collaborationTabKey: _collaborationTabKey,
		}: {
			workspaceId: string
			collaborationTabKey?: CollaborationProjectType
		}) => {
			setProjects([])
			const res =
				workspaceId === SHARE_WORKSPACE_ID
					? await SuperMagicApi.getCollaborationProjects({
							page: 1,
							page_size: 99,
							type: _collaborationTabKey || collaborationTabKey,
						})
					: await SuperMagicApi.getProjectsWithCollaboration({
							workspace_id: workspaceId,
							page: 1,
							page_size: 99,
						})

			setProjects(res?.list || [])
		},
		[collaborationTabKey],
	)

	const handleProjectClick = useCallback(
		async (project: ProjectListItem, onNavigate: (project: ProjectListItem) => void) => {
			onNavigate(project)
		},
		[],
	)

	return {
		projects,
		setProjects,
		handleRenameProject,
		handleDeleteProject,
		handleAddProject,
		loadProjects,
		handleProjectClick,
	}
}
