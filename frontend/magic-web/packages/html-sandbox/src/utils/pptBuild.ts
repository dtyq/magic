/**
 * Authored metadata only. Presentation visibility must never be written into slide HTML.
 * A build is plain attributes: `data-ppt-step="2"`, optional `data-ppt-effect="appear"`, and an
 * optional `data-ppt-after="500"` that makes the step play by itself that many milliseconds
 * after the previous step has finished (instead of waiting for a click).
 */
export const PPT_BUILD_ATTRIBUTE = "data-ppt-step"
export const PPT_BUILD_EFFECT_ATTRIBUTE = "data-ppt-effect"
export const PPT_BUILD_AFTER_ATTRIBUTE = "data-ppt-after"
export const PPT_BUILD_MAX_AFTER_MS = 60000
export interface PPTBuild {
	step: number
	effect: "appear" | "fade"
	/** Milliseconds after the previous step; absent means the step waits for a click. */
	after?: number
}

/**
 * Serialized into the slide preview, so it must stay self-contained: no module-level
 * references and no syntax the production build down-levels with helper functions.
 */
export function readPPTBuild(element: Element): PPTBuild | null {
	const rawStep = element.getAttribute("data-ppt-step")
	if (rawStep === null || !/^[0-9]+$/.test(rawStep.trim())) return null
	const step = Number(rawStep)
	if (step < 1 || step > 1000) return null
	const rawEffect = element.getAttribute("data-ppt-effect")
	const effect = rawEffect === null ? "fade" : rawEffect.trim()
	if (effect !== "appear" && effect !== "fade") return null
	// A malformed delay never invalidates the build: it just falls back to click-to-advance.
	const rawAfter = element.getAttribute("data-ppt-after")
	if (rawAfter !== null && /^[0-9]+$/.test(rawAfter.trim()) && Number(rawAfter) <= 60000)
		return { step: step, effect: effect, after: Number(rawAfter) }
	return { step: step, effect: effect }
}

/** Fade is the default effect, so it is not written out. */
export function writePPTBuild(element: Element, build: PPTBuild | null): void {
	if (!build) {
		element.removeAttribute(PPT_BUILD_ATTRIBUTE)
		element.removeAttribute(PPT_BUILD_EFFECT_ATTRIBUTE)
		element.removeAttribute(PPT_BUILD_AFTER_ATTRIBUTE)
		return
	}
	element.setAttribute(PPT_BUILD_ATTRIBUTE, String(build.step))
	if (build.after === undefined) element.removeAttribute(PPT_BUILD_AFTER_ATTRIBUTE)
	else element.setAttribute(PPT_BUILD_AFTER_ATTRIBUTE, String(build.after))
	if (build.effect === "fade") element.removeAttribute(PPT_BUILD_EFFECT_ATTRIBUTE)
	else element.setAttribute(PPT_BUILD_EFFECT_ATTRIBUTE, build.effect)
}

/** Validates untrusted build input (e.g. bridge payloads). */
export function normalizePPTBuild(value: unknown): PPTBuild | null {
	if (!value || typeof value !== "object") return null
	const { step, effect, after } = value as Record<string, unknown>
	if (typeof step !== "number" || !Number.isInteger(step) || step < 1 || step > 1000) return null
	if (effect !== "appear" && effect !== "fade") return null
	if (after === undefined) return { step, effect }
	if (
		typeof after !== "number" ||
		!Number.isInteger(after) ||
		after < 0 ||
		after > PPT_BUILD_MAX_AFTER_MS
	)
		return null
	return { step, effect, after }
}

export function isPPTBuildElement(element: Element): boolean {
	// Source markers are present in the editor before authored scripts execute.
	const root = element.ownerDocument.documentElement
	if (root.hasAttribute("data-magic-source-node")) {
		for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
			if (!node.hasAttribute("data-magic-source-node")) return false
		}
	}
	return (
		element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
		!["HTML", "HEAD", "BODY", "SCRIPT", "STYLE", "LINK", "META", "TITLE", "TEMPLATE"].includes(
			element.tagName,
		) &&
		!element.closest("[data-injected], [data-runtime]")
	)
}

/**
 * Every valid build in document order. A configured container and its configured descendants
 * may coexist: a descendant shows only once its own step and every ancestor's step are reached.
 * Malformed metadata never hides authored content.
 */
export function collectPPTBuilds(
	root: Document,
	read = readPPTBuild,
	allowed = isPPTBuildElement,
	attribute = PPT_BUILD_ATTRIBUTE,
): Array<{ element: HTMLElement; build: PPTBuild }> {
	const builds: Array<{ element: HTMLElement; build: PPTBuild }> = []
	root.querySelectorAll(`[${attribute}]`).forEach((element) => {
		const build = read(element)
		if (!build || !allowed(element)) return
		builds.push({ element: element as HTMLElement, build })
	})
	return builds
}
