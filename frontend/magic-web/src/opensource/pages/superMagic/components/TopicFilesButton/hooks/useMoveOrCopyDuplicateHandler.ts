import { useState, useRef, useCallback } from "react"

export function useMoveOrCopyDuplicateHandler() {
	const [modalVisible, setModalVisible] = useState(false)
	const [currentFileName, setCurrentFileName] = useState("")
	const [duplicateFileIds, setDuplicateFileIds] = useState<string[]>([])
	const [duplicatesMap, setDuplicatesMap] = useState<
		Map<string, { fileName: string; relativePath: string }>
	>(new Map())
	const [currentIndex, setCurrentIndex] = useState(0)
	const [keepBothIds, setKeepBothIds] = useState<string[]>([])

	// 存储 resolve 函数，用于返回用户选择结果
	const resolveRef = useRef<
		((value: { keepBothIds: string[]; shouldProceed: boolean }) => void) | null
	>(null)

	/**
	 * 主入口：显示同名检测 Modal
	 * 返回 Promise，等待用户完成所有选择
	 */
	const checkDuplicates = useCallback(
		(
			duplicates: Map<string, { fileName: string; relativePath: string }>,
		): Promise<{ keepBothIds: string[]; shouldProceed: boolean }> => {
			return new Promise((resolve) => {
				resolveRef.current = resolve

				const ids = Array.from(duplicates.keys())
				setDuplicatesMap(duplicates)
				setDuplicateFileIds(ids)
				setCurrentIndex(0)
				setKeepBothIds([])

				// 显示第一个冲突文件
				const firstId = ids[0]
				const firstDup = duplicates.get(firstId)
				setCurrentFileName(firstDup?.relativePath || firstDup?.fileName || "")
				setModalVisible(true)
			})
		},
		[],
	)

	/**
	 * 处理用户选择
	 */
	const handleUserChoice = useCallback(
		(choice: "replace" | "keep-both" | "cancel", applyToAll: boolean) => {
			setModalVisible(false)

			// 用户取消
			if (choice === "cancel") {
				resolveRef.current?.({ keepBothIds: [], shouldProceed: false })
				// 重置状态
				setDuplicateFileIds([])
				setCurrentIndex(0)
				setKeepBothIds([])
				return
			}

			// 更新 keepBothIds
			let updatedKeepBothIds = [...keepBothIds]
			const currentFileId = duplicateFileIds[currentIndex]

			if (choice === "keep-both") {
				updatedKeepBothIds.push(currentFileId)

				// 如果应用到所有，添加所有剩余文件
				if (applyToAll) {
					const remainingIds = duplicateFileIds.slice(currentIndex + 1)
					updatedKeepBothIds = [...updatedKeepBothIds, ...remainingIds]
				}
			} else if (choice === "replace" && applyToAll) {
				// 替换全部：不添加任何 ID 到 keepBothIds
				// 直接完成
			}

			setKeepBothIds(updatedKeepBothIds)

			// 检查是否还有更多文件需要处理
			const nextIndex = currentIndex + 1
			const hasMore = nextIndex < duplicateFileIds.length

			if (hasMore && !applyToAll) {
				// 显示下一个文件
				setCurrentIndex(nextIndex)
				const nextId = duplicateFileIds[nextIndex]
				const nextDup = duplicatesMap.get(nextId)
				setCurrentFileName(nextDup?.relativePath || nextDup?.fileName || "")
				setModalVisible(true)
			} else {
				// 所有文件已处理完成
				resolveRef.current?.({ keepBothIds: updatedKeepBothIds, shouldProceed: true })
				// 重置状态
				setDuplicateFileIds([])
				setCurrentIndex(0)
				setKeepBothIds([])
			}
		},
		[currentIndex, duplicateFileIds, duplicatesMap, keepBothIds],
	)

	return {
		modalVisible,
		currentFileName,
		totalDuplicates: duplicateFileIds.length,
		handleReplace: (applyToAll: boolean) => handleUserChoice("replace", applyToAll),
		handleKeepBoth: (applyToAll: boolean) => handleUserChoice("keep-both", applyToAll),
		handleCancel: () => handleUserChoice("cancel", false),
		checkDuplicates,
	}
}
