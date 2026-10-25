import { isNonTextualElementTag } from "@dtyq/html-sandbox"
import type { TFunction } from "i18next"
import type { InspectedElementInfo } from "./types"

function normalizeInspectorText(value?: string): string {
	return value?.replace(/\s+/g, " ").trim() ?? ""
}

function getTagLabel(tag: string, t: TFunction): string | undefined {
	switch (tag) {
		case "video":
			return t("stylePanel.inspector.tagLabel.video")
		case "audio":
			return t("stylePanel.inspector.tagLabel.audio")
		case "img":
		case "picture":
			return t("stylePanel.inspector.tagLabel.image")
		case "iframe":
			return t("stylePanel.inspector.tagLabel.iframe")
		case "object":
		case "embed":
			return t("stylePanel.inspector.tagLabel.embed")
		case "canvas":
			return t("stylePanel.inspector.tagLabel.canvas")
		default:
			return undefined
	}
}

/** User-facing label for an inspected element in chips and prompts. */
export function getInspectorElementDisplayText(
	info: Pick<InspectedElementInfo, "tagName" | "textContent" | "accessibleName">,
	t: TFunction,
): string {
	const tag = info.tagName.toLowerCase()
	const text = normalizeInspectorText(info.textContent)
	const accessibleName = normalizeInspectorText(info.accessibleName)
	const tagLabel = getTagLabel(tag, t)

	if (accessibleName) return accessibleName
	if (isNonTextualElementTag(tag)) return tagLabel ?? text
	if (text) return text
	return tagLabel ?? ""
}

export function getShortSelector(info: InspectedElementInfo): string {
	let selector = info.tagName
	if (info.id) selector += `#${info.id}`
	if (info.classList.length > 0) {
		selector += `.${info.classList.slice(0, 2).join(".")}`
	}
	return selector
}

export function formatElementSize(width: number, height: number): string {
	return `${Math.round(width)} × ${Math.round(height)}`
}
