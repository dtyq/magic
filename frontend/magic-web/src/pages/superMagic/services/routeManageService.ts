import { isUndefined } from "lodash-es"
import { RouteName } from "@/routes/constants"
import type { ViewTransitionConfig } from "@/types/viewTransition"
import { getWorkspaceStateSessionStorageKey } from "../utils/sessionStorage"
import { ProjectListItem } from "../pages/Workspace/types"
import { isOtherCollaborationProject, SHARE_WORKSPACE_ID } from "../constants"
import { isAiCanvasProject } from "../utils/isAiCanvasProject"
import { userStore } from "@/models/user"
import { routesMatch, routesPathMatch } from "@/routes/history/helpers"
import { baseHistory, history } from "@/routes/history"
import { projectStore, workspaceStore, topicStore } from "../stores/core"
import { interfaceStore } from "@/stores/interface"
import {
	WorkspaceStateCache,
	UserWorkspaceMapCache,
	ProjectTopicMapCache,
	ChatWorkspaceIdCache,
} from "../utils/superMagicCache"
import { RoutePathMobile } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import useNavigate, { type MagicNavigateParams } from "@/routes/hooks/useNavigate"
import { mobileTabStore } from "@/stores/mobileTab"
import { ROUTE_NAME_TO_TAB_PARAM, MobileTabParam } from "@/pages/mobileTabs/constants"

export interface NavigateToStateParams {
	workspaceId?: string | null
	projectId?: string | null
	topicId?: string | null
	state?: Record<string, unknown> | null
	viewTransition?: boolean | ViewTransitionConfig
}

class RouteManageService {
	private navigate: ReturnType<typeof useNavigate> | null = null

	private getCurrentMatchedRouteName(): RouteName | undefined {
		return routesMatch(baseHistory.location.pathname)?.route.name as RouteName | undefined
	}

	setNavigate(navigate: ReturnType<typeof useNavigate> | null) {
		this.navigate = navigate
	}

	/**
	 * 路由 hook 在布局重挂载时会短暂置空；这里回退到 history，避免移动端点击项目后丢跳转。
	 */
	private safeNavigate(params: MagicNavigateParams) {
		if (this.navigate) {
			this.navigate(params)
			return
		}

		console.warn("RouteManageService: navigate function not set")

		if (params.delta) {
			history.go(params.delta)
			return
		}

		if (!params.name) return

		const nextLocation = {
			name: params.name,
			params: params.params,
			query: params.query,
			state: params.state,
		}

		if (params.replace) {
			history.replace(nextLocation)
			return
		}

		history.push(nextLocation)
	}

	/**
	 * 检测当前是否在 MobileTabs 路由下
	 * TODO(mobile-refactor): 当前移动端已切到独立页面路由，这里仅用于兼容历史链路。
	 * 等本轮重构稳定并确认无线上的 mobile-tabs 回退依赖后，应移除此类判断和相关分支。
	 */
	private isInMobileTabs(): boolean {
		try {
			// 方法1: 检查 window.location（最可靠，实时更新）
			if (
				typeof window !== "undefined" &&
				window.location.pathname.includes("/mobile-tabs")
			) {
				return true
			}
			// 方法2: 备用：使用 baseHistory
			if (baseHistory.location.pathname.includes("/mobile-tabs")) {
				return true
			}
			return false
		} catch {
			return false
		}
	}

	/**
	 * 根据当前路由上下文获取正确的路由名称
	 * TODO(mobile-refactor): 独立路由完全收口后，删除 mobile-tabs 兼容重写逻辑，直接返回目标业务路由。
	 */
	private getRouteName(baseRoute: RouteName): RouteName {
		// 检测是否在 MobileTabs 路由下
		// 检查当前路径是否包含 /mobile-tabs
		const isInMobileTabs = this.isInMobileTabs()

		if (!isInMobileTabs) {
			return baseRoute
		}

		// 如果在 MobileTabs 下，统一返回 MobileTabs 路由名称（不再区分 Workspace/Project/Topic）
		switch (baseRoute) {
			case RouteName.SuperWorkspaceState:
			case RouteName.Super:
				return RouteName.MobileTabs
			default:
				return baseRoute
		}
	}

