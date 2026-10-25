type MetricsWindow = Window & { __MAGIC_DOCUMENT_FLOW_METRICS__?: boolean }

/** Report natural dimensions because cross-origin parents cannot measure this document. */
export default function install({ parentOrigin }: { parentOrigin: string }): void {
	const sandbox = window as MetricsWindow
	if (sandbox.__MAGIC_DOCUMENT_FLOW_METRICS__) return
	sandbox.__MAGIC_DOCUMENT_FLOW_METRICS__ = true
	let frameId = 0
	let settledTimer: ReturnType<typeof setTimeout> | null = null

	function getDimension(property: "scrollHeight" | "scrollWidth"): number {
		const root = document.documentElement
		const body = document.body
		const rectProperty = property === "scrollHeight" ? "height" : "width"
		return Math.ceil(
			Math.max(
				root ? Number(root[property]) || 0 : 0,
				body ? Number(body[property]) || 0 : 0,
				root ? root.getBoundingClientRect()[rectProperty] : 0,
				body ? body.getBoundingClientRect()[rectProperty] : 0,
			),
		)
	}
	function report(phase: "initial" | "settled"): void {
		try {
			window.parent.postMessage(
				{
					type: "contentMetrics",
					contentWidth: getDimension("scrollWidth"),
					contentHeight: getDimension("scrollHeight"),
					phase,
				},
				parentOrigin,
			)
		} catch {
			// Measurement must not interrupt a sandbox when its parent cannot receive messages.
		}
	}
	function scheduleReport(): void {
		if (frameId) cancelAnimationFrame(frameId)
		frameId = requestAnimationFrame(() => {
			frameId = 0
			report("initial")
		})
		if (settledTimer) clearTimeout(settledTimer)
		settledTimer = setTimeout(() => report("settled"), 200)
	}
	function observe(): void {
		const root = document.documentElement
		const body = document.body
		if (!root || !body) return
		if (typeof ResizeObserver !== "undefined") {
			const observer = new ResizeObserver(scheduleReport)
			observer.observe(root)
			observer.observe(body)
		}
		if (typeof MutationObserver !== "undefined") {
			const observer = new MutationObserver(scheduleReport)
			observer.observe(root, {
				attributes: true,
				attributeFilter: ["class", "style"],
				childList: true,
				subtree: true,
				characterData: true,
			})
		}
		scheduleReport()
	}
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", observe, { once: true })
	else observe()
	window.addEventListener("load", scheduleReport, { once: true })
}
