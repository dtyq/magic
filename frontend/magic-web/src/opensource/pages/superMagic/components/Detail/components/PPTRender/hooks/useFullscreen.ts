import { useState, useEffect, useCallback, RefObject } from "react"
import { useMemoizedFn } from "ahooks"

interface UseFullscreenOptions {
	containerRef: RefObject<HTMLElement>
}

interface UseFullscreenReturn {
	isFullscreen: boolean
	toggleFullscreen: () => Promise<void>
	exitFullscreen: () => Promise<void>
}

/**
 * Custom hook for managing fullscreen functionality
 * Handles fullscreen state, keyboard events, and fullscreen-related iframe messages
 */
export function useFullscreen({ containerRef }: UseFullscreenOptions): UseFullscreenReturn {
	const [isFullscreen, setIsFullscreen] = useState(false)

	// Toggle fullscreen mode
	const toggleFullscreen = useCallback(async () => {
		try {
			if (!document.fullscreenElement) {
				// Enter fullscreen for the container
				if (containerRef.current) {
					await containerRef.current.requestFullscreen()
					setIsFullscreen(true)
				}
			} else {
				await document.exitFullscreen()
				setIsFullscreen(false)
			}
		} catch (error) {
			console.error("Fullscreen error:", error)
		}
	}, [containerRef])

	// Exit fullscreen mode
	const exitFullscreen = useMemoizedFn(async () => {
		try {
			// Check if the current container is in fullscreen
			if (document.fullscreenElement === containerRef.current) {
				await document.exitFullscreen()
				setIsFullscreen(false)
			}
		} catch (error) {
			console.error("Exit fullscreen error:", error)
		}
	})

	// Listen for fullscreen state changes
	useEffect(() => {
		function handleFullscreenChange() {
			// Check if the current container is in fullscreen
			const isContainerFullscreen = document.fullscreenElement === containerRef.current
			setIsFullscreen(isContainerFullscreen)
		}

		document.addEventListener("fullscreenchange", handleFullscreenChange)
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
	}, [containerRef])

	// Listen for fullscreen-related keyboard events from iframe
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (event.data && event.data.type === "keyboardEvent") {
				const { direction } = event.data

				switch (direction) {
					case "fullscreen":
						toggleFullscreen()
						break
					case "escape":
						// Exit fullscreen if the container is in fullscreen mode
						if (isFullscreen && document.fullscreenElement === containerRef.current) {
							exitFullscreen()
						}
						break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [toggleFullscreen, exitFullscreen, isFullscreen, containerRef])

	// Handle keyboard events
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			switch (event.key) {
				case "Escape":
					// Exit fullscreen if the container is in fullscreen mode
					if (isFullscreen && document.fullscreenElement === containerRef.current) {
						exitFullscreen()
					}
					break
				case "F11":
					event.preventDefault()
					toggleFullscreen()
					break
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [isFullscreen, toggleFullscreen, exitFullscreen, containerRef])

	return {
		isFullscreen,
		toggleFullscreen,
		exitFullscreen,
	}
}
