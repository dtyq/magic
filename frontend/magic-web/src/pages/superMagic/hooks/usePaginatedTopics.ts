import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useScrollLoad from "@/hooks/use-scroll-load"
import type { Topic } from "../pages/Workspace/types"
import type TopicService from "../services/topicService"
import SuperMagicService from "../services"

const DEFAULT_PAGE_SIZE = 20

interface UsePaginatedTopicsOptions {
	projectId: string
	selectedTopicId?: string
	storeTopics: Topic[]
	pageSize?: number
	topicService?: TopicService
}

interface UsePaginatedTopicsResult {
	displayTopics: Topic[]
	total: number
	isLoading: boolean
	hasMore: boolean
	currentPage: number
	onScroll: (element?: HTMLElement) => void
	reload: () => void
	reset: () => void
}

function usePaginatedTopics({
	projectId,
	selectedTopicId,
	storeTopics,
	pageSize = DEFAULT_PAGE_SIZE,
	topicService,
}: UsePaginatedTopicsOptions): UsePaginatedTopicsResult {
	const projectIdRef = useRef(projectId)
	projectIdRef.current = projectId

	const selectedTopicIdRef = useRef(selectedTopicId)
	selectedTopicIdRef.current = selectedTopicId

	const topicServiceRef = useRef(topicService)
	topicServiceRef.current = topicService

	const injectedTopicIdsRef = useRef<Set<string>>(new Set())
	// Track all topic IDs ever seen in storeTopics to distinguish "deleted" from "not yet in store"
	const knownStoreTopicIdsRef = useRef<Set<string>>(new Set())
	const [total, setTotal] = useState(0)

	const getService = useCallback(() => topicServiceRef.current || SuperMagicService.topic, [])

	const loadTopicsFn = useCallback(
		async (params: { page: number; pageSize: number }) => {
			const currentProjectId = projectIdRef.current
			if (!currentProjectId) return { list: [] as Topic[], hasMore: false }

			const service = getService()
			const res = await service.getTopicsByProjectId(
				currentProjectId,
				params.page,
				params.pageSize,
			)

			let list = Array.isArray(res.list) ? res.list : []
			const hasMore = params.page * params.pageSize < res.total
			setTotal(res.total)

			if (params.page === 1) {
				injectedTopicIdsRef.current.clear()

				const currentSelectedId = selectedTopicIdRef.current
				if (currentSelectedId && !list.some((t) => t.id === currentSelectedId)) {
					try {
						const detail = await service.getTopicDetail(currentSelectedId)
						if (detail) {
							injectedTopicIdsRef.current.add(detail.id)
							list = [detail, ...list]
						}
					} catch {
						// selected topic may have been deleted, ignore
					}
				}
			} else if (injectedTopicIdsRef.current.size > 0) {
				list = list.filter((t) => !injectedTopicIdsRef.current.has(t.id))
			}

			return { list, hasMore }
		},
		[getService],
	)

	const {
		data: paginatedTopics,
		loading: isLoading,
		pageInfo,
		onScroll,
		reload,
		reset,
	} = useScrollLoad<Topic>({
		pageSize,
		loadFn: loadTopicsFn,
	})

	useEffect(() => {
		storeTopics.forEach((t) => knownStoreTopicIdsRef.current.add(t.id))
	}, [storeTopics])

	const displayTopics = useMemo(() => {
		if (paginatedTopics.length === 0) return storeTopics
		const storeTopicMap = new Map(storeTopics.map((t) => [t.id, t]))
		return paginatedTopics
			.filter((t) => {
				if (storeTopicMap.has(t.id)) return true
				// Topic was previously in store but now removed → deleted
				if (knownStoreTopicIdsRef.current.has(t.id)) return false
				// Topic from later pages, never in store → keep
				return true
			})
			.map((t) => storeTopicMap.get(t.id) || t)
	}, [paginatedTopics, storeTopics])

	return {
		displayTopics,
		total,
		isLoading,
		hasMore: pageInfo.hasMore,
		currentPage: pageInfo.page,
		onScroll,
		reload,
		reset,
	}
}

export default usePaginatedTopics
export type { UsePaginatedTopicsOptions, UsePaginatedTopicsResult }
