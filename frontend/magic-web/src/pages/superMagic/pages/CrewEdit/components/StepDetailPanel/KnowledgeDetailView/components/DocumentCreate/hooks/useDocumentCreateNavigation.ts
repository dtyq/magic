import { useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import type { DocumentCreateStore } from "../store"
import type { DocumentCreateNavigation } from "../types"

interface UseDocumentCreateNavigationParams {
	store: DocumentCreateStore
	onComplete?: () => void
	onCancel?: () => void
}

/**
 * Hook: 管理 DocumentCreate 导航逻辑
 *
 * 封装所有导航相关的回调函数，使用 useMemoizedFn 确保引用稳定
 *
 * @param store - DocumentCreateStore 实例
 * @param onComplete - 完成创建时的回调
 * @param onCancel - 取消创建时的回调
 * @returns 导航回调集合
 */
export function useDocumentCreateNavigation({
	store,
	onComplete,
	onCancel,
}: UseDocumentCreateNavigationParams): DocumentCreateNavigation {
	const handleComplete = useCallback(() => {
		store.clearPersistence()
		onComplete?.()
	}, [store, onComplete])

	const handleNext = useMemoizedFn(() => {
		if (store.isLastStep) {
			// 最后一步，完成创建
			handleComplete()
		} else {
			store.nextStep()
		}
	})

	const handlePrevious = useMemoizedFn(() => {
		store.previousStep()
	})

	const handleBack = useCallback(() => {
		// 点击返回按钮应该直接退出创建流程，回到知识库详情页
		onCancel?.()
	}, [onCancel])

	const handleClose = useCallback(() => {
		store.clearPersistence()
		onCancel?.()
	}, [store, onCancel])

	return {
		handleNext,
		handlePrevious,
		handleBack,
		handleClose,
		handleComplete,
	}
}
