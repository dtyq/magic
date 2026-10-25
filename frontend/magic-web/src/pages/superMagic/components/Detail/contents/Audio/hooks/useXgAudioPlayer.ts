import { useRef, useEffect, useState, useCallback } from "react"
import type Player from "@/infrastructure/vendors/xgplayer"
import { loadXGPlayer, loadXGPlayerModules } from "@/infrastructure/vendors/xgplayer"
import type { GetTemporaryDownloadUrlItem } from "@/pages/superMagic/utils/api"
import { parseExpiresAt } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import { SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS } from "@/pages/superMagic/services/sharedMediaUrlCache"

export type UseXgAudioPlayerMode = "music" | "core"

interface UseXgAudioPlayerProps {
	fileId?: string
	fileUrl?: string
	fileResource?: GetTemporaryDownloadUrlItem | null
	refreshFileUrl?: () => Promise<GetTemporaryDownloadUrlItem | null>
	fileName?: string
	audioPlayerMode?: UseXgAudioPlayerMode
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
	fileId,
	fileUrl,
	fileResource,
	refreshFileUrl,
	fileName,
	audioPlayerMode = "music",
	onPlay,
	onPause,
	onTimeUpdate,
}: UseXgAudioPlayerProps) {
	const playerRef = useRef<Player | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const volumeRef = useRef(1)
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const refreshAttemptedRef = useRef(false)
	const refreshPendingRef = useRef(false)
	const destroyingRef = useRef(false)
	const playbackStateRef = useRef({ current: 0, shouldResume: false, muted: false, rate: 1 })
	const [state, setState] = useState<AudioPlayerState>({
		isPlaying: false,
		duration: 0,
		current: 0,
		volume: 1,
		isMuted: false,
		isLoading: false,
		error: null,
	})

	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
		refreshTimerRef.current = null
	}, [])

	const refreshWhenPlaying = useCallback(() => {
		clearRefreshTimer()
		const expiresAt = parseExpiresAt(fileResource?.expires_at)
		if (!expiresAt || !playbackStateRef.current.shouldResume || !refreshFileUrl) return
		const delay = Math.max(0, expiresAt - Date.now() - SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS)
		refreshTimerRef.current = setTimeout(() => {
			if (refreshPendingRef.current || !playbackStateRef.current.shouldResume) return
			refreshPendingRef.current = true
			void refreshFileUrl().finally(() => {
				refreshPendingRef.current = false
			})
		}, delay)
	}, [clearRefreshTimer, fileResource, refreshFileUrl])

	useEffect(() => {
		refreshAttemptedRef.current = false
		playbackStateRef.current = { current: 0, shouldResume: false, muted: false, rate: 1 }
	}, [fileId])

	// Initialize player
	const initPlayer = useCallback(async () => {
		if (!fileUrl || !containerRef.current || playerRef.current) {
			return
		}

		try {
			setState((prev) => ({ ...prev, isLoading: true, error: null }))

			// Keep the historical music preset as the default. Native iOS can opt into
			// the core-only path because the preset is unnecessary for a single WAV.
			let LoadedPlayer: typeof import("xgplayer").default
			let MusicPreset: typeof import("xgplayer-music").default | undefined
			if (audioPlayerMode === "core") {
				LoadedPlayer = await loadXGPlayer()
			} else {
				const modules = await loadXGPlayerModules()
				LoadedPlayer = modules.Player
				MusicPreset = modules.MusicPreset
			}
			if (audioPlayerMode === "music" && !MusicPreset) {
				throw new Error("MusicPreset failed to load")
			}

			const player = new LoadedPlayer({
				el: containerRef.current,
				mediaType: "audio",
				url: fileUrl,
				autoplay: false,
				volume: volumeRef.current,
				width: 0,
				height: 0,
				...(audioPlayerMode === "music"
					? {
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
						}
					: {}),
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
				if (playbackStateRef.current.current > 0) {
					player.currentTime = playbackStateRef.current.current
				}
				player.muted = playbackStateRef.current.muted
				player.playbackRate = playbackStateRef.current.rate
				if (playbackStateRef.current.shouldResume) {
					void Promise.resolve(player.play()).catch(() => undefined)
				}
			})

			player.on("timeupdate", () => {
				const current = player.currentTime || 0
				const duration = player.duration || 0
				playbackStateRef.current.current = current
				setState((prev) => ({
					...prev,
					current,
					duration,
				}))
				onTimeUpdate?.(current, duration)
			})

			player.on("play", () => {
				playbackStateRef.current.shouldResume = true
				refreshWhenPlaying()
				setState((prev) => ({ ...prev, isPlaying: true }))
				onPlay?.()
			})

			player.on("pause", () => {
				if (destroyingRef.current) return
				playbackStateRef.current.shouldResume = false
				clearRefreshTimer()
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
				playbackStateRef.current.muted = player.muted || false
			})

			player.on("ratechange", () => {
				playbackStateRef.current.rate = player.playbackRate || 1
			})

			player.on("error", (error) => {
				console.error("XgPlayer error:", error)
				setState((prev) => ({
					...prev,
					error: "Failed to load audio",
					isLoading: false,
				}))
				if (!refreshAttemptedRef.current && refreshFileUrl) {
					refreshAttemptedRef.current = true
					clearRefreshTimer()
					refreshPendingRef.current = true
					void refreshFileUrl().finally(() => {
						refreshPendingRef.current = false
					})
				}
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
	}, [
		fileUrl,
		fileName,
		audioPlayerMode,
		onPlay,
		onPause,
		onTimeUpdate,
		refreshWhenPlaying,
		clearRefreshTimer,
		refreshFileUrl,
	])

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
		destroyingRef.current = true
		destroyPlayer()
		destroyingRef.current = false
		clearRefreshTimer()
		if (fileUrl) {
			// Add a small delay to ensure DOM is ready
			const timer = setTimeout(initPlayer, 100)
			return () => {
				clearTimeout(timer)
				clearRefreshTimer()
			}
		}
	}, [fileUrl, initPlayer, destroyPlayer, clearRefreshTimer])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			destroyingRef.current = true
			clearRefreshTimer()
			destroyPlayer()
			destroyingRef.current = false
		}
	}, [clearRefreshTimer, destroyPlayer])

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