	/**
	 * Whether the project opens at the AI canvas address (desktop only). The mode comes from the
	 * given project or the loaded project lists; an unknown project keeps the generic route, and
	 * the project pages redirect it once its details load.
	 */
	private isAiCanvasRouteProject(projectId?: string | null, project?: ProjectListItem | null) {
		if (interfaceStore.isMobile || !projectId) return false

		const target =
			(project?.id === projectId ? project : null) ??
			(projectStore.selectedProject?.id === projectId
				? projectStore.selectedProject
				: null) ??
			projectStore.projects.find((item) => item.id === projectId) ??
			Array.from(projectStore.projectsByWorkspace.values())
				.flat()
				.find((item) => item.id === projectId)

		return isAiCanvasProject(target)
	}

	/**
	 * AI canvas addresses carry no topic, so switching topics inside the same canvas keeps the
	 * URL: navigating to the address already shown would only stack a duplicate history entry.
	 */
	private navigateToAiCanvasProject(
		projectId: string,
		options: Pick<MagicNavigateParams, "state" | "replace" | "viewTransition"> = {},
	) {
		const match = routesMatch(baseHistory.location.pathname)
		if (
			match?.route.name === RouteName.AiCanvasProjectState &&
			match.params?.projectId === projectId
		) {
			return
		}

		this.safeNavigate({
			name: RouteName.AiCanvasProjectState,
			params: { projectId },
			...options,
		})
	}

	/**
	 * Get workspace state session storage key for current user
	 * @deprecated Use WorkspaceStateCache.getKey() directly
	 */
	getWorkspaceStateSessionStorageKey(): string {
		const userInfo = userStore.user.userInfo
		return getWorkspaceStateSessionStorageKey(userInfo)
	}

	/**
	 * Get project topic map localStorage key for current user
	 * @deprecated Use ProjectTopicMapCache.getKey() directly
	 */
	getProjectTopicMapLocalStorageKey(): string {
		const userInfo = userStore.user.userInfo
		return ProjectTopicMapCache.getKey(userInfo)
	}

	/**
	 * Get current route params from route history
	 * 在 mobile-tabs 下从 query 参数读取，否则从路径参数读取
	 */
	private getCurrentRouteParams(): Record<string, string | undefined> {
		const isInMobileTabs = this.isInMobileTabs()

		if (isInMobileTabs) {
			// 在 mobile-tabs 下，从 query 参数读取
			try {
				const searchParams = new URLSearchParams(baseHistory.location.search)
				return {
					projectId: searchParams.get("projectId") || undefined,
					topicId: searchParams.get("topicId") || undefined,
				}
			} catch (error) {
				console.error("Failed to get current route params from query:", error)
				return {}
			}
		} else {
			// 不在 mobile-tabs 下，从路径参数读取
			try {
				const pathname = baseHistory.location.pathname
				const match = routesMatch(pathname)
				if (match?.params) {
					const params = match.params as Record<string, string | undefined>
					// 新路由 path 不含 workspaceId，从 projectStore 反查补全
					if (!params.workspaceId && projectStore.selectedProject) {
						params.workspaceId = projectStore.selectedProject.workspace_id
					}
					return params
				}
			} catch (error) {
				console.error("Failed to get current route params:", error)
			}
			return {}
		}
	}

	isCurrentChatProjectRoute(): boolean {
		return this.getCurrentMatchedRouteName() === RouteName.SuperChatProjectState
	}

	/** Read the persisted chat workspace id locally to avoid pulling service/hook dependencies into routing. */
	private getCachedChatWorkspaceId(): string | null {
		return ChatWorkspaceIdCache.get(userStore.user.userInfo)
	}

	/**
	 * Save-as-project keeps the same project id after moving out of the hidden chat workspace.
	 * We must confirm the current project still belongs to chat workspace before preserving `/super/chat`.
	 */
	private isChatWorkspaceProjectForRoute(projectId?: string | null): boolean {
		if (!projectId) return false

		const selectedProject = projectStore.selectedProject
		if (selectedProject?.id === projectId) {
			const chatWorkspaceId = this.getCachedChatWorkspaceId()
			return Boolean(chatWorkspaceId && selectedProject.workspace_id === chatWorkspaceId)
		}

		return false
	}

