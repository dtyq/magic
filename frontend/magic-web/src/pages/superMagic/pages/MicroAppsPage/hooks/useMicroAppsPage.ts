import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SuperMagicApi } from "@/apis"
import type {
	MicroAppListItem as ApiMicroAppListItem,
	MicroAppListResponse as ApiMicroAppListResponse,
	MicroAppListScope,
} from "@/apis/modules/superMagic"
import { userStore } from "@/models/user"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"

const MICRO_APP_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 250
const MICRO_APP_LIST_SCOPES: MicroAppListScope[] = [
	"all",
	"created",
	"collaborated",
	"accessible",
	"recent",
]
const MICRO_APP_PERSONAL_LIST_SCOPES: MicroAppListScope[] = [
	"all",
	"created",
	"accessible",
	"recent",
]

export function shouldOpenPublishedShare(scope: MicroAppListScope, publishStatus: string): boolean {
	// 可访问列表只包含发布内容；最近访问同时包含发布内容和开发中的应用。
	return scope === "accessible" || (scope === "recent" && publishStatus === "published")
}

export function getMicroAppAvailableScopes(isPersonalOrganization: boolean): MicroAppListScope[] {
	return isPersonalOrganization ? MICRO_APP_PERSONAL_LIST_SCOPES : MICRO_APP_LIST_SCOPES
}

export function normalizeMicroAppListScope(
	scope: MicroAppListScope,
	isPersonalOrganization: boolean,
): MicroAppListScope {
	const availableScopes = getMicroAppAvailableScopes(isPersonalOrganization)
	return availableScopes.includes(scope) ? scope : "all"
}

export interface MicroAppListItem extends ApiMicroAppListItem {
	can_delete: boolean
	project_id: string
}

interface MicroAppListResponse extends Omit<ApiMicroAppListResponse, "list"> {
	list: MicroAppListItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object")
}

function normalizeCollaboratorPermission(value: unknown): CollaboratorPermission | undefined {
	switch (value) {
		case "owner":
		case "manage":
		case "editor":
		case "viewer":
		case "collaborator":
			return value
		default:
			return undefined
	}
}

function normalizeMicroAppItem(item: unknown): MicroAppListItem | null {
	if (!isRecord(item) || !item.app_id) return null

	return {
		app_id: String(item.app_id),
		project_id: String(item.project_id ?? ""),
		app_name: String(item.app_name ?? ""),
		app_description: String(item.app_description ?? ""),
		creator_id: String(item.creator_id ?? ""),
		cover_url: String(item.cover_url ?? ""),
		publish_status: String(item.publish_status ?? "unpublished"),
		updated_at: item.updated_at == null ? null : String(item.updated_at),
		can_delete: item.can_delete !== false,
		user_role: normalizeCollaboratorPermission(item.user_role),
	}
}

export function normalizeMicroAppListResponse(response: unknown): MicroAppListResponse {
	const payload = isRecord(response) && isRecord(response.data) ? response.data : response
	if (!isRecord(payload)) {
		return { list: [], total: 0, page: 1, page_size: MICRO_APP_PAGE_SIZE }
	}

	const list = Array.isArray(payload.list)
		? payload.list
				.map(normalizeMicroAppItem)
				.filter((item): item is MicroAppListItem => Boolean(item))
		: []

	return {
		list,
		total: Number(payload.total ?? list.length),
		page: Number(payload.page ?? 1),
		page_size: Number(payload.page_size ?? MICRO_APP_PAGE_SIZE),
	}
}

export function useMicroAppWorkspace(refreshVersion = 0, enabled = true) {
	const [workspace, setWorkspace] = useState<Workspace | null>(null)
	const workspaceRef = useRef<Workspace | null>(null)

	useEffect(() => {
		if (!enabled || workspaceRef.current) return

		let active = true

		SuperMagicApi.getMicroAppWorkspace()
			.then((nextWorkspace) => {
				if (!active) return
				workspaceRef.current = nextWorkspace
				setWorkspace(nextWorkspace)
			})
			.catch((workspaceError) => {
				if (active) console.error("Failed to load micro app workspace:", workspaceError)
			})

		return () => {
			active = false
		}
	}, [enabled, refreshVersion])

	return workspace
}

