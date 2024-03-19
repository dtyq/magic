import { useState, useCallback } from "react"
import type { TopicShareItem } from "../types"

interface UseTopicSharePopoverReturn {
	open: boolean
	currentItem: TopicShareItem | null
	openPopover: (item: TopicShareItem) => void
	closePopover: () => void
	setOpen: (open: boolean) => void
}

/**
 * 管理 TopicSharePopover 的状态
 */
export function useTopicSharePopover(): UseTopicSharePopoverReturn {
	const [open, setOpen] = useState(false)
	const [currentItem, setCurrentItem] = useState<TopicShareItem | null>(null)

	const openPopover = useCallback((item: TopicShareItem) => {
		setCurrentItem(item)
		setOpen(true)
	}, [])

	const closePopover = useCallback(() => {
		setOpen(false)
		setCurrentItem(null)
	}, [])

	return {
		open,
		currentItem,
		openPopover,
		closePopover,
		setOpen,
	}
}