	/**
	 * Chat route should only be preserved when the URL and target project still refer to the same chat.
	 * Using pathname alone caused leave-navigation races to snap back to the previous chat URL.
	 */
	shouldPreserveChatRoute(projectId?: string | null): boolean {
		if (!this.isCurrentChatProjectRoute()) return false

		const routeProjectId = this.getCurrentRouteParams().projectId
		if (!routeProjectId) return false
		if (!projectId) return true

		return projectId === routeProjectId && this.isChatWorkspaceProjectForRoute(projectId)
	}

	/** Detect async refreshState that started on one route but finished after the user already left. */
	isStaleScopedRefresh(
		initialRouteProjectId: string | undefined,
		requestedProjectId?: string,
	): boolean {
		const currentRouteProjectId = this.getCurrentRouteParams().projectId

		if (initialRouteProjectId !== currentRouteProjectId) return true

		if (!requestedProjectId) {
			return Boolean(currentRouteProjectId)
		}

		if (!currentRouteProjectId) {
			return !this.isCurrentChatProjectRoute()
		}

		return currentRouteProjectId !== requestedProjectId
	}

	/**
	 * Detect mobile Super homepage entry routes where fixRouteParams must not rewrite URL.
	 * Covers the new /mobile-home route, bare /super index, and legacy mobile-tabs home.
	 */
	isCurrentMobileHomeRoute(
		location: { pathname: string; search: string } = baseHistory.location,
	): boolean {
		const { pathname, search } = location

		if (routesPathMatch(RouteName.MobileHome, pathname)) {
			return true
		}

		if (isBareSuperRootPath(pathname)) {
			return true
		}

		if (!pathname.includes("/mobile-tabs")) return false

		const searchParams = new URLSearchParams(search)
		const currentTab = searchParams.get("tab") || MobileTabParam.Super
		const hasRouteParams =
			Boolean(searchParams.get("projectId")) || Boolean(searchParams.get("topicId"))

		return currentTab === MobileTabParam.Super && !hasRouteParams
	}

	navigateToState = ({
		workspaceId,
		projectId,
		topicId,
		state,
		viewTransition = false,
	}: NavigateToStateParams) => {
		if (isUndefined(workspaceId) && isUndefined(projectId) && isUndefined(topicId)) return

		// 1. 获取当前路由参数
		const params = this.getCurrentRouteParams()
		const {
			workspaceId: param_workspaceId,
			projectId: param_projectId,
			topicId: param_topicId,
		} = params

		// 2. 如果传入的参数与当前路由参数相同，则不进行任何操作
		if (
			state === undefined &&
			workspaceId == param_workspaceId &&
			projectId == param_projectId &&
			topicId == param_topicId
		) {
			// 保存当前路由参数到本地缓存
			const userInfo = userStore.user.userInfo
			WorkspaceStateCache.set(userInfo, {
				workspaceId: param_workspaceId || null,
				projectId: param_projectId || null,
				topicId: param_topicId || null,
			})
			UserWorkspaceMapCache.set(userInfo, param_workspaceId || null)
			return
		}

		// 3. 合并当前路由参数和传入的参数
		const superMagicWorkspaceState = {
			workspaceId: (isUndefined(workspaceId) ? param_workspaceId : workspaceId) || null,
			projectId: (isUndefined(projectId) ? param_projectId : projectId) || null,
			topicId: (isUndefined(topicId) ? param_topicId : topicId) || null,
		}

		// 4. 更新本地缓存数据
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, superMagicWorkspaceState)
		UserWorkspaceMapCache.set(userInfo, superMagicWorkspaceState.workspaceId)