interface MicroAppsPageOptions {
	initialScope?: MicroAppListScope
	loadWorkspace?: boolean
	keyword?: string
	retainResults?: boolean
	/** Search both project membership and published-share access. */
	searchAll?: boolean
	enabled?: boolean
}

export function useMicroAppsPage(options: MicroAppsPageOptions = {}) {
	const [apps, setApps] = useState<MicroAppListItem[]>([])
	const [scope, setScopeState] = useState<MicroAppListScope>(options.initialScope ?? "all")
	const [localKeyword, setKeyword] = useState("")
	const keyword = options.keyword ?? localKeyword
	const [page, setPage] = useState(1)
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [hasLoaded, setHasLoaded] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [loadMoreError, setLoadMoreError] = useState<unknown>(null)
	const [hasMore, setHasMore] = useState(false)
	const [error, setError] = useState<unknown>(null)
	const [refreshVersion, setRefreshVersion] = useState(0)
	const requestIdRef = useRef(0)
	const loadMoreRequestRef = useRef<number | null>(null)
	// Cache only a few first pages in this mounted panel, never across users or organizations.
	const cacheRef = useRef(new Map<string, MicroAppListResponse>())
	const identity = JSON.stringify([
		userStore.user.organizationCode,
		userStore.user.userInfo?.user_id,
	])
	const identityRef = useRef(identity)
	const retainResults = options.retainResults ?? false
	const enabled = options.enabled ?? true
	const searchAll = options.searchAll ?? false
	const workspace = useMicroAppWorkspace(refreshVersion, options.loadWorkspace ?? true)
	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const availableScopes = useMemo(
		() => getMicroAppAvailableScopes(isPersonalOrganization),
		[isPersonalOrganization],
	)
	const resolvedScope = availableScopes.includes(scope) ? scope : (options.initialScope ?? "all")

	useEffect(() => {
		if (scope === resolvedScope) return
		setScopeState(resolvedScope)
	}, [resolvedScope, scope])

	const setScope = useCallback((nextScope: MicroAppListScope) => {
		setScopeState(normalizeMicroAppListScope(nextScope, userStore.user.isPersonalOrganization))
	}, [])

	const fetchPage = useCallback(
		async (nextPage: number) => {
			const params = {
				page: nextPage,
				page_size: MICRO_APP_PAGE_SIZE,
				keyword: keyword.trim(),
			}
			// A unified view still needs both authorization scopes; `all` excludes share-only apps.
			const responses = await Promise.all(
				(searchAll ? (["all", "accessible"] as const) : [resolvedScope]).map(
					async (nextScope) =>
						normalizeMicroAppListResponse(
							await SuperMagicApi.getMicroApps({ ...params, scope: nextScope }),
						),
				),
			)
			return {
				...responses[0],
				list: Array.from(
					new Map(
						responses
							.flatMap((response) => response.list)
							.map((app) => [app.app_id, app]),
					).values(),
				),
				total: responses.reduce((sum, response) => sum + response.total, 0),
				hasMore: responses.some(
					(response) => response.page * response.page_size < response.total,
				),
			}
		},
		[keyword, resolvedScope, searchAll],
	)

	useEffect(() => {
		const requestId = ++requestIdRef.current
		loadMoreRequestRef.current = null
		if (!enabled) {
			setLoading(false)
			return
		}
		let active = true
		// Disable old results immediately while the new filter is being debounced.
		setLoading(true)
		setLoadingMore(false)
		setLoadMoreError(null)
		setError(null)
		if (identityRef.current !== identity) {
			cacheRef.current.clear()
			identityRef.current = identity
			setApps([])
			setHasLoaded(false)
		}
		const cacheKey = JSON.stringify([resolvedScope, keyword.trim()])
		const cached = retainResults ? cacheRef.current.get(cacheKey) : undefined
		if (cached) {
			setApps(cached.list)
			setTotal(cached.total)
			setPage(cached.page)
		}
		const timer = window.setTimeout(async () => {
			setLoading(true)
			setError(null)
			if (!retainResults) setApps([])
			setPage(1)

			try {
				const normalized = await fetchPage(1)
				if (!active || requestId !== requestIdRef.current) return
				setHasMore(normalized.hasMore)

				if (retainResults) {
					cacheRef.current.delete(cacheKey)
					cacheRef.current.set(cacheKey, normalized)
					if (cacheRef.current.size > 10) {
						const oldestKey = cacheRef.current.keys().next().value
						if (oldestKey !== undefined) cacheRef.current.delete(oldestKey)
					}
				}
				setHasLoaded(true)
				setApps(normalized.list)
				setTotal(normalized.total)
				setPage(normalized.page)
			} catch (nextError) {
				if (!active || requestId !== requestIdRef.current) return
				cacheRef.current.delete(cacheKey)
				setError(nextError)
				setApps([])
				setTotal(0)
				setHasMore(false)
			} finally {
				if (active && requestId === requestIdRef.current) setLoading(false)
			}
		}, SEARCH_DEBOUNCE_MS)

		return () => {
			active = false
			requestIdRef.current += 1
			window.clearTimeout(timer)
		}
	}, [enabled, fetchPage, identity, keyword, refreshVersion, resolvedScope, retainResults])

	const loadMore = useCallback(async () => {
		if (
			!enabled ||
			loading ||
			loadingMore ||
			loadMoreRequestRef.current !== null ||
			!(searchAll ? hasMore : apps.length < total)
		)
			return

		const requestId = ++requestIdRef.current
		loadMoreRequestRef.current = requestId
		setLoadingMore(true)
		setLoadMoreError(null)
		try {
			const normalized = await fetchPage(page + 1)
			if (requestId !== requestIdRef.current) return

			setApps((current) =>
				Array.from(
					new Map(
						[...current, ...normalized.list].map((app) => [app.app_id, app]),
					).values(),
				),
			)
			setHasMore(normalized.hasMore)
			setTotal(normalized.total)
			setPage(normalized.page)
		} catch (nextError) {
			if (requestId === requestIdRef.current) setLoadMoreError(nextError)
		} finally {
			if (loadMoreRequestRef.current === requestId) loadMoreRequestRef.current = null
			if (requestId === requestIdRef.current) setLoadingMore(false)
		}
	}, [apps.length, enabled, fetchPage, hasMore, loading, loadingMore, page, searchAll, total])

	const renameApp = useCallback(async (appId: string, appName: string) => {
		const metadata = await SuperMagicApi.updateMicroApp(appId, { app_name: appName })
		cacheRef.current.clear()
		setApps((current) =>
			current.map((app) =>
				app.app_id === appId
					? {
							...app,
							app_name: metadata.app_name || appName,
							updated_at: metadata.updated_at ?? app.updated_at,
						}
					: app,
			),
		)
		return metadata
	}, [])

	const deleteApp = useCallback(async (appId: string) => {
		const result = await SuperMagicApi.deleteMicroApp(appId)
		cacheRef.current.clear()
		setApps((current) => current.filter((app) => app.app_id !== appId))
		setTotal((current) => Math.max(0, current - 1))
		// 删除会改变分页边界，重新加载第一页，避免后续加载更多时跳过一条记录。
		setRefreshVersion((value) => value + 1)
		return result
	}, [])

	const refresh = useCallback(() => {
		cacheRef.current.clear()
		setRefreshVersion((value) => value + 1)
	}, [])

	return {
		workspace,
		apps,
		scope: resolvedScope,
		availableScopes,
		setScope,
		keyword,
		setKeyword,
		loading,
		initialLoading: loading && !hasLoaded,
		loadingMore,
		hasMore: searchAll ? hasMore : apps.length < total,
		total,
		loadMoreError,
		error,
		refresh,
		loadMore,
		renameApp,
		deleteApp,
	}
}
