import { useState } from "react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { last } from "lodash-es"

import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { getItemId, getDirectoriesFromPath, filterDirectories, findPathToItem } from "../utils"

interface UseDirectoryNavigationProps {
	projectId: string
	attachments: AttachmentItem[]
	defaultPath: AttachmentItem[]
	visible: boolean
}

export function useDirectoryNavigation({
	projectId,
	attachments,
	defaultPath,
	visible,
}: UseDirectoryNavigationProps) {
	const [loading, setLoading] = useState(false)
	const [path, setPath] = useState<AttachmentItem[]>(defaultPath)
	const [directories, setDirectories] = useState<AttachmentItem[]>([])

	// Fetch directories based on current path
	const fetchDirectories = useMemoizedFn(
		async (params: {
			projectId: string
			parentId?: string
			pathOverride?: AttachmentItem[]
		}) => {
			setLoading(true)
			try {
				// Use pathOverride or current path state
				const currentPath = params.pathOverride !== undefined ? params.pathOverride : path
				// Use attachments data instead of API call, only get directories
				const dirs = getDirectoriesFromPath(attachments, currentPath)

				setDirectories(filterDirectories(dirs))
			} catch (error) {
				console.error("Failed to fetch directories:", error)
				setDirectories([])
			}
			setLoading(false)
		},
	)

	// Navigate to a directory
	const navigateToDirectory = useMemoizedFn(async (item: AttachmentItem) => {
		if (!item.is_directory) {
			return
		}

		const itemId = getItemId(item)

		// Check if item is a direct child of current directory
		const currentDir = last(path)
		const currentChildren = currentDir ? currentDir.children || [] : attachments
		const isDirectChild = currentChildren.some((child) => getItemId(child) === itemId)

		let newPath: AttachmentItem[]

		if (isDirectChild) {
			// Item is a direct child, append to current path
			newPath = [...path, item]
		} else {
			// Item might be from search results or nested deeper, find its complete path
			const foundPath = findPathToItem(attachments, itemId)
			if (foundPath) {
				newPath = foundPath
			} else {
				// Fallback to original behavior if path cannot be found
				console.warn(`Could not find path to item ${itemId}, using fallback navigation`)
				newPath = [...path, item]
			}
		}

		setPath(newPath)
		await fetchDirectories({
			projectId,
			parentId: itemId,
			pathOverride: newPath, // Pass new path to avoid async state issues
		})
	})

	// Navigate to breadcrumb item
	const navigateToBreadcrumb = useMemoizedFn(async (itemId: string) => {
		const currentDirectory = last(path)
		if (
			loading ||
			(!currentDirectory && itemId === "0") ||
			getItemId(currentDirectory || {}) === itemId
		) {
			return
		}

		const index = path.findIndex((o) => getItemId(o) === itemId)
		const newPath = index >= 0 ? path.slice(0, index + 1) : []
		setPath(newPath)
		await fetchDirectories({
			projectId,
			parentId: itemId === "0" ? undefined : itemId,
			pathOverride: newPath, // Pass new path to avoid async state issues
		})
	})

	// Reset navigation state
	const resetNavigation = useMemoizedFn(() => {
		setLoading(false)
		setPath(defaultPath)
		setDirectories([])
	})

	// Initialize directories when modal becomes visible
	useUpdateEffect(() => {
		if (visible) {
			setPath(defaultPath)
			fetchDirectories({
				projectId,
				parentId: getItemId(last(defaultPath) || {}),
			})
		}
	}, [visible])

	return {
		loading,
		path,
		directories,
		setDirectories,
		fetchDirectories,
		navigateToDirectory,
		navigateToBreadcrumb,
		resetNavigation,
	}
}
