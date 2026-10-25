import { useCallback, useRef, useState } from "react"
import type { FolderConflictInfo } from "../utils/folderConflictHandler"

type FolderConflictChoice = "keep-both" | "replace" | "merge" | "cancel"

export function useFolderConflictHandler() {
	const [modalVisible, setModalVisible] = useState(false)
	const [currentFolderName, setCurrentFolderName] = useState("")
	const [canMerge, setCanMerge] = useState(true)
	const [conflictIds, setConflictIds] = useState<string[]>([])
	const [conflictsMap, setConflictsMap] = useState<Map<string, FolderConflictInfo>>(new Map())
	const [currentIndex, setCurrentIndex] = useState(0)
	const [keepBothIds, setKeepBothIds] = useState<string[]>([])
	const [replaceIds, setReplaceIds] = useState<string[]>([])
	const resolveRef = useRef<
		| ((value: { keepBothIds: string[]; replaceIds: string[]; shouldProceed: boolean }) => void)
		| null
	>(null)

	const reset = useCallback(() => {
		setModalVisible(false)
		setCurrentFolderName("")
		setCanMerge(true)
		setConflictIds([])
		setConflictsMap(new Map())
		setCurrentIndex(0)
		setKeepBothIds([])
		setReplaceIds([])
	}, [])

	const showConflictAtIndex = useCallback(
		(index: number, ids: string[], map: Map<string, FolderConflictInfo>) => {
			const nextId = ids[index]
			const nextConflict = map.get(nextId)
			if (!nextConflict) return

			setCurrentIndex(index)
			setCurrentFolderName(nextConflict.relativePath || nextConflict.folderName)
			setCanMerge(nextConflict.canMerge)
			setModalVisible(true)
		},
		[],
	)

	const checkConflicts = useCallback(
		(
			conflicts: Map<string, FolderConflictInfo>,
		): Promise<{
			keepBothIds: string[]
			replaceIds: string[]
			shouldProceed: boolean
		}> => {
			return new Promise((resolve) => {
				if (conflicts.size === 0) {
					resolve({ keepBothIds: [], replaceIds: [], shouldProceed: true })
					return
				}

				resolveRef.current = resolve
				const ids = Array.from(conflicts.keys())
				setConflictIds(ids)
				setConflictsMap(conflicts)
				setKeepBothIds([])
				showConflictAtIndex(0, ids, conflicts)
			})
		},
		[showConflictAtIndex],
	)

	const complete = useCallback(
		(nextKeepBothIds: string[], nextReplaceIds: string[], shouldProceed: boolean) => {
			resolveRef.current?.({
				keepBothIds: nextKeepBothIds,
				replaceIds: nextReplaceIds,
				shouldProceed,
			})
			resolveRef.current = null
			reset()
		},
		[reset],
	)

	const handleChoice = useCallback(
		(choice: FolderConflictChoice, applyToAll: boolean) => {
			setModalVisible(false)

			if (choice === "cancel") {
				complete([], [], false)
				return
			}

			const currentId = conflictIds[currentIndex]
			let nextKeepBothIds = [...keepBothIds]
			let nextReplaceIds = [...replaceIds]

			if (choice === "keep-both" && currentId) {
				nextKeepBothIds.push(currentId)
			}
			if (choice === "replace" && currentId) {
				nextReplaceIds.push(currentId)
			}

			if (applyToAll) {
				const remainingIds = conflictIds.slice(currentIndex + 1)
				if (choice === "keep-both") {
					nextKeepBothIds = [...nextKeepBothIds, ...remainingIds]
					complete(nextKeepBothIds, nextReplaceIds, true)
					return
				}
				if (choice === "replace") {
					nextReplaceIds = [...nextReplaceIds, ...remainingIds]
					complete(nextKeepBothIds, nextReplaceIds, true)
					return
				}

				const nextNonMergeableOffset = remainingIds.findIndex((id) => {
					const conflict = conflictsMap.get(id)
					return conflict && !conflict.canMerge
				})
				if (nextNonMergeableOffset === -1) {
					complete(nextKeepBothIds, nextReplaceIds, true)
					return
				}

				const nextIndex = currentIndex + 1 + nextNonMergeableOffset
				setKeepBothIds(nextKeepBothIds)
				setReplaceIds(nextReplaceIds)
				showConflictAtIndex(nextIndex, conflictIds, conflictsMap)
				return
			}

			const nextIndex = currentIndex + 1
			if (nextIndex < conflictIds.length) {
				setKeepBothIds(nextKeepBothIds)
				setReplaceIds(nextReplaceIds)
				showConflictAtIndex(nextIndex, conflictIds, conflictsMap)
				return
			}

			complete(nextKeepBothIds, nextReplaceIds, true)
		},
		[
			complete,
			conflictIds,
			conflictsMap,
			currentIndex,
			keepBothIds,
			replaceIds,
			showConflictAtIndex,
		],
	)

	return {
		modalVisible,
		currentFolderName,
		canMerge,
		totalConflicts: conflictIds.length,
		checkConflicts,
		handleKeepBoth: (applyToAll: boolean) => handleChoice("keep-both", applyToAll),
		handleReplace: (applyToAll: boolean) => handleChoice("replace", applyToAll),
		handleMerge: (applyToAll: boolean) => handleChoice("merge", applyToAll),
		handleCancel: () => handleChoice("cancel", false),
	}
}
