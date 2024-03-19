import { Lark } from "../../../../types/lark"

// Script source URL for Lark login SDK
const LARK_LOGIN_SDK_URL =
	"https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js"

/**
 * Dynamically loads the Lark login SDK script from CDN
 * @description Load Lark login SDK on demand to avoid blocking initial page load
 * Uses caching to prevent duplicate script loading
 * @returns Promise that resolves to the DTFrameLogin API instance
 * @throws Error if the script fails to load
 */
function generateLoadLoginSDK() {
	// Cache for the loading promise to avoid multiple concurrent loads
	let loadingPromise: Promise<Lark.LarkQRLogin> | null = null
	return (): Promise<Lark.LarkQRLogin> => {
		// If SDK is already loaded, return immediately
		if (window.QRLogin) {
			return Promise.resolve(window.QRLogin)
		}

		// If loading is already in progress, return the existing promise
		if (loadingPromise) {
			return loadingPromise
		}

		// Create new loading promise and cache it
		loadingPromise = new Promise((resolve, reject) => {
			// Create script element for lazy loading Lark login SDK
			const script = document.createElement("script")
			script.src = LARK_LOGIN_SDK_URL

			// Handle successful script loading
			script.onload = () => {
				resolve(window.QRLogin)
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
