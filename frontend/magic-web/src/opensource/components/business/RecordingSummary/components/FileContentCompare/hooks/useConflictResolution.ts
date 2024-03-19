import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { ConflictInfo } from "../utils/diff"
import { ConflictResolution, ConflictResolutionWithoutCustom } from "../types"

/**
 * 冲突解析 Hook
 * 处理冲突的选择、编辑和批量操作
 */
export function useConflictResolution(conflicts: ConflictInfo[]) {
	// 冲突选择状态：记录每个冲突的用户选择（current/server/custom）
	const [conflictSelections, setConflictSelections] = useState<Map<string, ConflictResolution>>(
		new Map(),
	)

	// 自定义内容状态：记录用户手动编辑的冲突内容
	const [conflictCustomContents, setConflictCustomContents] = useState<Map<string, string>>(
		new Map(),
	)

	// 是否已自动应用推荐（用于避免重复应用）
	const hasAutoAppliedRef = useRef<boolean>(false)

	// 自动应用智能合并
	useEffect(() => {
		if (conflicts.length === 0) return

		// 只自动应用一次
		if (hasAutoAppliedRef.current) return
		hasAutoAppliedRef.current = true

		const autoSelections = new Map<string, ConflictResolution>()

		conflicts.forEach((conflict) => {
			// 只自动应用有明确推荐的冲突
			if (conflict.recommendation) {
				autoSelections.set(conflict.id, conflict.recommendation)
			}
		})

		// 应用自动选择
		if (autoSelections.size > 0) {
			setConflictSelections(autoSelections)
		}
	}, [conflicts])

	// 检查是否有未解决的冲突
	const hasUnresolvedConflicts = useMemo(() => {
		if (conflicts.length === 0) {
			return false
		}
		// 如果已解决的冲突数量少于总冲突数，说明还有未解决的
		return conflictSelections.size < conflicts.length
	}, [conflicts.length, conflictSelections.size])

	// 处理冲突选择（选择当前或服务器版本）
	const handleConflictSelect = useCallback(
		(conflictId: string, selection: ConflictResolutionWithoutCustom) => {
			setConflictSelections((prev) => {
				const next = new Map(prev)
				next.set(conflictId, selection)
				return next
			})
		},
		[],
	)

	// 保存编辑的冲突内容
	const handleSaveConflictEdit = useCallback((conflictId: string, content: string) => {
		setConflictCustomContents((prev) => {
			const next = new Map(prev)
			next.set(conflictId, content)
			return next
		})
		setConflictSelections((prev) => {
			const next = new Map(prev)
			next.set(conflictId, ConflictResolution.CUSTOM)
			return next
		})
	}, [])

	// 开始编辑冲突（手动编辑模式）
	const handleEditConflict = useCallback(
		(conflict: ConflictInfo) => {
			const existingCustomContent = conflictCustomContents.get(conflict.id)

			if (existingCustomContent !== undefined) {
				// 使用已有的自定义内容
				handleSaveConflictEdit(conflict.id, existingCustomContent)
				return existingCustomContent
			} else {
				// 检查用户是否已经选择了某个选项
				const selection = conflictSelections.get(conflict.id)
				if (selection === "current") {
					// 用户选择了当前版本，使用当前内容
					handleSaveConflictEdit(conflict.id, conflict.currentLines.join("\n"))
					return conflict.currentLines.join("\n")
				} else if (selection === "server") {
					// 用户选择了服务器版本，使用服务器内容
					handleSaveConflictEdit(conflict.id, conflict.serverLines.join("\n"))
					return conflict.serverLines.join("\n")
				} else {
					// 还没有选择，初始化为当前 + 服务器内容的组合
					const combinedContent = [
						...conflict.currentLines,
						...conflict.serverLines,
					].join("\n")
					handleSaveConflictEdit(conflict.id, combinedContent)
					return combinedContent
				}
			}
		},
		[conflictCustomContents, conflictSelections, handleSaveConflictEdit],
	)

	// 批量操作：全部使用当前版本
	const handleUseAllCurrent = useCallback(() => {
		const newSelections = new Map<string, ConflictResolution>()
		conflicts.forEach((conflict) => {
			newSelections.set(conflict.id, ConflictResolution.CURRENT)
		})
		setConflictSelections(newSelections)
	}, [conflicts])

	// 批量操作：全部使用服务器版本
	const handleUseAllServer = useCallback(() => {
		const newSelections = new Map<string, ConflictResolution>()
		conflicts.forEach((conflict) => {
			newSelections.set(conflict.id, ConflictResolution.SERVER)
		})
		setConflictSelections(newSelections)
	}, [conflicts])

	// 批量操作：应用所有智能合并
	const handleApplyRecommendations = useCallback(() => {
		const newSelections = new Map<string, ConflictResolution>()
		conflicts.forEach((conflict) => {
			if (conflict.recommendation) {
				newSelections.set(conflict.id, conflict.recommendation)
			}
		})
		setConflictSelections(newSelections)
	}, [conflicts])

	// 批量操作：重置所有选择
	const handleResetAll = useCallback(() => {
		setConflictSelections(new Map())
		setConflictCustomContents(new Map())
	}, [])

	// 设置自定义冲突内容（用于 AI 生成的内容）
	const handleConflictCustom = useCallback((conflictId: string, customContent: string) => {
		setConflictCustomContents((prev) => {
			const next = new Map(prev)
			next.set(conflictId, customContent)
			return next
		})
		setConflictSelections((prev) => {
			const next = new Map(prev)
			next.set(conflictId, ConflictResolution.CUSTOM)
			return next
		})
	}, [])

	return {
		// 状态
		conflictSelections,
		conflictCustomContents,
		hasUnresolvedConflicts,

		// 操作方法
		handleConflictSelect,
		handleConflictCustom,
		handleEditConflict,
		handleSaveConflictEdit,
		handleUseAllCurrent,
		handleUseAllServer,
		handleApplyRecommendations,
		handleResetAll,
	}
}
