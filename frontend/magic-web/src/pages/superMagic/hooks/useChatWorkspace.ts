import { SuperMagicApi } from "@/apis"
import { useMemoizedFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import projectStore from "@/pages/superMagic/stores/core/project"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import SuperMagicService from "@/pages/superMagic/services"
import { userStore } from "@/models/user"
import { ChatWorkspaceIdCache } from "@/pages/superMagic/utils/superMagicCache"
import type {
	CreatedProject,
	ProjectListItem,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"

interface UseChatWorkspaceOptions {
	projectsEnabled?: boolean
	projectPageSize?: number
	projectKeyword?: string
}

interface CreateChatWorkspaceProjectParams {
	projectMode: TopicMode
	workdir?: string
}

interface ChatProjectQueryOptions {
	pageSize?: number
	keyword?: string
	silent?: boolean
	/** 请求第几页，默认 1 */
	page?: number
	/** 是否将结果追加到现有列表末尾（用于加载更多），默认 false（替换列表） */
	append?: boolean
}

interface UseChatWorkspaceResult {
	chatWorkspace: Workspace | null
	chatProjects: ProjectListItem[]
	/** 服务端返回的对话项目总数，用于判断是否还有更多分页数据 */
	chatProjectsTotal: number
	isLoadingChatWorkspace: boolean
	isLoadingChatProjects: boolean
	ensureChatWorkspace: () => Promise<Workspace | null>
	fetchChatProjects: (options?: ChatProjectQueryOptions) => Promise<ProjectListItem[]>
	refreshChatProjects: (options?: ChatProjectQueryOptions) => Promise<ProjectListItem[]>
	searchChatProjects: (
		keyword: string,
		options?: Omit<ChatProjectQueryOptions, "keyword">,
	) => Promise<ProjectListItem[]>
	/** 加载下一页并将结果追加到列表末尾 */
	loadMoreChatProjects: (
		page: number,
		options?: Omit<ChatProjectQueryOptions, "page" | "append">,
	) => Promise<ProjectListItem[]>
	createProjectInChatWorkspace: (
		params: CreateChatWorkspaceProjectParams,
	) => Promise<CreatedProject | null>
}

let cachedChatWorkspace: Workspace | null = null
let cachedChatWorkspaceId: string | null = null
let sharedChatWorkspaceRequest: Promise<Workspace | null> | null = null

/** Chat 对话列表按项目更新时间倒序；API order_by 仅支持 updated_at / id。 */
const CHAT_PROJECT_LIST_ORDER_BY = "updated_at"
const CHAT_PROJECT_LIST_SORT = "desc"

/**
 * Clear module-level chat workspace cache after org/account switch.
 * initUserData must call this so ensureChatWorkspace does not reuse the previous org workspace.
 */
export function clearChatWorkspaceModuleCache(): void {
	cachedChatWorkspace = null
	cachedChatWorkspaceId = null
	sharedChatWorkspaceRequest = null
}

function getPersistedChatWorkspaceId(): string | null {
	if (cachedChatWorkspace?.id) return cachedChatWorkspace.id
	if (cachedChatWorkspaceId) return cachedChatWorkspaceId

	const persistedWorkspaceId = ChatWorkspaceIdCache.get(userStore.user.userInfo)
	if (persistedWorkspaceId) {
		cachedChatWorkspaceId = persistedWorkspaceId
	}

	return persistedWorkspaceId
}

function persistChatWorkspace(workspace: Workspace | null): Workspace | null {
	if (!workspace?.id || workspace.workspace_type !== "chat") {
		cachedChatWorkspace = null
		cachedChatWorkspaceId = null
		ChatWorkspaceIdCache.clear(userStore.user.userInfo)
		return null
	}

	cachedChatWorkspace = workspace
	cachedChatWorkspaceId = workspace.id
	ChatWorkspaceIdCache.set(userStore.user.userInfo, workspace.id)
	return workspace
}

/**
 * 获取已缓存的 chat workspace ID。
 * 优先读内存缓存，其次回退到 sessionStorage，供轻量映射层零开销判断项目是否属于 chat workspace。
 */
export function getCachedChatWorkspaceId(): string | null {
	return cachedChatWorkspace?.id ?? getPersistedChatWorkspaceId()
}

/**
 * 请求并缓存 chat workspace，供映射层在需要时主动确保 ID 可用。
 * 多次调用会复用同一个运行中的请求，不重复发起网络请求。
 */
export async function ensureChatWorkspaceId(): Promise<string | null> {
	const cachedWorkspaceId = getPersistedChatWorkspaceId()
	if (cachedWorkspaceId) return cachedWorkspaceId
	if (sharedChatWorkspaceRequest) {
		const ws = await sharedChatWorkspaceRequest
		return ws?.id ?? null
	}

	const request = SuperMagicApi.getChatWorkspace()
		.then((workspace) => {
			return persistChatWorkspace(workspace)
		})
		.catch(() => null)
		.finally(() => {
			sharedChatWorkspaceRequest = null
		})

	sharedChatWorkspaceRequest = request
	const ws = await request
	return ws?.id ?? null
}

export function useChatWorkspace(options: UseChatWorkspaceOptions = {}): UseChatWorkspaceResult {
	const { projectsEnabled = false, projectPageSize = 100, projectKeyword = "" } = options
	const [chatWorkspace, setChatWorkspace] = useState<Workspace | null>(null)
	const [chatProjects, setChatProjects] = useState<ProjectListItem[]>([])
	const [chatProjectsTotal, setChatProjectsTotal] = useState(0)
	const [isLoadingChatWorkspace, setIsLoadingChatWorkspace] = useState(false)
	const [isLoadingChatProjects, setIsLoadingChatProjects] = useState(false)
	const isMountedRef = useRef(true)

	const ensureChatWorkspace = useMemoizedFn(async () => {
		if (chatWorkspace?.id) return chatWorkspace
		if (cachedChatWorkspace?.id) {
			if (isMountedRef.current) {
				setChatWorkspace(cachedChatWorkspace)
			}
			return cachedChatWorkspace
		}
		if (sharedChatWorkspaceRequest) return sharedChatWorkspaceRequest
		if (chatWorkspace?.id) return chatWorkspace

		setIsLoadingChatWorkspace(true)

		const request = SuperMagicApi.getChatWorkspace()
			.then((workspace) => {
				const resolvedWorkspace = persistChatWorkspace(workspace)
				if (!resolvedWorkspace) return null
				if (isMountedRef.current) {
					setChatWorkspace(resolvedWorkspace)
				}
				return resolvedWorkspace
			})
			.catch((error) => {
				console.error("Failed to load chat workspace:", error)
				return null
			})
			.finally(() => {
				sharedChatWorkspaceRequest = null
				if (isMountedRef.current) {
					setIsLoadingChatWorkspace(false)
				}
			})

		sharedChatWorkspaceRequest = request
		return request
	})

	const fetchChatProjects = useMemoizedFn(
		async ({
			pageSize = projectPageSize,
			keyword = projectKeyword.trim(),
			silent = false,
			page = 1,
			append = false,
		}: ChatProjectQueryOptions = {}) => {
			const workspace = await ensureChatWorkspace()
			if (!workspace?.id) {
				if (isMountedRef.current) {
					setChatProjects([])
					setChatProjectsTotal(0)
				}
				return []
			}

			if (!silent && isMountedRef.current) {
				setIsLoadingChatProjects(true)
			}

			try {
				const response = await SuperMagicApi.getProjects({
					workspace_id: workspace.id,
					project_name: keyword,
					order_by: CHAT_PROJECT_LIST_ORDER_BY,
					sort: CHAT_PROJECT_LIST_SORT,
					page,
					page_size: pageSize,
				})
				const chatProjectList = response.list || []

				/**
				 * 仅在非搜索态写回工作区缓存，避免搜索结果把完整 workspace 列表错误覆盖成过滤后的子集。
				 * append 模式（加载更多）同样不写回缓存，避免覆盖第 1 页数据。
				 */
				if (!keyword && !append) {
					projectStore.setProjectsForWorkspace(workspace.id, chatProjectList)
				}
				if (isMountedRef.current) {
					// append 模式：追加到现有列表末尾；否则替换整个列表
					setChatProjects((prev) =>
						append ? [...prev, ...chatProjectList] : chatProjectList,
					)
					setChatProjectsTotal(response.total ?? 0)
				}

				return chatProjectList
			} catch (error) {
				console.error("Failed to load chat projects:", error)
				if (isMountedRef.current && !append) {
					// 追加模式失败时不清空已加载的数据
					setChatProjects([])
					setChatProjectsTotal(0)
				}
				return []
			} finally {
				if (!silent && isMountedRef.current) {
					setIsLoadingChatProjects(false)
				}
			}
		},
	)

	/**
	 * 对外保留 refresh 语义，供 ChatDrawer 下拉刷新、动作回调和 ChatsPage 主动重试复用。
	 */
	const refreshChatProjects = useMemoizedFn((options?: ChatProjectQueryOptions) => {
		return fetchChatProjects(options)
	})

	/**
	 * 显式搜索入口让页面层表达“按关键字刷新”，而不必重复拼装 query 参数。
	 */
	const searchChatProjects = useMemoizedFn(
		(keyword: string, options?: Omit<ChatProjectQueryOptions, "keyword">) => {
			return fetchChatProjects({
				...options,
				keyword,
			})
		},
	)

	/**
	 * 加载指定页的数据并追加到现有列表末尾，供无限滚动（InfiniteScroll）使用。
	 */
	const loadMoreChatProjects = useMemoizedFn(
		(page: number, options?: Omit<ChatProjectQueryOptions, "page" | "append">) => {
			return fetchChatProjects({ ...options, page, append: true })
		},
	)

	const createProjectInChatWorkspace = useMemoizedFn(
		async ({ projectMode, workdir }: CreateChatWorkspaceProjectParams) => {
			const workspace = await ensureChatWorkspace()
			if (!workspace?.id) return null

			workspaceStore.setSelectedWorkspace(workspace)

			return SuperMagicService.project.createProject({
				workspaceId: workspace.id,
				projectMode,
				workdir,
			})
		},
	)

	useEffect(() => {
		isMountedRef.current = true
		void ensureChatWorkspace()

		return () => {
			isMountedRef.current = false
		}
	}, [ensureChatWorkspace])

	useEffect(() => {
		if (!projectsEnabled) return

		void refreshChatProjects({
			pageSize: projectPageSize,
			keyword: projectKeyword.trim(),
		})
	}, [projectKeyword, projectPageSize, projectsEnabled, refreshChatProjects])

	return {
		chatWorkspace,
		chatProjects,
		chatProjectsTotal,
		isLoadingChatWorkspace,
		isLoadingChatProjects,
		ensureChatWorkspace,
		fetchChatProjects,
		refreshChatProjects,
		searchChatProjects,
		loadMoreChatProjects,
		createProjectInChatWorkspace,
	}
}
