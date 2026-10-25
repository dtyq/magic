import type { TopicTypeFilterValue } from "../utils/topicTypeFilter"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Topic } from "../pages/Workspace/types"
import type TopicService from "../services/topicService"
import SuperMagicService from "../services"
import {
	normalizeTopicHistoryItem,
	TOPIC_HISTORY_PAGE_SIZE,
} from "@/pages/superMagic/utils/topicHistory"

const DEFAULT_PAGE_SIZE = TOPIC_HISTORY_PAGE_SIZE
const TOPIC_HISTORY_SESSION_STORAGE_KEY = "super-magic-topic-history-session-cache"

interface TopicHistorySessionCacheValue {
	total: number
	topics: Topic[]
}

interface UsePaginatedTopicsOptions {
	topicType?: TopicTypeFilterValue
	enabled?: boolean
	projectId: string
	selectedTopicId?: string
	storeTopics: Topic[]
	pageSize?: number
	topicService?: TopicService
	searchKeyword?: string
}

interface UsePaginatedTopicsResult {
	/** First-page failure; consumers may replace the whole list with it. */
	error: Error | null
	/** Next-page failure; loaded topics must stay visible and loadMore retries the same page. */
	loadMoreError: Error | null
	displayTopics: Topic[]
	total: number
	isLoading: boolean
	isReloading: boolean
	/** 是否还有更多话题可加载 */
	hasMore: boolean
	/** 当前已加载到第几页 */
	currentPage: number
	/** 加载下一页话题，供 InfiniteScroll 调用 */
	loadMore: () => Promise<void>
	reload: () => void
	reset: () => void
}

function getNormalizedStoreTopics(projectId: string, storeTopics: Topic[]) {
	if (!projectId) return []

	return storeTopics
		.filter((topic) => topic.project_id === projectId)
		.map(normalizeTopicHistoryItem)
}

function getTopicHistoryCache(projectId: string): TopicHistorySessionCacheValue | null {
	if (typeof window === "undefined" || !projectId) return null

	try {
		const rawValue = window.sessionStorage.getItem(TOPIC_HISTORY_SESSION_STORAGE_KEY)
		if (!rawValue) return null

		const parsedValue = JSON.parse(rawValue) as Record<string, TopicHistorySessionCacheValue>
		const cacheValue = parsedValue[projectId]
		if (!cacheValue) return null

		return {
			total: Number(cacheValue.total) || 0,
			topics: Array.isArray(cacheValue.topics)
				? cacheValue.topics.map(normalizeTopicHistoryItem)
				: [],
		}
	} catch {
		return null
	}
}

/**
 * 合并侧栏接口返回的一行与 store 中同 id 话题：默认 store 覆盖 remote（mergeTopic 即时生效）；
 * 当远端 `updated_at` 更新时整行以接口为准，避免父组件尚未带上最新 store 时陈旧 props 盖住刚拉取的数据。
 */
function mergeSidebarTopicWithStore(remoteTopic: Topic, storeTopic: Topic): Topic {
	const remoteMs = Date.parse(remoteTopic.updated_at)
	const storeMs = Date.parse(storeTopic.updated_at)
	const preferRemote = Number.isFinite(remoteMs) && Number.isFinite(storeMs) && remoteMs > storeMs

	if (preferRemote) {
		return { ...storeTopic, ...remoteTopic }
	}
	return { ...remoteTopic, ...storeTopic }
}

function setTopicHistoryCache(projectId: string, value: TopicHistorySessionCacheValue) {
	if (typeof window === "undefined" || !projectId) return

	try {
		const rawValue = window.sessionStorage.getItem(TOPIC_HISTORY_SESSION_STORAGE_KEY)
		const parsedValue = rawValue
			? (JSON.parse(rawValue) as Record<string, TopicHistorySessionCacheValue>)
			: {}

		parsedValue[projectId] = value
		window.sessionStorage.setItem(
			TOPIC_HISTORY_SESSION_STORAGE_KEY,
			JSON.stringify(parsedValue),
		)
	} catch {
		// ignore session storage write failures
	}
}

