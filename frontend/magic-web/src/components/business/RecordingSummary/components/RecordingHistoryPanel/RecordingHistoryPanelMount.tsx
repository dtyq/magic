import { lazy, Suspense, useCallback, useEffect, useState } from "react"

const QUERY_PARAM_KEY = "recording_history"
const TRUTHY = new Set(["1", "true", "open", "yes"])

// Lazy-load the panel so the feature only costs bundle when triggered
const LazyPanel = lazy(() => import("./index"))

function readInitialOpen(): boolean {
	if (typeof window === "undefined") return false
	try {
		const params = new URLSearchParams(window.location.search)
		const value = params.get(QUERY_PARAM_KEY)
		return value !== null && TRUTHY.has(value.toLowerCase())
	} catch {
		return false
	}
}

/**
 * Remove the trigger query param from current URL without triggering navigation
 * 关闭面板时移除 URL 中的触发参数
 */
function stripTriggerParam(): void {
	if (typeof window === "undefined") return
	try {
		const url = new URL(window.location.href)
		if (!url.searchParams.has(QUERY_PARAM_KEY)) return
		url.searchParams.delete(QUERY_PARAM_KEY)
		const nextSearch = url.searchParams.toString()
		const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`
		window.history.replaceState(window.history.state, "", nextUrl)
	} catch {
		/* noop */
	}
}

/**
 * Global mount that listens for the `recording_history` query param
 * 监听查询参数、按需渲染历史面板
 */
function RecordingHistoryPanelMount() {
	const [open, setOpen] = useState<boolean>(() => readInitialOpen())

	// Re-sync on browser back/forward navigation
	useEffect(() => {
		if (typeof window === "undefined") return

		const handler = () => setOpen(readInitialOpen())
		window.addEventListener("popstate", handler)
		return () => window.removeEventListener("popstate", handler)
	}, [])

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next)
		if (!next) {
			stripTriggerParam()
		}
	}, [])

	if (!open) return null

	return (
		<Suspense fallback={null}>
			<LazyPanel open={open} onOpenChange={handleOpenChange} />
		</Suspense>
	)
}

export default RecordingHistoryPanelMount
