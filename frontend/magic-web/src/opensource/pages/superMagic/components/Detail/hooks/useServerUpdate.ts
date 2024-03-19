import { useState, useEffect, useMemo, useCallback, useRef, type RefObject } from "react"
import { IsolatedHTMLRendererRef } from "../contents/HTML/IsolatedHTMLRenderer"

interface UseServerUpdateOptions {
	/** External server updated content passed from parent */
	externalServerUpdatedContent?: string
	/** Callback to clear server update flag in parent */
	onClearServerUpdate?: () => void
	/** Current edit mode state */
	isEditMode: boolean
	/** Reference to IsolatedHTMLRenderer for content updates */
	rendererRef: RefObject<IsolatedHTMLRendererRef>
	/** Original content for fallback */
	content: string
}

interface UseServerUpdateReturn {
	/** Whether there is a server update */
	hasServerUpdate: boolean
	/** Actual server content (internal or external) */
	actualServerContent: string
	/** Show version compare dialog state */
	showVersionCompareDialog: boolean
	/** Show save with update confirm dialog state */
	showSaveWithUpdateConfirmDialog: boolean
	/** Current editing content for comparison */
	currentEditingContent: string
	/** View server update handler */
	handleViewServerUpdate: () => Promise<void>
	/** Use my version handler */
	handleUseMyVersion: (editedContent?: string) => void
	/** Use server version handler */
	handleUseServerVersion: (editedContent?: string) => void
	/** Clear server update flags */
	clearServerUpdate: () => void
	/** Check server update before save (returns true if can proceed) */
	checkServerUpdateBeforeSave: () => boolean
	/** Set version compare dialog visibility */
	setShowVersionCompareDialog: (show: boolean) => void
	/** Set save confirm dialog visibility */
	setShowSaveWithUpdateConfirmDialog: (show: boolean) => void
	/** Apply server update to renderer (for cancel/discard scenarios) */
	applyServerUpdate: () => void
}

/**
 * Hook to manage server update logic including version comparison and conflict resolution
 */
function useServerUpdate({
	externalServerUpdatedContent,
	onClearServerUpdate,
	isEditMode,
	rendererRef,
	content,
}: UseServerUpdateOptions): UseServerUpdateReturn {
	// Internal server update state
	const [serverUpdatedContent, setServerUpdatedContent] = useState<string | null>(null)
	const [showVersionCompareDialog, setShowVersionCompareDialog] = useState(false)
	const [showSaveWithUpdateConfirmDialog, setShowSaveWithUpdateConfirmDialog] = useState(false)
	const [currentEditingContent, setCurrentEditingContent] = useState<string>(content)
	// 缓存最近一次服务端内容，避免状态切换时短暂丢失
	const latestServerContentRef = useRef<string>("")

	// Whether there is a server update
	const hasServerUpdate = useMemo(() => {
		return !!serverUpdatedContent || !!externalServerUpdatedContent
	}, [serverUpdatedContent, externalServerUpdatedContent])

	// Actual server content (prioritize internal state)
	const actualServerContent = useMemo(() => {
		return serverUpdatedContent || externalServerUpdatedContent || ""
	}, [serverUpdatedContent, externalServerUpdatedContent])

	// Receive external server update notification
	useEffect(() => {
		if (externalServerUpdatedContent && isEditMode) {
			setServerUpdatedContent(externalServerUpdatedContent)
			latestServerContentRef.current = externalServerUpdatedContent
		}
	}, [externalServerUpdatedContent, isEditMode])

	// Clear all server update flags
	const clearServerUpdate = useCallback(() => {
		setServerUpdatedContent(null)
		onClearServerUpdate?.()
	}, [onClearServerUpdate])

	// Check server update before save
	const checkServerUpdateBeforeSave = useCallback(() => {
		if (hasServerUpdate) {
			setShowSaveWithUpdateConfirmDialog(true)
			return false
		}
		return true
	}, [hasServerUpdate])

	// Apply server update to renderer
	const applyServerUpdate = useCallback(() => {
		const latestServerContent = actualServerContent || latestServerContentRef.current

		if (latestServerContent && rendererRef.current) {
			rendererRef.current.updateContent(latestServerContent, {
				restoreSelectionMode: false,
			})
			return
		}

		if (!rendererRef.current) return
		// 无服务端更新时，恢复为当前基线内容
		if (content)
			rendererRef.current.updateContent(content, {
				restoreSelectionMode: false,
			})
		else rendererRef.current.resetContent()
	}, [actualServerContent, content, rendererRef])

	// View server update - open version compare dialog
	const handleViewServerUpdate = useCallback(async () => {
		// Get latest editing content before opening dialog
		if (rendererRef.current) {
			const latestContent = await rendererRef.current.getContent()
			if (latestContent) {
				setCurrentEditingContent(latestContent)
			}
		}
		setShowVersionCompareDialog(true)
	}, [rendererRef])

	// Use my version - keep current editing content
	const handleUseMyVersion = useCallback(
		(editedContent?: string) => {
			setShowVersionCompareDialog(false)
			const contentToUse = editedContent || currentEditingContent
			if (contentToUse && rendererRef.current) {
				rendererRef.current.updateContent(contentToUse)
			}
			// Clear server update flags
			clearServerUpdate()
		},
		[rendererRef, clearServerUpdate, currentEditingContent],
	)

	// Use server version - apply server content
	const handleUseServerVersion = useCallback(
		(editedContent?: string) => {
			setShowVersionCompareDialog(false)
			// Use edited content if provided, otherwise use original server content
			// 当上游已清空更新标记时，仍可使用缓存值兜底
			const contentToUse =
				editedContent || actualServerContent || latestServerContentRef.current
			if (contentToUse && rendererRef.current) {
				rendererRef.current.updateContent(contentToUse)
			}
			clearServerUpdate()
		},
		[actualServerContent, rendererRef, clearServerUpdate],
	)

	return {
		hasServerUpdate,
		actualServerContent,
		showVersionCompareDialog,
		showSaveWithUpdateConfirmDialog,
		currentEditingContent,
		handleViewServerUpdate,
		handleUseMyVersion,
		handleUseServerVersion,
		clearServerUpdate,
		checkServerUpdateBeforeSave,
		setShowVersionCompareDialog,
		setShowSaveWithUpdateConfirmDialog,
		applyServerUpdate,
	}
}

export default useServerUpdate
