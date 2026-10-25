import { collectPPTBuilds, readPPTBuild, isPPTBuildElement } from "./pptBuild"

/** Runs only in a slide preview. The source file contains metadata, never hidden content. */
export function pptBuildRuntime(
	parentOrigin: string,
	documentKey: string,
	initiallyEnabled: boolean,
	collect: typeof collectPPTBuilds,
	read: typeof readPPTBuild,
	allowed: typeof isPPTBuildElement,
	attribute: string,
) {
	let enabled = initiallyEnabled
	let current = 0
	const entries = collect(document, read, allowed, attribute)
	const ignored = document.querySelectorAll(`[${attribute}]`).length - entries.length
	const steps = [...new Set(entries.map(({ build }) => build.step))].sort((a, b) => a - b)
	// Per step (in order): ms to wait after the previous step before it plays by itself, or null
	// when it waits for a click. Any element in the step may carry the delay; the longest wins.
	const delays = steps.map((value) => {
		const afters = entries
			.filter(({ build }) => build.step === value && typeof build.after === "number")
			.map(({ build }) => build.after as number)
		return afters.length ? Math.max(...afters) : null
	})
	const animations = new Map<HTMLElement, Animation>()
	const marker = "data-magic-ppt-build-hidden"
	const style = document.createElement("style")
	style.setAttribute("data-injected", "true")
	style.textContent = `[${marker}], [${marker}] * { visibility:hidden!important;pointer-events:none!important }`
	document.head.appendChild(style)
	let safetyTimer = 0
	let lastTouch: { x: number; y: number } | null = null
	let suppressClickUntil = 0
	function apply(step: number, animate: boolean) {
		const previous = current
		current = Math.max(0, Math.min(steps.length, step))
		entries.forEach(({ element, build }) => {
			animations.get(element)?.cancel()
			animations.delete(element)
			const index = steps.indexOf(build.step) + 1
			const hidden = enabled && index > current
			element.toggleAttribute(marker, hidden)
			if (
				enabled &&
				!hidden &&
				index > previous &&
				animate &&
				build.effect === "fade" &&
				!window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
				element.animate
			) {
				animations.set(
					element,
					element.animate(
						[{ opacity: 0 }, { opacity: getComputedStyle(element).opacity }],
						{ duration: 250, easing: "ease-out" },
					),
				)
			}
		})
	}
	function send(data: Record<string, unknown>) {
		// No object spread: this function is serialized into the iframe, where the build's
		// down-leveling helper for spread does not exist.
		window.parent.postMessage(Object.assign({}, data, { documentKey }), parentOrigin)
	}
	function onMessage(event: MessageEvent) {
		const data = event.data
		if (
			event.source !== window.parent ||
			event.origin !== parentOrigin ||
			data?.type !== "ppt-build:set" ||
			data.documentKey !== documentKey ||
			typeof data.requestId !== "string" ||
			typeof data.enabled !== "boolean" ||
			!Number.isInteger(data.step) ||
			data.step < 0
		)
			return
		window.clearTimeout(safetyTimer)
		enabled = data.enabled
		apply(data.step, data.animate === true)
		send({
			type: "ppt-build:applied",
			requestId: data.requestId,
			step: current,
			total: steps.length,
			ignored,
			delays,
		})
	}
	function interactive(target: EventTarget | null) {
		return (
			!(target instanceof Element) ||
			Boolean(
				target.closest(
					"a,area,button,input,textarea,select,[contenteditable],[role=button],[role=link],video,audio,[data-magic-href]",
				),
			)
		)
	}
	function onClick(event: MouseEvent) {
		if (
			!enabled ||
			!steps.length ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.detail > 1 ||
			performance.now() < suppressClickUntil ||
			interactive(event.target) ||
			window.getSelection()?.toString()
		)
			return
		send({ type: "ppt-build:action", direction: "next" })
	}
	function onTouchStart(event: TouchEvent) {
		lastTouch =
			event.touches.length === 1
				? { x: event.touches[0].clientX, y: event.touches[0].clientY }
				: null
		if (event.touches.length !== 1) suppressClickUntil = performance.now() + 700
	}
	function onTouchEnd(event: TouchEvent) {
		const end = event.changedTouches[0]
		if (
			lastTouch &&
			end &&
			Math.hypot(end.clientX - lastTouch.x, end.clientY - lastTouch.y) > 10
		)
			suppressClickUntil = performance.now() + 700
		lastTouch = null
	}
	window.addEventListener("message", onMessage)
	document.addEventListener("click", onClick)
	document.addEventListener("touchstart", onTouchStart, { passive: true })
	document.addEventListener("touchend", onTouchEnd, { passive: true })
	apply(0, false)
	// If the host cannot initialize this preview, fail open instead of leaving content hidden.
	safetyTimer = window.setTimeout(() => {
		enabled = false
		apply(steps.length, false)
	}, 1000)
	window.addEventListener(
		"pagehide",
		(event) => {
			if (event.persisted) return
			window.clearTimeout(safetyTimer)
			animations.forEach((animation) => animation.cancel())
			window.removeEventListener("message", onMessage)
			document.removeEventListener("click", onClick)
			document.removeEventListener("touchstart", onTouchStart)
			document.removeEventListener("touchend", onTouchEnd)
		},
		{ once: true },
	)
}
