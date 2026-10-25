interface ScriptAnimation {
	duration: () => number
	totalDuration: () => number
	repeat: () => number
	pause: () => void
	totalTime: (time: number, suppressEvents: boolean) => void
}

type AnimationWindow = Window & {
	gsap?: { globalTimeline?: { getChildren: (nested: boolean) => ScriptAnimation[] } }
}

const MAX_ANIMATION_WAIT_MS = 3000

/** Only the disposable screenshot iframe is advanced; the live slide keeps playing normally. */
export async function prepareScreenshotAnimations(
	doc: Document,
	target: HTMLElement,
	signal: AbortSignal,
	wait: (milliseconds: number, signal: AbortSignal) => Promise<void>,
): Promise<void> {
	if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError")
	const sampled = new WeakSet<object>()
	const deadline = Date.now() + MAX_ANIMATION_WAIT_MS
	const remainingTime = Math.max(
		0,
		...(doc.getAnimations?.() ?? []).map((animation) => {
			// Keep a short no-fill animation from disappearing while fonts/images settle.
			animation.effect?.updateTiming({ fill: "both" })
			const endTime = animation.effect?.getComputedTiming().endTime
			return animation.playState === "running" &&
				typeof endTime === "number" &&
				Number.isFinite(endTime) &&
				animation.playbackRate > 0
				? (endTime - Number(animation.currentTime ?? 0)) / animation.playbackRate
				: 0
		}),
	)
	// Let short entrances and their accompanying script updates actually run. The
	// duration comes from the active effects; long/looping timelines are sampled below.
	if (remainingTime > 0) await wait(Math.min(remainingTime, MAX_ANIMATION_WAIT_MS), signal)

	for (;;) {
		if (signal.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError")
		sampleScriptAnimations(doc, sampled)
		sampleWebAnimations(doc, sampled)
		if (!hasOnlyHiddenContent(doc, target)) return
		if (Date.now() >= deadline) throw new Error("Slide content stayed hidden during screenshot")
		// Timer/rAF-driven reveals have no common timeline API. Observe their actual
		// visibility instead of sleeping on every static page or waiting for infinite loops.
		await wait(100, signal)
	}
}

function sampleWebAnimations(doc: Document, sampled: WeakSet<object>): void {
	for (const animation of doc.getAnimations?.() ?? []) {
		if (sampled.has(animation) || !animation.effect) continue
		const timing = animation.effect.getComputedTiming()
		const duration = Number(timing.duration)
		const time = Number.isFinite(Number(timing.endTime))
			? Number(timing.endTime)
			: Math.max(0, timing.delay) + (Number.isFinite(duration) ? duration / 2 : 0)
		try {
			// Removing animation rules exposes opacity:0 / offscreen base styles again.
			// Keep the effect and its fill so even animations without forwards stay visible.
			animation.effect.updateTiming({ fill: "both" })
			animation.pause()
			animation.currentTime = Math.max(0, time)
			const element = (animation.effect as KeyframeEffect).target
			if (element && doc.defaultView?.getComputedStyle(element).opacity === "0") {
				// Exit-only / fade-in-out effects may end on a blank frame. Capture
				// their visible middle instead of caching the blank end state.
				animation.currentTime = Math.max(0, timing.delay) + duration / 2
			}
			// snapDOM disables CSS animations on its clone and preserves inline styles.
			// Materialize the sampled effect so the clone cannot revert to opacity:0.
			if (typeof animation.commitStyles === "function") animation.commitStyles()
			sampled.add(animation)
		} catch {
			// An effect can be cancelled by the page's own script while being sampled.
		}
	}
}

function sampleScriptAnimations(doc: Document, sampled: WeakSet<object>): void {
	const timeline = (doc.defaultView as AnimationWindow | null)?.gsap?.globalTimeline
	for (const animation of timeline?.getChildren(false) ?? []) {
		if (sampled.has(animation)) continue
		try {
			const time =
				animation.repeat() === -1 ? animation.duration() / 2 : animation.totalDuration()
			if (!Number.isFinite(time)) continue
			animation.pause()
			animation.totalTime(time, false)
			sampled.add(animation)
		} catch {
			// Unknown library/plugin versions fall back to the bounded visibility check.
		}
	}
}

function hasOnlyHiddenContent(doc: Document, target: HTMLElement): boolean {
	const win = doc.defaultView
	if (!win) return false
	const candidates = [target, ...Array.from(target.querySelectorAll("*"))].filter((element) => {
		if (element.matches("script,style,noscript,template")) return false
		return (
			element.matches("img,svg,canvas,video") ||
			Array.from(element.childNodes).some(
				(node) => node.nodeType === 3 && Boolean(node.textContent?.trim()),
			)
		)
	})
	if (candidates.length === 0) return false
	return !candidates.some((element) => {
		const rect = element.getBoundingClientRect()
		if (
			rect.width <= 0 ||
			rect.height <= 0 ||
			rect.right <= 0 ||
			rect.bottom <= 0 ||
			rect.left >= win.innerWidth ||
			rect.top >= win.innerHeight
		)
			return false
		for (let current: Element | null = element; current; current = current.parentElement) {
			const style = win.getComputedStyle(current)
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.visibility === "collapse" ||
				Number.parseFloat(style.opacity) === 0
			)
				return false
		}
		return true
	})
}
