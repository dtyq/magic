import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { ModelItem, ModelSwitchProps } from "../types"

/** 原入口即时选择；确认入口的候选在关闭时清除，不触发模型保存。 */
export function useModelSwitchConfirmation(selection: ModelSwitchProps["selection"]) {
	const [pendingModel, setPendingModel] = useState<ModelItem | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const submittingRef = useRef(false)
	const mountedRef = useRef(true)
	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])
	// 初始模型也可能受当前场景限制，确认不能绕过列表的不可选状态。
	const canConfirmModel = useMemoizedFn(
		(model: ModelItem) =>
			selection?.mode === "confirm" &&
			!selection.getModelState?.(model)?.disabled &&
			selection.canConfirm(model),
	)
	const confirm = useMemoizedFn(async (onClose: () => void) => {
		if (
			selection?.mode !== "confirm" ||
			!pendingModel ||
			submittingRef.current ||
			!canConfirmModel(pendingModel)
		)
			return
		submittingRef.current = true
		setSubmitting(true)
		try {
			const dispatched = await selection.onConfirm(pendingModel)
			if (dispatched && mountedRef.current) onClose()
		} finally {
			submittingRef.current = false
			if (mountedRef.current) setSubmitting(false)
		}
	})
	return {
		pendingModel,
		setPendingModel,
		submitting,
		canConfirm: pendingModel !== null && canConfirmModel(pendingModel),
		confirm,
	}
}
