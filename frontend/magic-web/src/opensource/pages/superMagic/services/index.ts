import WorkspaceService from "./workspaceService"
import ProjectService from "./projectService"
import TopicService from "./topicService"
import routeManageService from "./routeManageService"
import { workspaceStore, projectStore, topicStore } from "../stores/core"
import type { ProjectListItem, Topic, Workspace, CreatedProject } from "../pages/Workspace/types"
import { TopicMode } from "../pages/Workspace/types"
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
import { interfaceStore } from "@/opensource/stores/interface"
import { RequestConfig } from "@/opensource/apis/core/HttpClient"
import { isEqual } from "lodash-es"
import { UserWorkspaceMapCache } from "../utils/superMagicCache"
import { userStore } from "@/opensource/models/user"
import {
	superMagicTopicModelService,
	superMagicTopicModelCacheService,
	DEFAULT_TOPIC_ID,
} from "@/opensource/services/superMagic/topicModel"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import { SuperMagicApi } from "@/opensource/apis"

class SuperMagicService {
	workspace: WorkspaceService
	project: ProjectService
	topic: TopicService
	route: typeof routeManageService

	shouldShowErrorMessagePrompt = false

	constructor() {
		this.workspace = new WorkspaceService()
		this.project = new ProjectService()
		this.topic = new TopicService()
		this.route = routeManageService
	}

