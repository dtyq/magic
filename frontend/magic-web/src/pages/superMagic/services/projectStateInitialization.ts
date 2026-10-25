import { reaction, runInAction } from "mobx"
import { t } from "i18next"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { baseHistory } from "@/routes/history"
import { env } from "@/utils/env"
import { projectStore, workspaceStore } from "../stores/core"
import { SHARE_WORKSPACE_ID, SHARE_WORKSPACE_DATA } from "../constants"
import { isOwner, isReadOnlyProject } from "../utils/permission"
import { UserWorkspaceMapCache } from "../utils/superMagicCache"
import { isTopicBoundToProject } from "./topicProjectConsistency"
import type SuperMagicService from "./index"

export interface ProjectInitializationParams {
	workspaceId?: string
	projectId?: string
	topicId?: string
	enableErrorMessagePrompt?: boolean
}

/** 只约束本次初始化的读取与提交，不接管消息或其它页面的请求。 */
export interface ProjectInitializationScope {
	signal: AbortSignal
	isCurrent(): boolean
}

interface InitializationIdentity {
	magicId: string | undefined
	userId: string | undefined
	organizationCode: string
	authorization: string | null
	clusterCode: string
	baseURL: string
	sessionEpoch: number
}

let identityEpoch = 0
let previousIdentity: InitializationIdentity | undefined

export function readProjectInitializationIdentity(): InitializationIdentity {
	const { userInfo, organizationCode, authorization } = userStore.user
	const clusterCode = configStore.cluster.clusterCode
	const identity = {
		magicId: userInfo?.magic_id,
		userId: userInfo?.user_id,
		organizationCode,
		authorization,
		clusterCode,
		baseURL: env("MAGIC_SERVICE_BASE_URL", false, clusterCode),
	}
	// 请求键只包含递增编号，授权只参与私有内存比较；切回旧账号也不借用旧请求。
	if (
		!previousIdentity ||
		(Object.keys(identity) as (keyof typeof identity)[]).some(
			(key) => identity[key] !== previousIdentity?.[key],
		)
	)
		identityEpoch++
	previousIdentity = { ...identity, sessionEpoch: identityEpoch }
	return previousIdentity
}

export function isProjectInitializationIdentityCurrent(identity: InitializationIdentity): boolean {
	const current = readProjectInitializationIdentity()
	return (Object.keys(identity) as (keyof InitializationIdentity)[]).every(
		(key) => identity[key] === current[key],
	)
}

type InitializationServices = Pick<
	typeof SuperMagicService,
	| "project"
	| "topic"
	| "topicStore"
	| "workspace"
	| "route"
	| "resetState"
	| "initializeWorkspace"
	| "getTopicDataByProject"
>

interface PendingInitialization {
	paramsKey: string
	resolvedParamsKey?: string
	identity: InitializationIdentity
	scope: ProjectInitializationScope
	promise: Promise<void>
}

export class ProjectStateInitialization {
	private pending?: PendingInitialization
	private generation = 0
	private controller?: AbortController

	constructor(private readonly services: InitializationServices) {}

	initialize({
		workspaceId,
		projectId,
		topicId,
		enableErrorMessagePrompt = false,
	}: ProjectInitializationParams): Promise<void> {
		const params = { workspaceId, projectId, topicId, enableErrorMessagePrompt }
		const paramsKey = JSON.stringify([
			params.workspaceId || undefined,
			params.projectId || undefined,
			params.topicId || undefined,
			params.enableErrorMessagePrompt,
		])
		if (
			this.pending &&
			(this.pending.paramsKey === paramsKey ||
				this.pending.resolvedParamsKey === paramsKey) &&
			this.pending.scope.isCurrent() &&
			isProjectInitializationIdentityCurrent(this.pending.identity)
		) {
			return this.pending.promise
		}

		this.controller?.abort()
		const controller = new AbortController()
		this.controller = controller
		const generation = ++this.generation
		const identity = readProjectInitializationIdentity()
		let pathname = baseHistory.location.pathname
		const scope: ProjectInitializationScope = {
			signal: controller.signal,
			isCurrent: () =>
				!controller.signal.aborted &&
				generation === this.generation &&
				pathname === baseHistory.location.pathname &&
				isProjectInitializationIdentityCurrent(identity),
		}
		// A → B → A 不复用已取消的第一次 A；账户变化也立即取消本次独占的详情读取。
		const stopRoute = baseHistory.listen(({ location }) => {
			if (location.pathname !== pathname) controller.abort()
		})
		const stopIdentity = reaction(readProjectInitializationIdentity, () => {
			if (!isProjectInitializationIdentityCurrent(identity)) controller.abort()
		})
		// 先登记再执行，避免 resetState 的同步响应触发第二次初始化。
		const promise = Promise.resolve()
			.then(() =>
				this.run(params, scope, (workspaceId) => {
					if (this.pending?.scope === scope) {
						// 路由恢复可能从已选项目补出 workspaceId，两种参数表示的是同一次进入。
						this.pending.resolvedParamsKey = JSON.stringify([
							workspaceId || undefined,
							params.projectId || undefined,
							params.topicId || undefined,
							params.enableErrorMessagePrompt,
						])
					}
				}),
			)
			.then(() => {
				if (!scope.isCurrent()) return
				stopRoute()
				this.services.route.fixRouteParams()
				pathname = baseHistory.location.pathname
			})
			.finally(() => {
				stopRoute()
				stopIdentity()
				if (this.pending?.scope === scope) this.pending = undefined
			})
		this.pending = { paramsKey, identity, scope, promise }
		return promise
	}

