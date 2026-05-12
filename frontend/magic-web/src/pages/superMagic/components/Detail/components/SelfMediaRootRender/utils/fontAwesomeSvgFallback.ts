interface FontAwesomeSvgDefinition {
	name: string
	viewBox: string
	path: string
}

interface ReplaceFontAwesomeIconsWithSvgResult {
	replacedIconCount: number
	restore: () => void
}

const FONT_AWESOME_PREFIX_CLASSES = new Set([
	"fa",
	"fas",
	"far",
	"fab",
	"fa-solid",
	"fa-regular",
	"fa-brands",
])

const FONT_AWESOME_SVG_DEFINITIONS = new Map<string, FontAwesomeSvgDefinition>([
	[
		"magic",
		{
			name: "wand-magic-sparkles",
			viewBox: "0 0 576 512",
			path: "M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z",
		},
	],
	[
		"wand-magic-sparkles",
		{
			name: "wand-magic-sparkles",
			viewBox: "0 0 576 512",
			path: "M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z",
		},
	],
	[
		"star",
		{
			name: "star",
			viewBox: "0 0 576 512",
			path: "M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z",
		},
	],
])

function resolveFontAwesomeSvgDefinition(classList: DOMTokenList) {
	for (const className of Array.from(classList)) {
		if (!className.startsWith("fa-")) continue
		if (FONT_AWESOME_PREFIX_CLASSES.has(className)) continue

		const iconName = className.slice(3)
		const definition = FONT_AWESOME_SVG_DEFINITIONS.get(iconName)
		if (definition) return definition
	}

	return null
}

function createInlineSvgMarkup(definition: FontAwesomeSvgDefinition) {
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${definition.viewBox}"`,
		` fill="currentColor" aria-hidden="true" focusable="false"`,
		` data-icon="${definition.name}" data-prefix="fas"`,
		` style="display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;"`,
		">",
		`<path d="${definition.path}"></path>`,
		"</svg>",
	].join("")
}

function resolveTargetDocument(target: ParentNode) {
	if ((target as Node).nodeType === Node.DOCUMENT_NODE) return target as Document
	return target.ownerDocument
}

export function replaceFontAwesomeIconsWithSvg(
	target: ParentNode,
): ReplaceFontAwesomeIconsWithSvgResult {
	const doc = resolveTargetDocument(target)
	if (!doc) return { replacedIconCount: 0, restore: () => undefined }

	const iconElements = Array.from(
		target.querySelectorAll<HTMLElement>('i.fa, i.fas, i.far, i.fab, i[class*="fa-"]'),
	)
	const restoreCallbacks: Array<() => void> = []
	let styleElement: HTMLStyleElement | null = null
	let replacedIconCount = 0

	for (const iconElement of iconElements) {
		const definition = resolveFontAwesomeSvgDefinition(iconElement.classList)
		if (!definition) continue

		if (!styleElement) {
			styleElement = doc.createElement("style")
			styleElement.setAttribute("data-magic-export-fa-svg-style", "true")
			styleElement.textContent =
				'[data-magic-export-fa-svg="true"]::before{content:none !important;display:none !important;}'
			doc.head.appendChild(styleElement)
			restoreCallbacks.push(() => styleElement?.remove())
		}

		const previousInnerHTML = iconElement.innerHTML
		const previousMarker = iconElement.getAttribute("data-magic-export-fa-svg")

		iconElement.setAttribute("data-magic-export-fa-svg", "true")
		iconElement.innerHTML = createInlineSvgMarkup(definition)
		restoreCallbacks.push(() => {
			if (previousMarker === null) iconElement.removeAttribute("data-magic-export-fa-svg")
			else iconElement.setAttribute("data-magic-export-fa-svg", previousMarker)
			iconElement.innerHTML = previousInnerHTML
		})
		replacedIconCount += 1
	}

	return {
		replacedIconCount,
		restore: () => {
			for (let i = restoreCallbacks.length - 1; i >= 0; i -= 1) {
				restoreCallbacks[i]()
			}
		},
	}
}
