import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import type { HtmlMultiSelectionRequest, HtmlSelectionTarget, InspectedElementInfo } from "./types"

const MAX_INSTRUCTION_LENGTH = 2000
const MAX_TEXT_LENGTH = 240
const MAX_HTML_LENGTH = 1200
const SCREENSHOT_FILE_NAME_PREFIX = "html-screenshot"

/**
 * Build a short, deterministic screenshot filename from the target identity.
 * Selectors can be arbitrarily long, while workspace filenames are bounded.
 */
export function getHtmlScreenshotFileName(captureId: string, index = 0): string {
	const value = captureId.trim() || String(index + 1)
	let hash = 2166136261

	for (let charIndex = 0; charIndex < value.length; charIndex += 1) {
		hash ^= value.charCodeAt(charIndex)
		hash = Math.imul(hash, 16777619)
	}

	const suffix = (hash >>> 0).toString(16).padStart(8, "0")
	return `${SCREENSHOT_FILE_NAME_PREFIX}-${suffix}.png`
}

/** Unique capture id so one selector can keep many screenshots. */
export function createHtmlElementCaptureId(selector: string): string {
	return `element:${selector}:${createRandomUuidV4()}`
}

export function createHtmlSelectionTarget(
	info: InspectedElementInfo,
	instruction = "",
): HtmlSelectionTarget {
	return {
		id: info.selector,
		kind: "element",
		info,
		instruction,
	}
}

export function getHtmlSelectionTargetRect(
	target: HtmlSelectionTarget,
	scrollOffset: { left: number; top: number } = { left: 0, top: 0 },
): InspectedElementInfo["rect"] | null {
	return target.kind === "element"
		? (target.info?.rect ?? null)
		: target.screenshot?.documentRect
			? {
					...target.screenshot.documentRect,
					left: target.screenshot.documentRect.left - scrollOffset.left,
					top: target.screenshot.documentRect.top - scrollOffset.top,
				}
			: (target.screenshot?.rect ?? null)
}

/** Keep selector identity stable so re-selecting an element edits its existing item. */
export function upsertHtmlSelectionTarget(
	targets: HtmlSelectionTarget[],
	target: HtmlSelectionTarget,
): HtmlSelectionTarget[] {
	const index = targets.findIndex((item) => {
		if (item.kind !== target.kind) return false
		if (item.kind === "element" && target.kind === "element") {
			return item.info?.selector === target.info?.selector
		}
		return item.id === target.id
	})
	if (index < 0) return [...targets, target]

	return targets.map((item, itemIndex) => (itemIndex === index ? target : item))
}

export function getHtmlElementLabel(info: InspectedElementInfo): string {
	if (info.id) return `${info.tagName}#${info.id}`
	if (info.classList.length > 0) return `${info.tagName}.${info.classList[0]}`
	return info.tagName
}

export function buildHtmlMultiSelectionRequest(
	fileId: string,
	targets: HtmlSelectionTarget[],
	instruction: string,
	fileName = "",
	filePath = "",
): HtmlMultiSelectionRequest {
	return {
		fileId,
		...(fileName ? { fileName } : {}),
		...(filePath ? { filePath } : {}),
		instruction: instruction.trim().slice(0, MAX_INSTRUCTION_LENGTH),
		targets: targets.map((target) => {
			if (target.kind === "screenshot") {
				return {
					id: target.id,
					kind: "screenshot",
					selector: "",
					elementLabel: "Screenshot",
					// Keep host-only display metadata out of the submission contract.
					screenshot: {
						dataUrl: target.screenshot.dataUrl,
						rect: target.screenshot.rect,
						...(target.screenshot.mention
							? { mention: target.screenshot.mention }
							: {}),
					},
					instruction: target.instruction.trim().slice(0, MAX_INSTRUCTION_LENGTH),
				}
			}

			const info = target.info
			return {
				id: target.id,
				kind: "element",
				selector: info?.selector ?? "",
				elementLabel: info ? getHtmlElementLabel(info) : "Element",
				textContent: info?.textContent?.trim().slice(0, MAX_TEXT_LENGTH) || undefined,
				domContext: info?.domContext,
				elementHtml: info?.elementHtml?.slice(0, MAX_HTML_LENGTH) || undefined,
				...(target.screenshot
					? {
							screenshot: {
								dataUrl: target.screenshot.dataUrl,
								rect: target.screenshot.rect,
								...(target.screenshot.mention
									? { mention: target.screenshot.mention }
									: {}),
							},
						}
					: {}),
				instruction: target.instruction.trim().slice(0, MAX_INSTRUCTION_LENGTH),
			}
		}),
	}
}
