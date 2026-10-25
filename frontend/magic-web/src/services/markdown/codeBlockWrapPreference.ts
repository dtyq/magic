import { useCallback, useSyncExternalStore } from "react"
import { platformKey } from "@/utils/storage"

export const MARKDOWN_CODE_WRAP_STORAGE_KEY = platformKey("super_magic/markdown/code_block_wrap")

const DEFAULT_MARKDOWN_CODE_WRAP = false

type CodeBlockWrapListener = () => void

const subscribeDisabled = () => () => undefined
const getDisabledSnapshot = () => DEFAULT_MARKDOWN_CODE_WRAP

let codeBlockWrapValue: boolean | undefined
const codeBlockWrapListeners = new Set<CodeBlockWrapListener>()
let hasStorageListener = false

function readCodeBlockWrapPreference(): boolean {
	if (typeof window === "undefined") return DEFAULT_MARKDOWN_CODE_WRAP

	try {
		const storedValue = window.localStorage.getItem(MARKDOWN_CODE_WRAP_STORAGE_KEY)
		if (storedValue === "true") return true
		if (storedValue === "false") return false
	} catch {
		// 受限 WebView 或隐私模式可能禁止访问存储，回退到默认展示状态。
	}

	return DEFAULT_MARKDOWN_CODE_WRAP
}

function getCodeBlockWrapSnapshot(): boolean {
	if (codeBlockWrapValue === undefined) {
		codeBlockWrapValue = readCodeBlockWrapPreference()
	}

	return codeBlockWrapValue
}

function subscribeCodeBlockWrap(listener: CodeBlockWrapListener): () => void {
	if (typeof window !== "undefined" && !hasStorageListener) {
		window.addEventListener("storage", (event) => {
			if (event.key !== MARKDOWN_CODE_WRAP_STORAGE_KEY) return

			codeBlockWrapValue = readCodeBlockWrapPreference()
			codeBlockWrapListeners.forEach((currentListener) => currentListener())
		})
		hasStorageListener = true
	}

	codeBlockWrapListeners.add(listener)
	return () => codeBlockWrapListeners.delete(listener)
}

function setCodeBlockWrapPreference(nextValue: boolean): void {
	codeBlockWrapValue = nextValue
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(MARKDOWN_CODE_WRAP_STORAGE_KEY, String(nextValue))
		} catch {
			// 存储失败不应阻塞本次 UI 操作，内存状态仍然立即生效。
		}
	}

	codeBlockWrapListeners.forEach((listener) => listener())
}

export function useCodeBlockWrapPreference(enabled = true): {
	isWrapped: boolean
	toggle: () => void
} {
	const isWrapped = useSyncExternalStore(
		enabled ? subscribeCodeBlockWrap : subscribeDisabled,
		enabled ? getCodeBlockWrapSnapshot : getDisabledSnapshot,
		() => DEFAULT_MARKDOWN_CODE_WRAP,
	)

	const toggle = useCallback(() => {
		if (enabled) setCodeBlockWrapPreference(!isWrapped)
	}, [enabled, isWrapped])

	return { isWrapped, toggle }
}
