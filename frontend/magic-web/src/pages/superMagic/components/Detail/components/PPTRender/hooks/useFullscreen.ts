import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { isMagicApp } from "@/utils/devices"
import { retainMobilePresentationLayout } from "@/stores/layout/mobilePresentationLayout"

interface UseFullscreenOptions {
	containerRef: RefObject<HTMLElement>
	presenterTargetRef?: RefObject<HTMLElement>
	presenterEnabled?: boolean
	/** Preserve the mobile route and preview shell while orientation changes their viewport. */
	preserveMobileLayout?: boolean
	/** Runs for every entry path, including F11 and iframe shortcuts; exiting stays unconditional. */
	beforeEnter?: () => boolean | Promise<boolean>
}

interface UseFullscreenReturn {
	isFullscreen: boolean
	isPresenterView: boolean
	toggleFullscreen: () => Promise<void>
	exitFullscreen: () => Promise<void>
}

type PresenterAttemptResult = "entered" | "skipped" | "target-failed"

type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null
	webkitExitFullscreen?: () => Promise<void> | void
}

interface WindowManagementScreen {
	left?: number
	top?: number
	width?: number
	height?: number
}

interface ScreenDetailsLike {
	currentScreen: WindowManagementScreen
	screens: WindowManagementScreen[]
}

type WindowWithScreenDetails = Window & {
	getScreenDetails?: () => Promise<ScreenDetailsLike>
}

type ScreenWithExtensionState = Screen & {
	isExtended?: boolean
}

type WindowManagementPermissionDescriptor = PermissionDescriptor & {
	name: "window-management"
}

interface NavigatorWithWindowManagementPermission {
	permissions?: {
		query: (descriptor: WindowManagementPermissionDescriptor) => Promise<PermissionStatus>
	}
}

type FullscreenElement = HTMLElement & {
	requestFullscreen?: (
		options?: FullscreenOptions & { screen?: WindowManagementScreen },
	) => Promise<void>
	webkitRequestFullscreen?: () => Promise<void> | void
}

type ScreenOrientationWithLock = ScreenOrientation & {
	lock?: (orientation: "landscape" | "portrait") => Promise<void>
	unlock?: () => void
}

function getFullscreenElement(): Element | null {
	const fullscreenDocument = document as FullscreenDocument
	return document.fullscreenElement || fullscreenDocument.webkitFullscreenElement || null
}

function hasSameBounds(left: WindowManagementScreen, right: WindowManagementScreen) {
	return (
		left.left === right.left &&
		left.top === right.top &&
		left.width === right.width &&
		left.height === right.height
	)
}

function findExternalScreen(details: ScreenDetailsLike) {
	return details.screens.find(
		(screen) =>
			screen !== details.currentScreen && !hasSameBounds(screen, details.currentScreen),
	)
}

async function lockLandscapeOrientation() {
	const orientation = window.screen?.orientation as ScreenOrientationWithLock | undefined
	if (!orientation?.lock) return
	try {
		await orientation.lock("landscape")
	} catch {
		// Orientation lock requires an installed/PWA or platform permission in some
		// browsers; fullscreen remains useful when the optional capability is denied.
	}
}

function unlockScreenOrientation() {
	const orientation = window.screen?.orientation as ScreenOrientationWithLock | undefined
	orientation?.unlock?.()
}

/**
 * Manages ordinary PPT fullscreen and the Window Management API presenter mode.
 * Presenter mode fullscreens only the slide stage on an external display; the
 * original window remains on the current display with notes and controls.
 */
