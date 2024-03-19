import type { InitializationState } from "../types"

const STORAGE_KEY = "magic_initialization_state"

/**
 * 保存初始化状态到 sessionStorage
 */
export function saveInitializationState(state: InitializationState): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
	} catch (error) {
		console.error("Failed to save initialization state:", error)
	}
}

/**
 * 从 sessionStorage 加载初始化状态
 */
export function loadInitializationState(): InitializationState | null {
	try {
		const data = sessionStorage.getItem(STORAGE_KEY)
		return data ? JSON.parse(data) : null
	} catch (error) {
		console.error("Failed to load initialization state:", error)
		return null
	}
}

/**
 * 清除 sessionStorage 中的初始化状态
 */
export function clearInitializationState(): void {
	try {
		sessionStorage.removeItem(STORAGE_KEY)
	} catch (error) {
		console.error("Failed to clear initialization state:", error)
	}
}