	private async run(
		{
			workspaceId,
			projectId,
			topicId,
			enableErrorMessagePrompt = false,
		}: ProjectInitializationParams,
		scope: ProjectInitializationScope,
		onWorkspaceResolved: (workspaceId: string | undefined) => void,
	): Promise<void> {
		if (!scope.isCurrent()) return
		const services = this.services
		services.resetState(false)
		/** 备用工作区ID，用于在初始化工作区失败时使用 */
		const fallbackWorkspaceId = UserWorkspaceMapCache.get(userStore.user.userInfo) || undefined

		// 先判断是不是有项目，并且有效
		const project = projectId
			? await services.project
					.getProjectDetail(projectId, {
						// Notification navigation must explain missing or inaccessible targets.
						enableErrorMessagePrompt,
						signal: scope.signal,
					})
					.catch(() => null)
			: null
		if (!scope.isCurrent()) return
		const onlyCollWorkspaceId = workspaceId && workspaceId === SHARE_WORKSPACE_ID && !project
		// 新路由 path 不含 workspaceId，优先从 project 反查
		const resolvedWorkspaceId = workspaceId || project?.workspace_id
		onWorkspaceResolved(resolvedWorkspaceId)
		const canReadTopic = project && !isReadOnlyProject(project.user_role)
		const topicPromise =
			canReadTopic && topicId
				? services.topic
						.getTopicDetail(topicId, {
							enableErrorMessagePrompt: false,
							signal: scope.signal,
						})
						.catch(() => null)
				: null
		// 工作区先读取，不提交选中项；聊天提前就绪期间不能暂时选中 fallback 的其它工作区。
		const workspacePromise = services
			.initializeWorkspace(
				// 不能基于共享工作区ID初始化工作区
				onlyCollWorkspaceId ? undefined : resolvedWorkspaceId,
				fallbackWorkspaceId,
				scope,
				false,
			)
			.then(
				(value) => ({ status: "fulfilled" as const, value }),
				(reason: unknown) => ({ status: "rejected" as const, reason }),
			)
		const explicitTopic = topicPromise ? await topicPromise : null
		if (!scope.isCurrent()) return
		const chatReady = Boolean(
			project && explicitTopic && isTopicBoundToProject(explicitTopic, project.id),
		)
		if (project && explicitTopic && chatReady) {
			runInAction(() => {
				projectStore.setSelectedProject(project)
				services.topicStore.setSelectedTopic(explicitTopic)
				if (!isOwner(project.user_role))
					workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
			})
			services.project.recordProjectVisit(project)
		}

		const workspaceResult = await workspacePromise
		if (!scope.isCurrent()) return
		if (workspaceResult.status === "rejected") throw workspaceResult.reason
		const workspace = workspaceResult.value
		if (
			!chatReady ||
			!project ||
			(isOwner(project.user_role) && workspace?.id === project.workspace_id)
		) {
			workspaceStore.setSelectedWorkspace(workspace)
		}
		// 如果工作区存在，则获取项目列表
		if (workspace) {
			projectStore.setFetchingProjects(true)
			void services.project
				.fetchProjects(
					{
						workspaceId: workspace.id,
						page: 1,
						clearWhenNoProjects: false,
					},
					{ enableErrorMessagePrompt: false },
					scope,
				)
				.finally(() => {
					if (scope.isCurrent()) projectStore.setFetchingProjects(false)
				})
		}

		// 如果项目不存在，则直接返回
		if (!project) return
		// 校验工作区
		const _isOwner = isOwner(project.user_role)
		if (!_isOwner) {
			workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
		} else if (workspaceStore.selectedWorkspace?.id !== project.workspace_id) {
			// 校验工作区是否匹配，如果不匹配，则更新工作区
			const workspaceDetail = await services.workspace
				.getWorkspaceDetail(project.workspace_id, {
					enableErrorMessagePrompt: false,
					signal: scope.signal,
				})
				.catch(() => null)
			if (!scope.isCurrent()) return
			if (workspaceDetail) workspaceStore.setSelectedWorkspace(workspaceDetail)
		}

		if (!chatReady) {
			// PC端，如果没有传话题ID，也进行话题初始化
			const selectedTopic = canReadTopic
				? await services.getTopicDataByProject(
						project,
						topicPromise ? undefined : topicId,
						scope,
					)
				: null
			if (!scope.isCurrent()) return
			// 项目入口必须一起发布项目和话题；只发布项目会让页面凭 current_topic_id
			// 提前跳转，取消尚未完成的初始化。只读或无有效话题时仅保留项目视图。
			runInAction(() => {
				projectStore.setSelectedProject(project)
				if (selectedTopic) services.topicStore.setSelectedTopic(selectedTopic)
			})
			services.project.recordProjectVisit(project)
		}
		// 只有选中了某个项目，才需要加载这个项目下的话题
		if (!canReadTopic) return
		// 加载话题列表
		void services.topic.fetchTopics(
			{ projectId: project.id, isAutoSelect: false, page: 1 },
			scope,
		)
	}
}
