/**
 * ElementInspectorHandler
 *
 * Lightweight, self-contained inspector that runs inside the iframe.
 * Activated / deactivated by postMessage from the parent window.
 *
 * When active it:
 * 1. Listens for mousemove and reports the hovered element's info.
 * 2. On click, reports the selected element and auto-deactivates.
 * 3. Draws NO overlay itself — the parent-side overlay handles rendering.
 */

import { getElementSelector, isInjectedElement } from "../utils/dom"
import { getParentOrigin } from "../utils/parentOrigin"

// Mirror the constants from the shared types (iframe-runtime is a separate build)
const INSPECTOR_MSG = {
	START: "MAGIC_INSPECTOR_START",
	STOP: "MAGIC_INSPECTOR_STOP",
	HOVER: "MAGIC_INSPECTOR_HOVER",
	SELECT: "MAGIC_INSPECTOR_SELECT",
	HOVER_END: "MAGIC_INSPECTOR_HOVER_END",
} as const

interface BoxModelSides {
	top: number
	right: number
	bottom: number
	left: number
}

interface InspectedElementInfo {
	selector: string
	tagName: string
	id: string
	classList: string[]
	rect: { top: number; left: number; width: number; height: number }
	margin: BoxModelSides
	padding: BoxModelSides
	border: BoxModelSides
	computedStyles: Record<string, string>
	attributes: Record<string, string>
	textContent: string
	accessibleName?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePx(value: string): number {
	const n = parseFloat(value)
	return Number.isFinite(n) ? n : 0
}

function getBoxSides(computed: CSSStyleDeclaration, prefix: string): BoxModelSides {
	return {
		top: parsePx(computed.getPropertyValue(`${prefix}-top`)),
		right: parsePx(computed.getPropertyValue(`${prefix}-right`)),
		bottom: parsePx(computed.getPropertyValue(`${prefix}-bottom`)),
		left: parsePx(computed.getPropertyValue(`${prefix}-left`)),
	}
}

const STYLE_PROPS = [
	"display",
	"position",
	"width",
	"height",
	"color",
	"backgroundColor",
	"fontSize",
	"fontFamily",
	"fontWeight",
	"lineHeight",
	"textAlign",
	"opacity",
	"borderRadius",
	"overflow",
	"zIndex",
	"flexDirection",
	"justifyContent",
	"alignItems",
] as const

const MAX_TEXT_LENGTH = 120
const MAX_ATTRS = 10

function collectElementInfo(element: HTMLElement): InspectedElementInfo {
	const computed = window.getComputedStyle(element)
	const rect = element.getBoundingClientRect()

	const computedStyles: Record<string, string> = {}
	for (const prop of STYLE_PROPS) {
		computedStyles[prop] = computed[prop as keyof CSSStyleDeclaration] as string
	}

	// Collect important attributes (skip class/id/style — already exposed separately)
	const attributes: Record<string, string> = {}
	const skipAttrs = new Set(["class", "id", "style"])
	let attrCount = 0
	for (let i = 0; i < element.attributes.length && attrCount < MAX_ATTRS; i++) {
		const attr = element.attributes[i]
		if (!skipAttrs.has(attr.name)) {
			attributes[attr.name] =
				attr.value.length > 100 ? `${attr.value.slice(0, 100)}…` : attr.value
			attrCount++
		}
	}

	const rawText = element.textContent?.trim() ?? ""
	const textContent =
		rawText.length > MAX_TEXT_LENGTH ? `${rawText.slice(0, MAX_TEXT_LENGTH)}…` : rawText

	const classList: string[] = []
	if (element.className && typeof element.className === "string") {
		element.className
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.forEach((c) => classList.push(c))
	}

	return {
		selector: getElementSelector(element),
		tagName: element.tagName.toLowerCase(),
		id: element.id || "",
		classList,
		rect: {
			top: rect.top,
			left: rect.left,
			width: rect.width,
			height: rect.height,
		},
		margin: getBoxSides(computed, "margin"),
		padding: getBoxSides(computed, "padding"),
		border: {
			top: parsePx(computed.borderTopWidth),
			right: parsePx(computed.borderRightWidth),
			bottom: parsePx(computed.borderBottomWidth),
			left: parsePx(computed.borderLeftWidth),
		},
		computedStyles,
		attributes,
		textContent,
		accessibleName:
			element.getAttribute("aria-label") ||
			element.getAttribute("alt") ||
			element.getAttribute("title") ||
			undefined,
	}
}

// ─── Handler class ───────────────────────────────────────────────────────────

export class ElementInspectorHandler {
	private active = false
	private hoveredElement: HTMLElement | null = null

	private onMouseMove = (e: MouseEvent) => {
		if (!this.active) return

		const target = e.target as HTMLElement
		if (!target || target === document.body || target === document.documentElement) {
			return
		}
		if (isInjectedElement(target)) return

		if (this.hoveredElement === target) return
		this.hoveredElement = target

		const info = collectElementInfo(target)
		try {
			window.parent.postMessage(
				{ type: INSPECTOR_MSG.HOVER, elementInfo: info, timestamp: Date.now() },
				getParentOrigin(),
			)
		} catch {
			// ignore
		}
	}

	private onMouseOut = (e: MouseEvent) => {
		if (!this.active) return

		// Only send hover-end if the mouse actually left all content
		const related = e.relatedTarget as HTMLElement | null
		if (!related || related === document.documentElement) {
			this.hoveredElement = null
			try {
				window.parent.postMessage(
					{ type: INSPECTOR_MSG.HOVER_END, timestamp: Date.now() },
					getParentOrigin(),
				)
			} catch {
				// ignore
			}
		}
	}

	private onClick = (e: MouseEvent) => {
		if (!this.active) return

		const target = e.target as HTMLElement
		if (!target || isInjectedElement(target)) return

		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()

		const info = collectElementInfo(target)
		try {
			window.parent.postMessage(
				{ type: INSPECTOR_MSG.SELECT, elementInfo: info, timestamp: Date.now() },
				getParentOrigin(),
			)
		} catch {
			// ignore
		}

		// Auto-deactivate after selection
		this.deactivate()
	}

	activate(): void {
		if (this.active) return
		this.active = true
		this.hoveredElement = null

		// Capture phase so we intercept before any page handlers
		document.addEventListener("mousemove", this.onMouseMove, true)
		document.addEventListener("mouseout", this.onMouseOut, true)
		document.addEventListener("click", this.onClick, true)

		// Set cursor to crosshair on the whole page
		document.documentElement.style.cursor = "crosshair"
	}

	deactivate(): void {
		if (!this.active) return
		this.active = false
		this.hoveredElement = null

		document.removeEventListener("mousemove", this.onMouseMove, true)
		document.removeEventListener("mouseout", this.onMouseOut, true)
		document.removeEventListener("click", this.onClick, true)

		document.documentElement.style.cursor = ""
	}
}