		// 5. 更新路由参数，依次处理四种情况
		// 5.1 工作区/项目/话题都存在
		if (
			superMagicWorkspaceState.workspaceId &&
			superMagicWorkspaceState.projectId &&
			superMagicWorkspaceState.topicId
		) {
			// 5.1.1 更新项目与选中话题的映射表至本地缓存
			ProjectTopicMapCache.set(
				userInfo,
				superMagicWorkspaceState.projectId,
				superMagicWorkspaceState.topicId,
			)

			// 移动端，话题通过 popup 显示，不需要跳转，更新 store 即可
			if (
				!interfaceStore.isMobile &&
				!this.shouldPreserveChatRoute(superMagicWorkspaceState.projectId) &&
				this.isAiCanvasRouteProject(superMagicWorkspaceState.projectId)
			) {
				this.navigateToAiCanvasProject(superMagicWorkspaceState.projectId, {
					state,
					viewTransition: param_topicId ? false : viewTransition,
					replace: !!param_topicId,
				})
			} else if (!interfaceStore.isMobile) {
				// Keep chat URL only while updating the same chat project, not when switching contexts.
				const chatRouteName = this.shouldPreserveChatRoute(
					superMagicWorkspaceState.projectId,
				)
					? RouteName.SuperChatProjectState
					: RouteName.SuperWorkspaceProjectTopicState

				this.safeNavigate({
					name: this.getRouteName(chatRouteName),
					params: {
						projectId: superMagicWorkspaceState.projectId,
						topicId: superMagicWorkspaceState.topicId,
					},
					state,
					viewTransition: param_topicId ? false : viewTransition,
					replace: !!param_topicId,
				})
			}

			// 5.2 工作区存在，项目存在，话题不存在
		} else if (
			superMagicWorkspaceState.workspaceId &&
			superMagicWorkspaceState.projectId &&
			!this.shouldPreserveChatRoute(superMagicWorkspaceState.projectId) &&
			this.isAiCanvasRouteProject(superMagicWorkspaceState.projectId)
		) {
			this.navigateToAiCanvasProject(superMagicWorkspaceState.projectId, {
				state,
				viewTransition,
			})
		} else if (superMagicWorkspaceState.workspaceId && superMagicWorkspaceState.projectId) {
			const projectRouteName = this.shouldPreserveChatRoute(
				superMagicWorkspaceState.projectId,
			)
				? RouteName.SuperChatProjectState
				: RouteName.SuperWorkspaceProjectState

			this.safeNavigate({
				name: this.getRouteName(projectRouteName),
				params: {
					projectId: superMagicWorkspaceState.projectId,
				},
				state,
				viewTransition,
				replace: false,
			})
			// 5.3 工作区存在，项目和话题不存在
		} else if (superMagicWorkspaceState.workspaceId) {
			if (interfaceStore.isMobile) {
				this.safeNavigate({
					name: RouteName.MobileTabs,
					query: {
						tab: MobileTabParam.Super,
					},
					state,
					viewTransition,
					replace: false,
				})
			} else {
				this.safeNavigate({
					name: this.getRouteName(RouteName.SuperWorkspaceState),
					params: {
						workspaceId: superMagicWorkspaceState.workspaceId,
					},
					state,
					viewTransition,
					replace: false,
				})
			}

			// 5.4 工作区、项目和话题都不存在，跳转到首页
		} else {
			if (interfaceStore.isMobile) {
				this.safeNavigate({
					name: RouteName.MobileTabs,
					query: {
						tab: MobileTabParam.Super,
					},
					state,
				})
			} else {
				this.safeNavigate({
					name: this.getRouteName(RouteName.Super),
					state,
					viewTransition,
					replace: false,
				})
			}
		}
	}

	getCachedState(
		userId: string,
		organizationCode?: string,
	): {
		workspaceId: string | null
		projectId: string | null
		topicId: string | null
	} | null {
		const userInfo = {
			user_id: userId,
			organization_code: organizationCode,
		}
		const state = WorkspaceStateCache.get(userInfo)
		if (state.workspaceId || state.projectId || state.topicId) {
			return state
		}
		return null
	}

	getCachedTopicId(projectId: string, userId: string, organizationCode?: string): string | null {
		const userInfo = {
			user_id: userId,
			organization_code: organizationCode,
		}
		return ProjectTopicMapCache.get(userInfo, projectId)
	}

	navigateToHome(replace?: boolean, query?: Record<string, string>) {
		// 更新缓存：清空所有状态
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId: null,
			projectId: null,
			topicId: null,
		})
		UserWorkspaceMapCache.set(userInfo, null)
		const queryProps = query && Object.keys(query).length > 0 ? { query } : {}

		if (interfaceStore.isMobile) {
			this.safeNavigate({
				name: RouteName.MobileHome,
				...queryProps,
				viewTransition: false,
				replace,
			})
		} else {
			this.safeNavigate({
				name: this.getRouteName(RouteName.Super),
				...queryProps,
				viewTransition: false,
				replace,
			})
		}
	}

	resetToSuper() {
		const isInMobileTabs = this.isInMobileTabs()
		if (isInMobileTabs) {
			this.safeNavigate({
				name: RouteName.MobileHome,
				viewTransition: false,
				replace: true,
			})
		} else {
			this.safeNavigate({
				name: this.getRouteName(RouteName.Super),
				viewTransition: false,
				replace: true,
			})
		}
	}

	/**
	 * 在 mobile-tabs 下构建 URL（使用 query 参数）
	 * TODO(mobile-refactor): 该方法只服务历史 mobile-tabs 兼容路径；确认无需回退后应整体删除。
	 */
	private buildMobileTabsUrl(params: {
		projectId?: string | null
		topicId?: string | null
	}): string {
		const searchParams = new URLSearchParams(baseHistory.location.search)
		// 保留现有的 tab 参数（如果有）
		if (!searchParams.has("tab")) {
			searchParams.set("tab", MobileTabParam.Super)
		}

		searchParams.delete("workspaceId")

		// 设置或删除参数
		if (params.projectId) {
			searchParams.set("projectId", params.projectId)
		} else {
			searchParams.delete("projectId")
		}

		if (params.topicId) {
			searchParams.set("topicId", params.topicId)
		} else {
			searchParams.delete("topicId")
		}

		const queryString = searchParams.toString()
		// 使用全局配置的集群编码，而不是从路径解析（避免回退时错误注入集群编码）
		const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
		return `/${clusterCode}${RoutePathMobile.MobileTabs}${queryString ? `?${queryString}` : ""}`
	}

	/**
	 * Navigate to workspace page
	 * @param workspaceId Workspace ID
	 * @param query Search params that must survive the navigation (for example agentCode)
	 */
	navigateToWorkspace(workspaceId: string, replace?: boolean, query?: Record<string, string>) {
		const { workspaceId: param_workspaceId, projectId: param_projectId } =
			this.getCurrentRouteParams()

		let viewTransition: boolean | ViewTransitionConfig = false

		// 从话题页回来，使用右滑过渡
		if (param_workspaceId && param_projectId && interfaceStore.isMobile) {
			viewTransition = {
				direction: "right",
			}
		}

		// 更新缓存：仅工作区
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId,
			projectId: null,
			topicId: null,
		})
		UserWorkspaceMapCache.set(userInfo, workspaceId)

		if (interfaceStore.isMobile) {
			const isInMobileTabs = this.isInMobileTabs()
			const currentTab = isInMobileTabs
				? ROUTE_NAME_TO_TAB_PARAM[mobileTabStore.activeTab] || MobileTabParam.Super
				: MobileTabParam.Super

			this.safeNavigate({
				name: RouteName.MobileTabs,
				query: {
					...query,
					tab: currentTab,
				},
				viewTransition,
				replace,
			})
		} else {
			this.safeNavigate({
				name: this.getRouteName(RouteName.SuperWorkspaceState),
				params: {
					workspaceId,
				},
				...(query && Object.keys(query).length > 0 ? { query } : {}),
				viewTransition,
				replace,
			})
		}
	}

	backToProject(project: ProjectListItem) {
		// 更新缓存：工作区 + 项目
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId: project.workspace_id,
			projectId: project.id,
			topicId: null,
		})
		UserWorkspaceMapCache.set(userInfo, project.workspace_id)

		const isInMobileTabs = this.isInMobileTabs()
		if (isInMobileTabs) {
			const targetPath = this.buildMobileTabsUrl({
				projectId: project.id,
			})
			baseHistory.replace(targetPath)
		} else if (this.isAiCanvasRouteProject(project.id, project)) {
			this.navigateToAiCanvasProject(project.id, {
				viewTransition: { direction: "right" },
				replace: true,
			})
		} else {
			this.safeNavigate({
				name: this.getRouteName(RouteName.SuperWorkspaceProjectState),
				params: {
					projectId: project.id,
				},
				viewTransition: {
					direction: "right",
				},
				replace: true,
			})
		}
	}

	navigateToProject(
		project: ProjectListItem,
		replace?: boolean,
		state?: Record<string, unknown> | null,
	) {
		const { workspaceId: param_workspaceId, projectId: param_projectId } =
			this.getCurrentRouteParams()

		let viewTransition: boolean | ViewTransitionConfig = {
			direction: "left",
		}

		// PC端不进行动画
		// 如果是在移动端，并且当前已经在项目页，禁用动画
		if (
			!interfaceStore.isMobile ||
			(param_workspaceId && param_projectId && interfaceStore.isMobile)
		) {
			viewTransition = false
		}

		// 更新缓存：工作区 + 项目
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId: project.workspace_id,
			projectId: project.id,
			topicId: null,
		})
		UserWorkspaceMapCache.set(userInfo, project.workspace_id)

		// const isInMobileTabs = this.isInMobileTabs()
		// if (isInMobileTabs) {
		// 	const targetPath = this.buildMobileTabsUrl({
		// 		workspaceId: project.workspace_id,
		// 		projectId: project.id,
		// 	})
		// 	if (replace) {
		// 		baseHistory.replace(targetPath)
		// 	} else {
		// 		baseHistory.push(targetPath)
		// 	}
		// } else {
		// 	this.navigate({
		// 		name: this.getRouteName(RouteName.SuperWorkspaceProjectState),
		// 		params: {
		// 			workspaceId: project.workspace_id,
		// 			projectId: project.id,
		// 		},
		// 		viewTransition,
		// 		replace,
		// 	})
		// }
		if (this.isAiCanvasRouteProject(project.id, project)) {
			this.navigateToAiCanvasProject(project.id, { viewTransition, state, replace })
			return
		}

		this.safeNavigate({
			name: this.getRouteName(RouteName.SuperWorkspaceProjectState),
			params: {
				projectId: project.id,
			},
			viewTransition,
			state,
			replace,
		})
	}

	navigateToClawPlayground(clawCode: string, replace?: boolean) {
		this.safeNavigate({
			name: RouteName.ClawPlayground,
			params: { code: clawCode },
			replace,
		})
	}

	navigateToMicroApp(appId: string, replace?: boolean) {
		this.safeNavigate({
			name: RouteName.MicroApp,
			params: { appId },
			replace,
		})
	}

	navigateToChatProject(
		project: ProjectListItem,
		topicId?: string,
		replace?: boolean,
		state?: Record<string, unknown> | null,
	) {
		const targetTopicId = topicId || undefined
		const currentParams = this.getCurrentRouteParams()
		const currentRouteName = this.getCurrentMatchedRouteName()
		const isAlreadyOnTargetChatRoute =
			currentRouteName === RouteName.SuperChatProjectState &&
			currentParams.projectId === project.id &&
			(currentParams.topicId || undefined) === targetTopicId

		// Avoid stacking duplicate history entries for the same chat URL.
		if (isAlreadyOnTargetChatRoute && !replace) {
			return
		}

		const { projectId: param_projectId } = currentParams

		let viewTransition: boolean | ViewTransitionConfig = {
			direction: "left",
		}
		// Desktop and in-project mobile transitions stay static.
		if (!interfaceStore.isMobile || (param_projectId && interfaceStore.isMobile)) {
			viewTransition = false
		}

		const workspaceId = isOtherCollaborationProject(project)
			? SHARE_WORKSPACE_ID
			: project.workspace_id

		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId,
			projectId: project.id,
			topicId: targetTopicId || null,
		})
		UserWorkspaceMapCache.set(userInfo, workspaceId)
		if (targetTopicId) ProjectTopicMapCache.set(userInfo, project.id, targetTopicId)

		const shouldReplace =
			replace === true ||
			(currentRouteName === RouteName.SuperChatProjectState &&
				currentParams.projectId === project.id &&
				!isAlreadyOnTargetChatRoute)

		this.safeNavigate({
			name: this.getRouteName(RouteName.SuperChatProjectState),
			params: {
				projectId: project.id,
				topicId: targetTopicId,
			},
			viewTransition,
			state,
			replace: shouldReplace,
		})
	}

	navigateToCollaborationProject(
		project: ProjectListItem,
		replace?: boolean,
		state?: Record<string, unknown> | null,
	) {
		const {
			workspaceId: param_workspaceId,
			projectId: param_projectId,
			topicId: param_topicId,
		} = this.getCurrentRouteParams()

		let viewTransition: boolean | ViewTransitionConfig = false

		// 从话题页回来，使用右滑过渡
		if (param_workspaceId && param_projectId && param_topicId && interfaceStore.isMobile) {
			viewTransition = {
				direction: "right",
			}
		}

		// 更新缓存：协作工作区 + 项目
		// 注意：协作项目使用 SHARE_WORKSPACE_ID，user_workspace_map 也使用该值
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId: SHARE_WORKSPACE_ID,
			projectId: project.id,
			topicId: null,
		})
		UserWorkspaceMapCache.set(userInfo, SHARE_WORKSPACE_ID)

		this.safeNavigate({
			name: this.getRouteName(RouteName.SuperWorkspaceProjectState),
			params: {
				projectId: project.id,
			},
			viewTransition,
			state,
			replace,
		})
	}

	/**
	 * Navigate to mobile project topic sub-route and sync workspace caches.
	 * URL must update before lazy TopicPage reconciles route params against the store.
	 */
	navigateToProjectTopicOnMobile({
		projectId,
		topicId,
		workspaceId,
		replace,
	}: {
		projectId: string
		topicId: string
		workspaceId?: string | null
		replace?: boolean
	}) {
		const currentParams = this.getCurrentRouteParams()
		const resolvedWorkspaceId =
			workspaceId ?? currentParams.workspaceId ?? workspaceStore.selectedWorkspace?.id ?? null

		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId: resolvedWorkspaceId,
			projectId,
			topicId,
		})
		if (resolvedWorkspaceId) {
			UserWorkspaceMapCache.set(userInfo, resolvedWorkspaceId)
		}
		ProjectTopicMapCache.set(userInfo, projectId, topicId)

		const shouldReplace = replace ?? Boolean(currentParams.topicId)

		this.safeNavigate({
			name: this.getRouteName(RouteName.SuperWorkspaceProjectTopicState),
			params: {
				projectId,
				topicId,
			},
			viewTransition: false,
			replace: shouldReplace,
		})
	}

	/**
	 * Navigate to project with topic
	 * @param project Project
	 * @param topicId Topic ID
	 */
	navigateToTopic({
		workspaceId,
		projectId,
		topicId,
		replace = false,
		state,
	}: {
		workspaceId: string
		projectId: string
		topicId: string
		replace?: boolean
		state?: Record<string, unknown> | null
	}) {
		// 更新缓存：完整状态（工作区 + 项目 + 话题）
		const userInfo = userStore.user.userInfo
		WorkspaceStateCache.set(userInfo, {
			workspaceId,
			projectId,
			topicId,
		})
		UserWorkspaceMapCache.set(userInfo, workspaceId)
		ProjectTopicMapCache.set(userInfo, projectId, topicId)

		// const isInMobileTabs = this.isInMobileTabs()
		// if (isInMobileTabs) {
		// 	const targetPath = this.buildMobileTabsUrl({
		// 		workspaceId,
		// 		projectId,
		// 		topicId,
		// 	})
		// 	if (replace) {
		// 		baseHistory.replace(targetPath)
		// 	} else {
		// 		baseHistory.push(targetPath)
		// 	}
		// } else {
		// 	this.navigate({
		// 		name: this.getRouteName(RouteName.SuperWorkspaceProjectTopicState),
		// 		params: {
		// 			workspaceId,
		// 			projectId,
		// 			topicId,
		// 		},
		// 		replace,
		// 	})
		// }
		if (interfaceStore.isMobile) {
			const isInProjectPage =
				routesMatch(baseHistory.location.pathname)?.route.name ===
					RouteName.SuperWorkspaceProjectState ||
				routesMatch(baseHistory.location.pathname)?.route.name ===
					RouteName.SuperChatProjectState

			// 如果移动端当前在项目页，则不需要进行导航
			if (isInProjectPage) {
				return
			}

			this.safeNavigate({
				name: this.getRouteName(RouteName.SuperWorkspaceProjectState),
				params: {
					projectId,
				},
				state,
				replace,
			})
		} else if (this.shouldPreserveChatRoute(projectId)) {
			const currentProject = projectStore.selectedProject
			if (currentProject?.id === projectId) {
				this.navigateToChatProject(currentProject, topicId, replace, state)
				return
			}

			this.safeNavigate({
				name: this.getRouteName(RouteName.SuperChatProjectState),
				params: {
					projectId,
					topicId,
				},
				state,
				replace,
			})
		} else if (this.isAiCanvasRouteProject(projectId)) {
			this.navigateToAiCanvasProject(projectId, { state, replace })
		} else {
			this.safeNavigate({
				name: this.getRouteName(RouteName.SuperWorkspaceProjectTopicState),
				params: {
					projectId,
					topicId,
				},
				state,
				replace,
			})
		}
	}

	/**
	 * 修复路由参数
	 * 如果当前工作区、项目和话题都存在，则跳转到话题页
	 * 如果当前工作区、项目存在，则跳转到项目页
	 * 如果当前工作区存在，则跳转到工作区页
	 * 如果当前工作区、项目和话题都不存在，则跳转到首页
	 */
	fixRouteParams() {
		// Only fix route params when on a super workspace route to avoid
		// redirecting away from non-workspace routes (e.g. /market/crew).
		if (!this.isSuperRoute()) return
		if (interfaceStore.isMobile && this.isCurrentMobileHomeRoute()) return
		// Keep the deep-link query until the homepage hook has resolved access and
		// hired the employee; rewriting the route here would erase the request first.
		if (new URLSearchParams(baseHistory.location.search).has("agentCode")) return

		const currentWorkspace = workspaceStore.selectedWorkspace
		const currentProject = projectStore.selectedProject
		const currentTopic = topicStore.selectedTopic

		if (this.isCurrentChatProjectRoute()) {
			const routeProjectId = this.getCurrentRouteParams().projectId
			if (currentProject && routeProjectId && currentProject.id === routeProjectId) {
				this.navigateToChatProject(currentProject, currentTopic?.id, true)
				return
			}

			if (currentWorkspace) {
				this.navigateToWorkspace(currentWorkspace.id, true)
				return
			}

			this.navigateToHome(true)
			return
		}

		if (currentWorkspace && currentProject && currentTopic) {
			this.navigateToTopic({
				workspaceId: currentWorkspace.id,
				projectId: currentProject.id,
				topicId: currentTopic.id,
				replace: true,
			})
		} else if (currentWorkspace && currentProject) {
			if (isOtherCollaborationProject(currentProject)) {
				this.navigateToCollaborationProject(currentProject, true)
			} else {
				this.navigateToProject(currentProject, true)
			}
		} else if (currentWorkspace) {
			this.navigateToWorkspace(currentWorkspace.id, true)
		} else {
			this.navigateToHome(true)
		}
	}

	/**
	 * 判断是否是超级路由
	 */
	isSuperRoute() {
		const pathname = baseHistory.location.pathname
		const match = routesMatch(pathname)
		return (
			match?.route.name === RouteName.Super ||
			match?.route.name === RouteName.SuperWorkspaceState ||
			match?.route.name === RouteName.SuperChatProjectState ||
			match?.route.name === RouteName.SuperWorkspaceProjectState ||
			match?.route.name === RouteName.SuperWorkspaceProjectTopicState ||
			match?.route.name === RouteName.AiCanvasProjectState
		)
	}
}

/** Returns true when pathname is bare /{cluster}/super without project/topic segments. */
function isBareSuperRootPath(pathname: string): boolean {
	return /^\/[^/]+\/super\/?$/.test(pathname) && !pathname.includes("/mobile-tabs")
}

export default new RouteManageService()
