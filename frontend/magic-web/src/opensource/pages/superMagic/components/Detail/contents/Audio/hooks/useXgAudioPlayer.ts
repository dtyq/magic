import { useRef, useEffect, useState, useCallback } from "react"
import type Player from "xgplayer"
import { loadXGPlayerModules } from "@/opensource/lib/xgplayer"

interface UseXgAudioPlayerProps {
	fileUrl?: string
	fileName?: string
	onPlay?: () => void
	onPause?: () => void
	onTimeUpdate?: (current: number, duration: number) => void
}

interface AudioPlayerState {
	isPlaying: boolean
	duration: number
	current: number
	volume: number
	isMuted: boolean
	isLoading: boolean
	error: string | null
}

export function useXgAudioPlayer({
	fileUrl,
	fileName,
	onPlay,
	onPause,
	onTimeUpdate,
}: UseXgAudioPlayerProps) {
	const playerRef = useRef<Player | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const volumeRef = useRef(1)
	const [state, setState] = useState<AudioPlayerState>({
		isPlaying: false,
		duration: 0,
		current: 0,
		volume: 1,
		isMuted: false,
		isLoading: false,
		error: null,
	})

	// Initialize player
	const initPlayer = useCallback(async () => {
		if (!fileUrl || !containerRef.current || playerRef.current) {
			return
		}

		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }))

			// Load XGPlayer modules on demand
			const { Player, MusicPreset } = await loadXGPlayerModules()

			const player = new Player({
				el: containerRef.current,
				mediaType: "audio",
				url: fileUrl,
				autoplay: false,
				volume: volumeRef.current,
				width: 0,
				height: 0,
				music: {
					list: [
						{
							src: fileUrl,
							title: fileName || "Unknown",
							vid: "audio-player",
						},
					],
					switchKeepProgress: false,
				},
				presets: [MusicPreset],
				// Hide default controls since we use custom UI
				controls: false,
				playsinline: true,
			})

			// Event listeners
			player.on("loadedmetadata", () => {
				setState((prev) => ({
					...prev,
					duration: player.duration || 0,
					isLoading: false,
				}))
			})

			player.on("timeupdate", () => {
				const current = player.currentTime || 0
				const duration = player.duration || 0
				setState((prev) => ({
					...prev,
					current,
					duration,
				}))
				onTimeUpdate?.(current, duration)
			})

			player.on("play", () => {
				setState((prev) => ({ ...prev, isPlaying: true }))
				onPlay?.()
			})

			player.on("pause", () => {
				setState((prev) => ({ ...prev, isPlaying: false }))
				onPause?.()
			})

			player.on("volumechange", () => {
				volumeRef.current = player.volume || 0
				setState((prev) => ({
					...prev,
					volume: player.volume || 0,
					isMuted: player.muted || false,
				}))
			})

			player.on("error", (error) => {
				console.error("XgPlayer error:", error)
				setState((prev) => ({
					...prev,
					error: "Failed to load audio",
					isLoading: false,
				}))
			})

			player.on("canplay", () => {
				setState((prev) => ({ ...prev, isLoading: false }))
			})

			volumeRef.current = player.volume || volumeRef.current
			playerRef.current = player
		} catch (error) {
			console.error("Failed to initialize XgPlayer:", error)
			setState((prev) => ({
				...prev,
				error: "Failed to initialize player",
				isLoading: false,
			}))
		}
	}, [fileUrl, fileName, onPlay, onPause, onTimeUpdate])

	// Cleanup player
	const destroyPlayer = useCallback(() => {
		if (playerRef.current) {
			try {
				playerRef.current.destroy()
			} catch (error) {
				console.error("Error destroying player:", error)
			}
			playerRef.current = null
		}
	}, [])

	// Player controls
	const play = useCallback(() => {
		if (playerRef.current) {
			playerRef.current.play()
		}
	}, [])

	const pause = useCallback(() => {
		if (playerRef.current) {
			playerRef.current.pause()
		}
	}, [])

	const togglePlay = useCallback(() => {
		if (state.isPlaying) {
			pause()
		} else {
			play()
		}
	}, [state.isPlaying, play, pause])

	const seek = useCallback((time: number) => {
		if (playerRef.current && isFinite(time) && time >= 0) {
			playerRef.current.currentTime = time
		}
	}, [])

	const setVolume = useCallback((volume: number) => {
		if (playerRef.current) {
			const clampedVolume = Math.min(1, Math.max(0, volume))
			playerRef.current.volume = clampedVolume
			volumeRef.current = clampedVolume
			// Unmute if setting volume > 0
			if (clampedVolume > 0 && playerRef.current.muted) {
				playerRef.current.muted = false
			}
			const muted = playerRef.current.muted || false
			setState((prev) => ({
				...prev,
				volume: clampedVolume,
				isMuted: muted,
			}))
		}
	}, [])

	const toggleMute = useCallback(() => {
		if (playerRef.current) {
			const nextMuted = !playerRef.current.muted
			playerRef.current.muted = nextMuted
			setState((prev) => ({
				...prev,
				isMuted: nextMuted,
			}))
		}
	}, [])

	// Effect to reinitialize player when URL changes
	useEffect(() => {
		destroyPlayer()
		if (fileUrl) {
			// Add a small delay to ensure DOM is ready
			const timer = setTimeout(initPlayer, 100)
			return () => clearTimeout(timer)
		}
	}, [fileUrl, initPlayer, destroyPlayer])

	// Cleanup on unmount
	useEffect(() => {
		return destroyPlayer
	}, [destroyPlayer])

	return {
		containerRef,
		player: playerRef.current,
		...state,
		// Controls
		play,
		pause,
		togglePlay,
		seek,
		setVolume,
		toggleMute,
	}
}
