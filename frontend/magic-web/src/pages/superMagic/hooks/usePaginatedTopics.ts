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
	projectId: string
	selectedTopicId?: string
	storeTopics: Topic[]
	pageSize?: number
	topicService?: TopicService
	searchKeyword?: string
}

interface UsePaginatedTopicsResult {
	displayTopics: Topic[]
	total: number
	isLoading: boolean
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
	projectId,
	selectedTopicId,
	storeTopics,
	pageSize = DEFAULT_PAGE_SIZE,
	topicService,
	searchKeyword = "",
}: UsePaginatedTopicsOptions): UsePaginatedTopicsResult {
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
		() => getNormalizedStoreTopics(projectId, storeTopics),
		[projectId, storeTopics],
	)
	const initialCacheValue =
		!searchKeyword.trim() && projectId ? getTopicHistoryCache(projectId) : null
	const initialTopics = initialCacheValue?.topics ?? normalizedStoreTopics
	const [total, setTotal] = useState(initialCacheValue?.total ?? initialTopics.length)
	const [remoteTopics, setRemoteTopics] = useState<Topic[]>(initialTopics)
	const [isLoading, setIsLoading] = useState(
		Boolean(projectId) && !initialCacheValue && initialTopics.length === 0,
	)
	const [reloadSeed, setReloadSeed] = useState(0)

	const getService = useCallback(() => topicServiceRef.current || SuperMagicService.topic, [])

	useEffect(() => {
		storeTopics.forEach((t) => knownStoreTopicIdsRef.current.add(t.id))
	}, [storeTopics])

	useEffect(() => {
		if (!projectId) {
			setRemoteTopics([])
			setTotal(0)
			setIsLoading(false)
			return
		}

		if (searchKeyword.trim()) return

		const cachedValue = getTopicHistoryCache(projectId)
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
	}, [normalizedStoreTopics, projectId, searchKeyword])

	useEffect(() => {
		let isActive = true

		async function loadTopics() {
			const currentProjectId = projectIdRef.current
			if (!currentProjectId) {
				if (!isActive) return
				setRemoteTopics([])
				setTotal(0)
				setIsLoading(false)
				return
			}

			const hasSearchKeyword = Boolean(searchKeywordRef.current.trim())
			const cachedValue = hasSearchKeyword ? null : getTopicHistoryCache(currentProjectId)
			const storeTopicFallback = hasSearchKeyword
				? []
				: getNormalizedStoreTopics(currentProjectId, storeTopics)

			if (!cachedValue && storeTopicFallback.length === 0) setIsLoading(true)
			const service = getService()

			try {
				const response = await service.getSidebarTopicsByProjectId({
					projectId: currentProjectId,
					page: 1,
					pageSize,
					searchKeyword: searchKeywordRef.current,
				})

				let list = Array.isArray(response.list) ? response.list : []
				injectedTopicIdsRef.current.clear()

				const currentSelectedId = selectedTopicIdRef.current
				if (currentSelectedId && !list.some((topic) => topic.id === currentSelectedId)) {
					try {
						const detail = await service.getTopicDetail(currentSelectedId)
						if (detail) {
							const normalizedDetail = normalizeTopicHistoryItem(detail)
							injectedTopicIdsRef.current.add(normalizedDetail.id)
							list = [normalizedDetail, ...list]
						}
					} catch {
						// selected topic may have been deleted, ignore
					}
				}

				if (!hasSearchKeyword) {
					setTopicHistoryCache(currentProjectId, {
						total: response.total,
						topics: list,
					})
				}

				if (!isActive) return
				setRemoteTopics(list)
				setTotal(response.total)
			} catch (error) {
				if (!isActive) return
				console.error("获取历史话题列表失败:", error)
				if (!cachedValue) {
					setRemoteTopics(storeTopicFallback)
					setTotal(storeTopicFallback.length)
				}
			} finally {
				if (isActive) setIsLoading(false)
			}
		}

		void loadTopics()

		return () => {
			isActive = false
		}
	}, [getService, pageSize, projectId, reloadSeed, searchKeyword, selectedTopicId, storeTopics])

	const { displayTopics, resolvedTotal } = useMemo(() => {
		if (remoteTopics.length === 0) {
			return {
				displayTopics:
					searchKeyword.trim() || storeTopics.length === 0
						? []
						: storeTopics.map(normalizeTopicHistoryItem),
				resolvedTotal:
					searchKeyword.trim() || storeTopics.length === 0
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
			if (knownStoreTopicIdsRef.current.has(topic.id)) return
			mergedRemoteTopics.push(normalizeTopicHistoryItem(topic))
		})

		return {
			displayTopics: mergedRemoteTopics,
			resolvedTotal: Math.max(total, mergedRemoteTopics.length),
		}
	}, [remoteTopics, searchKeyword, storeTopics, total])

	const reload = useCallback(() => {
		setReloadSeed((previousValue) => previousValue + 1)
	}, [])

	const reset = useCallback(() => {
		injectedTopicIdsRef.current.clear()
		setRemoteTopics([])
		setTotal(0)
	}, [])

	return {
		displayTopics,
		total: resolvedTotal,
		isLoading,
		reload,
		reset,
	}
}

export default usePaginatedTopics
export type { UsePaginatedTopicsOptions, UsePaginatedTopicsResult }
