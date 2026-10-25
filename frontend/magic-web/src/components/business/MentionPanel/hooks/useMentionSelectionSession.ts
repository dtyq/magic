import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MentionItem, MentionPanelMultiSelectNavigationPolicy, NavigationItem } from "../types"
import {
	getMentionItemSelectionKey,
	getPendingSourceRootId,
	getSubmittablePendingEntries,
	type PendingMentionEntry,
} from "../utils/multiSelect"

export interface MentionPendingPreparation {
	canSelect: boolean
	mcpValidated?: boolean
}

export interface UseMentionSelectionSessionOptions {
	enabled: boolean
	canToggleItem: (item: MentionItem) => boolean
	navigationStack: NavigationItem[]
	/** 当前浏览上下文的稳定签名；目录、状态或搜索上下文变化时应更新。 */
	navigationKey?: string
	navigationPolicy: MentionPanelMultiSelectNavigationPolicy
	scopeId?: string
	getSelectionKey?: (item: MentionItem) => string
	prepareItem?: (
		item: MentionItem,
	) => MentionPendingPreparation | Promise<MentionPendingPreparation>
}

export interface UseMentionSelectionSessionReturn {
	multiSelectMode: boolean
	pendingByKey: Map<string, PendingMentionEntry>
	pendingEntries: PendingMentionEntry[]
	submittablePendingEntries: PendingMentionEntry[]
	enterMultiSelectMode: () => void
	leaveMultiSelectMode: () => void
	togglePendingForItem: (item: MentionItem) => Promise<boolean>
	removePendingKey: (key: string) => void
	isPending: (item: MentionItem) => boolean
	clearPendingItems: () => void
	clearForNavigation: (options?: { exitMode?: boolean }) => void
	reset: () => void
}

const defaultPrepareItem = async (): Promise<MentionPendingPreparation> => ({
	canSelect: true,
})

/**
 * Owns the temporary selection session independently from directory navigation.
 * A folder is only a view; the scope identifies the resource set that can be
 * submitted together. This keeps desktop and mobile selection semantics aligned.
 */