function usePaginatedTopics({
	enabled = true,
	projectId,
	selectedTopicId,
	storeTopics,
	pageSize = DEFAULT_PAGE_SIZE,
	topicService,
	searchKeyword = "",
	topicType = "all",
}: UsePaginatedTopicsOptions): UsePaginatedTopicsResult {
	const isFiltered = topicType !== "all"
	// Unfiltered legacy cache is only valid for the all-types query.
	const cacheKey = isFiltered ? JSON.stringify([projectId, topicType]) : projectId
	const queryIdentity = JSON.stringify([projectId, searchKeyword, topicType])
	const [resultIdentity, setResultIdentity] = useState(queryIdentity)
	const [error, setError] = useState<Error | null>(null)
	const [loadMoreError, setLoadMoreError] = useState<Error | null>(null)
	const enabledRef = useRef(enabled)
	enabledRef.current = enabled
	const requestGeneration = useRef(0)
	const resumePendingRef = useRef(false)
	const lastQueryRef = useRef<string | null>(null)
	const projectIdRef = useRef(projectId)
	projectIdRef.current = projectId

	const selectedTopicIdRef = useRef(selectedTopicId)
	selectedTopicIdRef.current = selectedTopicId

	const searchKeywordRef = useRef(searchKeyword)
	searchKeywordRef.current = searchKeyword

	const topicServiceRef = useRef(topicService)
	topicServiceRef.current = topicService

	const injectedTopicIdsRef = useRef<Set<string>>(new Set())
	// Track all topic IDs ever seen in storeTopics to distinguish "deleted" from "not yet in store"
	const knownStoreTopicIdsRef = useRef<Set<string>>(new Set())
	const normalizedStoreTopics = useMemo(
		() => (isFiltered ? [] : getNormalizedStoreTopics(projectId, storeTopics)),
		[projectId, storeTopics, isFiltered],
	)
	const initialCacheValue =
		!searchKeyword.trim() && projectId ? getTopicHistoryCache(cacheKey) : null
	const initialTopics = initialCacheValue?.topics ?? normalizedStoreTopics
	const [total, setTotal] = useState(initialCacheValue?.total ?? initialTopics.length)
	const [remoteTopics, setRemoteTopics] = useState<Topic[]>(initialTopics)
	const remoteTopicsRef = useRef(remoteTopics)
	remoteTopicsRef.current = remoteTopics
	const [isLoading, setIsLoading] = useState(
		Boolean(projectId) && !initialCacheValue && initialTopics.length === 0,
	)
	const [isReloading, setIsReloading] = useState(false)
	const [reloadSeed, setReloadSeed] = useState(0)
	// 当前已成功加载到第几页（1 为初始页）
	const [currentPage, setCurrentPage] = useState(1)
	// 是否正在加载更多（加载页 2+），避免与初始加载的 isLoading 混淆
	const [isLoadingMore, setIsLoadingMore] = useState(false)

	const getService = useCallback(() => topicServiceRef.current || SuperMagicService.topic, [])

	useEffect(() => {
		storeTopics.forEach((t) => knownStoreTopicIdsRef.current.add(t.id))
	}, [storeTopics])

	useEffect(() => {
		if (!enabled) {
			resumePendingRef.current = true
			return
		}
		// 同查询恢复时保留当前列表及滚动节点；首次加载、换项目和改搜索仍走原缓存路径。
		if (resumePendingRef.current && lastQueryRef.current === queryIdentity) return
		if (!projectId) {
			setRemoteTopics([])
			setTotal(0)
			setIsLoading(false)
			return
		}

		if (searchKeyword.trim()) return

		const cachedValue = getTopicHistoryCache(cacheKey)
		if (!cachedValue) {
			if (normalizedStoreTopics.length > 0) {
				setRemoteTopics(normalizedStoreTopics)
				setTotal(normalizedStoreTopics.length)
				setIsLoading(false)
				return
			}

			setRemoteTopics([])
			setTotal(0)
			setIsLoading(true)
			return
		}

		setRemoteTopics(cachedValue.topics)
		setTotal(cachedValue.total)
		setIsLoading(false)
	}, [normalizedStoreTopics, projectId, searchKeyword, enabled, cacheKey, queryIdentity])

	useEffect(() => {
		requestGeneration.current += 1
		if (!enabled) return
		let isActive = true
		setError(null)
		setLoadMoreError(null)
		setCurrentPage(1)
		setIsLoadingMore(false)

		async function loadTopics() {
			const currentProjectId = projectIdRef.current
			if (!currentProjectId) {
				if (!isActive) return
				setResultIdentity(queryIdentity)
				setRemoteTopics([])
				setTotal(0)
				setIsLoading(false)
				setIsReloading(false)
				return
			}

			const hasSearchKeyword = Boolean(searchKeywordRef.current.trim())
			const cachedValue = hasSearchKeyword ? null : getTopicHistoryCache(cacheKey)
			const storeTopicFallback =
				hasSearchKeyword || isFiltered
					? []
					: getNormalizedStoreTopics(currentProjectId, storeTopics)

			const queryKey = queryIdentity
			const hasRetainedResults =
				resumePendingRef.current &&
				lastQueryRef.current === queryKey &&
				remoteTopicsRef.current.length > 0
			resumePendingRef.current = false
			lastQueryRef.current = queryKey
			if (!cachedValue && storeTopicFallback.length === 0 && !hasRetainedResults)
				setIsLoading(true)
			const service = getService()

			try {
				const response = await service.getSidebarTopicsByProjectId({
					projectId: currentProjectId,
					page: 1,
					pageSize,
					searchKeyword: searchKeywordRef.current,
					topicType,
				})

				if (!isActive) return
				let list = Array.isArray(response.list) ? response.list : []
				injectedTopicIdsRef.current.clear()

				const currentSelectedId = selectedTopicIdRef.current
				if (
					!isFiltered &&
					!hasSearchKeyword &&
					currentSelectedId &&
					!list.some((topic) => topic.id === currentSelectedId)
				) {
					try {
						const detail = await service.getTopicDetail(currentSelectedId)
						if (!isActive) return
						if (detail) {
							const normalizedDetail = normalizeTopicHistoryItem(detail)
							injectedTopicIdsRef.current.add(normalizedDetail.id)
							list = [normalizedDetail, ...list]
						}
					} catch {
						// selected topic may have been deleted, ignore
					}
				}

				if (!isActive) return
				if (!hasSearchKeyword) {
					setTopicHistoryCache(cacheKey, {
						total: response.total,
						topics: list,
					})
				}

				if (!isActive) return
				setResultIdentity(queryIdentity)
				setRemoteTopics(list)
				setTotal(response.total)
			} catch (error) {
				if (!isActive) return
				setResultIdentity(queryIdentity)
				setError(error instanceof Error ? error : new Error("Topic request failed"))
				console.error("获取历史话题列表失败:", error)
				if (!cachedValue) {
					setRemoteTopics(storeTopicFallback)
					setTotal(storeTopicFallback.length)
				}
			} finally {
				if (isActive) {
					setIsLoading(false)
					setIsReloading(false)
				}
			}
		}

		void loadTopics()

		return () => {
			isActive = false
		}
	}, [
		getService,
		pageSize,
		projectId,
		reloadSeed,
		searchKeyword,
		selectedTopicId,
		storeTopics,
		enabled,
		topicType,
		isFiltered,
		cacheKey,
		queryIdentity,
	])

	const { displayTopics, resolvedTotal } = useMemo(() => {
		if (resultIdentity !== queryIdentity) return { displayTopics: [], resolvedTotal: 0 }
		if (remoteTopics.length === 0) {
			return {
				displayTopics:
					isFiltered || searchKeyword.trim() || storeTopics.length === 0
						? []
						: storeTopics.map(normalizeTopicHistoryItem),
				resolvedTotal:
					isFiltered || searchKeyword.trim() || storeTopics.length === 0
						? total
						: total || storeTopics.length,
			}
		}

		const storeTopicMap = new Map(storeTopics.map((topic) => [topic.id, topic]))
		const mergedRemoteTopics: Topic[] = []

		remoteTopics.forEach((topic) => {
			const storeTopic = storeTopicMap.get(topic.id)
			if (storeTopic) {
				mergedRemoteTopics.push(
					normalizeTopicHistoryItem(mergeSidebarTopicWithStore(topic, storeTopic)),
				)
				return
			}
			// Topic was previously in store but now removed → deleted
			if (!isFiltered && knownStoreTopicIdsRef.current.has(topic.id)) return
			mergedRemoteTopics.push(normalizeTopicHistoryItem(topic))
		})

		return {
			displayTopics: mergedRemoteTopics,
			resolvedTotal: Math.max(total, mergedRemoteTopics.length),
		}
	}, [remoteTopics, searchKeyword, storeTopics, total, isFiltered, resultIdentity, queryIdentity])

	const reload = useCallback(() => {
		if (!enabledRef.current) return
		setIsReloading(true)
		// 重置到第 1 页后触发重新加载
		setCurrentPage(1)
		setReloadSeed((previousValue) => previousValue + 1)
	}, [])

	const reset = useCallback(() => {
		injectedTopicIdsRef.current.clear()
		setRemoteTopics([])
		setTotal(0)
		setCurrentPage(1)
	}, [])

	/**
	 * 加载下一页话题并追加到现有列表，供 InfiniteScroll 回调使用。
	 * 搜索态下禁止加载更多，保持一次性全量搜索行为。
	 */
	const loadMore = useCallback(async () => {
		if (!enabledRef.current || !projectId || isLoading || isLoadingMore || searchKeyword.trim())
			return
		const generation = requestGeneration.current
		const nextPage = currentPage + 1
		setIsLoadingMore(true)
		setLoadMoreError(null)

		try {
			const service = getService()
			const response = await service.getSidebarTopicsByProjectId({
				projectId,
				page: nextPage,
				pageSize,
				searchKeyword: "",
				topicType,
			})
			if (!enabledRef.current || generation !== requestGeneration.current) return
			const newTopics = (Array.isArray(response.list) ? response.list : []).map(
				normalizeTopicHistoryItem,
			)
			setRemoteTopics((prev) => {
				const existing = new Set(prev.map((topic) => topic.id))
				return [...prev, ...newTopics.filter((topic) => !existing.has(topic.id))]
			})
			setTotal(response.total)
			setCurrentPage(nextPage)
		} catch (error) {
			if (generation === requestGeneration.current)
				setLoadMoreError(error instanceof Error ? error : new Error("Topic request failed"))
			console.error("加载更多话题失败:", error)
		} finally {
			if (generation === requestGeneration.current) setIsLoadingMore(false)
		}
	}, [
		projectId,
		isLoading,
		isLoadingMore,
		searchKeyword,
		currentPage,
		pageSize,
		getService,
		topicType,
	])

	// 是否还有更多话题：远端 total 大于当前已加载的 remoteTopics 数量
	const hasMore =
		!error &&
		resultIdentity === queryIdentity &&
		!searchKeyword.trim() &&
		remoteTopics.length < resolvedTotal

	return {
		error,
		loadMoreError,
		displayTopics,
		total: resolvedTotal,
		isLoading: isLoading || (enabled && resultIdentity !== queryIdentity),
		isReloading,
		hasMore,
		currentPage,
		loadMore,
		reload,
		reset,
	}
}

export default usePaginatedTopics
export type { UsePaginatedTopicsOptions, UsePaginatedTopicsResult }
