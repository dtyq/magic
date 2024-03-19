import { SuperMagicApi } from "@/opensource/apis"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { runInAction } from "mobx"
import projectStore from "../stores/core/project"
import type { ProjectListItem, CreatedProject, TopicMode } from "../pages/Workspace/types"
import { CollaborationProjectType } from "../pages/Workspace/types"
import { SHARE_WORKSPACE_ID, isOtherCollaborationProject } from "../constants"
import { generateCollaborationProjectUrl } from "../utils/project"
import { RequestConfig } from "@/opensource/apis/core/HttpClient"

export interface FetchProjectsParams {
	workspaceId: string
	page?: number
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
	collaborationTabKey?: CollaborationProjectType
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

// Request deduplication key generator
type RequestKey = string

class ProjectService {
	// Request deduplication: track ongoing requests
	private pendingRequests = new Map<RequestKey, Promise<unknown>>()

	// Optimistic update: store snapshots for rollback
	private optimisticSnapshots = new Map<string, ProjectListItem[]>()

	/**
	 * Generate request key for deduplication
	 */
	private getRequestKey(operation: string, params: Record<string, unknown>): RequestKey {
		const sortedParams = Object.keys(params)
			.sort()
			.map((key) => `${key}:${params[key]}`)
			.join("|")
		return `${operation}:${sortedParams}`
	}

	/**
	 * Get or create pending request
	 */
	private getOrCreateRequest<T>(key: RequestKey, requestFn: () => Promise<T>): Promise<T> {
		if (this.pendingRequests.has(key)) {
			return this.pendingRequests.get(key) as Promise<T>
		}

		const promise = requestFn().finally(() => {
			this.pendingRequests.delete(key)
		})

		this.pendingRequests.set(key, promise)
		return promise
	}

	/**
	 * Save snapshot for optimistic update rollback
	 */
	private saveSnapshot(operationId: string): void {
		runInAction(() => {
			this.optimisticSnapshots.set(operationId, [...projectStore.projects])
		})
	}

	/**
	 * Rollback optimistic update
	 */
	private rollbackSnapshot(operationId: string): void {
		const snapshot = this.optimisticSnapshots.get(operationId)
		if (snapshot) {
			runInAction(() => {
				projectStore.setProjects(snapshot)
			})
			this.optimisticSnapshots.delete(operationId)
		}
	}

	/**
	 * Clear snapshot after successful operation
	 */
	private clearSnapshot(operationId: string): void {
		this.optimisticSnapshots.delete(operationId)
	}
	updateProjects = async (
		{
			workspaceId,
			page = 1,
			collaborationTabKey = CollaborationProjectType.Received,
		}: UpdateProjectsParams,
		options?: Omit<RequestConfig, "url">,
	): Promise<ProjectListItem[]> => {
		const requestKey = this.getRequestKey("updateProjects", {
			workspaceId,
			page,
			collaborationTabKey,
		})

		return this.getOrCreateRequest(requestKey, async () => {
			try {
				const res =
					workspaceId === SHARE_WORKSPACE_ID
						? await SuperMagicApi.getCollaborationProjects(
								{
									page,
									page_size: 99,
									type: collaborationTabKey,
								},
								options,
							)
						: await SuperMagicApi.getProjectsWithCollaboration(
								{
									workspace_id: workspaceId,
									page,
									page_size: 99,
								},
								options,
							)
				const updatedProjects = res.list
				runInAction(() => {
					projectStore.setProjects(updatedProjects)
					// Sync to projectsByWorkspace so sidebar list updates (used by getProjectsByWorkspace)
					if (workspaceId !== SHARE_WORKSPACE_ID) {
						projectStore.setProjectsForWorkspace(workspaceId, updatedProjects)
					}
				})
				return updatedProjects
			} catch (error) {
				console.log("更新项目列表失败，失败原因：", error)
				return []
			}
		})
	}

