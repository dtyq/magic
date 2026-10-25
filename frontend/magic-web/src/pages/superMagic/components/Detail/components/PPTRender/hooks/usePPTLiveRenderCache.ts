import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { SlideItem } from "../PPTSidebar/types"
import { usePPTSlideTransition, type PPTSlideTransitionOptions } from "./usePPTSlideTransition"

export interface LiveRenderSlide {
	slide: SlideItem
	index: number
	key: string
	revision: string
}

interface ReconcileResidentSlideKeysOptions {
	previousKeys: string[]
	availableKeys: Set<string>
	activeKey: string | null
	presentedKey: string | null
	neighborKeys: string[]
	pinnedKeys: string[]
	recentKeys: string[]
	capacity: number
}

interface UsePPTLiveRenderCacheOptions {
	slides: SlideItem[]
	activeIndex: number
	capacity: number
	neighborRadius: number
	scopeKey?: string
	pinnedKeys?: string[]
	transition?: PPTSlideTransitionOptions
}

interface UsePPTLiveRenderCacheResult {
	residentSlides: LiveRenderSlide[]
	presentedKey: string | null
	pendingKey: string | null
	warmSlideIndices: number[]
	onSlideReadyChange: (key: string, revision: string, ready: boolean) => void
	transitionState: ReturnType<typeof usePPTSlideTransition>["transitionState"]
	registerTransitionLayer: (key: string, element: HTMLDivElement | null) => void
}

function appendUnique(target: string[], values: Array<string | null | undefined>): void {
	values.forEach((value) => {
		if (value && !target.includes(value)) target.push(value)
	})
}

export function getLiveRenderSlideKey(slide: SlideItem): string {
	return `${slide.path || "missing-path"}::${slide.id || "missing-id"}`
}

/**
 * A revision change means the existing iframe no longer represents the current slide content.
 * lastLoadedAt is updated by every visual load/refresh/save path. Raw source changes that only
 * update inert slide metadata (for example speaker notes) must not invalidate the live iframe.
 */
export function getLiveRenderSlideRevision(slide: SlideItem): string {
	return [
		slide.path,
		slide.loadingState || "idle",
		slide.lastLoadedAt || 0,
		slide.content?.length || 0,
	].join(":")
}

/** Source revisions update cached component props without remounting the iframe. */
export function getLiveRenderSlideSourceRevision(slide: SlideItem): string {
	return `${getLiveRenderSlideRevision(slide)}:${slide.rawRevision || 0}`
}

/**
 * Reconcile a bounded resident set while preserving the DOM order of retained iframe nodes.
 * During a cold transition the old presented page is pinned until the target is ready, so the
 * result may temporarily exceed the configured capacity by one entry.
 */
export function reconcileResidentSlideKeys({
	previousKeys,
	availableKeys,
	activeKey,
	presentedKey,
	neighborKeys,
	pinnedKeys,
	recentKeys,
	capacity,
}: ReconcileResidentSlideKeysOptions): string[] {
	const protectedKeys: string[] = []
	appendUnique(protectedKeys, [presentedKey, activeKey, ...pinnedKeys])
	const validProtectedKeys = protectedKeys.filter((key) => availableKeys.has(key))
	const isColdTransition = Boolean(presentedKey && activeKey && presentedKey !== activeKey)
	const targetCapacity = Math.max(
		1,
		Math.floor(capacity) + (isColdTransition ? 1 : 0),
		validProtectedKeys.length,
	)

	const prioritizedKeys = [...validProtectedKeys]
	appendUnique(prioritizedKeys, neighborKeys)
	appendUnique(prioritizedKeys, recentKeys)
	appendUnique(prioritizedKeys, previousKeys)

	const selectedKeys = prioritizedKeys
		.filter((key) => availableKeys.has(key))
		.slice(0, targetCapacity)
	const selectedKeySet = new Set(selectedKeys)

	// Keeping retained keys in their existing order prevents React from moving live iframe DOM nodes.
	const nextKeys = previousKeys.filter((key) => selectedKeySet.has(key))
	appendUnique(nextKeys, selectedKeys)
	return nextKeys
}

