import { useState, useCallback } from "react"

export interface UseFileEditStateReturn {
	editingIndex: number | null
	editingName: string
	startEditing: (index: number, currentName: string) => void
	cancelEditing: () => void
	updateEditingName: (name: string) => void
	confirmEditing: (onUpdateFileName?: (index: number, newName: string) => void) => void
}

export function useFileEditState(): UseFileEditStateReturn {
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const [editingName, setEditingName] = useState("")

	const startEditing = useCallback((index: number, currentName: string) => {
		setEditingIndex(index)
		setEditingName(currentName)
	}, [])

	const cancelEditing = useCallback(() => {
		setEditingIndex(null)
		setEditingName("")
	}, [])

	const updateEditingName = useCallback((name: string) => {
		setEditingName(name)
	}, [])

	const confirmEditing = useCallback(
		(onUpdateFileName?: (index: number, newName: string) => void) => {
			if (editingIndex !== null && editingName.trim()) {
				onUpdateFileName?.(editingIndex, editingName.trim())
				setEditingIndex(null)
				setEditingName("")
			}
		},
		[editingIndex, editingName],
	)

	return {
		editingIndex,
		editingName,
		startEditing,
		cancelEditing,
		updateEditingName,
		confirmEditing,
	}
}
