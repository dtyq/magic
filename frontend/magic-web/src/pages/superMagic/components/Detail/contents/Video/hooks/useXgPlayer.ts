import { useEffect, useRef, useState } from "react"
import Player from "xgplayer"
import { defaultLanguage, getLocalizedText } from "../utils/i18n"

export interface UseXgPlayerProps {
	fileUrl?: string
	containerRef: React.RefObject<HTMLDivElement>
}

export interface UseXgPlayerResult {
	playerRef: React.RefObject<Player | null>
	isLoading: boolean
	playerReady: boolean
}

export const useXgPlayer = ({ fileUrl, containerRef }: UseXgPlayerProps): UseXgPlayerResult => {
	const playerRef = useRef<Player | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [playerReady, setPlayerReady] = useState(false)

	// Initialize xgplayer when fileUrl is available
	useEffect(() => {
		if (!fileUrl || !containerRef.current) {
			setPlayerReady(false)
			return
		}

		// Destroy previous player instance
		if (playerRef.current) {
			playerRef.current.destroy()
			playerRef.current = null
		}

		setIsLoading(true)
		setPlayerReady(false)

		// Delay initialization to ensure container is properly rendered
		const initPlayer = () => {
			const container = containerRef.current
			if (!container) {
				console.warn("Container not found")
				return
			}

			// Check if container has actual dimensions
			const rect = container.getBoundingClientRect()

			if (rect.width === 0 || rect.height === 0) {
				console.warn("Container has no dimensions, retrying...")
				// Retry after a short delay
				setTimeout(initPlayer, 1000)
				return
			}

			try {
				const player = new Player({
					el: container,
					url: fileUrl,
					width: "100%",
					height: "100%",
					autoplay: false,
					controls: true,
					playsinline: true,
					preload: "auto", // Changed from "metadata" to "auto" for better WebM support
					videoFillMode: "contain",
					fluid: true, // Enable responsive mode
					// Language configuration
					lang: defaultLanguage, // Auto-detected language
					cssFullscreen: false,
					// Fullscreen configuration - disable CSS fullscreen, only use native fullscreen
					fullscreen: {
						useCssFullscreen: false, // Disable CSS fullscreen
						preferCssFullscreen: false, // Prefer native fullscreen
					},
					// Disable CSS fullscreen icon
					cssfullscreen: false,
					// Responsive configuration
					responsive: true,
					// Enhanced video scaling
					videoInit: true,
				})

				playerRef.current = player

				// Event listeners for loading states
				player.on("loadstart", () => {
					setIsLoading(true)
				})

				// Handle metadata loading - important for WebM files with duration issues
				player.on("loadedmetadata", () => {
					console.log("Metadata loaded, duration:", player.duration)

					// For WebM files with Infinity/NaN duration, allow playback immediately
					// Don't block the user from playing available content
					if (player.duration === Infinity || isNaN(player.duration)) {
						console.log(
							"WebM duration unknown: Allowing playback, will update duration as available",
						)
						// Allow playback to start immediately
						setIsLoading(false)
						setPlayerReady(true)

						// Try to detect duration in the background without blocking playback
						// Use a small seek (1 second) to trigger duration calculation if possible
						const originalTime = player.currentTime
						player.currentTime = Math.min(1, originalTime + 0.1)

						// Reset to original position after a brief moment
						setTimeout(() => {
							player.currentTime = originalTime
						}, 100)
					} else {
						// Normal case: duration is valid
						setIsLoading(false)
						setPlayerReady(true)
					}
				})

				// Monitor duration changes - critical for WebM files
				player.on("durationchange", () => {
					console.log("Duration changed:", player.duration)
					// WebM files may update duration as the file is processed
					// Just log the update, don't change loading state since we're already allowing playback
					if (
						player.duration &&
						player.duration !== Infinity &&
						!isNaN(player.duration)
					) {
						console.log("Real duration detected:", player.duration)
						// Ensure player is ready if it wasn't already
						setPlayerReady(true)
					}
				})

				player.on("canplay", () => {
					setIsLoading(false)
					setPlayerReady(true)
				})

				player.on("loadeddata", () => {
					setIsLoading(false)
					setPlayerReady(true)
				})

				player.on("error", (error: Error) => {
					console.error(getLocalizedText("playerError"), error)
					setIsLoading(false)
					setPlayerReady(false)
				})

				// Fullscreen event listeners
				player.on("fullscreenchange", (isFullscreen: boolean) => {
					console.log("Fullscreen changed:", isFullscreen)
					if (isFullscreen) {
						// Ensure video fills the screen properly
						player.resize()
					}
				})

				// Listen for browser fullscreen changes
				const handleFullscreenChange = () => {
					if (playerRef.current) {
						// Delay resize to ensure proper dimensions
						setTimeout(() => {
							if (playerRef.current) {
								playerRef.current.resize()
							}
						}, 100)
					}
				}
				document.addEventListener("fullscreenchange", handleFullscreenChange)

				// Store the handler for cleanup
				;(player as any).fullscreenHandler = handleFullscreenChange
			} catch (error) {
				console.error("Failed to initialize player:", error)
				setIsLoading(false)
				setPlayerReady(false)
			}
		}

		// Start initialization after a short delay
		const timer = setTimeout(initPlayer, 50)

		return () => {
			clearTimeout(timer)

			// Remove fullscreen event listener
			const player = playerRef.current as any
			if (player && player.fullscreenHandler) {
				document.removeEventListener("fullscreenchange", player.fullscreenHandler)
			}

			if (playerRef.current) {
				try {
					playerRef.current.destroy()
				} catch (error) {
					console.error("Error destroying player:", error)
				}
				playerRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileUrl])

	return {
		playerRef,
		isLoading,
		playerReady,
	}
}