function arraysEqual(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Keeps a small, keyed set of real slide renderers mounted. Cached slides preserve their iframe
 * browsing context; cold targets render hidden and replace the previous page only after ready.
 */
export function usePPTLiveRenderCache({
	slides,
	activeIndex,
	capacity,
	neighborRadius,
	scopeKey = "default",
	pinnedKeys = [],
	transition,
}: UsePPTLiveRenderCacheOptions): UsePPTLiveRenderCacheResult {
	const getScopedKey = (slide: SlideItem) => `${scopeKey}::${getLiveRenderSlideKey(slide)}`
	const entriesSignature = slides
		.map((slide) => `${getScopedKey(slide)}@${getLiveRenderSlideSourceRevision(slide)}`)
		.join("|")
	const entriesCacheRef = useRef<{ signature: string; entries: LiveRenderSlide[] } | null>(null)
	if (!entriesCacheRef.current || entriesCacheRef.current.signature !== entriesSignature) {
		entriesCacheRef.current = {
			signature: entriesSignature,
			entries: slides.map<LiveRenderSlide>((slide, index) => ({
				slide,
				index,
				key: getScopedKey(slide),
				revision: getLiveRenderSlideRevision(slide),
			})),
		}
	} else {
		entriesCacheRef.current.entries.forEach((entry, index) => {
			entry.slide = slides[index]
			entry.index = index
		})
	}
	const entries = entriesCacheRef.current.entries
	const entriesByKey = useMemo(
		() => new Map(entries.map((entry) => [entry.key, entry])),
		[entries],
	)
	const activeEntry = entries[activeIndex]
	const activeKey = activeEntry?.key || null
	const neighborEntries = useMemo(() => {
		const result: LiveRenderSlide[] = []
		for (let distance = 1; distance <= neighborRadius; distance++) {
			const nextEntry = entries[activeIndex + distance]
			const previousEntry = entries[activeIndex - distance]
			if (nextEntry) result.push(nextEntry)
			if (previousEntry) result.push(previousEntry)
		}
		return result
	}, [activeIndex, entries, neighborRadius])
	const neighborKeys = useMemo(() => neighborEntries.map((entry) => entry.key), [neighborEntries])
	const warmSlideIndices = useMemo(
		() => neighborEntries.map((entry) => entry.index),
		[neighborEntries],
	)
	const [residentKeys, setResidentKeys] = useState<string[]>([])
	const [readyVersion, setReadyVersion] = useState(0)
	const readyRevisionByKeyRef = useRef(new Map<string, string>())
	const recentKeysRef = useRef<string[]>([])
	const entriesByKeyRef = useRef(entriesByKey)
	const residentKeysRef = useRef(residentKeys)

	entriesByKeyRef.current = entriesByKey
	residentKeysRef.current = residentKeys
	const { presentedKey, transitionState, registerTransitionLayer } = usePPTSlideTransition({
		activeEntry,
		entriesByKey,
		readyRevisionByKey: readyRevisionByKeyRef.current,
		readyVersion,
		transition,
	})

	useLayoutEffect(() => {
		const availableKeys = new Set(entriesByKey.keys())

		readyRevisionByKeyRef.current.forEach((revision, key) => {
			const entry = entriesByKey.get(key)
			if (!entry || entry.revision !== revision) {
				readyRevisionByKeyRef.current.delete(key)
			}
		})

		if (activeKey) {
			recentKeysRef.current = [
				activeKey,
				...recentKeysRef.current.filter(
					(key) => key !== activeKey && availableKeys.has(key),
				),
			]
		}

		const nextResidentKeys = reconcileResidentSlideKeys({
			previousKeys: residentKeys,
			availableKeys,
			activeKey,
			// Cancellation settles to incoming before paint; do not pin three pages at capacity one.
			presentedKey:
				transitionState && activeKey !== transitionState.incomingKey
					? transitionState.incomingKey
					: presentedKey && availableKeys.has(presentedKey)
						? presentedKey
						: activeKey,
			neighborKeys,
			// At most one animation incoming page is protected during a superseding navigation.
			pinnedKeys: [
				...pinnedKeys.map((key) => `${scopeKey}::${key}`),
				...(transitionState ? [transitionState.incomingKey] : []),
			],
			recentKeys: recentKeysRef.current,
			capacity,
		})
		const nextResidentKeySet = new Set(nextResidentKeys)
		readyRevisionByKeyRef.current.forEach((_revision, key) => {
			if (!nextResidentKeySet.has(key)) readyRevisionByKeyRef.current.delete(key)
		})

		if (!arraysEqual(nextResidentKeys, residentKeys)) setResidentKeys(nextResidentKeys)
	}, [
		activeEntry,
		activeKey,
		capacity,
		entriesByKey,
		neighborKeys,
		pinnedKeys,
		presentedKey,
		residentKeys,
		scopeKey,
		transitionState,
	])

	const onSlideReadyChange = useCallback((key: string, revision: string, ready: boolean) => {
		const currentEntry = entriesByKeyRef.current.get(key)
		if (
			!currentEntry ||
			currentEntry.revision !== revision ||
			!residentKeysRef.current.includes(key)
		) {
			return
		}

		if (!ready) {
			if (readyRevisionByKeyRef.current.delete(key)) setReadyVersion((version) => version + 1)
			return
		}

		if (readyRevisionByKeyRef.current.get(key) === revision) return
		readyRevisionByKeyRef.current.set(key, revision)
		setReadyVersion((version) => version + 1)
	}, [])

	return {
		residentSlides: residentKeys
			.map((key) => entriesByKey.get(key))
			.filter((entry): entry is LiveRenderSlide => Boolean(entry)),
		presentedKey,
		pendingKey: activeKey && activeKey !== presentedKey ? activeKey : null,
		warmSlideIndices,
		onSlideReadyChange,
		transitionState,
		registerTransitionLayer,
	}
}
