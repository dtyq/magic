import { useEffect } from "react"

interface UseKeyboardControlsProps {
	enableKeyboard: boolean
	goToPrevPage: () => void
	goToNextPage: () => void
	zoomIn: () => void
	zoomOut: () => void
	resetZoom: () => void
	toggleFullscreen: () => void
}

export function useKeyboardControls({
	enableKeyboard,
	goToPrevPage,
	goToNextPage,
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
			if (event.target instanceof HTMLInputElement) return

			switch (event.key) {
				case "ArrowLeft":
					event.preventDefault()
					goToPrevPage()
					break
				case "ArrowRight":
					event.preventDefault()
					goToNextPage()
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
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [enableKeyboard, goToPrevPage, goToNextPage, zoomIn, zoomOut, resetZoom, toggleFullscreen])
}
