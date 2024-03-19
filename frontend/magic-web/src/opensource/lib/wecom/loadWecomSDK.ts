export type { WWLoginInstance, WWLoginOptions } from "@wecom/jssdk"

// 使用模块类型而不是自定义接口
export type WecomSDK = typeof import("@wecom/jssdk")

/**
 * Dynamically loads the WecomSDK from the @wecom/jssdk package
 * @description Load WecomSDK on demand to avoid blocking initial page load
 * Uses caching to prevent duplicate loading and ensure singleton pattern
 * @returns Promise that resolves to the WecomSDK instance
 * @throws Error if the SDK fails to load
 */
function generateLoadWecomSDK() {
	// Cache for the loading promise to avoid multiple concurrent loads
	let loadingPromise: Promise<WecomSDK> | null = null

	return (): Promise<WecomSDK> => {
		// Return existing promise if already loading/loaded
		if (loadingPromise) {
			return loadingPromise
		}

		// First time loading - create and cache the promise
		loadingPromise = import("@wecom/jssdk").catch((error) => {
			// Reset cache on error to allow retry
			loadingPromise = null
			throw error
		})

		return loadingPromise
	}
}

// Create a shared instance for convenience
export const loadWecomSDK = generateLoadWecomSDK()
