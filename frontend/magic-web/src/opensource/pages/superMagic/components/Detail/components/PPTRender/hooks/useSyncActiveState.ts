import { useEffect } from "react"
import { reaction } from "mobx"
import type { PPTStore } from "../stores/PPTStore"

/**
 * useSyncActiveState
 * Sync active state (index and fileId) to parent component
 * 同步激活状态（索引和文件 ID）到父组件
 */
export const useSyncActiveState = ({
	store,
	onActiveIndexChange,
	isTabActive,
}: {
	store: PPTStore
	onActiveIndexChange?: (index: number, fileId: string) => void
	isTabActive?: boolean
}) => {
	// 当激活索引或文件 ID 变化时通知父组件（用于外部状态同步）
	useEffect(() => {
		const dispose = reaction(
			() => ({ index: store.activeIndex, fileId: store.currentFileId }),
			({ index, fileId }) => {
				onActiveIndexChange?.(index, fileId)
			},
		)
		return dispose
	}, [onActiveIndexChange, store])

	// 当组件被重新激活时（从缓存中恢复显示），重新发送当前状态
	useEffect(() => {
		if (isTabActive && store.currentFileId) {
			onActiveIndexChange?.(store.activeIndex, store.currentFileId)
		}
		// 只在 isActive 变化时触发，避免与 reaction 重复
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isTabActive])
}
