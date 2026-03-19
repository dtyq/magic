import { useState, useCallback } from "react"
import type { FileShareItem, ProjectShareItem } from "../types"

type ShareModalItem = FileShareItem | ProjectShareItem

interface UseShareSuccessModalReturn {
	visible: boolean
	currentItem: ShareModalItem | null
	open: (item: ShareModalItem) => void
	close: () => void
}

/**
 * 管理 ShareSuccessModal 的状态
 */
export function useShareSuccessModal(): UseShareSuccessModalReturn {
	const [visible, setVisible] = useState(false)
	const [currentItem, setCurrentItem] = useState<ShareModalItem | null>(null)

	const open = useCallback((item: ShareModalItem) => {
		setCurrentItem(item)
		setVisible(true)
	}, [])

	const close = useCallback(() => {
		setVisible(false)
		setCurrentItem(null)
	}, [])

	return {
		visible,
		currentItem,
		open,
		close,
	}
}
