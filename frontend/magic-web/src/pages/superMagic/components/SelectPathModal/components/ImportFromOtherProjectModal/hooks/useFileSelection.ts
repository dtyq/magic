import { useState, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"

interface SelectedFileWithProject extends AttachmentItem {
	sourceProjectId: string
}

export function useFileSelection() {
	// 存储 file_id -> SelectedFileWithProject 映射
	const [selectedFilesMap, setSelectedFilesMap] = useState<Map<string, SelectedFileWithProject>>(
		new Map(),
	)

	// 兼容性属性：保持与原有接口一致
	const selectedFileIds = useMemo(() => {
		return new Set(selectedFilesMap.keys())
	}, [selectedFilesMap])

	const selectedFiles = useMemo(() => {
		return Array.from(selectedFilesMap.values())
	}, [selectedFilesMap])

	const handleSelectFile = useMemoizedFn(
		(item: AttachmentItem, checked: boolean, projectId?: string) => {
			if (!item.file_id) return

			setSelectedFilesMap((prev) => {
				const newMap = new Map(prev)
				if (checked) {
					if (!projectId) {
						console.warn("projectId is required when selecting a file")
						return prev
					}
					newMap.set(item.file_id as string, {
						...item,
						sourceProjectId: projectId,
					})
				} else {
					newMap.delete(item.file_id as string)
				}
				return newMap
			})
		},
	)

	const selectAll = useMemoizedFn((items: AttachmentItem[], projectId?: string) => {
		if (!projectId) {
			console.warn("projectId is required when selecting files")
			return
		}

		setSelectedFilesMap((prev) => {
			const newMap = new Map(prev)

			items.forEach((item) => {
				if (item.file_id) {
					newMap.set(item.file_id, {
						...item,
						sourceProjectId: projectId,
					})
				}
			})

			return newMap
		})
	})

	const deselectAll = useMemoizedFn((items: AttachmentItem[]) => {
		setSelectedFilesMap((prev) => {
			const newMap = new Map(prev)

			items.forEach((item) => {
				if (item.file_id) {
					newMap.delete(item.file_id)
				}
			})

			return newMap
		})
	})

	const clearSelection = useMemoizedFn(() => {
		setSelectedFilesMap(new Map())
	})

	const isAllSelected = useMemo(
		() => (items: AttachmentItem[]) => {
			if (items.length === 0) return false
			const validItems = items.filter((item) => item.file_id)
			if (validItems.length === 0) return false
			return validItems.every((item) => selectedFilesMap.has(item.file_id as string))
		},
		[selectedFilesMap],
	)

	const isIndeterminate = useMemo(
		() => (items: AttachmentItem[]) => {
			if (items.length === 0) return false
			const validItems = items.filter((item) => item.file_id)
			if (validItems.length === 0) return false
			const selectedCount = validItems.filter((item) =>
				selectedFilesMap.has(item.file_id as string),
			).length
			return selectedCount > 0 && selectedCount < validItems.length
		},
		[selectedFilesMap],
	)

	const getSelectedFilesByProject = useMemoizedFn(() => {
		const projectGroups = new Map<
			string,
			{ sourceProjectId: string; selectedFileIds: string[]; selectedFiles: AttachmentItem[] }
		>()

		selectedFilesMap.forEach((file, fileId) => {
			const projectId = file.sourceProjectId
			if (!projectGroups.has(projectId)) {
				projectGroups.set(projectId, {
					sourceProjectId: projectId,
					selectedFileIds: [],
					selectedFiles: [],
				})
			}
			const group = projectGroups.get(projectId)
			if (group) {
				group.selectedFileIds.push(fileId)
				group.selectedFiles.push(file)
			}
		})

		return Array.from(projectGroups.values())
	})

	const getSelectedFilesCount = useMemoizedFn(() => {
		return selectedFilesMap.size
	})

	const getSelectedProjectsCount = useMemoizedFn(() => {
		const projectIds = new Set<string>()
		selectedFilesMap.forEach((file) => {
			projectIds.add(file.sourceProjectId)
		})
		return projectIds.size
	})

	const hasMultipleProjects = useMemoizedFn(() => {
		return getSelectedProjectsCount() > 1
	})

	return {
		selectedFileIds,
		selectedFiles,
		handleSelectFile,
		selectAll,
		deselectAll,
		clearSelection,
		isAllSelected,
		isIndeterminate,
		getSelectedFilesByProject,
		getSelectedFilesCount,
		getSelectedProjectsCount,
		hasMultipleProjects,
	}
}
