import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"

/** 各页面独立的历史话题面板开关偏好（localStorage） */
export const TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS = {
	topicPage: "super-magic.topic-history.open.topic-page",
	skillEdit: "super-magic.topic-history.open.skill-edit",
	crewEdit: "super-magic.topic-history.open.crew-edit",
} as const

interface UseTopicHistoryLayoutStateOptions {
	/** localStorage 键，按页面 scope 区分 */
	storageKey: string
	isEnabled?: boolean
}

interface UseTopicHistoryLayoutStateResult {
	isTopicHistoryPanelOpen: boolean
	openTopicHistoryPanel: () => void
	closeTopicHistoryPanel: () => void
	toggleTopicHistoryPanel: () => void
}

function readOpenFromStorage(key: string): boolean {
	if (typeof window === "undefined") return false
	try {
		return window.localStorage.getItem(key) === "true"
	} catch {
		return false
	}
}

function writeOpenToStorage(key: string, open: boolean) {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(key, open ? "true" : "false")
	} catch {
		// ignore quota / private mode
	}
}

export function useTopicHistoryLayoutState({
	storageKey,
	isEnabled = true,
}: UseTopicHistoryLayoutStateOptions): UseTopicHistoryLayoutStateResult {
	const [isTopicHistoryPanelOpen, setIsTopicHistoryPanelOpen] = useState(() =>
		isEnabled ? readOpenFromStorage(storageKey) : false,
	)

	const isEnabledRef = useRef(isEnabled)
	isEnabledRef.current = isEnabled

	useEffect(() => {
		if (!isEnabled) {
			setIsTopicHistoryPanelOpen(false)
			return
		}
		setIsTopicHistoryPanelOpen(readOpenFromStorage(storageKey))
	}, [isEnabled, storageKey])

	const openTopicHistoryPanel = useMemoizedFn(() => {
		if (!isEnabledRef.current) return
		writeOpenToStorage(storageKey, true)
		setIsTopicHistoryPanelOpen(true)
	})

	const closeTopicHistoryPanel = useMemoizedFn(() => {
		setIsTopicHistoryPanelOpen(false)
		if (isEnabledRef.current) writeOpenToStorage(storageKey, false)
	})

	const toggleTopicHistoryPanel = useMemoizedFn(() => {
		if (!isEnabledRef.current) return
		setIsTopicHistoryPanelOpen((prev) => {
			const next = !prev
			writeOpenToStorage(storageKey, next)
			return next
		})
	})

	return {
		isTopicHistoryPanelOpen,
		openTopicHistoryPanel,
		closeTopicHistoryPanel,
		toggleTopicHistoryPanel,
	}
}
