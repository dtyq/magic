import { useState, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { ExampleItem, TopicExamplesList } from "../types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { env, isDev } from "@/utils/env"

// Global cache for all examples (singleton pattern)
let cachedExampleList: TopicExamplesList | null = null
let fetchPromise: Promise<TopicExamplesList> | null = null

interface UseTopicExamplesOptions {
	topicMode: TopicMode
	count?: number
	enabled?: boolean
}

interface UseTopicExamplesReturn {
	exampleList: ExampleItem[]
	refreshExamples: () => void
	rotationCount: number
	loading: boolean
	allExampleList: TopicExamplesList | null
}

/**
 * Fetch and manage topic examples data
 * Data is fetched once globally and cached
 */
export function useTopicExamples({
	topicMode,
	count = 5,
	enabled = true,
}: UseTopicExamplesOptions): UseTopicExamplesReturn {
	const [allExampleList, setAllExampleList] = useState<TopicExamplesList | null>(
		cachedExampleList,
	)
	const [exampleList, setExampleList] = useState<ExampleItem[]>([])
	const [rotationCount, setRotationCount] = useState<number>(1)
	const [loading, setLoading] = useState(!cachedExampleList)

	// Fetch topic examples from CDN (only once globally)
	const fetchTopicExamples = useMemoizedFn(async (): Promise<TopicExamplesList> => {
		// Return cached data if available
		if (cachedExampleList) {
			return cachedExampleList
		}

		// Return existing promise if fetch is in progress
		if (fetchPromise) {
			return fetchPromise
		}

		// Use proxy path in development to avoid CORS issues
		const apiUrl = isDev
			? `/api/cdn/cases/new_task_example.json?t=${Date.now()}`
			: `${env("MAGIC_PUBLIC_CDN_URL")}/cases/new_task_example.json?t=${Date.now()}`

		// Create new fetch promise
		fetchPromise = fetch(apiUrl)
			.then((res) => res.json())
			.then((data) => {
				cachedExampleList = data
				return data
			})
			.finally(() => {
				fetchPromise = null
			})

		return fetchPromise
	})

	// Randomly select examples based on mode and count
	const getRandomExamples = useMemoizedFn(
		(mode: TopicMode, selectedCount: number): ExampleItem[] => {
			if (!allExampleList?.[mode]) {
				return []
			}

			const currentIds = new Set(exampleList.map((item) => item.id))
			const modeExamples = allExampleList[mode]

			// Create array of all available indexes
			const allIndexes = modeExamples.map((_, index) => index)

			// Filter out indexes with different IDs
			const availableIndexes = allIndexes.filter((index) => !currentIds.has(index))

			// Use all indexes if not enough unique ones available
			const sourceIndexes =
				availableIndexes.length >= selectedCount ? availableIndexes : allIndexes

			// Shuffle and select required count
			const shuffled = [...sourceIndexes].sort(() => Math.random() - 0.5)
			const selectedIndexes = shuffled.slice(0, selectedCount)

			// Shuffle again and construct result
			return selectedIndexes
				.sort(() => Math.random() - 0.5)
				.map((index) => ({
					...modeExamples[index],
					id: index,
				})) as ExampleItem[]
		},
	)

	// Refresh examples with rotation animation
	const refreshExamples = useMemoizedFn(() => {
		setRotationCount((prev) => prev + 1)

		const newExamples = getRandomExamples(topicMode, count)
		setExampleList(newExamples)
	})

	// Load data on mount
	useEffect(() => {
		if (!enabled) return

		if (cachedExampleList) {
			setAllExampleList(cachedExampleList)
			setLoading(false)
		} else {
			setLoading(true)
			fetchTopicExamples().then((data) => {
				setAllExampleList(data)
				setLoading(false)
			})
		}
	}, [enabled, fetchTopicExamples])

	// Auto-refresh when topicMode or allExampleList changes
	useEffect(() => {
		if (!enabled || !allExampleList) return

		// Clear list for Chat and RecordSummary modes
		if ([TopicMode.Chat, TopicMode.RecordSummary].includes(topicMode)) {
			setExampleList([])
		} else {
			const newExamples = getRandomExamples(topicMode, count)
			setExampleList(newExamples)
		}
	}, [topicMode, allExampleList, enabled, count, getRandomExamples])

	return {
		exampleList,
		refreshExamples,
		rotationCount,
		loading,
		allExampleList,
	}
}
