import WorkspaceService from "./workspaceService"
import ProjectService from "./projectService"
import TopicService from "./topicService"
import routeManageService from "./routeManageService"
import { workspaceStore, projectStore, topicStore } from "../stores/core"
import type { ProjectListItem, Topic, Workspace, CreatedProject } from "../pages/Workspace/types"
import { TopicMode } from "../pages/Workspace/TopicMode"
import type { HandleCreateProjectParams } from "./projectService"
import {
	isOtherCollaborationProject,
	SHARE_WORKSPACE_ID,
	SHARE_WORKSPACE_DATA,
	isCollaborationWorkspace,
} from "../constants"
import { t } from "i18next"
import { isOwner, isReadOnlyProject } from "../utils/permission"
import { runInAction } from "mobx"
import { interfaceStore } from "@/stores/interface"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { isEqual } from "lodash-es"
import { UserWorkspaceMapCache } from "../utils/superMagicCache"
import { userStore } from "@/models/user"
import {
	superMagicTopicModelService,
	superMagicTopicModelCacheService,
	DEFAULT_TOPIC_ID,
} from "@/services/superMagic/topicModel"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { SuperMagicApi } from "@/apis"
import type { TopicStore } from "../stores/core/topic"
import topicReadProgressService from "./topicReadProgressService"
import { mergeProjectListItemWithStoreCache } from "@/pages/superMagicMobile/utils/mergeProjectListItemWithStoreCache"
import {
	ProjectStateInitialization,
	type ProjectInitializationParams,
	type ProjectInitializationScope,
} from "./projectStateInitialization"
export {
	syncChatConversationName,
	resolveChatTopicId,
	shouldSyncChatConversationName,
	renameTopicWithChatSync,
	syncChatProjectNameOnly,
} from "./chatConversationNameSync"
export type {
	SyncChatConversationNameParams,
	RenameTopicWithChatSyncParams,
	SyncChatProjectNameOnlyParams,
} from "./chatConversationNameSync"

class SuperMagicService {
	workspace: WorkspaceService
	project: ProjectService
	topic: TopicService
	topicStore: TopicStore
	route: typeof routeManageService

	shouldShowErrorMessagePrompt = false

	/** Monotonic token so stale desktop chat switch async work cannot overwrite newer navigation. */
	private desktopChatSwitchGeneration = 0

	private desktopChatSwitchInFlight = false
	private readonly stateInitialization: ProjectStateInitialization

	/** Exposed for ChatProjectPageDesktop to skip refreshState during optimistic chat switches. */
	isDesktopChatSwitchInProgress(): boolean {
		return this.desktopChatSwitchInFlight
	}

	private flushCurrentTopicReadProgress(
		reason: "switch-topic" | "switch-project" | "switch-workspace" | "route-leave",
	) {
		void topicReadProgressService.flushCurrentTopicReadProgress(reason)
	}

	constructor() {
		this.workspace = new WorkspaceService()
		this.project = new ProjectService()
		this.topic = new TopicService({
			store: topicStore,
		})
		this.topicStore = topicStore
		this.route = routeManageService
		this.stateInitialization = new ProjectStateInitialization(this)
	}

	/**
	 * 初始化工作区
	 * @param workspaceId 工作区ID
	 */
	async initializeWorkspace(
		workspaceId?: string,
		fallbackWorkspaceId?: string,
		scope?: ProjectInitializationScope,
		selectWorkspace = true,
	): Promise<Workspace | null> {
		if (scope && !scope.isCurrent()) return null
		if (workspaceId === SHARE_WORKSPACE_ID) {
			const workspace = SHARE_WORKSPACE_DATA(t)
			if (selectWorkspace) workspaceStore.setSelectedWorkspace(workspace)

			requestIdleCallback(() => {
				if (scope && !scope.isCurrent()) return
				this.workspace.fetchWorkspaces(
					{
						isAutoSelect: false,
						page: 1,
					},
					undefined,
					scope,
				)
			})

			return workspace
		}

		const workspace = workspaceId
			? await this.workspace
					.getWorkspaceDetail(workspaceId, {
						enableErrorMessagePrompt: false,
						signal: scope?.signal,
					})
					.catch(() => null)
			: null
		if (scope && !scope.isCurrent()) return null
		// 获取工作区详情成功
		if (workspace) {
			requestIdleCallback(() => {
				if (scope && !scope.isCurrent()) return
				this.workspace.fetchWorkspaces(
					{
						isAutoSelect: false,
						page: 1,
					},
					undefined,
					scope,
				)
			})

			if (selectWorkspace) workspaceStore.setSelectedWorkspace(workspace)
			return workspace
		} else {
			// 获取工作区详情失败，尝试获取第一个工作区
			await this.workspace
				.fetchWorkspaces(
					{
						isAutoSelect: false,
						page: 1,
					},
					{ enableErrorMessagePrompt: false },
					scope,
				)
				.catch(() => [])
			if (scope && !scope.isCurrent()) return null
			const fallbackWorkspace = fallbackWorkspaceId
				? workspaceStore.workspaces.find((ws) => ws.id === fallbackWorkspaceId) ||
					workspaceStore.firstWorkspace
				: workspaceStore.firstWorkspace
			if (selectWorkspace) workspaceStore.setSelectedWorkspace(fallbackWorkspace)
			return fallbackWorkspace
		}
	}

	// Delete workspace via workspace service
	createWorkspace = async (workspaceName: string) => {
		const newWorkspace = await this.workspace.createWorkspace(workspaceName)
		if (newWorkspace) {
			this.workspace.fetchWorkspaces({ isSelectLast: true, isAutoSelect: false, page: 1 })
			this.switchWorkspace(newWorkspace)
		}
	}

