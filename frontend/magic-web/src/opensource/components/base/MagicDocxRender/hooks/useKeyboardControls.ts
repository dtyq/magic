import { useEffect } from "react"

interface UseKeyboardControlsProps {
	enableKeyboard: boolean
	goToPrevSection: () => void
	goToNextSection: () => void
	zoomIn: () => void
	zoomOut: () => void
	resetZoom: () => void
	toggleFullscreen: () => void
}

export function useKeyboardControls({
	enableKeyboard,
	goToPrevSection,
	goToNextSection,
	zoomIn,
	zoomOut,
	resetZoom,
	toggleFullscreen,
}: UseKeyboardControlsProps) {
	// Keyboard event handling
	useEffect(() => {
		if (!enableKeyboard) return

		const handleKeyDown = (event: KeyboardEvent) => {
			// Prevent triggering in input fields
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement
			) {
				return
			}

			switch (event.key) {
				case "ArrowLeft":
					event.preventDefault()
					goToPrevSection()
					break
				case "ArrowRight":
					event.preventDefault()
					goToNextSection()
					break
				case "ArrowUp":
					event.preventDefault()
					goToPrevSection()
					break
				case "ArrowDown":
					event.preventDefault()
					goToNextSection()
					break
				case "+":
				case "=":
					event.preventDefault()
					zoomIn()
					break
				case "-":
					event.preventDefault()
					zoomOut()
					break
				case "0":
					if (event.ctrlKey || event.metaKey) {
						event.preventDefault()
						resetZoom()
					}
					break
				case "F11":
					event.preventDefault()
					toggleFullscreen()
					break
				case "Escape":
					if (document.fullscreenElement) {
						event.preventDefault()
						toggleFullscreen()
					}
					break
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [
		enableKeyboard,
		goToPrevSection,
		goToNextSection,
		zoomIn,
		zoomOut,
		resetZoom,
		toggleFullscreen,
	])
}
