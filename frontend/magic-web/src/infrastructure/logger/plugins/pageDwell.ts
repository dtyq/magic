import type { Logger, LoggerPlugin } from "../types"

/** One listener set per installation, including bfcache restores and inactive sessions. */
function installPageDwell(logger: Logger, onDispose: (cleanup: () => void) => void): void {
	let route = location.href
	let from = document.referrer
	let type = "direct"
	let start = Date.now()
	let segment = performance.now()
	let duration = 0
	let active = document.visibilityState === "visible"
	let closed = false
	let timer: ReturnType<typeof setTimeout>
	const pause = () => {
		if (active) duration += performance.now() - segment
		active = false
		clearTimeout(timer)
	}
	const activity = () => {
		if (closed || document.visibilityState !== "visible") return
		if (!active) {
			active = true
			segment = performance.now()
		}
		clearTimeout(timer)
		timer = setTimeout(pause, 10 * 60 * 1000)
	}
	const report = (reason: string) => {
		if (closed) return
		pause()
		logger.report({
			namespace: "PageDwellTime",
			data: {
				route,
				from,
				type,
				duration: Math.round(duration),
				start,
				end: Date.now(),
				reason,
			},
		})
		duration = 0
		start = Date.now()
	}
	const change = (nextType: string) => {
		// A later History wrapper can retain ours after disposal; never restart its timer.
		if (closed || location.href === route) return
		report("route_change")
		from = route
		route = location.href
		type = nextType
		activity()
	}
	const pop = () => change("popstate")
	const visibility = () => {
		if (document.visibilityState === "hidden") pause()
		else activity()
	}
	const hide = () => report("page_hide")
	const cleanups: (() => void)[] = []
	onDispose(() => {
		report("shutdown")
		closed = true
		clearTimeout(timer)
		cleanups.forEach((cleanup) => cleanup())
		window.removeEventListener("popstate", pop)
		window.removeEventListener("hashchange", pop)
		window.removeEventListener("pagehide", hide)
		window.removeEventListener("pageshow", activity)
		document.removeEventListener("visibilitychange", visibility)
	})
	for (const method of ["pushState", "replaceState"] as const) {
		const original = history[method]
		const wrapped: History[typeof method] = function (this: History, ...args) {
			const result = original.apply(this, args)
			change(method)
			return result
		}
		history[method] = wrapped
		cleanups.push(() => {
			if (history[method] === wrapped) history[method] = original
		})
	}

	window.addEventListener("popstate", pop)
	window.addEventListener("hashchange", pop)
	window.addEventListener("pagehide", hide)
	window.addEventListener("pageshow", activity)
	document.addEventListener("visibilitychange", visibility)
	for (const event of [
		"mousemove",
		"mousedown",
		"mouseup",
		"click",
		"keydown",
		"keyup",
		"scroll",
		"touchstart",
		"touchmove",
		"touchend",
		"focus",
	]) {
		window.addEventListener(event, activity, { passive: true })
		cleanups.push(() => window.removeEventListener(event, activity))
	}
	activity()
}

export function createPageDwellPlugin(): LoggerPlugin {
	return {
		name: "pageDwell",
		scope: "page",
		setup({ logger, onDispose, flushHidden }) {
			installPageDwell(logger, onDispose)
			const hidden = () => {
				if (document.visibilityState === "hidden") flushHidden()
			}
			onDispose(() => document.removeEventListener("visibilitychange", hidden))
			document.addEventListener("visibilitychange", hidden)
		},
	}
}
