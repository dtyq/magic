import { useRef, useState, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { usePendingActionGuard } from "../../../utils/usePendingActionGuard"

interface NavigationAction {
	type: "prev" | "next" | "first" | "jump"
	targetIndex?: number
}

interface UseCheckBeforeNavigateParams {
	/** Whether any slide is currently being edited */
	isAnySlideEditing: boolean
	/** Whether the active slide has pending AI selection targets */
	isInspectorPicking?: () => boolean
	/** Requests confirmation before clearing the active slide's AI selection */
	requestInspectorExit?: () => boolean | Promise<boolean>
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
	registerSaveHandler: (handler: (() => Promise<boolean>) | null) => void
	/** Register discard handler from active slide */
	registerDiscardHandler: (handler: (() => Promise<boolean>) | null) => void
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
 * @param params - current slide edit and AI selection state plus activeIndex
 * @returns Object containing checkBeforeNavigate function and dialog-related states
 */
function useCheckBeforeNavigate({
	isAnySlideEditing,
	isInspectorPicking,
	requestInspectorExit,
	activeIndex,
}: UseCheckBeforeNavigateParams): UseCheckBeforeNavigateReturn {
	// Store save handler for current active slide
	const activeSlideSaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)
	const activeSlideDiscardHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

	// Navigation confirmation dialog state
	const [showNavigationDialog, setShowNavigationDialog] = useState(false)
	const [isSavingForNavigation, setIsSavingForNavigation] = useState(false)
	const navigationGuard = usePendingActionGuard<NavigationAction>({
		shouldBlock: () => isAnySlideEditing,
		onBlocked: () => setShowNavigationDialog(true),
	})
	const {
		run: runNavigation,
		resolve: resolveNavigation,
		cancel: cancelNavigation,
	} = navigationGuard
	const pendingNavigation = navigationGuard.pendingContext

	// Register save handler from active slide
	const registerSaveHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		activeSlideSaveHandlerRef.current = handler
	})

	const registerDiscardHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		activeSlideDiscardHandlerRef.current = handler
	})

	// Check before navigate - returns true if can navigate, false if cancelled.
	// AI selection owns its own confirmation modal, so it must be resolved before
	// the edit-mode navigation guard can defer the same navigation action.
	const checkBeforeNavigate = useMemoizedFn(
		async (
			type: "prev" | "next" | "first" | "jump",
			targetIndex?: number,
		): Promise<boolean> => {
			if (isInspectorPicking?.()) {
				const canExitInspector = await (requestInspectorExit?.() ?? Promise.resolve(true))
				if (!canExitInspector) return false
			}

			return runNavigation(async () => undefined, { type, targetIndex })
		},
	)

	// Handle save and navigate
	const handleSaveAndNavigate = useMemoizedFn(async () => {
		if (isSavingForNavigation || !pendingNavigation) return

		setIsSavingForNavigation(true)
		try {
			const didSave = activeSlideSaveHandlerRef.current
				? await activeSlideSaveHandlerRef.current()
				: true

			if (!didSave) return

			// Close dialog and resolve the deferred check. The caller then performs
			// the actual slide navigation after this Promise resolves.
			setShowNavigationDialog(false)
			await resolveNavigation(true)
		} catch (error) {
			console.error("Failed to save before navigation:", error)
			await resolveNavigation(false)
		} finally {
			setIsSavingForNavigation(false)
		}
	})

	// Handle discard and navigate
	const handleDiscardAndNavigate = useMemoizedFn(async () => {
		const didDiscard = activeSlideDiscardHandlerRef.current
			? await activeSlideDiscardHandlerRef.current()
			: true
		if (!didDiscard) return

		setShowNavigationDialog(false)
		await resolveNavigation(true)
	})

	// Handle cancel navigation
	const handleCancelNavigation = useMemoizedFn(() => {
		setShowNavigationDialog(false)
		cancelNavigation()
	})

	const handleNavigationDialogOpenChange = useMemoizedFn((show: boolean) => {
		setShowNavigationDialog(show)
		if (!show) cancelNavigation()
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
		registerDiscardHandler,
		showNavigationDialog,
		setShowNavigationDialog: handleNavigationDialogOpenChange,
		isSavingForNavigation,
		targetPageNumber,
		handleSaveAndNavigate,
		handleDiscardAndNavigate,
		handleCancelNavigation,
	}
}

export default useCheckBeforeNavigate