	/**
	 * 初始化工作区
	 * @param workspaceId 工作区ID
	 */
	async initializeWorkspace(
		workspaceId?: string,
		fallbackWorkspaceId?: string,
	): Promise<Workspace | null> {
		if (workspaceId === SHARE_WORKSPACE_ID) {
			const workspace = SHARE_WORKSPACE_DATA(t)
			workspaceStore.setSelectedWorkspace(workspace)

			requestIdleCallback(() => {
				this.workspace.fetchWorkspaces({
					isAutoSelect: false,
					page: 1,
				})
			})

			return workspace
		}

		const workspace = workspaceId
			? await this.workspace
					.getWorkspaceDetail(workspaceId, { enableErrorMessagePrompt: false })
					.catch(() => null)
			: null
		// 获取工作区详情成功
		if (workspace) {
			requestIdleCallback(() => {
				this.workspace.fetchWorkspaces({
					isAutoSelect: false,
					page: 1,
				})
			})

			workspaceStore.setSelectedWorkspace(workspace)
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
				)
				.catch(() => [])
			const fallbackWorkspace = fallbackWorkspaceId
				? workspaceStore.workspaces.find((ws) => ws.id === fallbackWorkspaceId) ||
					workspaceStore.firstWorkspace
				: workspaceStore.firstWorkspace
			workspaceStore.setSelectedWorkspace(fallbackWorkspace)
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
	 * Switch workspace - fetch projects and navigate to workspace
	 * @param workspaceId Workspace ID to switch to
	 */
	switchWorkspace(workspace: Workspace) {
		projectStore.setSelectedProject(null)
		topicStore.setSelectedTopic(null)
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
	async deleteProject(project: ProjectListItem): Promise<ProjectListItem | null> {
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
			topicStore.setSelectedTopic(null)
			topicStore.setTopics([])

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
	) {
		let project = projectStore.projects.find((p) => p.id === projectId) || null

		if (!project) {
			project = await this.project.getProjectDetail(projectId, options).catch(() => null)
		}

		if (!project) {
			throw new Error("Project not found")
		}

		if (interfaceStore.isMobile) {
			this.switchProjectInMobile(project, topic_id)
		} else {
			this.switchProjectInDesktop(project, topic_id)
		}
	}

	/**
	 * 切换项目 - 设置选中项目并获取话题列表（乐观路由策略）
	 * @param project Project to switch to
	 * @param topic_id Optional topic ID to navigate to
	 */
	async switchProjectInMobile(project: ProjectListItem, topic_id?: string) {
		// 1. 同步设置与检查
		const _isReadOnlyProject = isReadOnlyProject(project.user_role)

		let targetWorkspaceId: string | null = null
		if (isOtherCollaborationProject(project)) {
			targetWorkspaceId = SHARE_WORKSPACE_ID
		} else {
			targetWorkspaceId = project.workspace_id
		}

		// 2. 乐观状态更新
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
		// 路由检测在 routeManageService.getRouteName() 中自动处理
		// Check if there's a topic to navigate to
		const optimisticTopicId = topic_id || null
		let navigatedToTopic = false
		const navigationWorkspaceId = optimisticWorkspaceId || targetWorkspaceId

		if (optimisticTopicId && navigationWorkspaceId) {
			// Navigate to topic optimistically
			topicStore.setSelectedTopic(null) // Clear first, wait for background data
			this.route.navigateToTopic({
				workspaceId: navigationWorkspaceId,
				projectId: project.id,
				topicId: optimisticTopicId,
			})
			navigatedToTopic = true
		} else {
			// Navigate to project optimistically
			topicStore.setSelectedTopic(null)
			if (isOtherCollaborationProject(project)) {
				this.route.navigateToCollaborationProject(project)
			} else {
				this.route.navigateToProject(project)
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
					topicStore.setSelectedTopic(actualTopic)

					// Verify the topic belongs to the project
					if (actualTopic.project_id !== project.id) {
						// Topic doesn't belong to this project, navigate back to project
						topicStore.setSelectedTopic(null)
						if (isOtherCollaborationProject(project)) {
							this.route.navigateToCollaborationProject(project, true)
						} else {
							this.route.navigateToProject(project, true)
						}
					}

					// Load topic list in the background
					requestIdleCallback(() => {
						this.topic.fetchTopics({
							projectId: project.id,
							isAutoSelect: false,
							page: 1,
						})
					})
				} else {
					// Topic not found, navigate back to project
					topicStore.setSelectedTopic(null)
					if (isOtherCollaborationProject(project)) {
						this.route.navigateToCollaborationProject(project, true)
					} else {
						this.route.navigateToProject(project, true)
					}
				}
			} else {
				runInAction(() => {
					topicStore.setFetchList(true)
				})
				// Normal project switch without topic, fetch topic list
				this.topic
					.fetchTopics({ projectId: project.id, isAutoSelect: false, page: 1 })
					.finally(() => {
						runInAction(() => {
							topicStore.setFetchList(false)
						})
					})
			}
		}
	}

	/**
	 * 切换项目 - 设置选中项目并导航到项目（乐观路由策略）
	 * @param project Project to switch to
	 */
	async switchProjectInDesktop(project: ProjectListItem, topic_id?: string) {
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
			topicStore.setSelectedTopic(null) // 先清空，等待后台数据
			this.route.navigateToTopic({
				workspaceId: navigationWorkspaceId,
				projectId: project.id,
				topicId: optimisticTopicId,
			})
			navigatedToTopic = true
		} else {
			// 乐观导航到项目
			topicStore.setSelectedTopic(null)
			if (isOtherCollaborationProject(project)) {
				this.route.navigateToCollaborationProject(project)
			} else {
				this.route.navigateToProject(project)
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
				topicStore.setSelectedTopic(actualTopic)
				const finalWorkspaceId =
					workspaceStore.selectedWorkspace?.id || optimisticWorkspaceId || ""

				// 如果实际话题与乐观导航不同，进行修正
				if (navigatedToTopic && actualTopic.id !== optimisticTopicId) {
					// 话题ID不匹配，修正路由（使用 replace 替换乐观导航）
					this.route.navigateToTopic({
						workspaceId: finalWorkspaceId,
						projectId: project.id,
						topicId: actualTopic.id,
						replace: true,
					})
				} else if (!navigatedToTopic) {
					// 之前导航到项目，但实际有话题，修正到话题路由（使用 replace 替换乐观导航）
					this.route.navigateToTopic({
						workspaceId: finalWorkspaceId,
						projectId: project.id,
						topicId: actualTopic.id,
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
					topicStore.setSelectedTopic(null)
					if (isOtherCollaborationProject(project)) {
						this.route.navigateToCollaborationProject(project, true)
					} else {
						this.route.navigateToProject(project, true)
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
	async getTopicDataByProject(project: ProjectListItem, topicId?: string): Promise<Topic | null> {
		let _topicId = topicId
		let _selectedTopic: Topic | null = null

		if (!_topicId) {
			const topics = await this.topic
				.fetchTopics({
					projectId: project.id,
					isAutoSelect: true,
					isSelectLast: true,
					page: 1,
				})
				.catch(() => [])
			if (topics.length > 0) {
				_topicId = topics[0].id
				_selectedTopic = topics[0]
			} else {
				// 如果话题列表为空，则自动创建一个话题
				const newTopic = await this.topic
					.createTopic({
						projectId: project.id,
						topicName: "",
					})
					.catch(() => null)
				if (newTopic) {
					_topicId = newTopic.id
					_selectedTopic = newTopic
				}
			}
		} else {
			const topicDetail = await this.topic
				.getTopicDetail(_topicId, { enableErrorMessagePrompt: false })
				.catch(() => null)
			if (topicDetail) {
				_selectedTopic = topicDetail
			} else {
				// 话题无效, 重新获取
				return this.getTopicDataByProject(project)
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
	async navigateToHome(lastUsedWorkspaceId?: string | null) {
		projectStore.setSelectedProject(null)
		topicStore.setSelectedTopic(null)

		// 移动端返回首页使用 replace，避免 ProjectPage 残留在历史栈中导致左滑可回退
		const shouldReplace = interfaceStore.isMobile

		let workspaceId = workspaceStore.selectedWorkspace?.id
		if (!workspaceId || isCollaborationWorkspace(workspaceStore.selectedWorkspace)) {
			const workspaces =
				workspaceStore.workspaces.length > 0
					? workspaceStore.workspaces
					: await this.workspace.fetchWorkspaces({
							isAutoSelect: false,
							page: 1,
						})

			// 如果传入了最后一个使用的工作区ID，则使用最后一个使用的工作区ID
			const targetWorkspace =
				// 如果传入了最后一个使用的工作区ID，且不是共享工作区，则使用最后一个使用的工作区ID
				lastUsedWorkspaceId && lastUsedWorkspaceId !== SHARE_WORKSPACE_ID
					? workspaces.find((ws) => ws.id === lastUsedWorkspaceId)
					: workspaces?.[0]

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
			this.route.navigateToWorkspace(workspaceId, shouldReplace)

			this.project.fetchProjects({
				workspaceId: workspaceId,
				page: 1,
			})
		} else {
			workspaceStore.setSelectedWorkspace(null)
			this.route.navigateToHome(shouldReplace)
		}
	}

	resetState = (navigateToHome: boolean = true) => {
		projectStore.reset()
		topicStore.reset()
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
	async initializeState({
		workspaceId,
		projectId,
		topicId,
	}: {
		workspaceId?: string
		projectId?: string
		topicId?: string
	}) {
		this.resetState(false)

		/** 备用工作区ID，用于在初始化工作区失败时使用 */
		const fallbackWorkspaceId = UserWorkspaceMapCache.get(userStore.user.userInfo) || undefined

		// 先判断是不是有项目，并且有效
		const project = !projectId
			? null
			: await this.project
					.getProjectDetail(projectId, {
						enableErrorMessagePrompt: false,
					})
					.catch(() => null)

		const onlyCollWorkspaceId = workspaceId && workspaceId === SHARE_WORKSPACE_ID && !project

		// 新路由 path 不含 workspaceId，优先从 project 反查
		const resolvedWorkspaceId = workspaceId || project?.workspace_id

		const workspace = await this.initializeWorkspace(
			// 不能基于共享工作区ID初始化工作区
			onlyCollWorkspaceId ? undefined : resolvedWorkspaceId,
			fallbackWorkspaceId,
		)

		// 如果工作区存在，则获取项目列表
		if (workspace) {
			projectStore.setFetchingProjects(true)
			// 获取项目列表
			this.project
				.fetchProjects(
					{
						workspaceId: workspace.id,
						page: 1,
					},
					{ enableErrorMessagePrompt: false },
				)
				.finally(() => {
					projectStore.setFetchingProjects(false)
				})
		}

		// 如果项目不存在，则直接返回
		if (project) {
			projectStore.setSelectedProject(project)
			// 校验工作区
			const _isOwner = isOwner(project.user_role)
			if (!_isOwner) {
				workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
			}
			// 校验工作区是否匹配，如果不匹配，则更新工作区
			else if (workspaceStore.selectedWorkspace?.id !== project.workspace_id) {
				const workspaceDetail = await this.workspace
					.getWorkspaceDetail(project.workspace_id, { enableErrorMessagePrompt: false })
					.catch(() => null)
				if (workspaceDetail) {
					workspaceStore.setSelectedWorkspace(workspaceDetail)
				}
			}

			// 只有选中了某个项目，才需要加载这个项目下的话题
			if (!isReadOnlyProject(project.user_role)) {
				// PC端，如果没有传话题ID，也进行话题初始化
				const selectedTopic = await this.getTopicDataByProject(project, topicId)
				if (selectedTopic) {
					topicStore.setSelectedTopic(selectedTopic)
				}

				// 加载话题列表
				this.topic.fetchTopics({
					projectId: project.id,
					isAutoSelect: false,
					page: 1,
				})
			}
		}

		this.route.fixRouteParams()
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
	}: {
		workspaceId?: string
		projectId?: string
		topicId?: string
	}) {
		const fallbackWorkspaceId = UserWorkspaceMapCache.get(userStore.user.userInfo) || undefined

		// 0. 立即根据 projectId 参数更新 selectedProject，避免闪烁
		if (!projectId) {
			projectStore.setSelectedProject(null)
		}

		// 新路由 path 不含 workspaceId，通过 projectId 反查
		let resolvedWorkspaceId = workspaceId
		if (!resolvedWorkspaceId && projectId) {
			const project = await this.project
				.getProjectDetail(projectId, { enableErrorMessagePrompt: false })
				.catch(() => null)
			if (project) {
				resolvedWorkspaceId = project.workspace_id
				projectStore.setSelectedProject(project)
			}
		}

		// 1. 总是拉取 workspace 数据
		let workspace: Workspace | null = null
		if (resolvedWorkspaceId && resolvedWorkspaceId !== SHARE_WORKSPACE_ID) {
			workspace = await this.workspace
				.getWorkspaceDetail(resolvedWorkspaceId, { enableErrorMessagePrompt: false })
				.catch(() => null)

			// 如果获取失败，尝试使用 fallbackWorkspaceId
			if (!workspace && fallbackWorkspaceId) {
				workspace = await this.workspace
					.getWorkspaceDetail(fallbackWorkspaceId, { enableErrorMessagePrompt: false })
					.catch(() => null)
			}
		} else if (resolvedWorkspaceId === SHARE_WORKSPACE_ID) {
			workspace = SHARE_WORKSPACE_DATA(t)
		}

		if (workspace) {
			const current = workspaceStore.selectedWorkspace
			// 深度比较：只在数据真正变化时更新
			if (!isEqual(current, workspace)) {
				workspaceStore.setSelectedWorkspace(workspace)
			}

			// 静默刷新工作区列表
			requestIdleCallback(() => {
				this.workspace.fetchWorkspaces({
					isAutoSelect: false,
					page: 1,
				})
			})

			// 静默刷新项目列表
			this.project.fetchProjects(
				{
					workspaceId: workspace.id,
					page: 1,
				},
				{ enableErrorMessagePrompt: false },
			)
		}

		// 2. 总是拉取 project 数据
		let project: ProjectListItem | null = null
		if (projectId) {
			project = await this.project
				.getProjectDetail(projectId, { enableErrorMessagePrompt: false })
				.catch(() => null)
		}

		// 根据 projectId 参数决定是否设置项目
		// 如果没有 projectId，已经在函数开始时清空了 selectedProject
		// 如果有 projectId 且成功获取到项目数据，则设置项目
		// 检查 project.id === projectId 确保是当前请求的项目，避免旧的异步请求覆盖
		if (projectId && project && project.id === projectId) {
			const current = projectStore.selectedProject
			// 深度比较：只在数据真正变化时更新
			if (!isEqual(current, project)) {
				projectStore.setSelectedProject(project)
			}

			// 静默刷新话题列表
			if (!isReadOnlyProject(project.user_role)) {
				this.topic.fetchTopics({
					projectId: project.id,
					isAutoSelect: false,
					page: 1,
				})
			}
		} else if (!projectId) {
			// 确保当 projectId 不存在时，selectedProject 一定是 null
			// 防止旧的异步请求在设置 null 之后又设置了项目
			if (projectStore.selectedProject !== null) {
				projectStore.setSelectedProject(null)
			}
		}

		// 3. 总是拉取 topic 数据
		// 移动端：只有传了 topicId 才拉取
		// PC端：无 topicId 时也进行 topic 自动初始化（自动选择或创建）
		if (project && !isReadOnlyProject(project.user_role)) {
			if (topicId || !interfaceStore.isMobile) {
				const selectedTopic = await this.getTopicDataByProject(project, topicId)

				if (selectedTopic) {
					const current = topicStore.selectedTopic
					// 深度比较：只在数据真正变化时更新
					if (!isEqual(current, selectedTopic)) {
						topicStore.setSelectedTopic(selectedTopic)
					}
				}
			}
		}

		// PC端：修正路由，确保 URL 与最终数据状态一致
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
		const { projectMode, isAutoSelect = true, isEditProject, workdir } = params
		// Note: isEditProject is kept for backward compatibility but editing state
		// is now managed within ProjectsMenu component via useProjectEditing hook
		void isEditProject

		const selectedWorkspace = workspaceStore.selectedWorkspace
		if (!selectedWorkspace) return null

		try {
			const res = await this.project.createProject({
				workspaceId: selectedWorkspace.id,
				projectMode,
				workdir,
			})

			if (res) {
				// Copy global model configuration to the newly created topic
				const globalModelCache =
					await superMagicTopicModelCacheService.getTopicModel(DEFAULT_TOPIC_ID)

				if (globalModelCache?.languageModelId || globalModelCache?.imageModelId) {
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

					// Save to the new topic
					if (languageModel || imageModel) {
						await superMagicTopicModelService.saveModel(
							res.topic.id,
							res.project.id,
							languageModel,
							imageModel,
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
							workspaceId: selectedWorkspace.id,
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
	}: {
		selectedProject: ProjectListItem | null | undefined
		targetProject?: ProjectListItem
		onError?: (error: unknown) => void
		onSuccess?: (topic: Topic) => Promise<void> | void
	}): Promise<Topic | null> {
		const project = targetProject ?? selectedProject

		if (!project) {
			return null
		}

		try {
			const newTopic = await this.topic.createTopic({
				projectId: project.id,
				topicName: "",
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

				this.route.navigateToState({
					topicId: newTopic.id || null,
				})
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
		topicStore.setSelectedTopic(null)
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
					topicStore.setSelectedTopic(newTopicList[0])
				})
				this.route.navigateToState({
					topicId: newTopicList[0]?.id || null,
				})
			} else {
				// When workspace has no remaining topics, set selected topic to null
				runInAction(() => {
					topicStore.setSelectedTopic(null)
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
				topicStore.setSelectedTopic(null)

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
		topicStore.setSelectedTopic(topic)
		this.route.navigateToTopic({
			workspaceId: topic.workspace_id || "",
			projectId: topic.project_id,
			topicId: topic.id,
		})
	}
}

export default new SuperMagicService()
