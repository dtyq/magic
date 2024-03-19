import { useCallback, useEffect, useState } from "react"
import type { CreatedProject, ProjectListItem } from "../pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"
import { Workspace, TopicMode, CollaborationProjectType } from "../pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { openModal } from "@/opensource/utils/react"
import DeleteDangerModal from "@/opensource/components/business/DeleteDangerModal"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import type { NavigateToStateParams } from "../services/routeManageService"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { isCollaborationWorkspace, SHARE_WORKSPACE_ID } from "../constants"
import { useNoPermissionCollaborationProject } from "./useNoPermissionCollaborationProject"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export const enum COLLABORATION_TAB_KEY {
	FROM_OTHER = "received",
	TO_OTHER = "shared",
}

interface UseProjectsProps {
	selectedWorkspace: Workspace | null
	onWorkspaceStateChange: (workspaceState: NavigateToStateParams) => void
}

export interface FetchProjectsParams {
	workspaceId: string
	isAutoSelect?: boolean
	isSelectLast?: boolean
	isEditLast?: boolean
	page?: number
	/**
	 * 当项目列表为空时，是否清除选中项目
	 */
	clearWhenNoProjects?: boolean
	collaborationTabKey?: CollaborationProjectType
}

export interface HandleRenameProjectParams {
	projectId: string
	projectName: string
	showMessage?: boolean
}

export interface UpdateProjectsParams {
	workspaceId: string
	page?: number
}

export interface UpdateProjectStatusParams {
	projectId?: string
}

export interface HandleCreateProjectParams {
	projectMode: TopicMode
	isAutoSelect?: boolean
	isEditProject?: boolean
	workdir?: string
}

