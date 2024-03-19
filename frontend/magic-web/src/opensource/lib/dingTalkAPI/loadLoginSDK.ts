import type { DingTalk } from "../../../../types/dingTalk"

// Script source URL for DingTalk login SDK
const DINGTALK_LOGIN_SDK_URL = "https://g.alicdn.com/dingding/h5-dingtalk-login/0.21.0/ddlogin.js"

/**
 * Dynamically loads the DingTalk login SDK script from CDN
 * @description Load DingTalk login SDK on demand to avoid blocking initial page load
 * Uses caching to prevent duplicate script loading
 * @returns Promise that resolves to the DTFrameLogin API instance
 * @throws Error if the script fails to load
 */
function generateLoadLoginSDK() {
	// Cache for the loading promise to avoid multiple concurrent loads
	let loadingPromise: Promise<DingTalk.DTFrameLoginAPI> | null = null
	return (): Promise<DingTalk.DTFrameLoginAPI> => {
		// If SDK is already loaded, return immediately
		if (window.DTFrameLogin) {
			return Promise.resolve(window.DTFrameLogin)
		}

		// If loading is already in progress, return the existing promise
		if (loadingPromise) {
			return loadingPromise
		}

		// Create new loading promise and cache it
		loadingPromise = new Promise((resolve, reject) => {
			// Create script element for lazy loading DingTalk login SDK
			const script = document.createElement("script")
			script.src = DINGTALK_LOGIN_SDK_URL

			// Handle successful script loading
			script.onload = () => {
				resolve(window.DTFrameLogin)
			}

			// Handle script loading errors
			script.onerror = (error) => {
				// Reset loading promise on error to allow retry
				loadingPromise = null
				reject(error)
			}

			// Append script to document body to start loading
			document.body.appendChild(script)
		})

		return loadingPromise
	}
}

// Create a shared instance for convenience
export const loadLoginSDK = generateLoadLoginSDK()
