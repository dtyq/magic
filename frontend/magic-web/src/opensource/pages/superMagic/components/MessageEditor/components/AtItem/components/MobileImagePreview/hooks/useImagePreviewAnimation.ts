import { useState, useEffect, useCallback } from "react"

interface UseImagePreviewAnimationOptions {
	isVisible: boolean
	onClose?: () => void
	animationDuration?: number
}

interface UseImagePreviewAnimationReturn {
	isClosing: boolean
	isInteractive: boolean
	handleClose: () => void
	handleShow: () => void
}

export function useImagePreviewAnimation(
	options: UseImagePreviewAnimationOptions,
): UseImagePreviewAnimationReturn {
	const { isVisible, onClose, animationDuration = 250 } = options

	const [isClosing, setIsClosing] = useState(false)
	const [isInteractive, setIsInteractive] = useState(false)

	// Enable interactive mode after entrance animation
	useEffect(() => {
		if (isVisible && !isClosing) {
			// Wait for entrance animation to complete
			const timer = setTimeout(() => {
				setIsInteractive(true)
			}, 350) // Faster interactive enable timing

			return () => clearTimeout(timer)
		} else {
			setIsInteractive(false)
		}
	}, [isVisible, isClosing])

	// Handle show animation
	const handleShow = useCallback(() => {
		setIsClosing(false)
		setIsInteractive(false)
	}, [])

	// Handle close animation
	const handleClose = useCallback(() => {
		if (isClosing) return

		setIsClosing(true)
		setIsInteractive(false)

		// Wait for exit animation to complete
		setTimeout(() => {
			setIsClosing(false)
			onClose?.()
		}, animationDuration)
	}, [isClosing, onClose, animationDuration])

	return {
		isClosing,
		isInteractive,
		handleClose,
		handleShow,
	}
}
