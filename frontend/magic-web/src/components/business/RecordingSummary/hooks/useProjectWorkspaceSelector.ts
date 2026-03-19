import { useCallback, useEffect, useMemo, useState } from "react"
import { useUserInfo } from "@/models/user/hooks"
import { platformKey } from "@/utils/storage"
import { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/use-mobile"

export interface ProjectWorkspaceSelection {
	project: ProjectListItem | null
	workspace: Workspace | null
}

/**
 * Custom hook for managing project and workspace selection with localStorage persistence
 * Persists selection based on user ID
 */
export function useProjectWorkspaceSelector() {
	const { userInfo } = useUserInfo()
	const isMobile = useIsMobile()

	// Generate storage key based on user ID
	const storageKey = useMemo(() => {
		const userId = userInfo?.user_id || "unknown"
		return platformKey(`recording_summary/project_workspace_selector/${userId}`)
	}, [userInfo?.user_id])

	// Load selection from localStorage helper
	const loadSelectionFromStorage = useCallback((key: string): ProjectWorkspaceSelection => {
		if (typeof window === "undefined") {
			return { project: null, workspace: null }
		}

		try {
			const stored = localStorage.getItem(key)
			if (!stored) return { project: null, workspace: null }

			const parsed = JSON.parse(stored)
			return {
				project: parsed.project || null,
				workspace: parsed.workspace || null,
			}
		} catch (error) {
			console.error("Failed to load project/workspace selection from localStorage:", error)
			return { project: null, workspace: null }
		}
	}, [])

	// Initialize state from localStorage
	const [selection, setSelection] = useState<ProjectWorkspaceSelection>(() => {
		if (typeof window === "undefined") {
			return { project: null, workspace: null }
		}

		const userId = userInfo?.user_id || "unknown"
		const initialKey = platformKey(`recording_summary/project_workspace_selector/${userId}`)

		try {
			const stored = localStorage.getItem(initialKey)
			if (!stored) return { project: null, workspace: null }

			const parsed = JSON.parse(stored)
			return {
				project: parsed.project || null,
				workspace: parsed.workspace || null,
			}
		} catch (error) {
			console.error("Failed to load project/workspace selection from localStorage:", error)
			return { project: null, workspace: null }
		}
	})

	// Reload selection when storageKey changes (user ID changes)
	useEffect(() => {
		const newSelection = loadSelectionFromStorage(storageKey)
		setSelection(newSelection)
	}, [storageKey, loadSelectionFromStorage])

	// Update localStorage when selection changes
	useEffect(() => {
		if (typeof window === "undefined") return

		try {
			localStorage.setItem(storageKey, JSON.stringify(selection))
		} catch (error) {
			console.error("Failed to save project/workspace selection to localStorage:", error)
		}
	}, [selection, storageKey])

	// Update selection
	const updateSelection = useCallback((newSelection: ProjectWorkspaceSelection) => {
		setSelection(newSelection)
	}, [])

	// Clear selection
	const clearSelection = useCallback(() => {
		setSelection({ project: null, workspace: null })
	}, [])

	return {
		// 移动端不保存项目和空间选择，在哪选择就在哪保存
		selection,
		updateSelection,
		clearSelection,
	}
}