export function useMentionSelectionSession({
	enabled,
	canToggleItem,
	navigationStack,
	navigationKey,
	navigationPolicy,
	scopeId,
	getSelectionKey = getMentionItemSelectionKey,
	prepareItem = defaultPrepareItem,
}: UseMentionSelectionSessionOptions): UseMentionSelectionSessionReturn {
	const [multiSelectMode, setMultiSelectMode] = useState(false)
	const [pendingByKey, setPendingByKey] = useState<Map<string, PendingMentionEntry>>(
		() => new Map(),
	)
	const pendingPreparationKeysRef = useRef(new Map<string, number>())
	const preparationRequestIdRef = useRef(0)
	const pendingSessionGenerationRef = useRef(0)
	const activeScopeIdRef = useRef(scopeId)
	const resolvedNavigationKey =
		navigationKey ??
		navigationStack.map((item) => `${item.state}:${item.catalogId ?? ""}:${item.id}`).join("|")
	const previousNavigationKeyRef = useRef(resolvedNavigationKey)

	const invalidatePendingPreparation = useCallback(() => {
		pendingSessionGenerationRef.current += 1
		pendingPreparationKeysRef.current.clear()
	}, [])

	const reset = useCallback(() => {
		invalidatePendingPreparation()
		setMultiSelectMode(false)
		setPendingByKey(new Map())
	}, [invalidatePendingPreparation])

	useEffect(() => {
		if (!enabled) reset()
	}, [enabled, reset])

	useEffect(() => {
		if (activeScopeIdRef.current !== scopeId) {
			reset()
			activeScopeIdRef.current = scopeId
		}
	}, [reset, scopeId])

	useEffect(() => {
		const previousNavigationKey = previousNavigationKeyRef.current
		if (previousNavigationKey !== resolvedNavigationKey) {
			previousNavigationKeyRef.current = resolvedNavigationKey
			// The default clear policy preserves the historical single-directory behavior.
			// Canvas opts into preservation, so its pending items survive folder changes.
			if (navigationPolicy === "clear") {
				invalidatePendingPreparation()
				setPendingByKey(new Map())
			}
		}
	}, [invalidatePendingPreparation, navigationPolicy, resolvedNavigationKey])

	const enterMultiSelectMode = useCallback(() => {
		if (enabled) setMultiSelectMode(true)
	}, [enabled])

	const leaveMultiSelectMode = useCallback(() => {
		setMultiSelectMode(false)
	}, [])

	const clearPendingItems = useCallback(() => {
		invalidatePendingPreparation()
		setPendingByKey(new Map())
	}, [invalidatePendingPreparation])

	const clearForNavigation = useCallback(
		({ exitMode = false }: { exitMode?: boolean } = {}) => {
			if (navigationPolicy !== "clear") return
			clearPendingItems()
			if (exitMode) setMultiSelectMode(false)
		},
		[clearPendingItems, navigationPolicy],
	)

	const removePendingKey = useCallback((key: string) => {
		setPendingByKey((previous) => {
			if (!previous.has(key)) return previous
			const next = new Map(previous)
			next.delete(key)
			return next
		})
	}, [])

	const togglePendingForItem = useCallback(
		async (item: MentionItem) => {
			if (!canToggleItem(item)) return false
			const didScopeChange = activeScopeIdRef.current !== scopeId
			if (didScopeChange) {
				// Scope can change before effects run; clear synchronously so the first
				// click in the new resource domain cannot mix with the previous session.
				reset()
				activeScopeIdRef.current = scopeId
			}

			const key = getSelectionKey(item)
			if (!didScopeChange && pendingByKey.has(key)) {
				removePendingKey(key)
				return true
			}

			// Avoid two concurrent validation requests re-adding the same item after
			// a rapid double click or a slow MCP preparation response.
			if (pendingPreparationKeysRef.current.has(key)) return true
			const preparationRequestId = ++preparationRequestIdRef.current
			pendingPreparationKeysRef.current.set(key, preparationRequestId)
			const preparationGeneration = pendingSessionGenerationRef.current

			try {
				const preparation = await prepareItem(item)
				if (!preparation.canSelect) return true
				// A navigation/scope reset may finish while validation is in flight.
				// Do not let that stale response resurrect a cleared selection.
				if (
					preparationGeneration !== pendingSessionGenerationRef.current ||
					pendingPreparationKeysRef.current.get(key) !== preparationRequestId
				)
					return true

				const sourceRootId = getPendingSourceRootId(navigationStack, item)
				setPendingByKey((previous) => {
					if (previous.has(key)) return previous
					const next = new Map(previous)
					next.set(key, {
						item,
						sourceRootId,
						mcpValidated: preparation.mcpValidated,
					})
					return next
				})
				return true
			} catch {
				return false
			} finally {
				if (pendingPreparationKeysRef.current.get(key) === preparationRequestId) {
					pendingPreparationKeysRef.current.delete(key)
				}
			}
		},
		[
			canToggleItem,
			getSelectionKey,
			navigationStack,
			pendingByKey,
			prepareItem,
			removePendingKey,
			reset,
			scopeId,
		],
	)

	const isPending = useCallback(
		(item: MentionItem) => pendingByKey.has(getSelectionKey(item)),
		[getSelectionKey, pendingByKey],
	)

	const pendingEntries = useMemo(() => Array.from(pendingByKey.values()), [pendingByKey])
	const submittablePendingEntries = useMemo(
		() => getSubmittablePendingEntries(pendingByKey),
		[pendingByKey],
	)

	return {
		multiSelectMode,
		pendingByKey,
		pendingEntries,
		submittablePendingEntries,
		enterMultiSelectMode,
		leaveMultiSelectMode,
		togglePendingForItem,
		removePendingKey,
		isPending,
		clearPendingItems,
		clearForNavigation,
		reset,
	}
}
