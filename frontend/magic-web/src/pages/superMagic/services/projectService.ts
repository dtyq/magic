import { assertProjectDeletionAllowed } from "@/services/recordSummary/projectDeletionRecordingGuard"
import { userStore } from "@/models/user"
import recentProjectsStore from "../stores/core/recentProjects"
import { SuperMagicApi } from "@/apis"
import { clipboard } from "@/utils/clipboard-helpers"
import { runInAction } from "mobx"
import projectStore from "../stores/core/project"
import type { ProjectListItem, CreatedProject } from "../pages/Workspace/types"
import type { TopicMode } from "../pages/Workspace/TopicMode"
import { CollaborationProjectType } from "../pages/Workspace/types"
import { SHARE_WORKSPACE_ID, isOtherCollaborationProject } from "../constants"
import { generateCollaborationProjectUrl } from "../utils/project"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import {
	shouldSyncChatConversationName,
	syncChatConversationName,
} from "./chatConversationNameSync"
import {
	ensureChatWorkspaceId,
	getCachedChatWorkspaceId,
} from "@/pages/superMagic/hooks/useChatWorkspace"
import { topicStore, workspaceStore } from "../stores/core"
import { getInsertIndexByAnchors, isSameOrder } from "./orderUtils"
import { createOrderRequestOptions, reportOrderApiError } from "./orderErrorReporter"
import { invalidateWorkspaceSearchResults } from "./workspaceListSearchInvalidation"
import { analyticsService } from "@/services/analytics"
import {
	readProjectInitializationIdentity,
	type ProjectInitializationScope,
} from "./projectStateInitialization"

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
	projectName?: string
	/** Explicit workspace override so list pages are not bound to a stale selectedWorkspace. */
	workspaceId?: string
}

/** Parameters for moving a project to another workspace (maps to projects/move API). */
export interface MoveProjectParams {
	projectId: string
	targetWorkspaceId: string
	sourceWorkspaceId: string
	preProjectId?: string | null
	nextProjectId?: string | null
	/** Optional; resolved from workspace list when omitted. */
	targetWorkspaceName?: string
	/** Optional; used by save-as-project flow as API `target_project_name`. */
	targetProjectName?: string
}

// Request deduplication key generator
type RequestKey = string

class ProjectService {
	private visitKey: string | null = null
	private visitScope: object | undefined
	private visitGeneration = 0

	resetVisit() {
		this.visitKey = null
		this.visitScope = undefined
		this.visitGeneration++
	}

	/** 每次进入只记录一次；话题切换、后台详情刷新及预取不会制造新访问。 */
	recordProjectVisit(project: ProjectListItem, visitScope?: object) {
		const userId = userStore.user.userInfo?.user_id
		const organizationCode = userStore.user.organizationCode
		if (!userId || !organizationCode) return
		const key = JSON.stringify([userId, organizationCode, project.id])
		// 专用页面有独立 store，以页面进入范围去重，不依赖普通项目的选中态。
		if (this.visitKey === key && this.visitScope === visitScope) return
		this.visitKey = key
		this.visitScope = visitScope
		const generation = this.visitGeneration
		void SuperMagicApi.recordProjectVisit(project.id)
			.then((result) => {
				if (
					generation !== this.visitGeneration ||
					userId !== userStore.user.userInfo?.user_id ||
					organizationCode !== userStore.user.organizationCode
				)
					return
				recentProjectsStore.recordVisit(project, result.last_active_at)
			})
			.catch(() => {
				// 导航可正常完成；失败不提升最近顺序，同次进入也不反复上报。
			})
	}

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
	 * Resolves project metadata for rename: chat detail often only hydrates selectedProject, not flat projects[].
	 */
	private resolveProjectForRename(projectId: string): ProjectListItem | null {
		const fromList = projectStore.projects.find((project) => project.id === projectId)
		if (fromList) return fromList

		if (projectStore.selectedProject?.id === projectId) {
			return projectStore.selectedProject
		}

		return recentProjectsStore.items.find((project) => project.id === projectId) ?? null
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
		scope?: ProjectInitializationScope,
	): Promise<ProjectListItem[]> => {
		if (scope && !scope.isCurrent()) return []
		const requestKey = this.getRequestKey("updateProjects", {
			workspaceId,
			page,
			collaborationTabKey,
			sessionEpoch: readProjectInitializationIdentity().sessionEpoch,
		})

		const updatedProjects = await this.getOrCreateRequest(requestKey, async () => {
			try {
				const res =
					workspaceId === SHARE_WORKSPACE_ID
						? await SuperMagicApi.getCollaborationProjects(
								{
									page,
									page_size: 100,
									type: collaborationTabKey,
								},
								options,
							)
						: await SuperMagicApi.getProjectsWithCollaboration(
								{
									workspace_id: workspaceId,
									page,
									page_size: 100,
								},
								options,
							)
				const updatedProjects = res.list
				return updatedProjects
			} catch (error) {
				console.log("更新项目列表失败，失败原因：", error)
				return null
			}
		})
		if (!updatedProjects) return []
		// 共享服务器读取，每个调用方分别决定是否提交；旧初始化不能取消或覆盖新调用方。
		if (scope && !scope.isCurrent()) return updatedProjects
		runInAction(() => {
			projectStore.setProjects(updatedProjects)
			// Sync to projectsByWorkspace so sidebar list updates (used by getProjectsByWorkspace)
			if (workspaceId !== SHARE_WORKSPACE_ID) {
				projectStore.setProjectsForWorkspace(workspaceId, updatedProjects)
			}
		})
		return updatedProjects
	}