	/**
	 * 静默刷新侧栏已加载的工作区列表与各工作区项目缓存（含当前工作区扁平 projects），不改变选中项。
	 */
	silentRefreshSidebarLoadedCaches = async (): Promise<void> => {
		// Normalize the loaded workspace cache ids so manual refresh only touches
		// concrete personal workspaces and never duplicates requests for invalid entries.
		const loadedIds = Array.from(projectStore.loadedWorkspaces).filter(
			(id): id is string => Boolean(id) && id !== SHARE_WORKSPACE_ID,
		)
		const selectedId = workspaceStore.selectedWorkspace?.id
		const needsFlatSync = Boolean(selectedId && selectedId !== SHARE_WORKSPACE_ID)

		const tasks: Promise<unknown>[] = [
			this.workspace.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			}),
		]

		for (const wsId of loadedIds) {
			tasks.push(projectStore.loadProjectsForWorkspace(wsId, true, true))
		}

		if (needsFlatSync) {
			tasks.push(this.project.updateProjects({ workspaceId: selectedId as string }))
		}

		await Promise.allSettled(tasks)
	}

	/**
	 * Clear project/topic when showing workspace-only UI (no open project).
	 * Matches switchWorkspace entry; also used by ProjectCard "back to workspace".
	 */
	clearProjectAndTopicSelection() {
		projectStore.setSelectedProject(null)
		this.topicStore.setSelectedTopic(null)
		this.topicStore.setTopics([])
	}

	initializeMobileHomeState() {
		this.clearProjectAndTopicSelection()
		workspaceStore.setSelectedWorkspace(null)
	}

	/**
	 * Switch workspace - fetch projects and navigate to workspace
	 * @param workspaceId Workspace ID to switch to
	 */
	switchWorkspace(workspace: Workspace) {
		this.flushCurrentTopicReadProgress("switch-workspace")
		this.clearProjectAndTopicSelection()
		runInAction(() => {
			projectStore.setFetchingProjects(true)
		})
		// Fetch projects for the workspace
		this.project
			.fetchProjects({
				workspaceId: workspace.id,
				page: 1,
			})
			.finally(() => {
				runInAction(() => {
					projectStore.setFetchingProjects(false)
				})
			})
		workspaceStore.setSelectedWorkspace(workspace)
		// Navigate to workspace
		this.route.navigateToWorkspace(workspace.id)
	}

	/**
	 * Delete workspace and cleanup related project/topic state
	 * @param workspaceId Workspace ID to delete
	 * @returns Next workspace after deletion or null if no workspaces remain
	 */
	async deleteWorkspace(workspaceId: string): Promise<Workspace | null> {
		const isDeletingSelectedWorkspace = workspaceStore.selectedWorkspace?.id === workspaceId

		// Delete workspace via workspace service
		const nextWorkspace = await this.workspace.deleteWorkspace(workspaceId)

		// Only handle navigation and cleanup if deleting selected workspace
		if (isDeletingSelectedWorkspace) {
			// Navigate based on deletion result
			if (nextWorkspace) {
				// Switch to next workspace (will reset project/topic)
				this.switchWorkspace(nextWorkspace)
			} else {
				// No workspaces remain, navigate to home
				this.navigateToHome()
			}
		}
		// If deleting non-selected workspace, keep current workspace/project/topic state unchanged

		return nextWorkspace
	}

	/**
	 * Delete project and cleanup related topic state
	 * @param projectId Project ID to delete
	 * @param workspaceId Workspace ID that contains the project
	 * @returns Next project after deletion or null if no projects remain
	 */
	async deleteProject(
		project: ProjectListItem,
		options: {
			selectedProjectBehavior?: "switch-next" | "navigate-home"
			lastUsedWorkspaceId?: string | null
		} = {},
	): Promise<ProjectListItem | null> {
		const { selectedProjectBehavior = "switch-next", lastUsedWorkspaceId } = options
		const isDeletingSelectedProject = projectStore.selectedProject?.id === project.id

		// Get current projects list before deletion to calculate next project index
		const currentProjects = projectStore.projects
		const targetProjectIndex = currentProjects.findIndex((p) => p.id === project.id)
		const nextProjectIndex =
			targetProjectIndex === currentProjects.length - 1
				? targetProjectIndex - 1
				: targetProjectIndex

		const workspaceId = isOtherCollaborationProject(project)
			? SHARE_WORKSPACE_ID
			: project.workspace_id
		// Delete project via project service (this will update local state optimistically)
		await this.project.deleteProject(project.id, workspaceId)

		// Only handle navigation and cleanup if deleting selected project
		if (isDeletingSelectedProject) {
			// Reset topic state (clear selected topic and topics list)
			this.topicStore.setSelectedTopic(null)
			this.topicStore.setTopics([])

			if (selectedProjectBehavior === "navigate-home") {
				projectStore.setSelectedProject(null)
				await this.navigateToHome(lastUsedWorkspaceId || workspaceId)

				this.project.fetchProjects({
					workspaceId,
					page: 1,
				})

				return projectStore.selectedProject || null
			}

			// Use local state to select next project immediately (optimistic update)
			const remainingProjects = projectStore.projects
			if (remainingProjects.length > 0) {
				// Select next project based on calculated index from local state
				const nextProject =
					nextProjectIndex >= 0 && nextProjectIndex < remainingProjects.length
						? remainingProjects[nextProjectIndex]
						: remainingProjects[0]
				// Navigate to the next project immediately
				// PS: 移动端逻辑是否一致
				this.switchProjectInDesktop(nextProject)
			} else {
				// No projects remain, reset project state and navigate to workspace
				projectStore.setSelectedProject(null)
				this.route.navigateToWorkspace(workspaceId)
			}

			// Fetch latest projects list asynchronously to update state
			this.project.fetchProjects({
				workspaceId,
				page: 1,
			})
		}
		// If deleting non-selected project, keep current project/topic state unchanged

		return projectStore.selectedProject || null
	}

	/**
	 * 切换项目 - 设置选中项目并导航到项目
	 * @param project Project to switch to
	 */
	backProjectInMobile(project: ProjectListItem) {
		if (isOtherCollaborationProject(project)) {
			workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
			projectStore.setSelectedProject(project)
			this.route.navigateToCollaborationProject(project)
		} else {
			const workspace = workspaceStore.workspaces.find((ws) => ws.id === project.workspace_id)
			if (workspace) {
				workspaceStore.setSelectedWorkspace(workspace)
			}
			projectStore.setSelectedProject(project)
			this.route.backToProject(project)
		}

		this.topic.fetchTopics({
			projectId: project.id,
			isAutoSelect: false,
			page: 1,
		})
	}

	/**
	 * 根据项目ID切换项目
	 * @param projectId Project ID to switch to
	 */
	async switchProjectById(
		projectId: string,
		options?: Omit<RequestConfig, "url">,
		topic_id?: string,
		navigationState?: Record<string, unknown> | null,
	) {
		let project = projectStore.projects.find((p) => p.id === projectId) || null

		if (!project) {
			project = await this.project.getProjectDetail(projectId, options).catch(() => null)
		}

		if (!project) {
			throw new Error("Project not found")
		}

		if (interfaceStore.isMobile) {
			return this.switchProjectInMobile(project, topic_id, navigationState)
		} else {
			return this.switchProjectInDesktop(project, topic_id, navigationState)
		}
	}

	async switchChatProjectById(projectId: string, options?: Omit<RequestConfig, "url">) {
		let project = projectStore.projects.find((p) => p.id === projectId) || null

		if (!project) {
			project = await this.project.getProjectDetail(projectId, options).catch(() => null)
		}

		if (!project) throw new Error("Project not found")

		return this.switchChatProject(project)
	}

	async switchChatProject(
		project: ProjectListItem,
		initialTopic?: Topic | null,
		options?: {
			/** Caller-provided chat workspace keeps service layer independent from React hooks. */
			chatWorkspace?: Workspace | null
		},
	) {
		if (interfaceStore.isMobile) {
			return this.switchChatProjectInMobile(project, initialTopic)
		}

		return this.switchChatProjectInDesktop(project, {
			topicId: initialTopic?.id ?? project.current_topic_id ?? undefined,
			initialTopic,
			chatWorkspace: options?.chatWorkspace,
		})
	}

	/**
	 * Mobile chat project switch (blocking topic fetch before navigation).
	 */
	async switchChatProjectInMobile(project: ProjectListItem, initialTopic?: Topic | null) {
		projectStore.setSelectedProject(project)

		if (isOtherCollaborationProject(project)) {
			workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
		}

		if (isReadOnlyProject(project.user_role)) {
			this.topicStore.setSelectedTopic(null)
			this.route.navigateToChatProject(project)
			return
		}

		const selectedTopic =
			initialTopic ||
			(await this.getTopicDataByProject(project, project.current_topic_id || undefined))

		this.topicStore.setSelectedTopic(selectedTopic)
		this.route.navigateToChatProject(project, selectedTopic?.id)

		requestIdleCallback(() => {
			this.topic.fetchTopics({
				projectId: project.id,
				isAutoSelect: false,
				page: 1,
			})
		})
	}

	/**
	 * Desktop chat switch mirrors switchProjectInDesktop: optimistic store/route first, reconcile in background.
	 */
	async switchChatProjectInDesktop(
		project: ProjectListItem,
		options?: {
			topicId?: string
			initialTopic?: Topic | null
			/** Provided by UI callers that already resolved the dedicated chat workspace. */
			chatWorkspace?: Workspace | null
		},
	) {
		this.flushCurrentTopicReadProgress("switch-project")
		const switchToken = ++this.desktopChatSwitchGeneration
		this.desktopChatSwitchInFlight = true

		try {
			if (isReadOnlyProject(project.user_role)) {
				projectStore.setSelectedProject(project)
				if (isOtherCollaborationProject(project)) {
					workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
				}
				this.topicStore.setSelectedTopic(null)
				this.route.navigateToChatProject(project)
				return
			}

			let chatWorkspace: Workspace | null = options?.chatWorkspace ?? null
			if (isOtherCollaborationProject(project)) {
				chatWorkspace = SHARE_WORKSPACE_DATA(t)
			}

			if (switchToken !== this.desktopChatSwitchGeneration) return

			projectStore.setSelectedProject(project)
			if (chatWorkspace) {
				workspaceStore.setSelectedWorkspace(chatWorkspace)
			}

			// Cut the previous conversation context before navigation so detail UI cannot render stale messages.
			this.topicStore.setSelectedTopic(null)

			const optimisticTopicId = options?.topicId ?? project.current_topic_id ?? undefined
			this.route.navigateToChatProject(project, optimisticTopicId)

			let actualTopic: Topic | null = options?.initialTopic ?? null
			if (!actualTopic) {
				actualTopic = await this.getTopicDataByProject(project, optimisticTopicId)
			}

			if (switchToken !== this.desktopChatSwitchGeneration) return

			if (!actualTopic) {
				return
			}

			this.topicStore.setSelectedTopic(actualTopic)

			if (optimisticTopicId && actualTopic.id !== optimisticTopicId) {
				this.route.navigateToChatProject(project, actualTopic.id, true)
			}

			requestIdleCallback(() => {
				this.topic.fetchTopics({
					projectId: project.id,
					isAutoSelect: false,
					page: 1,
				})
			})
		} finally {
			if (switchToken === this.desktopChatSwitchGeneration) {
				this.desktopChatSwitchInFlight = false
			}
		}
	}

	/**
	 * 切换项目 - 设置选中项目并获取话题列表（乐观路由策略）
	 * @param project Project to switch to
	 * @param topic_id Optional topic ID to navigate to
	 */
	async switchProjectInMobile(
		project: ProjectListItem,
		topic_id?: string,
		navigationState?: Record<string, unknown> | null,
	) {
		this.flushCurrentTopicReadProgress("switch-project")
		let resolvedProject = mergeProjectListItemWithStoreCache(project) ?? project
		if (!resolvedProject.user_role) {
			const detail = await this.project
				.getProjectDetail(project.id, { enableErrorMessagePrompt: false })
				.catch(() => null)
			if (detail) {
				resolvedProject = mergeProjectListItemWithStoreCache(detail) ?? detail
			}
		}
		if (resolvedProject.project_mode === TopicMode.MagiClaw && resolvedProject.claw_code) {
			this.project.recordProjectVisit(resolvedProject)
			projectStore.setSelectedProject(resolvedProject)
			this.route.navigateToClawPlayground(resolvedProject.claw_code)
			return
		}
		if (resolvedProject.project_mode === TopicMode.MicroApp && resolvedProject.micro_app_id) {
			this.project.recordProjectVisit(resolvedProject)
			projectStore.setSelectedProject(resolvedProject)
			this.route.navigateToMicroApp(resolvedProject.micro_app_id)
			return
		}

		// 1. 同步设置与检查
		const _isReadOnlyProject = isReadOnlyProject(resolvedProject.user_role)

		let targetWorkspaceId: string | null = null
		if (isOtherCollaborationProject(resolvedProject)) {
			targetWorkspaceId = SHARE_WORKSPACE_ID
		} else {
			targetWorkspaceId = resolvedProject.workspace_id
		}

		// 2. 乐观状态更新
		projectStore.setSelectedProject(resolvedProject)
		// Clear the previous project's topic list before switching. Read-only
		// collaboration projects skip topic fetching below, so without this the
		// topic view would keep rendering the last visited project's topics.
		this.topicStore.setTopics([])

		// 如果工作区已在缓存中，立即更新
		let optimisticWorkspaceId: string | null = null
		if (workspaceStore.selectedWorkspace?.id !== targetWorkspaceId) {
			if (targetWorkspaceId === SHARE_WORKSPACE_ID) {
				workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
				optimisticWorkspaceId = SHARE_WORKSPACE_ID
			} else {
				const cachedWorkspace = workspaceStore.workspaces.find(
					(ws) => ws.id === targetWorkspaceId,
				)
				if (cachedWorkspace) {
					workspaceStore.setSelectedWorkspace(cachedWorkspace)
					optimisticWorkspaceId = targetWorkspaceId
				}
			}
		} else {
			optimisticWorkspaceId = workspaceStore.selectedWorkspace?.id || null
		}

		// 3. 立即导航（乐观导航）
		// 路由检测在 routeManageService.getRouteName() 中自动处理
		// Check if there's a topic to navigate to
		const optimisticTopicId = topic_id || null
		let navigatedToTopic = false
		const navigationWorkspaceId = optimisticWorkspaceId || targetWorkspaceId

		if (optimisticTopicId && navigationWorkspaceId) {
			// Navigate to topic optimistically
			this.topicStore.setSelectedTopic(null) // Clear first, wait for background data
			if (interfaceStore.isMobile) {
				// Mobile has a dedicated project-topic route. navigateToTopic intentionally
				// resolves to the project page there, so use the detail route directly.
				this.route.navigateToProjectTopicOnMobile({
					workspaceId: navigationWorkspaceId,
					projectId: resolvedProject.id,
					topicId: optimisticTopicId,
				})
			} else {
				this.route.navigateToTopic({
					workspaceId: navigationWorkspaceId,
					projectId: resolvedProject.id,
					topicId: optimisticTopicId,
					state: navigationState,
				})
			}
			navigatedToTopic = true
		} else {
			// Navigate to project optimistically
			this.topicStore.setSelectedTopic(null)
			if (isOtherCollaborationProject(resolvedProject)) {
				this.route.navigateToCollaborationProject(
					resolvedProject,
					undefined,
					navigationState,
				)
			} else {
				this.route.navigateToProject(resolvedProject, undefined, navigationState)
			}
		}

		// 4. 后台数据同步
		// 4.1 同步工作区（如果不在缓存中）
		if (!optimisticWorkspaceId && targetWorkspaceId) {
			const workspace = await this.workspace
				.getWorkspaceDetail(targetWorkspaceId)
				.catch(() => null)
			if (workspace) {
				workspaceStore.setSelectedWorkspace(workspace)
			}
		}

		if (!_isReadOnlyProject) {
			// Get actual topic data if navigated to topic or fetch topic list
			if (navigatedToTopic && optimisticTopicId) {
				// Fetch specific topic data
				const actualTopic = await this.topic
					.getTopicDetail(optimisticTopicId, { enableErrorMessagePrompt: false })
					.catch(() => null)

				if (actualTopic) {
					this.topicStore.setSelectedTopic(actualTopic)

					// Verify the topic belongs to the project
					if (actualTopic.project_id !== resolvedProject.id) {
						// Topic doesn't belong to this project, navigate back to project
						this.topicStore.setSelectedTopic(null)
						if (isOtherCollaborationProject(resolvedProject)) {
							this.route.navigateToCollaborationProject(
								resolvedProject,
								true,
								navigationState,
							)
						} else {
							this.route.navigateToProject(resolvedProject, true, navigationState)
						}
					}

					// Load topic list in the background
					requestIdleCallback(() => {
						this.topic.fetchTopics({
							projectId: resolvedProject.id,
							isAutoSelect: false,
							page: 1,
						})
					})
				} else {
					// Topic not found, navigate back to project
					this.topicStore.setSelectedTopic(null)
					if (isOtherCollaborationProject(resolvedProject)) {
						this.route.navigateToCollaborationProject(
							resolvedProject,
							true,
							navigationState,
						)
					} else {
						this.route.navigateToProject(resolvedProject, true, navigationState)
					}
				}
			} else {
				runInAction(() => {
					this.topicStore.setFetchList(true)
				})
				// Normal project switch without topic, fetch topic list
				this.topic
					.fetchTopics({ projectId: resolvedProject.id, isAutoSelect: false, page: 1 })
					.finally(() => {
						runInAction(() => {
							this.topicStore.setFetchList(false)
						})
					})
			}
		}
	}

	/**
	 * 切换项目 - 设置选中项目并导航到项目（乐观路由策略）
	 * @param project Project to switch to
	 */
	async switchProjectInDesktop(
		project: ProjectListItem,
		topic_id?: string,
		navigationState?: Record<string, unknown> | null,
	) {
		this.flushCurrentTopicReadProgress("switch-project")
		if (project.project_mode === TopicMode.MagiClaw && project.claw_code) {
			this.project.recordProjectVisit(project)
			projectStore.setSelectedProject(project)
			this.route.navigateToClawPlayground(project.claw_code)
			return
		}
		if (project.project_mode === TopicMode.MicroApp && project.micro_app_id) {
			this.project.recordProjectVisit(project)
			projectStore.setSelectedProject(project)
			this.route.navigateToMicroApp(project.micro_app_id)
			return
		}
		// 1. 同步设置与检查
		const _isReadOnlyProject = isReadOnlyProject(project.user_role)
		const _isOwner = isOwner(project.user_role)

		let targetWorkspaceId: string | null = null
		if (!_isOwner) {
			targetWorkspaceId = SHARE_WORKSPACE_ID
		} else {
			targetWorkspaceId = project.workspace_id
		}

		// 2. 乐观状态更新
		this.project.recordProjectVisit(project)
		projectStore.setSelectedProject(project)

		// 如果工作区已在缓存中，立即更新
		let optimisticWorkspaceId: string | null = null
		if (workspaceStore.selectedWorkspace?.id !== targetWorkspaceId) {
			if (targetWorkspaceId === SHARE_WORKSPACE_ID) {
				workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
				optimisticWorkspaceId = SHARE_WORKSPACE_ID
			} else {
				const cachedWorkspace = workspaceStore.workspaces.find(
					(ws) => ws.id === targetWorkspaceId,
				)
				if (cachedWorkspace) {
					workspaceStore.setSelectedWorkspace(cachedWorkspace)
					optimisticWorkspaceId = targetWorkspaceId
				}
			}
		} else {
			optimisticWorkspaceId = workspaceStore.selectedWorkspace?.id || null
		}

		// 3. 立即导航（乐观导航）
		// 条件 A: 如果存在 current_topic_id 且用户是所有者，导航到话题路由
		// 条件 B: 否则导航到项目路由
		const optimisticTopicId =
			topic_id || (!_isReadOnlyProject && _isOwner ? project.current_topic_id : undefined)
		let navigatedToTopic = false
		// 使用乐观工作区ID，如果不存在则使用目标工作区ID
		const navigationWorkspaceId = optimisticWorkspaceId || targetWorkspaceId

		if (optimisticTopicId && navigationWorkspaceId) {
			// 乐观导航到话题
			this.topicStore.setSelectedTopic(null) // 先清空，等待后台数据
			this.route.navigateToTopic({
				workspaceId: navigationWorkspaceId,
				projectId: project.id,
				topicId: optimisticTopicId,
				state: navigationState,
			})
			navigatedToTopic = true
		} else {
			// 乐观导航到项目
			this.topicStore.setSelectedTopic(null)
			if (isOtherCollaborationProject(project)) {
				this.route.navigateToCollaborationProject(project, undefined, navigationState)
			} else {
				this.route.navigateToProject(project, undefined, navigationState)
			}
		}

		// 4. 后台数据同步
		// 4.1 同步工作区（如果不在缓存中）
		if (!optimisticWorkspaceId && targetWorkspaceId) {
			const workspace = await this.workspace
				.getWorkspaceDetail(targetWorkspaceId)
				.catch(() => null)
			if (workspace) {
				workspaceStore.setSelectedWorkspace(workspace)
			}
		}

		// 4.2 同步话题数据（如果不是只读项目）
		if (!_isReadOnlyProject) {
			const actualTopic = await this.getTopicDataByProject(project, optimisticTopicId)

			// 5. 路由修正
			if (actualTopic) {
				this.topicStore.setSelectedTopic(actualTopic)
				const finalWorkspaceId =
					workspaceStore.selectedWorkspace?.id || optimisticWorkspaceId || ""

				// 如果实际话题与乐观导航不同，进行修正
				if (navigatedToTopic && actualTopic.id !== optimisticTopicId) {
					// 话题ID不匹配，修正路由（使用 replace 替换乐观导航）
					this.route.navigateToTopic({
						workspaceId: finalWorkspaceId,
						projectId: project.id,
						topicId: actualTopic.id,
						state: navigationState,
						replace: true,
					})
				} else if (!navigatedToTopic) {
					// 之前导航到项目，但实际有话题，修正到话题路由（使用 replace 替换乐观导航）
					this.route.navigateToTopic({
						workspaceId: finalWorkspaceId,
						projectId: project.id,
						topicId: actualTopic.id,
						state: navigationState,
						replace: true,
					})
				}

				// 空闲时加载话题列表
				requestIdleCallback(() => {
					this.topic.fetchTopics({
						projectId: project.id,
						isAutoSelect: false,
						page: 1,
					})
				})
			} else {
				// 没有有效话题，确保导航到项目路由
				if (navigatedToTopic) {
					// 之前导航到话题，但实际没有话题，修正到项目路由（使用 replace 替换乐观导航）
					this.topicStore.setSelectedTopic(null)
					if (isOtherCollaborationProject(project)) {
						this.route.navigateToCollaborationProject(project, true, navigationState)
					} else {
						this.route.navigateToProject(project, true, navigationState)
					}
				}
			}
		}
	}

	/**
	 * 初始化话题数据
	 * @param project Project to switch to
	 * @param topicId 话题ID
	 * @returns 话题详情
	 */
	async getTopicDataByProject(
		project: ProjectListItem,
		topicId?: string,
		scope?: ProjectInitializationScope,
	): Promise<Topic | null> {
		if (scope && !scope.isCurrent()) return null
		let _topicId = topicId
		let _selectedTopic: Topic | null = null

		if (!_topicId) {
			const topics = await this.topic
				.fetchTopics(
					{
						projectId: project.id,
						// 初始化由调用方一起提交项目与话题；普通项目切换仍立即选中。
						isAutoSelect: !scope,
						isSelectLast: true,
						page: 1,
					},
					scope,
				)
				.catch(() => [])
			if (scope && !scope.isCurrent()) return null
			if (topics.length > 0) {
				_topicId = topics[0].id
				_selectedTopic = topics[0]
			} else {
				// 如果话题列表为空，则自动创建一个话题
				const newTopic = await this.topic
					.createTopic(
						{
							projectId: project.id,
							topicName: "",
							workspaceId: project.workspace_id,
							mode: project.project_mode,
						},
						scope,
					)
					.catch(() => null)
				if (scope && !scope.isCurrent()) return null
				if (newTopic) {
					_topicId = newTopic.id
					_selectedTopic = newTopic
				}
			}
		} else {
			const topicDetail = await this.topic
				.getTopicDetail(_topicId, {
					enableErrorMessagePrompt: false,
					signal: scope?.signal,
				})
				.catch(() => null)
			if (scope && !scope.isCurrent()) return null
			if (topicDetail) {
				_selectedTopic = topicDetail
			} else {
				// 话题无效, 重新获取
				return this.getTopicDataByProject(project, undefined, scope)
			}
		}
		return _selectedTopic
	}

	/**
	 * 初始化第一个工作区
	 * @returns 是否成功
	 */
	async initFirstWorkspace() {
		const workspace = await this.workspace.createWorkspace()
		if (workspace) {
			runInAction(() => {
				workspaceStore.setSelectedWorkspace(workspace)
			})
			this.route.navigateToWorkspace(workspace.id)
			return workspace
		} else {
			console.error("创建第一个工作区失败")
			return null
		}
	}

	/**
	 * 跳转回首页
	 * @returns
	 */
	async navigateToHome(lastUsedWorkspaceId?: string | null, query?: Record<string, string>) {
		projectStore.setSelectedProject(null)
		this.topicStore.setSelectedTopic(null)

		// 移动端返回首页使用 replace，避免 ProjectPage 残留在历史栈中导致左滑可回退
		const shouldReplace = interfaceStore.isMobile
		if (interfaceStore.isMobile) {
			workspaceStore.setSelectedWorkspace(null)
			this.route.navigateToHome(shouldReplace, query)
			return
		}

		let workspaceId = workspaceStore.selectedWorkspace?.id
		const shouldResolveHomeWorkspace =
			!workspaceId ||
			isCollaborationWorkspace(workspaceStore.selectedWorkspace) ||
			workspaceStore.selectedWorkspace?.workspace_type === "chat"

		if (shouldResolveHomeWorkspace) {
			const workspaces =
				workspaceStore.workspaces.length > 0
					? workspaceStore.workspaces
					: await this.workspace.fetchWorkspaces({
							isAutoSelect: false,
							page: 1,
						})
			const homeWorkspaces = workspaces.filter(
				(workspace) =>
					workspace.id !== SHARE_WORKSPACE_ID && workspace.workspace_type !== "chat",
			)

			// Chat route writes the chat workspace id into the cache, so "last used"
			// may not belong to the normal home workspace list. In that case we must
			// fall back to the first normal workspace instead of creating a new one.
			const lastUsedHomeWorkspace =
				lastUsedWorkspaceId && lastUsedWorkspaceId !== SHARE_WORKSPACE_ID
					? homeWorkspaces.find((ws) => ws.id === lastUsedWorkspaceId)
					: null
			const targetWorkspace = lastUsedHomeWorkspace || homeWorkspaces?.[0]

			if (targetWorkspace) {
				workspaceId = targetWorkspace.id
				workspaceStore.setSelectedWorkspace(targetWorkspace)
			} else {
				const workspace = await this.initFirstWorkspace()
				if (workspace) {
					workspaceId = workspace.id
					workspaceStore.setSelectedWorkspace(workspace)
				} else {
					workspaceStore.setSelectedWorkspace(null)
				}
			}
		}

		if (workspaceId) {
			if (query && Object.keys(query).length > 0) {
				this.route.navigateToWorkspace(workspaceId, shouldReplace, query)
			} else {
				this.route.navigateToWorkspace(workspaceId, shouldReplace)
			}
		} else {
			workspaceStore.setSelectedWorkspace(null)
			this.route.navigateToHome(shouldReplace, query)
		}
	}

	resetState = (navigateToHome: boolean = true) => {
		this.project.resetVisit()
		projectStore.reset()
		this.topicStore.reset()
		workspaceStore.reset()
		if (routeManageService.isSuperRoute() && navigateToHome) {
			routeManageService.resetToSuper()
		}
	}

	/**
	 * 初始化状态
	 * @param workspaceId Workspace ID
	 * @param projectId Project ID
	 * @param topicId Topic ID
	 */
	initializeState(params: ProjectInitializationParams): Promise<void> {
		return this.stateInitialization.initialize(params)
	}

	/**
	 * 后退时刷新状态：总是拉取最新数据，通过比较决定是否更新
	 * @param workspaceId Workspace ID
	 * @param projectId Project ID
	 * @param topicId Topic ID
	 * @param isDesktop 是否桌面端
	 * @param fallbackWorkspaceId 备用工作区ID
	 */
	async refreshState({
		workspaceId,
		projectId,
		topicId,
		enableErrorMessagePrompt = false,
	}: {
		workspaceId?: string
		projectId?: string
		topicId?: string
		enableErrorMessagePrompt?: boolean
	}) {
		const initialRouteProjectId = this.route.getCurrentRouteParams().projectId
		const fallbackWorkspaceId = UserWorkspaceMapCache.get(userStore.user.userInfo) || undefined

		if (!projectId) {
			if (this.route.isStaleScopedRefresh(initialRouteProjectId, projectId)) {
				return
			}
			projectStore.setSelectedProject(null)
			this.topicStore.setSelectedTopic(null)
			if (!workspaceId) {
				return
			}
		}

		// Resolve workspace id and project payload without mutating store yet.
		let resolvedWorkspaceId = workspaceId
		let projectFromLookup: ProjectListItem | null = null
		if (!resolvedWorkspaceId && projectId) {
			projectFromLookup = await this.project
				.getProjectDetail(projectId, { enableErrorMessagePrompt })
				.catch(() => null)
			if (projectFromLookup) {
				resolvedWorkspaceId = projectFromLookup.workspace_id
			}
		}

		let workspace: Workspace | null = null
		if (resolvedWorkspaceId && resolvedWorkspaceId !== SHARE_WORKSPACE_ID) {
			workspace = await this.workspace
				.getWorkspaceDetail(resolvedWorkspaceId, { enableErrorMessagePrompt: false })
				.catch(() => null)

			if (!workspace && fallbackWorkspaceId) {
				workspace = await this.workspace
					.getWorkspaceDetail(fallbackWorkspaceId, { enableErrorMessagePrompt: false })
					.catch(() => null)
			}
		} else if (resolvedWorkspaceId === SHARE_WORKSPACE_ID) {
			workspace = SHARE_WORKSPACE_DATA(t)
		}

		let project: ProjectListItem | null = projectFromLookup
		// A failed project-only lookup is final; repeating it produces duplicate error prompts.
		if (projectId && !project && workspaceId) {
			project = await this.project
				.getProjectDetail(projectId, { enableErrorMessagePrompt })
				.catch(() => null)
		}

		let selectedTopic: Topic | null = null
		if (project && project.id === projectId && !isReadOnlyProject(project.user_role)) {
			const shouldEnsureTopic =
				Boolean(topicId) ||
				!interfaceStore.isMobile ||
				this.route.isCurrentChatProjectRoute()

			if (shouldEnsureTopic) {
				selectedTopic = await this.getTopicDataByProject(project, topicId)
			}
		}

		if (this.route.isStaleScopedRefresh(initialRouteProjectId, projectId)) {
			return
		}

		if (enableErrorMessagePrompt && projectId && !project) {
			// Do not leave the previous project's content under an unavailable notification URL.
			projectStore.setSelectedProject(null)
			this.topicStore.setSelectedTopic(null)
			this.route.fixRouteParams()
			return
		}

		if (workspace) {
			const current = workspaceStore.selectedWorkspace
			if (!isEqual(current, workspace)) {
				workspaceStore.setSelectedWorkspace(workspace)
			}

			requestIdleCallback(() => {
				this.workspace.fetchWorkspaces({
					isAutoSelect: false,
					page: 1,
				})
			})

			this.project.fetchProjects(
				{
					workspaceId: workspace.id,
					page: 1,
					// Route restoration owns the selected project; a failed or empty sidebar refresh must not clear it.
					clearWhenNoProjects: false,
				},
				{ enableErrorMessagePrompt: false },
			)
		}

		if (projectId && project && project.id === projectId) {
			this.project.recordProjectVisit(project)
			const current = projectStore.selectedProject
			if (!isEqual(current, project)) {
				projectStore.setSelectedProject(project)
			}

			if (!isReadOnlyProject(project.user_role)) {
				this.topic.fetchTopics({
					projectId: project.id,
					isAutoSelect: false,
					page: 1,
				})
			}
		}

		if (selectedTopic) {
			const current = topicStore.selectedTopic
			if (!isEqual(current, selectedTopic)) {
				topicStore.setSelectedTopic(selectedTopic)
			}
		} else if (!topicId && !this.route.isCurrentChatProjectRoute()) {
			// A project/workspace home route must not inherit the previous conversation.
			this.topicStore.setSelectedTopic(null)
		}

		if (!interfaceStore.isMobile) {
			this.route.fixRouteParams()
		}
	}

	/**
	 * Handle project creation with auto-select and workspace state update
	 * @param params Project creation parameters
	 * @returns Created project or null
	 */
	handleCreateProject = async (
		params: HandleCreateProjectParams,
	): Promise<CreatedProject | null> => {
		const {
			projectMode,
			isAutoSelect = true,
			isEditProject,
			workdir,
			projectName,
			workspaceId,
		} = params
		// Note: isEditProject is kept for backward compatibility but editing state
		// is now managed within ProjectsMenu component via useProjectEditing hook
		void isEditProject

		// Prefer an explicit workspaceId so route-scoped pages are not bound to store selection.
		const resolvedWorkspaceId = workspaceId || workspaceStore.selectedWorkspace?.id
		if (!resolvedWorkspaceId) return null

		try {
			const res = await this.project.createProject({
				workspaceId: resolvedWorkspaceId,
				projectMode,
				workdir,
				projectName,
			})

			if (res) {
				// Copy global model configuration to the newly created topic
				const globalModelCache =
					await superMagicTopicModelCacheService.getTopicModel(DEFAULT_TOPIC_ID)

				if (
					globalModelCache?.languageModelId ||
					globalModelCache?.imageModelId ||
					globalModelCache?.videoModelId
				) {
					// Find the full ModelItem objects
					const languageModel = globalModelCache.languageModelId
						? await superMagicModeService.resolveLanguageModelByMode(
								projectMode,
								globalModelCache.languageModelId,
							)
						: null

					const imageModel = globalModelCache.imageModelId
						? await superMagicModeService.resolveImageModelByMode(
								projectMode,
								globalModelCache.imageModelId,
							)
						: null
					const videoModel = globalModelCache.videoModelId
						? await superMagicModeService.resolveVideoModelByMode(
								projectMode,
								globalModelCache.videoModelId,
							)
						: null

					// Save to the new topic
					if (languageModel || imageModel || videoModel) {
						await superMagicTopicModelService.saveModel(
							res.topic.id,
							res.project.id,
							languageModel,
							imageModel,
							videoModel,
						)
					}
				}

				if (isAutoSelect) {
					projectStore.setSelectedProject(res.project)
					if (interfaceStore.isMobile) {
						this.topic.fetchTopics({
							projectId: res.project.id,
						})
						this.route.navigateToProject(res.project)
					} else {
						topicStore.setSelectedTopic(res.topic)
						this.route.navigateToTopic({
							workspaceId: resolvedWorkspaceId,
							projectId: res.project.id,
							topicId: res.topic.id,
						})
					}
				}
				return res
			}
		} catch (error) {
			console.log("创建项目失败，失败原因：", error)
		}
		return null
	}

	/**
	 * Handle topic creation with workspace selection, error handling, and navigation
	 * This method encapsulates the common logic for creating topics across the application
	 * @param params Topic creation parameters
	 * @param params.selectedProject Selected project (from store)
	 * @param params.targetProject Optional target project (if different from selectedProject)
	 * @param params.onError Optional error handler callback for collaboration project permission errors
	 * @param params.onSuccess Optional success callback to update local state (for components using local state instead of store)
	 * @returns Created topic or null
	 */
	async handleCreateTopic({
		selectedProject,
		targetProject,
		onError,
		onSuccess,
		onNavigated,
		sourceTopic,
		topicName,
	}: {
		selectedProject: ProjectListItem | null | undefined
		targetProject?: ProjectListItem
		onError?: (error: unknown) => void
		onSuccess?: (topic: Topic) => Promise<void> | void
		/** Called after navigateToState — safe moment to insert content into the new topic's editor */
		onNavigated?: (topic: Topic) => void
		/** 新话题后端空创建；该字段只用于前端选中态继承员工/mode */
		sourceTopic?: Pick<Topic, "project_id" | "topic_mode" | "agent_code"> | null
		topicName?: string
	}): Promise<Topic | null> {
		const project = targetProject ?? selectedProject

		if (!project) {
			return null
		}

		try {
			const newTopic = await this.topic.createTopic({
				projectId: project.id,
				topicName: topicName || "",
				workspaceId: project.workspace_id,
				mode: project.project_mode,
				sourceTopic,
			})

			if (newTopic) {
				// 预热话题沙箱
				SuperMagicApi.preWarmSandbox({
					topic_id: newTopic.id,
				})

				// Call success callback if provided (for local state management)
				if (onSuccess) {
					await onSuccess(newTopic)
				}

				// Mobile project topic pages must update URL; navigateToState skips mobile navigation.
				if (interfaceStore.isMobile && newTopic.id && project.id) {
					this.route.navigateToProjectTopicOnMobile({
						projectId: project.id,
						topicId: newTopic.id,
						workspaceId: project.workspace_id,
					})
				} else {
					this.route.navigateToState({
						topicId: newTopic.id || null,
					})
				}

				if (onNavigated) {
					setTimeout(() => {
						onNavigated(newTopic)
					}, 500)
				}
			}

			return newTopic
		} catch (error) {
			// Call custom error handler if provided
			if (onError) {
				onError(error)
			}
			console.error("创建话题失败:", error)
			return null
		}
	}

	/**
	 * Handle project creation and navigate to topic page (Desktop)
	 * Creates a new empty project, updates store, and navigates to the created topic
	 * @param workspaceId Workspace ID to create project in
	 * @param projectName Optional project name
	 * @returns Created project result or null
	 */
	async handleCreateProjectAndNavigate(
		workspaceId: string,
		projectName?: string,
	): Promise<CreatedProject | null> {
		try {
			const result = await this.project.createProject({
				workspaceId,
				projectMode: TopicMode.Empty,
				projectName,
			})

			if (result) {
				this.project.recordProjectVisit(result.project)
				projectStore.setSelectedProject(result.project)
				projectStore.loadProjectsForWorkspace(workspaceId, true)
				topicStore.setSelectedTopic(result.topic)
				routeManageService.navigateToTopic({
					workspaceId,
					projectId: result.project.id,
					topicId: result.topic.id,
				})
			}

			return result
		} catch (error) {
			console.error("创建项目失败:", error)
			return null
		}
	}
	/**
	 * 返回项目页面 - 移动端
	 */
	backToProjectPageInMobile() {
		this.topicStore.setSelectedTopic(null)
		if (!projectStore.selectedProject) return
		this.backProjectInMobile(projectStore.selectedProject)
	}

	/**
	 * Delete topic and handle related navigation and state updates
	 * @param topicId Topic ID to delete
	 * @param workspaceId Workspace ID that contains the topic
	 * @returns Promise that resolves when deletion is complete
	 */
	async deleteTopic(topicId: string): Promise<void> {
		const selectedTopic = topicStore.selectedTopic

		// Delete topic via topic service (handles API call, cache clearing, and store update)
		const newTopicList = await this.topic.deleteTopic(topicId)

		// Only handle navigation and topic selection if we're deleting the currently selected topic
		if (topicId === selectedTopic?.id) {
			if (newTopicList && newTopicList.length > 0) {
				runInAction(() => {
					this.topicStore.setSelectedTopic(newTopicList[0])
				})
				this.route.navigateToState({
					topicId: newTopicList[0]?.id || null,
				})
			} else {
				// When workspace has no remaining topics, set selected topic to null
				runInAction(() => {
					this.topicStore.setSelectedTopic(null)
				})
				this.route.navigateToState({
					topicId: null,
				})
			}
		}
	}

	/**
	 * Create project and activate it with full initialization (Mobile)
	 * Creates project → Selects → Fetches topics → Navigates
	 * @param workspaceId Workspace ID to create project in
	 * @returns Created project result or null
	 */
	async createProjectAndActivateInMobile(workspaceId: string): Promise<CreatedProject | null> {
		try {
			const result = await this.project.createProject({
				workspaceId,
				projectMode: TopicMode.Empty,
			})

			if (result) {
				// Update store state
				projectStore.setSelectedProject(result.project)
				this.topicStore.setSelectedTopic(null)

				// Refresh global project list asynchronously
				this.project.fetchProjects({
					workspaceId,
				})

				// Fetch topics for the new project
				await this.topic.fetchTopics({
					projectId: result.project.id,
					isAutoSelect: false,
					page: 1,
				})

				// Navigate to project
				routeManageService.navigateToState({
					workspaceId,
					projectId: result.project.id,
					topicId: null,
				})

				return result
			}

			return null
		} catch (error) {
			console.error("创建并激活项目失败:", error)
			return null
		}
	}

	/**
	 * 切换话题(适合在同项目下切换话题)
	 * @param topic Topic to switch to
	 */
	switchTopic(topic: Topic) {
		this.flushCurrentTopicReadProgress("switch-topic")
		this.topicStore.setSelectedTopic(topic)
		this.route.navigateToTopic({
			workspaceId: topic.workspace_id || "",
			projectId: topic.project_id,
			topicId: topic.id,
		})
	}
}

export { loadProjectAttachments } from "./projectAttachmentsLoader"

export default new SuperMagicService()
