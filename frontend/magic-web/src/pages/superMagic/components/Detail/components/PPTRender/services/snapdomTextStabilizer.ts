type RestoreStyle = () => void

const TEXT_NODE = 3

export function stabilizeSingleLineTextForSnapdom(root: Element): RestoreStyle {
	const doc = root.ownerDocument
	const win = doc.defaultView
	if (!win) return noop

	const restoreStyles: RestoreStyle[] = []
	for (const element of getCandidateElements(root)) {
		if (!hasOnlyDirectText(element)) continue

		const style = win.getComputedStyle(element)
		if (!shouldStabilizeTextElement(element, style)) continue

		const previousWhiteSpace = element.style.getPropertyValue("white-space")
		const previousPriority = element.style.getPropertyPriority("white-space")
		element.style.setProperty("white-space", "nowrap", "important")

		restoreStyles.push(() => {
			if (previousWhiteSpace) {
				element.style.setProperty("white-space", previousWhiteSpace, previousPriority)
				return
			}
			element.style.removeProperty("white-space")
		})
	}

	return () => {
		for (let i = restoreStyles.length - 1; i >= 0; i -= 1) {
			restoreStyles[i]()
		}
	}
}

function getCandidateElements(root: Element): HTMLElement[] {
	const elements: HTMLElement[] = []
	if (isHTMLElementLike(root)) {
		elements.push(root)
	}
	elements.push(...Array.from(root.querySelectorAll<HTMLElement>("*")))
	return elements
}

function isHTMLElementLike(element: Element): element is HTMLElement {
	return "style" in element && "getBoundingClientRect" in element && "children" in element
}

function hasOnlyDirectText(element: HTMLElement): boolean {
	if (element.children.length > 0) return false
	return Array.from(element.childNodes).some(
		(node) => node.nodeType === TEXT_NODE && Boolean(node.textContent?.trim()),
	)
}

function shouldStabilizeTextElement(element: HTMLElement, style: CSSStyleDeclaration): boolean {
	if (style.display === "none" || style.visibility === "hidden") return false
	if (style.whiteSpace === "nowrap") return false
	if (style.whiteSpace === "pre" || style.whiteSpace === "pre-wrap") return false
	if (style.whiteSpace === "break-spaces") return false

	const rect = element.getBoundingClientRect()
	if (rect.height <= 0) return false

	const fontSize = parsePx(style.fontSize, 16)
	const lineHeight = parseLineHeight(style.lineHeight, fontSize)
	const verticalInset =
		parsePx(style.paddingTop) +
		parsePx(style.paddingBottom) +
		parsePx(style.borderTopWidth) +
		parsePx(style.borderBottomWidth)

	return rect.height < lineHeight * 1.8 + verticalInset
}

function parseLineHeight(lineHeight: string, fontSize: number): number {
	if (!lineHeight || lineHeight === "normal") return fontSize * 1.2

	const numeric = Number(lineHeight)
	if (Number.isFinite(numeric)) return numeric * fontSize

	return parsePx(lineHeight, fontSize * 1.2)
}

function parsePx(value: string, fallback = 0): number {
	const match = value.match(/^-?[\d.]+/)
	if (!match) return fallback

	const parsed = Number(match[0])
	return Number.isFinite(parsed) ? parsed : fallback
}

function noop(): void {}
