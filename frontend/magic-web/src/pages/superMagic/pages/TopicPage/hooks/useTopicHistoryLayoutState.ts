import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { TOPIC_HISTORY_RESIZE } from "../../../constants/resizablePanel"

/** 各页面独立的历史话题面板开关偏好（localStorage） */
export const TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS = {
	topicPage: "super-magic.topic-history.open.topic-page",
	skillEdit: "super-magic.topic-history.open.skill-edit",
	crewEdit: "super-magic.topic-history.open.crew-edit",
	microApp: "super-magic.topic-history.open.micro-app",
} as const

interface UseTopicHistoryLayoutStateOptions {
	/** localStorage 键，按页面 scope 区分 */
	storageKey: string
	isEnabled?: boolean
	/** Disable persistence for temporary embed instances that must start closed. */
	persistOpenState?: boolean
}

interface UseTopicHistoryLayoutStateResult {
	topicHistoryWidth: number
	commitTopicHistoryWidth: (width: number) => void
	isTopicHistoryPanelOpen: boolean
	openTopicHistoryPanel: () => void
	closeTopicHistoryPanel: () => void
	toggleTopicHistoryPanel: () => void
}

export function readOpenFromStorage(key: string): boolean {
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

export function readTopicHistoryWidth(storageKey: string): number {
	try {
		const width = Number(localStorage.getItem(`${storageKey}.width`))
		return Number.isFinite(width) &&
			width >= TOPIC_HISTORY_RESIZE.min &&
			width <= TOPIC_HISTORY_RESIZE.max
			? width
			: TOPIC_HISTORY_RESIZE.default
	} catch {
		return TOPIC_HISTORY_RESIZE.default
	}
}

export function useTopicHistoryLayoutState({
	storageKey,
	isEnabled = true,
	persistOpenState = true,
}: UseTopicHistoryLayoutStateOptions): UseTopicHistoryLayoutStateResult {
	const [topicHistoryWidth, setTopicHistoryWidth] = useState(() =>
		readTopicHistoryWidth(storageKey),
	)
	const commitTopicHistoryWidth = useMemoizedFn((width: number) => {
		if (!Number.isFinite(width) || !isEnabled) return
		const next = Math.max(TOPIC_HISTORY_RESIZE.min, Math.min(TOPIC_HISTORY_RESIZE.max, width))
		setTopicHistoryWidth(next)
		if (persistOpenState) {
			try {
				localStorage.setItem(`${storageKey}.width`, String(next))
			} catch {
				/* Storage can be unavailable. */
			}
		}
	})
	useEffect(() => {
		setTopicHistoryWidth(readTopicHistoryWidth(storageKey))
	}, [storageKey])
	const [isTopicHistoryPanelOpen, setIsTopicHistoryPanelOpen] = useState(() =>
		isEnabled && persistOpenState ? readOpenFromStorage(storageKey) : false,
	)

	const isEnabledRef = useRef(isEnabled)
	isEnabledRef.current = isEnabled

	useEffect(() => {
		if (!isEnabled) {
			setIsTopicHistoryPanelOpen(false)
			return
		}
		setIsTopicHistoryPanelOpen(persistOpenState ? readOpenFromStorage(storageKey) : false)
	}, [isEnabled, persistOpenState, storageKey])

	const openTopicHistoryPanel = useMemoizedFn(() => {
		if (!isEnabledRef.current) return
		if (persistOpenState) writeOpenToStorage(storageKey, true)
		setIsTopicHistoryPanelOpen(true)
	})

	const closeTopicHistoryPanel = useMemoizedFn(() => {
		setIsTopicHistoryPanelOpen(false)
		if (isEnabledRef.current && persistOpenState) writeOpenToStorage(storageKey, false)
	})

	const toggleTopicHistoryPanel = useMemoizedFn(() => {
		if (!isEnabledRef.current) return
		setIsTopicHistoryPanelOpen((prev) => {
			const next = !prev
			if (persistOpenState) writeOpenToStorage(storageKey, next)
			return next
		})
	})

	return {
		topicHistoryWidth,
		commitTopicHistoryWidth,
		isTopicHistoryPanelOpen,
		openTopicHistoryPanel,
		closeTopicHistoryPanel,
		toggleTopicHistoryPanel,
	}
}
