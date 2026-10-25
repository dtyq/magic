import { Node } from "@/infrastructure/editors/tiptap/core"
import { isSafeInlineStyle, isSafeUrlAttribute } from "../../../utils"

function isSafeVideoSource(value: unknown): value is string {
	if (typeof value !== "string" || !value.trim() || !isSafeUrlAttribute("src", value)) {
		return false
	}

	const normalized = Array.from(value)
		.filter((character) => {
			const codePoint = character.codePointAt(0) ?? 0
			return codePoint > 0x20 && (codePoint < 0x7f || codePoint > 0x9f)
		})
		.join("")
	const protocol = normalized.match(/^([a-z][a-z\d+.-]*):/i)?.[1].toLowerCase()
	return !protocol || protocol === "http" || protocol === "https"
}

function getSafeVideoAttributes(attributes: Record<string, unknown>) {
	const safeAttributes: Record<string, string> = {
		controls: "",
		preload: "metadata",
		playsinline: "",
	}

	if (isSafeVideoSource(attributes.src)) safeAttributes.src = attributes.src
	if (typeof attributes.style === "string" && isSafeInlineStyle(attributes.style)) {
		safeAttributes.style = attributes.style
	}

	return safeAttributes
}

export const SafeVideo = Node.create({
	name: "safeVideo",
	priority: 110,
	group: "block",
	atom: true,
	selectable: true,

	addAttributes() {
		return {
			src: {
				default: null,
				parseHTML: (element) => element.getAttribute("src"),
			},
			style: {
				default: null,
				parseHTML: (element) => {
					const style = element.getAttribute("style")
					return style && isSafeInlineStyle(style) ? style : null
				},
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: "video[src]",
				getAttrs: (node) => {
					if (!(node instanceof HTMLElement)) return false
					const src = node.getAttribute("src")
					const style = node.getAttribute("style")
					if (!isSafeVideoSource(src)) return false
					if (style && !isSafeInlineStyle(style)) return false
					return null
				},
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return ["video", getSafeVideoAttributes(HTMLAttributes as Record<string, unknown>)]
	},
})