export function useProjects({ selectedWorkspace, onWorkspaceStateChange }: UseProjectsProps) {
	const { t } = useTranslation("super")

	const [projects, setProjects] = useState<ProjectListItem[]>([])
	const [allProjects, setAllProjects] = useState<ProjectListItem[]>([])
	const [allProjectsPage, setAllProjectsPage] = useState(1)
	const [isAllProjectsLoaded, setIsAllProjectsLoaded] = useState(false)
	const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)

	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	/**
	 * 更新项目列表
	 * 注意：该方法仅用于更新指定工作区的项目列表，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateProjects = useCallback(
		async ({
			workspaceId,
			page = 1,
			collaborationTabKey = CollaborationProjectType.Received,
		}: {
			workspaceId: string
			page?: number
			collaborationTabKey?: CollaborationProjectType
		}) => {
			try {
				const res =
					workspaceId === SHARE_WORKSPACE_ID
						? await SuperMagicApi.getCollaborationProjects({
								page,
								page_size: 99,
								type: collaborationTabKey,
							})
						: await SuperMagicApi.getProjectsWithCollaboration({
								workspace_id: workspaceId,
								page,
								page_size: 99,
							})
				const updatedProjects = res.list
				setProjects(updatedProjects)
				return updatedProjects
			} catch (error) {
				console.log("更新项目列表失败，失败原因：", error)
				return []
			}
		},
		[],
	)

	/**
	 * 获取工作区的项目列表
	 * @param workspaceId 当前工作区ID
	 * @param isAutoSelect 返回列表后是否自动选中项目
	 * @param isSelectLast 返回列表后是否选中最新的项目
	 * @param isEditLast 返回列表后是否自动编辑最新项目（已废弃，编辑状态现在由组件内部管理）
	 * @param page 项目列表页码
	 */
	const fetchProjects = useCallback(
		async ({
			workspaceId,
			isAutoSelect = true,
			isSelectLast = true,
			isEditLast = false,
			collaborationTabKey,
			clearWhenNoProjects = true,
			page = 1,
		}: FetchProjectsParams) => {
			// Note: isEditLast is kept for backward compatibility but editing state
			// is now managed within ProjectsMenu component via useProjectEditing hook
			void isEditLast
			try {
				const updatedProjects = await updateProjects({
					workspaceId,
					page,
					collaborationTabKey,
				})

				if (updatedProjects.length === 0) {
					if (clearWhenNoProjects) {
						setSelectedProject(null)
						onWorkspaceStateChange({
							workspaceId,
							projectId: null,
							topicId: null,
						})
					}
					return []
				}

				if (isAutoSelect && !isSelectLast && selectedProject) {
					const _selectedProject =
						updatedProjects.find(
							(project: ProjectListItem) => project.id === selectedProject.id,
						) ||
						updatedProjects[0] ||
						null
					setSelectedProject(_selectedProject)
					onWorkspaceStateChange({
						projectId: _selectedProject?.id || null,
					})
				} else if (isAutoSelect) {
					const _selectedProject = updatedProjects[0] || null
					setSelectedProject(_selectedProject)
					onWorkspaceStateChange({
						projectId: _selectedProject?.id || null,
					})
				}

				return updatedProjects
			} catch (error) {
				console.log("加载项目失败，失败原因：", error)
				return []
			}
		},
		[selectedProject, onWorkspaceStateChange, updateProjects],
	)

	// 获取所有项目列表，按最新更新时间排序
	const fetchAllProjects = useCallback(
		async ({ page }: { page: number }) => {
			try {
				const res = await SuperMagicApi.getProjectsWithCollaboration({
					page,
					page_size: 20,
				})
				if (page === 1) {
					setAllProjects(res.list)
					setAllProjectsPage(1)
					setIsAllProjectsLoaded(res.total === res.list.length)
				} else {
					const newAllProjects = [...allProjects, ...res.list]
					setAllProjects(newAllProjects)
					setAllProjectsPage(page)
					setIsAllProjectsLoaded(res.total === newAllProjects.length)
				}
			} catch (error) {
				console.log("加载项目失败，失败原因：", error)
			}
		},
		[allProjects],
	)

	/**
	 * 更新项目的名称
	 * 注意：该方法仅用于更新指定项目的项目名称，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateProjectName = useCallback(
		async (projectId: string, projectName: string) => {
			if (selectedProject?.id === projectId) {
				setSelectedProject({
					...selectedProject,
					project_name: projectName,
				})
			}
			const updatedProjects = projects.map((project) => {
				if (project.id === projectId) {
					return { ...project, project_name: projectName }
				}
				return project
			})
			setProjects(updatedProjects)
		},
		[selectedProject, projects],
	)

	/**
	 * 更新项目的运行状态
	 * 注意：该方法仅用于更新指定项目的运行状态，不会调用onWorkspaceStateChange触发路由的更新。
	 */
	const updateProjectStatus = useMemoizedFn(async ({ projectId }: UpdateProjectStatusParams) => {
		if (!projectId) return
		try {
			const res = await SuperMagicApi.getProjectDetail({ id: projectId })
			if (selectedProject?.id === projectId) {
				setSelectedProject(res)
			}
			const updatedProjects = projects.map((project) => {
				if (project.id === projectId) {
					return res
				}
				return project
			})
			setProjects(updatedProjects)
		} catch (error) {
			console.log("更新项目状态失败，失败原因：", error)
			if (isCollaborationWorkspace(selectedWorkspace)) {
				handleNoPermissionCollaborationProject(error)
			}
		}
	})

	/** 修改项目的名称 */
	const handleRenameProject = useCallback(
		async ({ projectId, projectName, showMessage = true }: HandleRenameProjectParams) => {
			try {
				if (!selectedWorkspace || isCollaborationWorkspace(selectedWorkspace)) return
				await SuperMagicApi.editProject({
					id: projectId,
					workspace_id: selectedWorkspace.id,
					project_name: projectName,
					project_description: "",
				})
				await updateProjectName(projectId, projectName)
				if (showMessage) {
					magicToast.success(t("project.renameProjectSuccess"))
				}
			} catch (error) {
				console.log("重命名项目失败，失败原因：", error)
			}
		},
		[selectedWorkspace, t, updateProjectName],
	)

	/** 删除项目 */
	const handleDeleteProject = useCallback(
		async (id: string, isAutoSelect = true) => {
			if (!selectedWorkspace) return
			try {
				await SuperMagicApi.deleteProject({ id })
				await fetchProjects({ workspaceId: selectedWorkspace.id, isAutoSelect })
				magicToast.success(t("project.deleteProjectSuccess"))
			} catch (error) {
				console.log("删除项目失败，失败原因：", error)
			}
		},
		[selectedWorkspace, fetchProjects, t],
	)

	/** 携带二次确认框的删除项目操作 */
	const handleDeleteProjectWithConfirm = useCallback(
		(projectId: string, isAutoSelect = true) => {
			openModal(DeleteDangerModal, {
				content:
					projects.find((project) => project.id === projectId)?.project_name ||
					t("project.unnamedProject"),
				needConfirm: false,
				onSubmit: () => {
					handleDeleteProject(projectId, isAutoSelect)
				},
			})
		},
		[handleDeleteProject, projects, t],
	)

	/**
	 * 创建新项目
	 * @param projectMode 项目模式
	 * @param isAutoSelect 是否自动选中项目
	 * @param isEditProject 是否自动编辑项目
	 * @param workdir 工作目录
	 */
	const handleStartAddProject = useCallback(
		async ({
			projectMode,
			isAutoSelect = true,
			isEditProject = false,
			workdir,
		}: HandleCreateProjectParams): Promise<CreatedProject | null> => {
			// Note: isEditProject is kept for backward compatibility but editing state
			// is now managed within ProjectsMenu component via useProjectEditing hook
			void isEditProject
			if (!selectedWorkspace) return null
			try {
				const defaultProjectName = ""
				const res = await SuperMagicApi.createProject({
					workspace_id: selectedWorkspace.id,
					project_name: defaultProjectName,
					project_description: "",
					project_mode: projectMode,
					workdir,
				})
				if (res) {
					await updateProjects({ workspaceId: selectedWorkspace.id })

					if (isAutoSelect) {
						setSelectedProject(res.project)
						onWorkspaceStateChange({
							projectId: res.project.id,
						})
					}

					magicToast.success(t("project.createProjectSuccess"))
					return res
				}
			} catch (error) {
				console.log("创建项目失败，失败原因：", error)
			}
			return null
		},
		[selectedWorkspace, onWorkspaceStateChange, updateProjects, t],
	)

	useEffect(() => {
		pubsub.subscribe(
			PubSubEvents.Update_Project_Name,
			(projectId: string, projectName: string) => {
				updateProjectName(projectId, projectName)
			},
		)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Project_Name)
		}
	}, [updateProjectName])

	useDeepCompareEffect(() => {
		if (selectedWorkspace) {
			fetchProjects({
				workspaceId: selectedWorkspace.id,
				isAutoSelect: false,
				isSelectLast: false,
			})
		}
	}, [selectedWorkspace?.id])

	return {
		projects,
		allProjects,
		setProjects,
		allProjectsPage,
		isAllProjectsLoaded,
		selectedProject,
		setSelectedProject,
		handleStartAddProject,
		handleDeleteProject,
		handleDeleteProjectWithConfirm,
		handleRenameProject,
		fetchProjects,
		fetchAllProjects,
		updateProjects,
		updateProjectStatus,
	}
}
