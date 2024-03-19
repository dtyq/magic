import { useEffect, useCallback, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { KEYBOARD_MAPPING, DEBOUNCE_DELAYS } from "../constants"
import { KeyboardAction, KeyboardEventHandler } from "../types"

interface UseKeyboardNavProps {
	onSelectPrevious: () => void
	onSelectNext: () => void
	onConfirm: () => void
	onNavigateBack: () => void
	onEnterFolder: () => void
	onExit: () => void
	enabled?: boolean
	preventDefault?: boolean
}

interface UseKeyboardNavReturn {
	handleKeyDown: KeyboardEventHandler
}

/**
 * useKeyboardNav - Keyboard navigation hook
 *
 * @param props - Keyboard navigation configuration
 * @returns Keyboard event handlers
 */
export function useKeyboardNav(props: UseKeyboardNavProps): UseKeyboardNavReturn {
	const {
		onSelectPrevious,
		onSelectNext,
		onConfirm,
		onNavigateBack,
		onEnterFolder,
		onExit,
		enabled = true,
		preventDefault = true,
	} = props

	// Debounce tracking for Enter key to prevent rapid consecutive presses
	const lastConfirmTimeRef = useRef<number>(0)
	const confirmDebounceDelay = DEBOUNCE_DELAYS.KEYBOARD

	// Memoized action handlers
	const handleSelectPrevious = useMemoizedFn(onSelectPrevious)
	const handleSelectNext = useMemoizedFn(onSelectNext)
	const handleConfirm = useMemoizedFn(() => {
		const now = Date.now()
		if (now - lastConfirmTimeRef.current < confirmDebounceDelay) {
			// Ignore rapid consecutive Enter key presses
			return
		}
		lastConfirmTimeRef.current = now
		onConfirm()
	})
	const handleNavigateBack = useMemoizedFn(onNavigateBack)
	const handleEnterFolder = useMemoizedFn(onEnterFolder)
	const handleExit = useMemoizedFn(onExit)

	// Map keyboard action to handler
	const actionHandlers = useMemoizedFn((action: KeyboardAction) => {
		switch (action) {
			case KeyboardAction.SELECT_PREVIOUS:
				return handleSelectPrevious
			case KeyboardAction.SELECT_NEXT:
				return handleSelectNext
			case KeyboardAction.CONFIRM:
				return handleConfirm
			case KeyboardAction.NAVIGATE_BACK:
				return handleNavigateBack
			case KeyboardAction.ENTER_FOLDER:
				return handleEnterFolder
			case KeyboardAction.EXIT:
				return handleExit
			default:
				return null
		}
	})

	// Handle keyboard events
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!enabled) return

			const { key, metaKey, ctrlKey, altKey, shiftKey } = event

			// Ignore if modifier keys are pressed (except for specific combinations)
			if (metaKey || ctrlKey || altKey || shiftKey) {
				return
			}

			// Get action from keyboard mapping
			const action = KEYBOARD_MAPPING[key]
			if (!action) return

			// Get handler for the action
			const handler = actionHandlers(action)
			if (!handler) return

			// Prevent default behavior if needed
			if (preventDefault) {
				event.preventDefault()
				event.stopPropagation()
			}

			// Execute handler
			handler()
		},
		[enabled, preventDefault, actionHandlers],
	)

	// Add global keyboard event listener
	useEffect(() => {
		if (!enabled) return

		// Use capture phase to ensure we get the event first
		document.addEventListener("keydown", handleKeyDown, { capture: true })

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true })
		}
	}, [enabled, handleKeyDown])

	return {
		handleKeyDown,
	}
}

// Utility hook for debounced keyboard actions
export function useDebouncedKeyboard(
	callback: () => void,
	delay: number = DEBOUNCE_DELAYS.KEYBOARD,
) {
	const debouncedCallback = useMemoizedFn(() => {
		const timeoutId = setTimeout(callback, delay)
		return () => clearTimeout(timeoutId)
	})

	return debouncedCallback
}

// Hook for handling specific key combinations
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const { key, metaKey, ctrlKey, altKey, shiftKey } = event

			// Build key combination string
			let combination = ""
			if (metaKey) combination += "Meta+"
			if (ctrlKey) combination += "Ctrl+"
			if (altKey) combination += "Alt+"
			if (shiftKey) combination += "Shift+"
			combination += key

			// Check if we have a handler for this combination
			const handler = shortcuts[combination] || shortcuts[key]
			if (handler) {
				event.preventDefault()
				handler()
			}
		},
		[shortcuts],
	)

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	return { handleKeyDown }
}

// Hook for focus management
export function useFocusManager(containerRef: React.RefObject<HTMLElement>) {
	const focusContainer = useCallback(() => {
		if (containerRef.current) {
			containerRef.current.focus()
		}
	}, [containerRef])

	const focusFirstItem = useCallback(() => {
		if (containerRef.current) {
			const firstFocusable = containerRef.current.querySelector(
				'[tabindex="0"], [tabindex="-1"]',
			) as HTMLElement
			if (firstFocusable) {
				firstFocusable.focus()
			}
		}
	}, [containerRef])

	const focusLastItem = useCallback(() => {
		if (containerRef.current) {
			const focusableElements = containerRef.current.querySelectorAll(
				'[tabindex="0"], [tabindex="-1"]',
			)
			const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement
			if (lastFocusable) {
				lastFocusable.focus()
			}
		}
	}, [containerRef])

	return {
		focusContainer,
		focusFirstItem,
		focusLastItem,
	}
}
