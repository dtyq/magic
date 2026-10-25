import { collectPPTBuilds } from "../utils/pptBuild"

export const PPT_BUILD_MARKERS_ATTRIBUTE = "data-magic-ppt-build-markers"

/** A disposable overlay. It never writes presentation state onto authored elements. */
export class PPTBuildMarkers {
	private host: HTMLElement | null = null
	private shadow: ShadowRoot | null = null
	private mutations: MutationObserver | null = null
	private resize: ResizeObserver | null = null
	private observed = new Set<Element>()
	private frame: number | null = null
	private suspended = false

	/** Hides the overlay without tearing it down, e.g. while the slide is previewed as presented. */
	setSuspended(suspended: boolean): void {
		this.suspended = suspended
		if (this.host) this.host.style.visibility = suspended ? "hidden" : ""
	}

	setVisible(visible: boolean): void {
		if (!visible) {
			this.destroy()
			return
		}
		if (this.host) return
		this.host = document.createElement("div")
		this.host.setAttribute(PPT_BUILD_MARKERS_ATTRIBUTE, "")
		this.host.setAttribute("data-runtime", "true")
		this.host.setAttribute("data-injected", "true")
		this.host.setAttribute("aria-hidden", "true")
		// A fixed, zero-size host cannot affect slide layout or intercept canvas selection.
		this.host.style.cssText =
			"position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;"
		this.shadow = this.host.attachShadow({ mode: "open" })
		if (this.suspended) this.host.style.visibility = "hidden"
		document.documentElement.append(this.host)
		this.mutations = new MutationObserver((records) => {
			if (
				records.some(
					(record) => record.target !== this.host && !this.host?.contains(record.target),
				)
			)
				this.schedule()
		})
		this.mutations.observe(document.documentElement, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
		})
		if (typeof ResizeObserver !== "undefined") {
			this.resize = new ResizeObserver(this.schedule)
			this.resize.observe(document.documentElement)
		}
		window.addEventListener("resize", this.schedule)
		window.addEventListener("scroll", this.schedule, true)
		window.addEventListener("pagehide", this.handlePageHide)
		window.addEventListener("pageshow", this.schedule)
		this.render()
	}

	private schedule = (): void => {
		if (!this.host || this.frame !== null) return
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null
			this.render()
		})
	}

	private handlePageHide = (event: PageTransitionEvent): void => {
		// A bfcache entry freezes this document and its open panel together. Keep that
		// intent, then refresh geometry on pageshow; a real teardown releases everything.
		if (!event.persisted) this.destroy()
	}

	private render(): void {
		if (!this.shadow) return
		const builds = collectPPTBuilds(document)
		const steps = [...new Set(builds.map(({ build }) => build.step))].sort((a, b) => a - b)
		this.shadow.replaceChildren()
		// Preserve existing subscriptions: re-observing every frame would trigger a render loop.
		const targets = new Set<Element>(builds.map(({ element }) => element))
		for (const element of this.observed) {
			if (!targets.has(element)) this.resize?.unobserve(element)
		}
		for (const element of targets) {
			if (!this.observed.has(element)) this.resize?.observe(element)
		}
		this.observed = targets
		// The slide is shown scaled down, so size the chrome against that scale to keep it legible.
		const displayScale = window.__MAGIC_SCALE_RATIO__
		const k = Math.min(
			3,
			Math.max(
				1,
				typeof displayScale === "number" && displayScale > 0 ? 1 / displayScale : 1,
			),
		)
		const size = Math.round(24 * k)
		const autoSteps = new Set(
			builds.filter(({ build }) => build.after !== undefined).map(({ build }) => build.step),
		)
		for (const { element, build } of builds) {
			const rect = element.getBoundingClientRect()
			if (rect.width === 0 || rect.height === 0) continue
			const frame = document.createElement("div")
			frame.style.cssText =
				`position:absolute;left:${rect.left}px;top:${rect.top}px;` +
				`width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;` +
				`border:${Math.round(2 * k)}px solid #2563eb;border-radius:${Math.round(4 * k)}px;` +
				"background:rgba(37,99,235,.10);"
			// Nested builds share a corner with their ancestors, so shift each level aside.
			let depth = 0
			for (let node = element.parentElement; node; node = node.parentElement)
				if (targets.has(node)) depth += 1
			const marker = document.createElement("span")
			// A clock marks steps that play by themselves instead of waiting for a click.
			marker.textContent =
				String(steps.indexOf(build.step) + 1) + (autoSteps.has(build.step) ? " ⏱" : "")
			marker.style.cssText =
				`position:absolute;left:${Math.round(-size / 2 + depth * size * 0.95)}px;top:${Math.round(-size / 2)}px;` +
				`box-sizing:border-box;min-width:${size}px;height:${size}px;padding:0 ${Math.round(6 * k)}px;` +
				`border:${Math.round(2 * k)}px solid white;border-radius:${size}px;background:#2563eb;color:white;` +
				`font:700 ${Math.round(14 * k)}px/${size - Math.round(4 * k)}px system-ui;text-align:center;` +
				`box-shadow:0 ${Math.round(2 * k)}px ${Math.round(6 * k)}px rgba(0,0,0,.45);`
			frame.append(marker)
			this.shadow.append(frame)
		}
	}

	destroy = (): void => {
		if (this.frame !== null) window.cancelAnimationFrame(this.frame)
		this.frame = null
		this.mutations?.disconnect()
		this.resize?.disconnect()
		this.mutations = null
		this.resize = null
		this.observed.clear()
		window.removeEventListener("resize", this.schedule)
		window.removeEventListener("scroll", this.schedule, true)
		window.removeEventListener("pagehide", this.handlePageHide)
		window.removeEventListener("pageshow", this.schedule)
		this.host?.remove()
		this.host = null
		this.shadow = null
	}
}
