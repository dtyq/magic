/** Compare project-relative identities without rewriting the paths saved in slides. */
export function normalizePptSlidePath(path: string): string {
	const parts: string[] = []
	for (const part of path.replace(/\\/g, "/").split("/")) {
		if (!part || part === ".") continue
		if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop()
		else parts.push(part)
	}
	return parts.join("/")
}

/** Invalid configuration must be reported instead of silently making hidden pages visible. */
export function normalizeHiddenSlides(slides: readonly string[], hiddenSlides: unknown): string[] {
	if (hiddenSlides === undefined) return []
	if (
		!Array.isArray(hiddenSlides) ||
		hiddenSlides.some((path) => typeof path !== "string" || !path.trim())
	) {
		throw new Error("Invalid hidden_slides configuration")
	}
	const hidden = new Set((hiddenSlides as string[]).map(normalizePptSlidePath))
	// Use deck order and spelling, and discard orphan entries from earlier removals.
	return slides.filter((path) => hidden.has(normalizePptSlidePath(path)))
}

export function filterPptSlidePaths(
	slides: readonly string[],
	hiddenSlides: unknown,
	includeHiddenSlides = false,
): string[] {
	const hidden = new Set(normalizeHiddenSlides(slides, hiddenSlides))
	return slides.filter((path) => includeHiddenSlides || !hidden.has(path))
}

export function getPptVisibleSlideIndices(
	slides: readonly { path: string }[],
	hiddenSlides: unknown,
): number[] {
	const hidden = new Set(
		normalizeHiddenSlides(
			slides.map((slide) => slide.path),
			hiddenSlides,
		),
	)
	return slides.flatMap((slide, index) => (hidden.has(slide.path) ? [] : [index]))
}

/** Starting on a hidden page advances to its successor, then wraps to the first visible page. */
export function getPptPresentationStartIndex(
	visibleIndices: readonly number[],
	activeIndex: number,
): number | null {
	return visibleIndices.find((index) => index >= activeIndex) ?? visibleIndices[0] ?? null
}
