import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { BatchKey, MessageGroupKey, RenderedLists } from "../types"

const INITIAL_BATCH_SIZE = window.innerHeight / 40
const HYDRATE_BATCH_SIZE = window.innerHeight / 40

interface UseVirtualListParams {
	topGroupList: string[]
	singleGroupList: string[]
	groupGroupList: string[]
	aiGroupList: string[]
	listsReady: boolean
	aiHydrated: boolean
}

/**
 * Hook for managing virtual list rendering with batch loading
 */
export function useVirtualList({
	topGroupList,
	singleGroupList,
	groupGroupList,
	aiGroupList,
	listsReady,
	aiHydrated,
}: UseVirtualListParams) {
	const listMapRef = useRef<Record<BatchKey, string[]>>({
		[MessageGroupKey.Pinned]: [],
		[MessageGroupKey.Single]: [],
		[MessageGroupKey.Group]: [],
		Ai: [],
	})

	const initializedRef = useRef<Record<BatchKey, boolean>>({
		[MessageGroupKey.Pinned]: false,
		[MessageGroupKey.Single]: false,
		[MessageGroupKey.Group]: false,
		Ai: false,
	})

	const [renderedLists, setRenderedLists] = useState<RenderedLists>(listMapRef.current)

	const scheduleHydrate = useMemoizedFn((key: BatchKey) => {
		const list = listMapRef.current[key]
		if (!list?.length) return

		const hydrate = () => {
			let shouldContinue = false
			setRenderedLists((prev) => {
				const currentCount = prev[key]?.length ?? 0
				const latestList = listMapRef.current[key] ?? []
				if (!latestList.length) return prev

				const nextCount = Math.min(currentCount + HYDRATE_BATCH_SIZE, latestList.length)
				shouldContinue = nextCount < latestList.length
				if (nextCount === currentCount) return prev

				return { ...prev, [key]: latestList.slice(0, nextCount) }
			})

			if (shouldContinue) {
				if (typeof requestIdleCallback !== "undefined") {
					requestIdleCallback(hydrate)
				} else {
					requestAnimationFrame(hydrate)
				}
			}
		}

		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(hydrate)
		} else {
			requestAnimationFrame(hydrate)
		}
	})

	useEffect(() => {
		if (!listsReady) return

		const mapping: Record<BatchKey, string[]> = {
			[MessageGroupKey.Pinned]: topGroupList,
			[MessageGroupKey.Single]: singleGroupList,
			[MessageGroupKey.Group]: groupGroupList,
			Ai: aiGroupList,
		}

		// Update list map reference
		listMapRef.current = mapping

		setRenderedLists((prev) => {
			const next: RenderedLists = { ...prev }

			// Process each list
			;(Object.keys(mapping) as BatchKey[]).forEach((key) => {
				const newList = mapping[key]
				const isInitialized = initializedRef.current[key]

				if (key === "Ai" && !aiHydrated) {
					// Keep previous AI list if not hydrated
					return
				}

				if (!isInitialized && newList.length > 0) {
					// First time initialization: start with initial batch
					next[key] = newList.slice(0, INITIAL_BATCH_SIZE)
					initializedRef.current[key] = true
					// Schedule hydration for remaining items
					if (newList.length > INITIAL_BATCH_SIZE) {
						scheduleHydrate(key)
					}
				} else if (isInitialized) {
					// Already initialized: directly update the entire list
					next[key] = newList
				} else {
					// Not initialized and empty: set to empty array
					next[key] = []
				}
			})

			return next
		})
	}, [
		aiGroupList,
		aiHydrated,
		groupGroupList,
		listsReady,
		scheduleHydrate,
		singleGroupList,
		topGroupList,
	])

	return { renderedLists }
}
