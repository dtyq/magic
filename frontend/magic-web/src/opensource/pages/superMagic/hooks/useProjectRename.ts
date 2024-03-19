import { useState, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { HandleRenameProjectParams } from "./useProjects"

interface ProjectWithId {
	id: string
	project_name: string
}

interface UseProjectRenameParams<T extends ProjectWithId> {
	item: T
	onRenameProject?: (params: HandleRenameProjectParams) => Promise<void>
}

interface UseProjectRenameReturn {
	isEditing: boolean
	setIsEditing: (editing: boolean) => void
	editingProjectName: string
	handleProjectNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	handleProjectNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => Promise<void>
	handleProjectNameBlur: () => Promise<void>
	handleNameClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

/**
 * Custom hook for managing project rename functionality
 * @param item - The project item to be renamed
 * @param onRenameProject - Callback function to handle rename operation
 * @returns Object containing rename-related states and handlers
 */
function useProjectRename<T extends ProjectWithId>({
	item,
	onRenameProject,
}: UseProjectRenameParams<T>): UseProjectRenameReturn {
	const [isEditing, setIsEditing] = useState(false)
	const [editingProjectName, setEditingProjectName] = useState(item.project_name)

	// Set editing project name when entering edit mode
	useEffect(() => {
		if (isEditing) {
			setEditingProjectName(item.project_name)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEditing])

	const handleProjectNameChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		setEditingProjectName(e.target.value)
	})

	const handleProjectNameKeyDown = useMemoizedFn(
		async (e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter" && ![item.project_name, ""].includes(editingProjectName.trim())) {
				await onRenameProject?.({
					projectId: item.id,
					projectName: editingProjectName.trim(),
				})
				setIsEditing(false)
			} else if (e.key === "Enter") {
				setIsEditing(false)
			} else if (e.key === "Escape") {
				// Cancel editing and restore original name
				setEditingProjectName(item.project_name)
				setIsEditing(false)
			}
		},
	)

	const handleProjectNameBlur = useMemoizedFn(async () => {
		if (![item.project_name, ""].includes(editingProjectName.trim())) {
			await onRenameProject?.({
				projectId: item.id,
				projectName: editingProjectName.trim(),
			})
		}
		setIsEditing(false)
	})

	const handleNameClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
		setIsEditing(true)
	})

	return {
		isEditing,
		setIsEditing,
		editingProjectName,
		handleProjectNameChange,
		handleProjectNameKeyDown,
		handleProjectNameBlur,
		handleNameClick,
	}
}

export default useProjectRename