	fetchProjects = async (
		{
			workspaceId,
			page = 1,
			collaborationTabKey,
			clearWhenNoProjects = true,
		}: FetchProjectsParams,
		options?: Omit<RequestConfig, "url">,
		scope?: ProjectInitializationScope,
	): Promise<ProjectListItem[]> => {
		try {
			const updatedProjects = await this.updateProjects(
				{
					workspaceId,
					page,
					collaborationTabKey,
				},
				options,
				scope,
			)
			if (scope && !scope.isCurrent()) return updatedProjects

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

	moveProjectInWorkspace = async (
		workspaceId: string,
		projectId: string,
		preProjectId: string | null,
		nextProjectId: string | null,
		isPinned?: boolean,
	): Promise<void> => {
		const projects = projectStore.getProjectsByWorkspace(workspaceId)
		const previousIds = projects.map((project) => project.id)
		const previousProject = projects.find((project) => project.id === projectId)
		const sourceIndex = previousIds.indexOf(projectId)
		if (sourceIndex === -1) return
		const nextIds = previousIds.filter((id) => id !== projectId)
		const insertIndex = getInsertIndexByAnchors(nextIds, preProjectId, nextProjectId)
		if (insertIndex === null) return
		nextIds.splice(Math.max(0, insertIndex), 0, projectId)
		const optimisticProjectIds = [...nextIds]
		runInAction(() => projectStore.reorderProjectsInWorkspace(workspaceId, nextIds))
		if (isPinned !== undefined) {
			const movedProject = projectStore
				.getProjectsByWorkspace(workspaceId)
				.find((project) => project.id === projectId)
			if (movedProject) {
				projectStore.updateProject({ ...movedProject, is_pinned: isPinned })
			}
		}

		const { requestId, options } = createOrderRequestOptions()
		let orderingRequestCompleted = false
		const usesPinEndpoint = isPinned !== undefined && previousProject != null
		try {
			if (usesPinEndpoint) {
				// Pin-boundary moves use the pin endpoint because it owns both pin state and ordering.
				await this.pinProject(
					previousProject,
					isPinned,
					workspaceId,
					preProjectId,
					nextProjectId,
				)
			} else {
				await SuperMagicApi.moveProject(
					{
						source_project_id: projectId,
						target_workspace_id: workspaceId,
						pre_project_id: preProjectId,
						next_project_id: nextProjectId,
					},
					options,
				)
			}
			orderingRequestCompleted = true
			await projectStore.loadProjectsForWorkspace(workspaceId, true, true)
			this.syncSelectedProjectAfterMove(
				projectId,
				workspaceId,
				projectStore.getProjectsByWorkspace(workspaceId),
			)
		} catch (error) {
			if (!orderingRequestCompleted && !usesPinEndpoint)
				reportOrderApiError({
					endpoint: "/api/v1/super-agent/projects/move",
					params: {
						source_project_id: projectId,
						target_workspace_id: workspaceId,
						pre_project_id: preProjectId,
						next_project_id: nextProjectId,
						...(isPinned === undefined ? {} : { is_pin: isPinned }),
					},
					requestId,
					error,
				})
			const currentProjectIds = projectStore
				.getProjectsByWorkspace(workspaceId)
				.map((project) => project.id)
			if (isSameOrder(currentProjectIds, optimisticProjectIds)) {
				runInAction(() => projectStore.reorderProjectsInWorkspace(workspaceId, previousIds))
			}
			if (previousProject && isPinned !== undefined) {
				projectStore.updateProject(previousProject)
			}
			throw error
		} finally {
			recentProjectsStore.invalidate()
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
		creationScene,
	}: {
		workspaceId: string
		projectMode: TopicMode
		workdir?: string
		projectName?: string
		/** The product entry that initiated creation; independent from the selected agent mode. */
		creationScene?: string
	}): Promise<CreatedProject | null> => {
		const requestKey = this.getRequestKey("createProject", {
			workspaceId,
			projectMode,
			workdir,
			projectName,
			creationScene,
		})

		return this.getOrCreateRequest(requestKey, async () => {
			try {
				// Report after local de-duplication accepts the action but before the request,
				// so failed requests still count as creation attempts.
				analyticsService.report("project_create_attempted", {
					workspaceId,
					sceneOverride: creationScene,
					mode: projectMode,
				})
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
			} finally {
				recentProjectsStore.invalidate()
			}
		})
	}

	renameProject = async (
		id: string,
		name: string,
		workspaceId: string,
		options?: { topicId?: string },
	): Promise<void> => {
		const operationId = `rename_${id}_${Date.now()}`
		const requestKey = this.getRequestKey("renameProject", { id, name, workspaceId })

		// Optimistic update: update project name immediately
		this.saveSnapshot(operationId)
		const originalProject = this.resolveProjectForRename(id)
		if (originalProject) {
			runInAction(() => {
				projectStore.updateProject({
					...originalProject,
					project_name: name,
				})
			})

			// Only chat-workspace projects represent the same display name as their
			// topic. Ordinary project renames must not mutate the topic optimistically;
			// their API path only updates the project name.
			if (shouldSyncChatConversationName(originalProject, getCachedChatWorkspaceId())) {
				const topicIdForOptimistic =
					options?.topicId ??
					(topicStore.selectedTopic?.project_id === id
						? topicStore.selectedTopic.id
						: undefined)
				if (topicIdForOptimistic) {
					topicStore.updateTopicName(topicIdForOptimistic, name)
				}
			}
		}

		// Await rename API so callers (e.g. chat list reload) do not race ahead of server state
		return this.getOrCreateRequest(requestKey, async () => {
			try {
				let chatWorkspaceId = getCachedChatWorkspaceId()
				if (!chatWorkspaceId) {
					chatWorkspaceId = await ensureChatWorkspaceId()
				}
				if (shouldSyncChatConversationName(originalProject, chatWorkspaceId)) {
					const topicId =
						options?.topicId ??
						(topicStore.selectedTopic?.project_id === id
							? topicStore.selectedTopic.id
							: undefined)
					await syncChatConversationName({
						projectId: id,
						topicId,
						name,
						workspaceId,
					})
				} else {
					await SuperMagicApi.editProject({
						id,
						project_name: name,
						project_description: "",
					})
				}
				this.updateProjects({ workspaceId }).catch((error) => {
					console.error("后台刷新项目列表失败，失败原因：", error)
				})
				this.clearSnapshot(operationId)
				invalidateWorkspaceSearchResults()
			} catch (error) {
				console.log("重命名项目失败，失败原因：", error)
				this.rollbackSnapshot(operationId)
				throw error
			} finally {
				recentProjectsStore.invalidate()
			}
		})
	}

	deleteProject = async (id: string, workspaceId: string): Promise<void> => {
		assertProjectDeletionAllowed([id])
		const operationId = `delete_${id}_${Date.now()}`
		const requestKey = this.getRequestKey("deleteProject", { id, workspaceId })

		// Optimistic update: remove project from list immediately
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProject(id)
		})

		// Await delete API so callers (e.g. list reload) do not race ahead of server state
		return this.getOrCreateRequest(requestKey, async () => {
			try {
				await SuperMagicApi.deleteProject({ id })
				this.clearSnapshot(operationId)
				invalidateWorkspaceSearchResults()
			} catch (error) {
				console.log("删除项目失败，失败原因：", error)
				// Rollback optimistic update
				this.rollbackSnapshot(operationId)
				throw error
			} finally {
				recentProjectsStore.invalidate()
			}
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
	 * Move a project to another workspace. This does not change selectedWorkspace —
	 * callers that leave the current view (detail exit, desktop switch) update it themselves.
	 */
	moveProject = async ({
		projectId,
		targetWorkspaceId,
		sourceWorkspaceId,
		targetWorkspaceName,
		targetProjectName,
		preProjectId,
		nextProjectId,
	}: MoveProjectParams): Promise<boolean> => {
		const operationId = `move_${projectId}_${Date.now()}`
		const resolvedTargetWorkspaceName =
			targetWorkspaceName?.trim() ||
			workspaceStore.workspaces
				.find((workspace) => workspace.id === targetWorkspaceId)
				?.name?.trim() ||
			undefined
		const requestKey = this.getRequestKey("moveProject", {
			projectId,
			targetWorkspaceId,
			resolvedTargetWorkspaceName,
			targetProjectName,
			preProjectId,
			nextProjectId,
		})

		const activeProject =
			projectStore.selectedProject?.id === projectId ? projectStore.selectedProject : null
		const targetWorkspace = workspaceStore.workspaces.find(
			(workspace) => workspace.id === targetWorkspaceId,
		)
		const movedActiveProject = activeProject
			? {
					...activeProject,
					project_name: targetProjectName?.trim() || activeProject.project_name,
					workspace_id: targetWorkspaceId,
					workspace_name:
						targetWorkspaceName?.trim() ||
						targetWorkspace?.name ||
						activeProject.workspace_name ||
						"",
				}
			: null

		// Optimistic update: drop list entries only. Keep selectedWorkspace on the
		// viewing workspace so a list-page move does not send later create/refresh to B.
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProjectFromCollections(projectId)
			if (movedActiveProject) projectStore.setSelectedProject(movedActiveProject)
		})

		// Await move API so callers (e.g. save-as-project + list reload) do not race ahead of server state
		return this.getOrCreateRequest(requestKey, async () => {
			try {
				const res = await SuperMagicApi.moveProjectToNewWorkspace({
					source_project_id: projectId,
					target_workspace_id: targetWorkspaceId,
					target_workspace_name: resolvedTargetWorkspaceName,
					target_project_name: targetProjectName?.trim() || undefined,
					pre_project_id: preProjectId,
					next_project_id: nextProjectId,
				})

				if (res) {
					this.updateProjects({ workspaceId: sourceWorkspaceId }).catch((error) => {
						console.error("后台刷新项目列表失败，失败原因：", error)
					})
					this.clearSnapshot(operationId)
					invalidateWorkspaceSearchResults()
					return true
				}

				this.rollbackSnapshot(operationId)
				throw new Error("Move project failed")
			} catch (error) {
				console.error("移动项目失败，失败原因：", error)
				if (activeProject) {
					runInAction(() => {
						projectStore.setSelectedProject(activeProject)
					})
				}
				this.rollbackSnapshot(operationId)
				throw error
			} finally {
				recentProjectsStore.invalidate()
			}
		})
	}

	/**
	 * Move project to new workspace and refresh source/target workspace project lists.
	 */
	moveProjectAndRefresh = async (params: MoveProjectParams): Promise<void> => {
		const { sourceWorkspaceId, targetWorkspaceId } = params
		await this.moveProject(params)

		const [, targetProjects] = await Promise.all([
			this.fetchProjects({
				workspaceId: sourceWorkspaceId,
				clearWhenNoProjects: false,
			}),
			this.fetchProjects({
				workspaceId: targetWorkspaceId,
				clearWhenNoProjects: false,
			}),
		])

		this.syncSelectedProjectAfterMove(params.projectId, targetWorkspaceId, targetProjects)
	}

	/** Synchronizes the active project with the freshly loaded target workspace entry. */
	private syncSelectedProjectAfterMove(
		projectId: string,
		targetWorkspaceId: string,
		refreshedProjects: ProjectListItem[],
	) {
		if (projectStore.selectedProject?.id !== projectId) return
		const refreshedProject = refreshedProjects.find((project) => project.id === projectId)
		if (refreshedProject) {
			projectStore.setSelectedProject({
				...projectStore.selectedProject,
				...refreshedProject,
			})
		}
		const targetWorkspace = workspaceStore.workspaces.find(
			(workspace) => workspace.id === targetWorkspaceId,
		)
		if (targetWorkspace) workspaceStore.setSelectedWorkspace(targetWorkspace)
	}

	/**
	 * Sidebar move: update both workspace caches optimistically, then persist and
	 * refresh the two affected lazy-loaded lists.
	 */
	moveProjectFromSidebar = async ({
		project,
		targetWorkspaceId,
		targetWorkspaceName,
		preProjectId,
		nextProjectId,
		isPinned,
		usePinApi = false,
	}: {
		project: ProjectListItem
		targetWorkspaceId: string
		targetWorkspaceName?: string
		preProjectId?: string | null
		nextProjectId?: string | null
		isPinned?: boolean
		usePinApi?: boolean
	}): Promise<void> => {
		const sourceWorkspaceId = project.workspace_id
		if (!sourceWorkspaceId || sourceWorkspaceId === targetWorkspaceId) return
		const targetProjects = projectStore.getProjectsByWorkspace(targetWorkspaceId)
		const targetIndex =
			preProjectId !== undefined || nextProjectId !== undefined
				? getInsertIndexByAnchors(
						targetProjects.map((item) => item.id),
						preProjectId,
						nextProjectId,
					)
				: undefined
		if (targetIndex === null) return

		runInAction(() => {
			projectStore.moveProjectBetweenWorkspaces(
				project,
				sourceWorkspaceId,
				targetWorkspaceId,
				targetWorkspaceName,
				targetIndex,
				isPinned,
			)
		})

		const moveRequest = createOrderRequestOptions()
		let orderingRequestCompleted = false
		try {
			if (usePinApi) {
				await this.pinProject(project, true, targetWorkspaceId, preProjectId, nextProjectId)
			} else {
				await SuperMagicApi.moveProjectToNewWorkspace(
					{
						source_project_id: project.id,
						target_workspace_id: targetWorkspaceId,
						target_workspace_name: targetWorkspaceName,
						pre_project_id: preProjectId,
						next_project_id: nextProjectId,
					},
					moveRequest.options,
				)
				if (isPinned !== undefined) {
					await this.pinProject(
						project,
						isPinned,
						targetWorkspaceId,
						preProjectId,
						nextProjectId,
					)
				}
			}
			orderingRequestCompleted = true
			await Promise.all([
				projectStore.loadProjectsForWorkspace(sourceWorkspaceId, true, true),
				projectStore.loadProjectsForWorkspace(targetWorkspaceId, true, true),
			])
			this.syncSelectedProjectAfterMove(
				project.id,
				targetWorkspaceId,
				projectStore.getProjectsByWorkspace(targetWorkspaceId),
			)
			invalidateWorkspaceSearchResults()
		} catch (error) {
			if (!orderingRequestCompleted && !usePinApi)
				reportOrderApiError({
					endpoint: "/api/v1/super-agent/projects/move",
					params: {
						source_project_id: project.id,
						target_workspace_id: targetWorkspaceId,
						pre_project_id: preProjectId,
						next_project_id: nextProjectId,
					},
					requestId: moveRequest.requestId,
					error,
				})
			// A forced refresh is the safest rollback because either side may have
			// been changed by another tab while the move was in flight.
			await Promise.all([
				projectStore.loadProjectsForWorkspace(sourceWorkspaceId, true, true),
				projectStore.loadProjectsForWorkspace(targetWorkspaceId, true, true),
			])
			throw error
		} finally {
			recentProjectsStore.invalidate()
		}
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

		// Optimistic update: remove the shortcut project from the list cache without
		// clearing the active selection — the project itself is not deleted.
		this.saveSnapshot(operationId)
		runInAction(() => {
			projectStore.removeProjectFromCollections(projectId)
		})

		// Await API so callers refreshing the list do not race ahead of server state
		return this.getOrCreateRequest(requestKey, async () => {
			try {
				await SuperMagicApi.updateCollaborationProjectShortcutStatus(projectId, {
					workspace_id: workspaceId,
					is_bind_workspace: 0,
				})

				// Sync the active project's binding flags so the "取消关联" menu item
				// hides immediately instead of waiting for a full list refresh.
				runInAction(() => {
					if (projectStore.selectedProject?.id === projectId) {
						projectStore.selectedProject = {
							...projectStore.selectedProject,
							is_bind_workspace: false,
							bind_workspace_id: "",
						}
					}
				})

				this.fetchProjects({
					workspaceId,
					clearWhenNoProjects: false,
				}).catch((error) => {
					console.error("后台刷新项目列表失败，失败原因：", error)
				})
				this.clearSnapshot(operationId)
			} catch (error) {
				console.error("取消工作区快捷方式失败，失败原因：", error)
				this.rollbackSnapshot(operationId)
				throw error
			} finally {
				recentProjectsStore.invalidate()
			}
		})
	}

	/**
	 * Pin or unpin project (supports both regular and collaboration projects)
	 * @param project Project item
	 * @param isPin Whether to pin the project
	 * @param workspaceId Workspace ID (for refreshing project list)
	 */
	pinProject = async (
		project: ProjectListItem,
		isPin: boolean,
		targetWorkspaceId?: string,
		preProjectId?: string | null,
		nextProjectId?: string | null,
	): Promise<void> => {
		const requestKey = this.getRequestKey("pinProject", {
			projectId: project.id,
			isPin,
			targetWorkspaceId,
			preProjectId,
			nextProjectId,
		})

		return this.getOrCreateRequest(requestKey, async () => {
			const { requestId, options } = createOrderRequestOptions()
			const workspaceId = targetWorkspaceId || project.workspace_id
			const hasOrdering = preProjectId !== undefined || nextProjectId !== undefined
			const previousProjects = workspaceId
				? projectStore.getProjectsByWorkspace(workspaceId)
				: []
			// The pin endpoint only orders within the pinned section.
			const shouldIncludePinNextProject =
				preProjectId !== null &&
				nextProjectId != null &&
				previousProjects.some((item) => item.id === nextProjectId && item.is_pinned)
			const pinNextProjectId = shouldIncludePinNextProject ? nextProjectId : undefined
			let optimisticProjectIds: string[] | null = null

			if (workspaceId && hasOrdering) {
				const nextProjects = previousProjects.filter((item) => item.id !== project.id)
				const insertIndex =
					preProjectId === null
						? 0
						: getInsertIndexByAnchors(
								nextProjects.map((item) => item.id),
								preProjectId,
								nextProjectId,
							)
				if (insertIndex === null) return
				nextProjects.splice(Math.min(insertIndex, nextProjects.length), 0, {
					...project,
					workspace_id: workspaceId,
					is_pinned: isPin,
				})
				optimisticProjectIds = nextProjects.map((item) => item.id)
				runInAction(() => {
					projectStore.reorderProjectsInWorkspace(
						workspaceId,
						nextProjects.map((item) => item.id),
					)
					projectStore.updateProject({
						...project,
						workspace_id: workspaceId,
						is_pinned: isPin,
					})
				})
			}

			try {
				// Use appropriate API based on project type
				if (isOtherCollaborationProject(project)) {
					await SuperMagicApi.updateCollaborationProjectPinStatus(
						project.id,
						{
							is_pin: isPin,
							target_workspace_id: targetWorkspaceId,
							pre_project_id: preProjectId,
							next_project_id: pinNextProjectId,
						},
						options,
					)
				} else {
					await SuperMagicApi.updateProjectPinStatus(
						project.id,
						{
							is_pin: isPin,
							target_workspace_id: targetWorkspaceId,
							pre_project_id: preProjectId,
							next_project_id: pinNextProjectId,
						},
						options,
					)
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
				reportOrderApiError({
					endpoint: isOtherCollaborationProject(project)
						? `/api/v1/super-agent/collaboration-projects/${project.id}/pin`
						: `/api/v1/super-agent/projects/${project.id}/pin`,
					params: {
						is_pin: isPin,
						target_workspace_id: targetWorkspaceId,
						pre_project_id: preProjectId,
						next_project_id: pinNextProjectId,
					},
					requestId,
					error,
				})
				if (
					workspaceId &&
					hasOrdering &&
					optimisticProjectIds &&
					projectStore
						.getProjectsByWorkspace(workspaceId)
						.every((item, index) => item.id === optimisticProjectIds?.[index]) &&
					projectStore.getProjectsByWorkspace(workspaceId).length ===
						optimisticProjectIds.length
				) {
					runInAction(() => {
						projectStore.setProjectsForWorkspace(workspaceId, previousProjects)
					})
				}
				console.error("固定项目失败，失败原因：", error)
				throw error
			} finally {
				recentProjectsStore.invalidate()
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