	fetchProjects = async (
		{
			workspaceId,
			page = 1,
			collaborationTabKey,
			clearWhenNoProjects = true,
		}: FetchProjectsParams,
		options?: Omit<RequestConfig, "url">,
	): Promise<ProjectListItem[]> => {
		try {
			const updatedProjects = await this.updateProjects(
				{
					workspaceId,
					page,
					collaborationTabKey,
				},
				options,
			)

			if (updatedProjects.length === 0) {
				if (clearWhenNoProjects) {
					runInAction(() => {
						projectStore.setSelectedProject(null)
					})
				}
				return []
			}

			return updatedProjects
		} catch (error) {
			console.log("加载项目失败，失败原因：", error)
			return []
		}
	}

	/**
	 * 获取项目详情
	 * @param projectId 项目ID
	 * @returns 项目详情
	 */
	getProjectDetail = (projectId: string, options?: Omit<RequestConfig, "url">) => {
		return SuperMagicApi.getProjectDetail({ id: projectId }, options)
	}

	createProject = async ({
		workspaceId,
		projectMode,
		workdir,
		projectName,
	}: {
		workspaceId: string
		projectMode: TopicMode
		workdir?: string
		projectName?: string
	}): Promise<CreatedProject | null> => {
		const requestKey = this.getRequestKey("createProject", {
			workspaceId,
			projectMode,
			workdir,
			projectName,
		})

		return this.getOrCreateRequest(requestKey, async () => {
			try {
				const res = await SuperMagicApi.createProject({
					workspace_id: workspaceId,
					project_name: projectName || "",
					project_description: "",
					project_mode: projectMode,
					workdir,
				})

				if (res) {
					// Update project list with the new project
					runInAction(() => {
						projectStore.setProjects([res.project, ...projectStore.projects])
					})

					// Refresh list asynchronously (non-blocking)
					this.updateProjects({ workspaceId }).catch((error) => {
						console.error("后台刷新项目列表失败，失败原因：", error)
					})
					return res
				}

				return null
			} catch (error) {
				console.log("创建项目失败，失败原因：", error)
				return null
			}
		})
	}

	renameProject = async (id: string, name: string, workspaceId: string): Promise<void> => {
		const operationId = `rename_${id}_${Date.now()}`
		const requestKey = this.getRequestKey("renameProject", { id, name, workspaceId })

		// Optimistic update: update project name immediately
		this.saveSnapshot(operationId)
		const originalProject = projectStore.projects.find((p) => p.id === id)
		if (originalProject) {
			runInAction(() => {
				projectStore.updateProject({
					...originalProject,
					project_name: name,
				})
			})
		}

		// Call API asynchronously (non-blocking)
		this.getOrCreateRequest(requestKey, async () => {
			try {
				await SuperMagicApi.editProject({
					id,
					workspace_id: workspaceId,
					project_name: name,
					project_description: "",
				})
				// Refresh list asynchronously (non-blocking)
				this.updateProjects({ workspaceId }).catch((error) => {
					console.error("后台刷新项目列表失败，失败原因：", error)
				})
				this.clearSnapshot(operationId)
			} catch (error) {
				console.log("重命名项目失败，失败原因：", error)
				// Rollback optimistic update
				this.rollbackSnapshot(operationId)
				throw error
			}
		}).catch(() => {
			// Error already handled in the request function
		})
	}

	deleteProject = async (id: string, workspaceId: string): Promise<void> => {
		const operationId = `delete_${id}_${Date.now()}`
		const requestKey = this.getRequestKey("deleteProject", { id, workspaceId })

		// Optimistic update: remove project from list immediately
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProject(id)
		})

