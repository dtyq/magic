import { useEffect, useCallback } from "react"
import {
	PPT_EVENTS,
	type DownloadEventPayload,
	type FullscreenStateChangePayload,
} from "../events/PPTEventBus"
import { usePPTEventBusContext } from "../contexts/PPTContext"

/**
 * Hook to use PPT Event Bus
 * Provides typed methods for subscribing and publishing PPT events
 */
export function usePPTEventBus() {
	const eventBus = usePPTEventBusContext()

	// Download event
	const onDownloadRequest = useCallback(
		(callback: (payload: DownloadEventPayload) => void) => {
			return eventBus.on<DownloadEventPayload>(PPT_EVENTS.DOWNLOAD, callback)
		},
		[eventBus],
	)

	const emitDownload = useCallback(
		(payload: DownloadEventPayload) => {
			eventBus.emit<DownloadEventPayload>(PPT_EVENTS.DOWNLOAD, payload)
		},
		[eventBus],
	)

	// Fullscreen toggle event
	const onFullscreenToggle = useCallback(
		(callback: () => void) => {
			return eventBus.on(PPT_EVENTS.FULLSCREEN_TOGGLE, callback)
		},
		[eventBus],
	)

	const emitFullscreenToggle = useCallback(() => {
		eventBus.emit(PPT_EVENTS.FULLSCREEN_TOGGLE)
	}, [eventBus])

	// Fullscreen state change event
	const onFullscreenStateChange = useCallback(
		(callback: (payload: FullscreenStateChangePayload) => void) => {
			return eventBus.on<FullscreenStateChangePayload>(
				PPT_EVENTS.FULLSCREEN_STATE_CHANGE,
				callback,
			)
		},
		[eventBus],
	)

	const emitFullscreenStateChange = useCallback(
		(isFullscreen: boolean) => {
			eventBus.emit<FullscreenStateChangePayload>(PPT_EVENTS.FULLSCREEN_STATE_CHANGE, {
				isFullscreen,
			})
		},
		[eventBus],
	)

	return {
		// Download
		onDownloadRequest,
		emitDownload,
		// Fullscreen toggle
		onFullscreenToggle,
		emitFullscreenToggle,
		// Fullscreen state
		onFullscreenStateChange,
		emitFullscreenStateChange,
	}
}

/**
 * Hook to listen to fullscreen state changes
 * Automatically subscribes/unsubscribes on mount/unmount
 */
export function useFullscreenState(callback: (isFullscreen: boolean) => void) {
	const { onFullscreenStateChange } = usePPTEventBus()

	useEffect(() => {
		const unsubscribe = onFullscreenStateChange((payload) => {
			callback(payload.isFullscreen)
		})
		return unsubscribe
	}, [callback, onFullscreenStateChange])
}
