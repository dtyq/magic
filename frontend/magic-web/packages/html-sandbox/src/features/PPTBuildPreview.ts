import { collectPPTBuilds } from "../utils/pptBuild"

const HIDDEN_MARKER = "data-magic-ppt-build-hidden"
const PREVIEW_STYLE_ATTRIBUTE = "data-magic-ppt-build-preview"

/**
 * Shows the slide as it looks after a given step while authoring. Purely visual: the hidden
 * marker and the style are runtime state that content cleaning removes from saved HTML.
 */
export class PPTBuildPreview {
	private style: HTMLStyleElement | null = null

	/**
	 * `steps` is the number of display steps already revealed (0 hides every configured element).
	 * With `animate`, elements revealed by this call fade in like they do in a presentation.
	 */
	show(steps: number, animate = false): void {
		const builds = collectPPTBuilds(document)
		const order = [...new Set(builds.map(({ build }) => build.step))].sort((a, b) => a - b)
		this.ensureStyle()
		const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		for (const { element, build } of builds) {
			const wasHidden = element.hasAttribute(HIDDEN_MARKER)
			const hidden = order.indexOf(build.step) + 1 > steps
			element.toggleAttribute(HIDDEN_MARKER, hidden)
			if (animate && wasHidden && !hidden && build.effect === "fade" && !reduceMotion)
				element.animate?.(
					[{ opacity: 0 }, { opacity: getComputedStyle(element).opacity }],
					{
						duration: 250,
						easing: "ease-out",
					},
				)
		}
	}

	clear(): void {
		document.querySelectorAll(`[${HIDDEN_MARKER}]`).forEach((element) => {
			element.removeAttribute(HIDDEN_MARKER)
		})
		this.style?.remove()
		this.style = null
	}

	private ensureStyle(): void {
		if (this.style?.isConnected) return
		const style = document.createElement("style")
		style.setAttribute("data-injected", "true")
		style.setAttribute(PREVIEW_STYLE_ATTRIBUTE, "")
		style.textContent = `[${HIDDEN_MARKER}], [${HIDDEN_MARKER}] * { visibility:hidden!important;pointer-events:none!important }`
		document.head.appendChild(style)
		this.style = style
	}
}