export function useFullscreen({
	containerRef,
	presenterTargetRef,
	presenterEnabled = false,
	preserveMobileLayout = false,
	beforeEnter,
}: UseFullscreenOptions): UseFullscreenReturn {
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isPresenterView, setIsPresenterView] = useState(false)
	const skipPresenterAttemptRef = useRef(false)
	const resetPresenterSkipOnExitRef = useRef(false)
	const fullscreenModeRef = useRef<"native" | "css" | null>(null)
	const releaseMobileLayoutRef = useRef<(() => void) | null>(null)
	const releaseMobileLayout = useMemoizedFn(() => {
		releaseMobileLayoutRef.current?.()
		releaseMobileLayoutRef.current = null
	})

	const exitNativeFullscreen = useMemoizedFn(async () => {
		const fullscreenDocument = document as FullscreenDocument
		const exitDocumentFullscreen =
			document.exitFullscreen || fullscreenDocument.webkitExitFullscreen
		if (!exitDocumentFullscreen) return
		await exitDocumentFullscreen.call(document)
	})

	const exitFullscreen = useMemoizedFn(async () => {
		try {
			if (isMagicApp) {
				fullscreenModeRef.current = null
				releaseMobileLayout()
				setIsFullscreen(false)
				setIsPresenterView(false)
				unlockScreenOrientation()
				return
			}
			const fullscreenElement = getFullscreenElement()
			if (
				fullscreenElement === containerRef.current ||
				fullscreenElement === presenterTargetRef?.current
			) {
				await exitNativeFullscreen()
			}
			fullscreenModeRef.current = null
			releaseMobileLayout()
			setIsFullscreen(false)
			setIsPresenterView(false)
			unlockScreenOrientation()
		} catch (error) {
			console.error("Exit fullscreen error:", error)
		}
	})

	const tryEnterPresenterView = useMemoizedFn(async (): Promise<PresenterAttemptResult> => {
		const screenWindow = window as WindowWithScreenDetails
		const target = presenterTargetRef?.current as FullscreenElement | null | undefined
		if (
			skipPresenterAttemptRef.current ||
			isMagicApp ||
			!presenterEnabled ||
			!screenWindow.getScreenDetails ||
			!target?.requestFullscreen
		) {
			return "skipped"
		}
		const screen = window.screen as ScreenWithExtensionState
		if (screen.isExtended === false) return "skipped"
		try {
			const permissionApi = (navigator as unknown as NavigatorWithWindowManagementPermission)
				.permissions
			const permission = await permissionApi?.query({
				name: "window-management",
			} as WindowManagementPermissionDescriptor)
			if (permission?.state === "denied") return "skipped"
		} catch {
			// Older Chromium builds expose getScreenDetails without recognizing the
			// permission descriptor. Let the API itself decide in that case.
		}

		let screenDetails: ScreenDetailsLike
		try {
			// This follows the Window Management API's projected-presentation flow:
			// screen enumeration and targeted fullscreen stay in the same user gesture.
			screenDetails = await screenWindow.getScreenDetails()
		} catch {
			return "skipped"
		}
		const externalScreen = findExternalScreen(screenDetails)
		if (!externalScreen) return "skipped"

		try {
			await target.requestFullscreen({ screen: externalScreen })
			fullscreenModeRef.current = "native"
			skipPresenterAttemptRef.current = false
			setIsFullscreen(true)
			setIsPresenterView(true)
			return "entered"
		} catch {
			// requestFullscreen may consume transient activation before rejecting. Keep
			// today's ordinary fallback, but skip presenter negotiation on the next click
			// so that gesture goes directly to the stable single-window path.
			skipPresenterAttemptRef.current = true
			return "target-failed"
		}
	})

	const toggleFullscreen = useCallback(async () => {
		if (!isFullscreen && !getFullscreenElement() && beforeEnter) {
			try {
				const result = beforeEnter()
				// A clean visible slide must enter in the original user gesture, without a microtask.
				if (typeof result === "boolean" ? !result : !(await result)) return
			} catch (error) {
				console.error("Presentation entry guard failed:", error)
				return
			}
		}
		// Retain before requesting native fullscreen: orientation can resize ancestors before it resolves.
		if (!isFullscreen && !getFullscreenElement() && preserveMobileLayout) {
			releaseMobileLayoutRef.current ??= retainMobilePresentationLayout()
		}
		try {
			// Native fullscreen is unreliable inside the mobile app WebView; its fixed layout is the
			// fullscreen surface, so only the local CSS state needs to change there.
			if (isMagicApp) {
				fullscreenModeRef.current = isFullscreen ? null : "css"
				if (isFullscreen) releaseMobileLayout()
				setIsFullscreen((current) => !current)
				setIsPresenterView(false)
				if (isFullscreen) unlockScreenOrientation()
				else void lockLandscapeOrientation()
				return
			}

			if (!getFullscreenElement()) {
				// CSS fullscreen fallback (WebView and browsers without Fullscreen API).
				if (isFullscreen) {
					fullscreenModeRef.current = null
					releaseMobileLayout()
					setIsFullscreen(false)
					setIsPresenterView(false)
					unlockScreenOrientation()
					return
				}
				const presenterAttempt = await tryEnterPresenterView()
				if (presenterAttempt === "entered") return
				const isPresenterFallbackRecovery =
					presenterAttempt === "skipped" && skipPresenterAttemptRef.current

				// Existing single-window fullscreen is the compatibility fallback.
				if (containerRef.current) {
					const fullscreenContainer = containerRef.current as FullscreenElement
					const requestFullscreen =
						fullscreenContainer.requestFullscreen ||
						fullscreenContainer.webkitRequestFullscreen
					if (!requestFullscreen) {
						const isCoarsePointer =
							window.matchMedia?.("(pointer: coarse)")?.matches ?? false
						if (isCoarsePointer) {
							fullscreenModeRef.current = "css"
							setIsFullscreen(true)
							setIsPresenterView(false)
							await lockLandscapeOrientation()
						}
						return
					}
					await requestFullscreen.call(fullscreenContainer)
					fullscreenModeRef.current = "native"
					// A direct fallback that succeeds after the presenter breaker was opened
					// restores presenter negotiation only after this fullscreen session exits.
					resetPresenterSkipOnExitRef.current = isPresenterFallbackRecovery
					setIsFullscreen(true)
					setIsPresenterView(false)
					await lockLandscapeOrientation()
				}
			} else {
				await exitNativeFullscreen()
				fullscreenModeRef.current = null
				releaseMobileLayout()
				setIsFullscreen(false)
				setIsPresenterView(false)
				unlockScreenOrientation()
			}
		} catch (error) {
			console.error("Fullscreen error:", error)
			// Some mobile WebViews expose requestFullscreen but reject it at runtime.
			// Keep the CSS fallback limited to coarse-pointer devices; desktop permission
			// failures must remain visible instead of being reported as fullscreen.
			const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false
			if (isCoarsePointer) {
				fullscreenModeRef.current = "css"
				setIsFullscreen(true)
				setIsPresenterView(false)
				await lockLandscapeOrientation()
			}
		} finally {
			if (!fullscreenModeRef.current) releaseMobileLayout()
		}
	}, [
		beforeEnter,
		containerRef,
		exitNativeFullscreen,
		isFullscreen,
		preserveMobileLayout,
		releaseMobileLayout,
		tryEnterPresenterView,
	])

	useEffect(() => {
		function handleFullscreenChange() {
			// Safari/WebView CSS presentation does not own native fullscreen events.
			if (fullscreenModeRef.current === "css") return
			const fullscreenElement = getFullscreenElement()
			const containerFullscreen = fullscreenElement === containerRef.current
			const presenterFullscreen = fullscreenElement === presenterTargetRef?.current
			fullscreenModeRef.current = containerFullscreen || presenterFullscreen ? "native" : null
			setIsFullscreen(containerFullscreen || presenterFullscreen)
			setIsPresenterView(presenterFullscreen)
			if (!containerFullscreen && !presenterFullscreen) {
				releaseMobileLayout()
				if (resetPresenterSkipOnExitRef.current) {
					resetPresenterSkipOnExitRef.current = false
					skipPresenterAttemptRef.current = false
				}
				unlockScreenOrientation()
			}
		}

		document.addEventListener("fullscreenchange", handleFullscreenChange)
		document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange)
			document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
		}
	}, [containerRef, presenterTargetRef, releaseMobileLayout])

	useEffect(
		() => () => {
			fullscreenModeRef.current = null
			releaseMobileLayout()
			unlockScreenOrientation()
		},
		[releaseMobileLayout],
	)

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
						if (isFullscreen) exitFullscreen()
						break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [toggleFullscreen, exitFullscreen, isFullscreen])

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			switch (event.key) {
				case "Escape":
					if (isFullscreen) exitFullscreen()
					break
				case "F11":
					event.preventDefault()
					toggleFullscreen()
					break
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [isFullscreen, toggleFullscreen, exitFullscreen])

	return {
		isFullscreen,
		isPresenterView,
		toggleFullscreen,
		exitFullscreen,
	}
}
