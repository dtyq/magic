import {
	containsMarkdownFileReference,
	classifyMarkdownFileHref,
} from "@/pages/superMagic/utils/filePathMention"
import { hasSerializedSelection } from "../extensions/inspector-detail/serialization"

export const LONG_PLAIN_TEXT_PASTE_THRESHOLD = 4000
const MAGIC_CLIPBOARD_TYPES = new Set([
	"text/x-magic-message-rich-text",
	"text/x-magic-message-mentions",
])

interface ClipboardDataLike {
	files: FileList | File[]
	types?: readonly string[] | DOMStringList
	getData: (format: string) => string
}

interface CreatePastedTextFileOptions {
	text: string
	now?: Date
}

export function shouldConvertPastedTextToAttachment(
	clipboardData: ClipboardDataLike,
	threshold = LONG_PLAIN_TEXT_PASTE_THRESHOLD,
): boolean {
	if (clipboardData.files.length > 0) return false

	const text = clipboardData.getData("text/plain")
	// 标签渲染之前还有输入分流；纯文本复制的选取资料也须交给粘贴恢复器。
	if (hasSerializedSelection(text)) return false
	if (text.trim().length < threshold) return false

	const types = getClipboardTypes(clipboardData.types)
	if (types.length === 0) return true
	if (!types.includes("text/plain")) return false
	if (hasMagicClipboardData(clipboardData)) return false

	return true
}

export function containsCanonicalWorkspaceLink(clipboardData: ClipboardDataLike): boolean {
	const html = clipboardData.getData("text/html")
	if (html) {
		const container = document.createElement("div")
		container.innerHTML = html
		if (
			Array.from(container.querySelectorAll("a[href]")).some(
				(anchor) =>
					!anchor.closest("code, pre") &&
					Boolean(
						(() => {
							const result = classifyMarkdownFileHref(
								anchor.getAttribute("href") || "",
							)
							return result.target || result.explicitFileReference
						})(),
					),
			)
		) {
			return true
		}
	}

	return containsMarkdownFileReference(clipboardData.getData("text/plain"))
}

export function createPastedTextFile({ text, now = new Date() }: CreatePastedTextFileOptions) {
	return new File([text], `pasted-text-${formatTimestamp(now)}.txt`, {
		type: "text/plain;charset=utf-8",
		lastModified: now.getTime(),
	})
}

function getClipboardTypes(types?: readonly string[] | DOMStringList): string[] {
	if (!types) return []
	return Array.from(types)
}

export function hasMagicClipboardData(clipboardData: ClipboardDataLike): boolean {
	const types = getClipboardTypes(clipboardData.types)
	if (types.some((type) => MAGIC_CLIPBOARD_TYPES.has(type))) return true

	const html = clipboardData.getData("text/html")
	return html.includes("data-magic-clipboard")
}

function formatTimestamp(date: Date): string {
	const year = date.getFullYear()
	const month = padDatePart(date.getMonth() + 1)
	const day = padDatePart(date.getDate())
	const hour = padDatePart(date.getHours())
	const minute = padDatePart(date.getMinutes())
	const second = padDatePart(date.getSeconds())

	return `${year}${month}${day}-${hour}${minute}${second}`
}

function padDatePart(value: number): string {
	return value.toString().padStart(2, "0")
}
