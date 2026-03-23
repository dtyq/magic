import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { MessageGroupKey } from "../types"

interface UseCollapsePanelsParams {
	firstAvailableGroup?: MessageGroupKey
	defaultActiveKeys?: MessageGroupKey[]
}

/**
 * Hook for managing collapse panels state and animation
 */
export function useCollapsePanels({
	firstAvailableGroup,
	defaultActiveKeys = [],
}: UseCollapsePanelsParams) {
	const [activeKeys, setActiveKeys] = useState<string[]>([])
	const [collapseAnimationDisabled, setCollapseAnimationDisabled] = useState(true)
	const [listsReady, setListsReady] = useState(false)

	// Expand default groups after render to reduce initial load
	useEffect(() => {
		if (listsReady) return
		if (!activeKeys.length) {
			const hydrate = () => {
				const nextActiveKeys = defaultActiveKeys.length
					? defaultActiveKeys
					: firstAvailableGroup
						? [firstAvailableGroup]
						: []

				setListsReady(true)
				setActiveKeys(nextActiveKeys)
			}
			if (typeof requestIdleCallback !== "undefined") {
				requestIdleCallback(hydrate)
			} else {
				requestAnimationFrame(hydrate)
			}
		}
	}, [activeKeys.length, defaultActiveKeys, firstAvailableGroup, listsReady])

	// Disable collapse animation on initial render, enable after idle
	useEffect(() => {
		const enable = () => setCollapseAnimationDisabled(false)
		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(enable)
		} else {
			requestAnimationFrame(enable)
		}
	}, [])

	const handleTogglePanel = useMemoizedFn((key: string) => {
		setActiveKeys((prev) => {
			if (prev.includes(key)) {
				return prev.filter((item) => item !== key)
			}
			return [...prev, key]
		})
	})

	return {
		activeKeys,
		collapseAnimationDisabled,
		listsReady,
		handleTogglePanel,
	}
}
