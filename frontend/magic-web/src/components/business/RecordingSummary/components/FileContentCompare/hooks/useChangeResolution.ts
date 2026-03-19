import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { ChangeInfo, ChangeRecommendation } from "../utils/diff"

/**
 * 变更解析 Hook
 * 处理新增和删除变更的用户选择
 */
export function useChangeResolution(changes: ChangeInfo[]) {
	// 变更选择状态：记录每个变更的用户选择（keep: 保留 / remove: 移除）
	const [changeSelections, setChangeSelections] = useState<Map<string, ChangeRecommendation>>(
		new Map(),
	)

	// 是否已自动应用推荐（用于避免重复应用）
	const hasAutoAppliedRef = useRef<boolean>(false)

	// 自动应用智能合并
	useEffect(() => {
		if (changes.length === 0) return

		// 只自动应用一次
		if (hasAutoAppliedRef.current) return
		hasAutoAppliedRef.current = true

		const autoSelections = new Map<string, "keep" | "remove">()

		changes.forEach((change) => {
			// 只自动应用有明确推荐的变更
			if (change.recommendation) {
				autoSelections.set(change.id, change.recommendation)
			}
		})

		// 应用自动选择
		if (autoSelections.size > 0) {
			setChangeSelections(autoSelections)
		}
	}, [changes])

	// 处理变更选择
	const handleChangeSelect = useCallback((changeId: string, selection: ChangeRecommendation) => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			next.set(changeId, selection)
			return next
		})
	}, [])

	// 批量操作：保留所有新增
	const handleKeepAllAdditions = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "addition") {
					next.set(change.id, "keep")
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：移除所有新增
	const handleRemoveAllAdditions = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "addition") {
					next.set(change.id, "remove")
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：恢复所有删除（保留被删除的内容）
	const handleKeepAllDeletions = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "deletion") {
					next.set(change.id, "keep")
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：确认所有删除
	const handleRemoveAllDeletions = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "deletion") {
					next.set(change.id, "remove")
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：重置所有变更选择
	const handleResetAllChanges = useCallback(() => {
		setChangeSelections(new Map())
	}, [])

	// 批量操作：应用所有推荐
	const handleApplyRecommendations = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.recommendation) {
					next.set(change.id, change.recommendation)
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：全部使用当前版本（保留删除 + 移除新增）
	const handleUseAllCurrent = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "deletion") {
					// 删除的内容选择"保留" = 恢复删除
					next.set(change.id, "keep")
				} else if (change.type === "addition") {
					// 新增的内容选择"移除" = 不接受服务器新增
					next.set(change.id, "remove")
				}
			})
			return next
		})
	}, [changes])

	// 批量操作：全部使用服务器版本（确认删除 + 保留新增）
	const handleUseAllServer = useCallback(() => {
		setChangeSelections((prev) => {
			const next = new Map(prev)
			changes.forEach((change) => {
				if (change.type === "deletion") {
					// 删除的内容选择"移除" = 确认删除
					next.set(change.id, "remove")
				} else if (change.type === "addition") {
					// 新增的内容选择"保留" = 接受服务器新增
					next.set(change.id, "keep")
				}
			})
			return next
		})
	}, [changes])

	// 检查是否还有未处理的变更
	const hasUnresolvedChanges = useMemo(() => {
		return changes.some((change) => !changeSelections.has(change.id))
	}, [changes, changeSelections])

	// 统计信息
	const stats = useMemo(() => {
		const additionCount = changes.filter((c) => c.type === "addition").length
		const deletionCount = changes.filter((c) => c.type === "deletion").length
		const resolvedCount = changeSelections.size

		return {
			totalChanges: changes.length,
			additionCount,
			deletionCount,
			resolvedCount,
			unresolvedCount: changes.length - resolvedCount,
		}
	}, [changes, changeSelections])

	return {
		changeSelections,
		hasUnresolvedChanges,
		stats,
		handleChangeSelect,
		handleKeepAllAdditions,
		handleRemoveAllAdditions,
		handleKeepAllDeletions,
		handleRemoveAllDeletions,
		handleResetAllChanges,
		handleApplyRecommendations,
		handleUseAllCurrent,
		handleUseAllServer,
	}
}
