import { useEffect, useState } from "react"
import type { IOSKeyboardState } from "./useIOSKeyboard.types"

// Use useLayoutEffect in browser, useEffect in SSR

/**
 * Detect if device is iOS
 */
const isIOSDevice = (): boolean => {
	if (typeof window === "undefined") return false

	return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

/**
 * Detect if device is Android
 */
const isAndroidDevice = (): boolean => {
	if (typeof window === "undefined") return false

	return /Android/.test(navigator.userAgent)
}

/**
 * Detect if browser is Chrome
 */
const isChromeOrChromiumBrowser = (): boolean => {
	if (typeof window === "undefined") return false

	const userAgent = navigator.userAgent
	return /Chrome|Chromium/.test(userAgent) && !/Edge|Edg/.test(userAgent)
}

/**
 * Check if device needs keyboard handling
 */
const needsKeyboardHandling = (): boolean => {
	return isIOSDevice()
}

/**
 * Detect if element can trigger virtual keyboard
 */
const isKeyboardInput = (element: HTMLElement): boolean => {
	const tagName = element.tagName.toLowerCase()

	if (tagName === "input") {
		const inputType = (element as HTMLInputElement).type.toLowerCase()
		return !["button", "submit", "reset", "checkbox", "radio", "file", "image"].includes(
			inputType,
		)
	}

	if (tagName === "textarea") return true
	if (element.hasAttribute("contenteditable")) return true

	return false
}

/**
 * Hook to detect mobile keyboard state (iOS and Android Chrome)
 */
export function useIOSKeyboard() {
	const [keyboardState, setKeyboardState] = useState<IOSKeyboardState>({
		isUp: false,
		offset: 0,
		isVisible: false,
	})

	const [initialViewportHeight, setInitialViewportHeight] = useState<number>(0)

	// Initialize viewport height for Android Chrome
	useEffect(() => {
		if (needsKeyboardHandling()) {
			const height = window.visualViewport?.height || window.innerHeight
			setInitialViewportHeight(height)
		}
	}, [])

	// Listen for Visual Viewport changes (Android Chrome)
	useEffect(() => {
		if (!needsKeyboardHandling()) return

		const handleViewportResize = () => {
			if (isAndroidDevice() && isChromeOrChromiumBrowser()) {
				const currentHeight = window.visualViewport?.height || window.innerHeight
				const heightDifference = initialViewportHeight - currentHeight
				const threshold = 150 // Minimum height change to consider as keyboard

				if (heightDifference > threshold) {
					// Keyboard is open
					setKeyboardState({
						isUp: true,
						offset: heightDifference,
						isVisible: true,
					})
				} else {
					// Keyboard is closed
					setKeyboardState({
						isUp: false,
						offset: 0,
						isVisible: false,
					})
				}
			}
		}

		// For Android Chrome, use Visual Viewport API
		if (window.visualViewport && isAndroidDevice()) {
			window.visualViewport.addEventListener("resize", handleViewportResize)

			return () => {
				window.visualViewport?.removeEventListener("resize", handleViewportResize)
			}
		}
	}, [initialViewportHeight])

	// Listen for focus events to detect keyboard opening (iOS and fallback)
	useEffect(() => {
		if (!needsKeyboardHandling()) return

		const handleFocusIn = (event: FocusEvent) => {
			const target = event.target as HTMLElement
			if (target && isKeyboardInput(target)) {
				if (isIOSDevice()) {
					// iOS specific handling
					const rect = target.getBoundingClientRect()
					const origin = rect.top
					// Small delay to let the keyboard animation start
					setTimeout(() => {
						const rect = target.getBoundingClientRect()
						const newOffset = origin - rect.top
						setKeyboardState({
							isUp: true,
							offset: newOffset,
							isVisible: true,
						})
					}, 100)
				} else if (isAndroidDevice() && !window.visualViewport) {
					// Fallback for Android without Visual Viewport API
					setTimeout(() => {
						const heightDifference = initialViewportHeight - window.innerHeight
						if (heightDifference > 100) {
							setKeyboardState({
								isUp: true,
								offset: heightDifference,
								isVisible: true,
							})
						}
					}, 200)
				}
			}
		}

		const handleFocusOut = (event: FocusEvent) => {
			const target = event.target as HTMLElement
			if (target && isKeyboardInput(target)) {
				if (isIOSDevice()) {
					// iOS specific handling
					const rect = target.getBoundingClientRect()
					const origin = rect.top
					// Delay to let the keyboard animation complete
					setTimeout(() => {
						const rect = target.getBoundingClientRect()
						const newOffset = origin - rect.top
						setKeyboardState({
							isUp: false,
							offset: newOffset,
							isVisible: false,
						})
					}, 300)
				} else if (isAndroidDevice() && !window.visualViewport) {
					// Fallback for Android without Visual Viewport API
					setTimeout(() => {
						setKeyboardState({
							isUp: false,
							offset: 0,
							isVisible: false,
						})
					}, 200)
				}
			}
		}

		document.addEventListener("focusin", handleFocusIn)
		document.addEventListener("focusout", handleFocusOut)

		return () => {
			document.removeEventListener("focusin", handleFocusIn)
			document.removeEventListener("focusout", handleFocusOut)
		}
	}, [initialViewportHeight])

	return {
		...keyboardState,
		isIOSDevice: isIOSDevice(),
		isAndroidDevice: isAndroidDevice(),
		isChromeOrChromiumBrowser: isChromeOrChromiumBrowser(),
		needsKeyboardHandling: needsKeyboardHandling(),
	}
}
