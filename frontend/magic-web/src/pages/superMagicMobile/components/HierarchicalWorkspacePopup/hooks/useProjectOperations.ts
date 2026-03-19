import { useState, useCallback, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import {
	TopicMode,
	type CollaborationProjectType,
	type CreatedProject,
	type ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import SuperMagicService from "@/pages/superMagic/services"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import { SuperMagicApi } from "@/apis"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseProjectOperationsParams {
	currentProject?: ProjectListItem
	currentProjects?: ProjectListItem[]
	setRenameModalVisible: (visible: boolean) => void
	setDeleteModalVisible: (visible: boolean) => void
	setSelectedProject?: (project: ProjectListItem | null) => void
	collaborationTabKey?: CollaborationProjectType
}

export function useProjectOperations({
	currentProject,
	currentProjects,
	setRenameModalVisible,
	setDeleteModalVisible,
	setSelectedProject,
	collaborationTabKey,
}: UseProjectOperationsParams) {
	const { t } = useTranslation("super")
	// Keep projects as component internal state (temporary, doesn't affect global store)
	const [projects, setProjects] = useState<ProjectListItem[]>(currentProjects || [])

	const currentProjectIdsKey = useMemo(
		() => (currentProjects || []).map((p) => p.id).join(","),
		[currentProjects],
	)

	const currentProjectsRef = useRef(currentProjects)
	currentProjectsRef.current = currentProjects

	useUpdateEffect(() => {
		setProjects(currentProjectsRef.current || [])
	}, [currentProjectIdsKey])

	const handleRenameProject = useMemoizedFn(
		async (project: ProjectListItem, workspaceId: string) => {
			if (!project?.project_name || !workspaceId) {
				magicToast.error(t("hierarchicalWorkspacePopup.projectNameRequired"))
				return
			}

			try {
				await SuperMagicService.project.renameProject(
					project.id,
					project.project_name,
					workspaceId,
				)
				magicToast.success(t("hierarchicalWorkspacePopup.renameSuccess"))
				pubsub.publish(PubSubEvents.Update_Project_Name, project.id, project.project_name)
				// Update internal state
				setProjects((prevProjects) => {
					return prevProjects.map((p) => {
						if (p.id !== project.id) return p
						return {
							...p,
							project_name: project.project_name,
						}
					})
				})
				setRenameModalVisible(false)
			} catch (error) {
				// Error already handled in service
			}
		},
	)

	const handleDeleteProject = useMemoizedFn(
		async (projectId: string, deleteProjectApi: (id: string) => Promise<void>) => {
			await deleteProjectApi(projectId)

			if (currentProjects?.length === 1) {
				setProjects([])
				setSelectedProject?.(null)
				setDeleteModalVisible(false)
				// 回到工作区页面
				if (workspaceStore.selectedWorkspace) {
					SuperMagicService.switchWorkspace(workspaceStore.selectedWorkspace)
				}
				return
			}

			const targetIndex = projects.findIndex((p) => p.id === projectId)
			const nextIndex = targetIndex === projects.length - 1 ? targetIndex - 1 : targetIndex
			const newProjects = projects.filter((p) => p.id !== projectId)

			setProjects(newProjects)

			// If deleting the currently selected project, select the next one
			if (!currentProject || currentProject?.id === projectId) {
				const nextProject = newProjects[nextIndex]
				SuperMagicService.switchProjectInMobile(nextProject)
			}

			setDeleteModalVisible(false)
		},
	)

	const handleAddProject = useCallback(
		async (workspaceId: string): Promise<CreatedProject | null> => {
			if (!workspaceId) return null

			const loadingMessage = magicToast.loading({ content: t("ui.processing"), duration: 0 })
			try {
				// Use service to create project (updates global store)
				const res = await SuperMagicService.project.createProject({
					workspaceId,
					projectMode: TopicMode.Empty,
				})

				if (res?.project) {
					// Update internal state
					setProjects((prevProjects) => {
						return [res.project, ...prevProjects]
					})
				}
				return res
			} catch (error) {
				console.log(error, "err")
				return null
			} finally {
				magicToast.destroy(loadingMessage)
			}
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
			// setProjects([])
			try {
				// Directly call API to avoid updating global store
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
				const updatedProjects = res.list
				// Update internal state only, don't affect global store
				setProjects(updatedProjects || [])
			} catch (error) {
				console.error("Failed to load projects:", error)
				setProjects([])
			}
		},
		[collaborationTabKey],
	)

	return {
		projects,
		setProjects,
		handleRenameProject,
		handleDeleteProject,
		handleAddProject,
		loadProjects,
	}
}