		// Call API asynchronously (non-blocking)
		this.getOrCreateRequest(requestKey, async () => {
			try {
				await SuperMagicApi.deleteProject({ id })
				this.clearSnapshot(operationId)
			} catch (error) {
				console.log("删除项目失败，失败原因：", error)
				// Rollback optimistic update
				this.rollbackSnapshot(operationId)
				throw error
			}
		}).catch(() => {
			// Error already handled in the request function
		})
	}

	updateProjectStatus = async (projectId: string): Promise<void> => {
		if (!projectId) return

		const requestKey = this.getRequestKey("updateProjectStatus", { projectId })

		return this.getOrCreateRequest(requestKey, async () => {
			try {
				const res = await SuperMagicApi.getProjectDetail({ id: projectId })
				runInAction(() => {
					projectStore.updateProject(res)
				})
			} catch (error) {
				console.log("更新项目状态失败，失败原因：", error)
				throw error
			}
		})
	}

	/**
	 * Move project to new workspace
	 * @param projectId Project ID to move
	 * @param targetWorkspaceId Target workspace ID
	 * @param sourceWorkspaceId Source workspace ID (for refreshing project list)
	 * @returns Success status
	 */
	moveProject = async (
		projectId: string,
		targetWorkspaceId: string,
		sourceWorkspaceId: string,
	): Promise<boolean> => {
		const operationId = `move_${projectId}_${Date.now()}`
		const requestKey = this.getRequestKey("moveProject", {
			projectId,
			targetWorkspaceId,
		})

		// Optimistic update: remove project from list immediately
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProject(projectId)
		})

		// Call API asynchronously (non-blocking)
		this.getOrCreateRequest(requestKey, async () => {
			try {
				const res = await SuperMagicApi.moveProjectToNewWorkspace({
					source_project_id: projectId,
					target_workspace_id: targetWorkspaceId,
				})

				if (res) {
					// Refresh project list for source workspace asynchronously (non-blocking)
					this.updateProjects({ workspaceId: sourceWorkspaceId }).catch((error) => {
						console.error("后台刷新项目列表失败，失败原因：", error)
					})
					this.clearSnapshot(operationId)
					return true
				}

				// Rollback on failure
				this.rollbackSnapshot(operationId)
				return false
			} catch (error) {
				console.error("移动项目失败，失败原因：", error)
				// Rollback optimistic update
				this.rollbackSnapshot(operationId)
				throw error
			}
		}).catch(() => {
			// Error already handled in the request function
		})

		// Return immediately after optimistic update
		return true
	}

	/**
	 * Move project to new workspace and refresh project list
	 * @param projectId Project ID to move
	 * @param targetWorkspaceId Target workspace ID
	 * @param sourceWorkspaceId Source workspace ID (for refreshing project list)
	 * @returns Promise that resolves when operation completes
	 */
	moveProjectAndRefresh = async (
		projectId: string,
		targetWorkspaceId: string,
		sourceWorkspaceId: string,
	): Promise<void> => {
		await this.moveProject(projectId, targetWorkspaceId, sourceWorkspaceId)

		// Refresh project list with specific options
		this.fetchProjects({
			workspaceId: sourceWorkspaceId,
			clearWhenNoProjects: false,
		}).catch((error) => {
			console.error("后台刷新项目列表失败，失败原因：", error)
		})

		// Refresh project list for target workspace asynchronously (non-blocking)
		this.fetchProjects({
			workspaceId: targetWorkspaceId,
			clearWhenNoProjects: false,
		}).catch((error) => {
			console.error("后台刷新项目列表失败，失败原因：", error)
		})
	}

	/**
	 * Cancel workspace shortcut for collaboration project
	 * @param projectId Project ID
	 * @param workspaceId Workspace ID
	 */
	cancelWorkspaceShortcut = async (projectId: string, workspaceId: string): Promise<void> => {
		const operationId = `cancel_shortcut_${projectId}_${Date.now()}`
		const requestKey = this.getRequestKey("cancelWorkspaceShortcut", {
			projectId,
			workspaceId,
		})

		// Optimistic update: remove project from list immediately
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProject(projectId)
		})

		// Call API asynchronously (non-blocking)
		this.getOrCreateRequest(requestKey, async () => {
			try {
				await SuperMagicApi.updateCollaborationProjectShortcutStatus(projectId, {
					workspace_id: workspaceId,
					is_bind_workspace: 0,
				})

				// Refresh project list asynchronously (non-blocking)
				this.fetchProjects({
					workspaceId,
					clearWhenNoProjects: false,
				}).catch((error) => {
					console.error("后台刷新项目列表失败，失败原因：", error)
				})
				this.clearSnapshot(operationId)
			} catch (error) {
				console.error("取消工作区快捷方式失败，失败原因：", error)
				// Rollback optimistic update
				this.rollbackSnapshot(operationId)
				throw error
			}
		}).catch(() => {
			// Error already handled in the request function
		})
	}

	/**
	 * Pin or unpin project (supports both regular and collaboration projects)
	 * @param project Project item
	 * @param isPin Whether to pin the project
	 * @param workspaceId Workspace ID (for refreshing project list)
	 */
	pinProject = async (project: ProjectListItem, isPin: boolean): Promise<void> => {
		const requestKey = this.getRequestKey("pinProject", { projectId: project.id, isPin })

		// Call API and refresh list (no optimistic update to preserve sorting)
		return this.getOrCreateRequest(requestKey, async () => {
			try {
				// Use appropriate API based on project type
				if (isOtherCollaborationProject(project)) {
					await SuperMagicApi.updateCollaborationProjectPinStatus(project.id, {
						is_pin: isPin,
					})
				} else {
					await SuperMagicApi.updateProjectPinStatus(project.id, {
						is_pin: isPin,
					})
				}

				if (projectStore.selectedProject?.id === project.id) {
					runInAction(() => {
						projectStore.updateProject({
							...project,
							is_pinned: isPin,
						})
					})
				}
			} catch (error) {
				console.error("固定项目失败，失败原因：", error)
				throw error
			}
		})
	}

	/**
	 * Generate collaboration project URL
	 * @param project Project item
	 * @returns Collaboration project URL
	 */
	getCollaborationProjectUrl = (project: ProjectListItem): string => {
		return generateCollaborationProjectUrl(project)
	}

	/**
	 * Copy collaboration project link to clipboard
	 * @param project Project item
	 * @returns Promise that resolves to true if successful, false otherwise
	 */
	copyCollaborationLink = async (project: ProjectListItem): Promise<boolean> => {
		try {
			const url = this.getCollaborationProjectUrl(project)
			await clipboard.writeText(url)
			return true
		} catch (error) {
			console.error("复制协作链接失败，失败原因：", error)
			return false
		}
	}

	/**
	 * Toggle project pin status and refresh project list
	 * @param project Project item
	 * @param isPin Whether to pin the project
	 * @param workspaceId Workspace ID for refreshing (local list)
	 * @param selectedWorkspaceId Current selected workspace ID (for global store refresh)
	 */
	pinProjectAndRefresh = async (
		project: ProjectListItem,
		isPin: boolean,
		workspaceId: string,
		selectedWorkspaceId?: string,
	): Promise<void> => {
		await this.pinProject(project, isPin)

		// Refresh local project list
		await this.fetchProjects({
			workspaceId,
			clearWhenNoProjects: false,
		})

		// Refresh global project list if workspace matches
		if (selectedWorkspaceId && selectedWorkspaceId === workspaceId) {
			await this.fetchProjects({
				workspaceId: selectedWorkspaceId,
				clearWhenNoProjects: false,
			})
		}
	}

	/**
	 * Cancel workspace shortcut and refresh project list
	 * @param projectId Project ID
	 * @param workspaceId Workspace ID for refreshing
	 * @param selectedWorkspaceId Current selected workspace ID (for global store refresh)
	 */
	cancelWorkspaceShortcutAndRefresh = async (
		projectId: string,
		workspaceId: string,
		selectedWorkspaceId?: string,
	): Promise<void> => {
		await this.cancelWorkspaceShortcut(projectId, workspaceId)

		// Refresh local project list
		await this.fetchProjects({
			workspaceId,
			clearWhenNoProjects: false,
		})

		// Refresh global project list if workspace matches
		if (selectedWorkspaceId && selectedWorkspaceId === workspaceId) {
			await this.fetchProjects({
				workspaceId: selectedWorkspaceId,
				clearWhenNoProjects: false,
			})
		}
	}
}

export default ProjectService
