import { useRef, useState, useMemo } from "react"
import { useMemoizedFn } from "ahooks"

interface NavigationAction {
	type: "prev" | "next" | "first" | "jump"
	targetIndex?: number
}

interface UseCheckBeforeNavigateParams {
	/** Whether any slide is currently being edited */
	isAnySlideEditing: boolean
	/** Current active slide index (for computing target page number) */
	activeIndex: number
}

interface UseCheckBeforeNavigateReturn {
	/** Check if navigation is allowed, returns Promise<boolean> */
	checkBeforeNavigate: (
		type: "prev" | "next" | "first" | "jump",
		targetIndex?: number,
	) => Promise<boolean>
	/** Register save handler from active slide */
	registerSaveHandler: (handler: (() => Promise<void>) | null) => void
	/** Dialog visibility state */
	showNavigationDialog: boolean
	/** Set dialog visibility */
	setShowNavigationDialog: (show: boolean) => void
	/** Whether currently saving for navigation */
	isSavingForNavigation: boolean
	/** Target page number for dialog display */
	targetPageNumber: number
	/** Handle save and navigate action */
	handleSaveAndNavigate: () => Promise<void>
	/** Handle discard and navigate action */
	handleDiscardAndNavigate: () => void
	/** Handle cancel navigation action */
	handleCancelNavigation: () => void
}

/**
 * Hook for managing navigation confirmation with save handler
 * Provides async checkBeforeNavigate function that shows confirmation dialog if editing
 *
 * @param params - isAnySlideEditing and activeIndex
 * @returns Object containing checkBeforeNavigate function and dialog-related states
 */
function useCheckBeforeNavigate({
	isAnySlideEditing,
	activeIndex,
}: UseCheckBeforeNavigateParams): UseCheckBeforeNavigateReturn {
	// Store save handler for current active slide
	const activeSlideSaveHandlerRef = useRef<(() => Promise<void>) | null>(null)

	// Store resolve/reject callbacks for navigation promise
	const navigationPromiseRef = useRef<{
		resolve: (value: boolean) => void
		reject: (error: Error) => void
	} | null>(null)

	// Navigation confirmation dialog state
	const [showNavigationDialog, setShowNavigationDialog] = useState(false)
	const [pendingNavigation, setPendingNavigation] = useState<NavigationAction | null>(null)
	const [isSavingForNavigation, setIsSavingForNavigation] = useState(false)

	// Register save handler from active slide
	const registerSaveHandler = useMemoizedFn((handler: (() => Promise<void>) | null) => {
		activeSlideSaveHandlerRef.current = handler
	})

	// Check before navigate - returns true if can navigate, false if cancelled
	const checkBeforeNavigate = useMemoizedFn(
		async (
			type: "prev" | "next" | "first" | "jump",
			targetIndex?: number,
		): Promise<boolean> => {
			// If not editing, allow navigation immediately
			if (!isAnySlideEditing) {
				return true
			}

			// If already showing dialog, return false to prevent duplicate dialogs
			if (showNavigationDialog) {
				return false
			}

			// Show confirmation dialog and wait for user decision
			return new Promise((resolve) => {
				navigationPromiseRef.current = { resolve, reject: () => resolve(false) }
				setPendingNavigation({ type, targetIndex })
				setShowNavigationDialog(true)
			})
		},
	)

	// Handle save and navigate
	const handleSaveAndNavigate = useMemoizedFn(async () => {
		if (isSavingForNavigation || !pendingNavigation) return

		setIsSavingForNavigation(true)
		try {
			// Call save handler if available
			if (activeSlideSaveHandlerRef.current) {
				await activeSlideSaveHandlerRef.current()
			}

			// Close dialog and reset state
			setShowNavigationDialog(false)
			setPendingNavigation(null)

			// Resolve promise with true (navigation allowed)
			navigationPromiseRef.current?.resolve(true)
			navigationPromiseRef.current = null
		} catch (error) {
			console.error("Failed to save before navigation:", error)

			// Resolve with false on error (navigation blocked)
			navigationPromiseRef.current?.resolve(false)
			navigationPromiseRef.current = null
		} finally {
			setIsSavingForNavigation(false)
		}
	})

	// Handle discard and navigate
	const handleDiscardAndNavigate = useMemoizedFn(() => {
		setShowNavigationDialog(false)
		setPendingNavigation(null)

		// Resolve promise with true (navigation allowed without save)
		navigationPromiseRef.current?.resolve(true)
		navigationPromiseRef.current = null
	})

	// Handle cancel navigation
	const handleCancelNavigation = useMemoizedFn(() => {
		setShowNavigationDialog(false)
		setPendingNavigation(null)

		// Resolve promise with false (navigation cancelled)
		navigationPromiseRef.current?.resolve(false)
		navigationPromiseRef.current = null
	})

	// Compute target page number for dialog
	const targetPageNumber = useMemo(() => {
		if (!pendingNavigation) return 0

		const { type, targetIndex } = pendingNavigation
		switch (type) {
			case "next":
				return activeIndex + 2 // +1 for index, +1 for next page
			case "prev":
				return activeIndex // 0-based to 1-based
			case "first":
				return 1
			case "jump":
				return (targetIndex ?? 0) + 1
			default:
				return 0
		}
	}, [pendingNavigation, activeIndex])

	return {
		checkBeforeNavigate,
		registerSaveHandler,
		showNavigationDialog,
		setShowNavigationDialog,
		isSavingForNavigation,
		targetPageNumber,
		handleSaveAndNavigate,
		handleDiscardAndNavigate,
		handleCancelNavigation,
	}
}

export default useCheckBeforeNavigate
