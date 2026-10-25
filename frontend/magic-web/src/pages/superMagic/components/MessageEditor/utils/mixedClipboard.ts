import { htmlToClipboardMarkdown } from "../../MessageList/utils/clipboardMarkdown"
import { isWechatChatText } from "../extensions/wechat-chat-history/parser"

export type MixedClipboardPart =
	{ type: "text"; text: string } | { type: "file"; file: File; originalText: string }

export interface MixedClipboardContent {
	parts: MixedClipboardPart[]
	/** false 表示只保留了内容，无法证明附件与正文的穿插位置。 */
	ordered: boolean
}

interface ParseMixedClipboardOptions {
	/** paste 事件未提供文本时，通过 Clipboard API 补读的系统文本。 */
	textFromClipboardApi?: boolean
}

interface FileMarker {
	start: number
	end: number
	file: File
}

function partsFromMarkers(text: string, markers: FileMarker[]): MixedClipboardPart[] {
	const parts: MixedClipboardPart[] = []
	let cursor = 0
	for (const marker of markers) {
		if (marker.start > cursor) {
			parts.push({ type: "text", text: text.slice(cursor, marker.start) })
		}
		parts.push({
			type: "file",
			file: marker.file,
			originalText: text.slice(marker.start, marker.end),
		})
		cursor = marker.end
	}
	if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) })
	return parts
}

/**
 * 微信多选复制的纯文本是「发送者、时间、正文」记录序列。
 * 实际采样确认：浏览器文件列表与其中的附件记录同序；图片正文使用 .dat 别名，
 * 文件字节则以 PNG 名称提供。因此仅在消息头、完整数量、类型和文件名均符合格式时
 * 使用这个来源的顺序契约；普通文本不能仅因附件数量相同就按下标配对。
 */
export function parseWeChatMixedClipboard(
	text: string,
	files: File[],
): MixedClipboardContent | null {
	const headers = Array.from(
		text.matchAll(/^[^\n]+\n\d{4}年\d{1,2}月\d{1,2}日[ \t]+\d{1,2}:\d{2}(?::\d{2})?\n/gm),
	)
	if (headers.length === 0 || headers[0].index !== 0) return null

	const markers: FileMarker[] = []
	for (const [index, header] of headers.entries()) {
		const start = header.index + header[0].length
		const body = text.slice(start, headers[index + 1]?.index ?? text.length).trimEnd()
		const media = body.match(/^\[(图片|视频|文件)\][ \t]+([^\n]+)$/)
		if (!media) continue
		const file = files[markers.length]
		if (!file) return null
		const name = media[2].trim()
		const isImage = file.type.toLowerCase().startsWith("image/")
		if (media[1] === "图片") {
			if (!isImage || (name !== file.name && !/^微信图片_[\d_]+\.dat$/i.test(name))) {
				return null
			}
		} else if (
			name !== file.name ||
			(media[1] === "视频" && !file.type.toLowerCase().startsWith("video/"))
		) {
			return null
		}
		markers.push({ start, end: start + body.length, file })
	}
	if (markers.length === 0 || markers.length !== files.length) return null
	return { parts: partsFromMarkers(text, markers), ordered: true }
}

function localFileName(source: string): string | null {
	// 远程图片同名不能证明它就是剪贴板附件；只接受正文明确给出的本地文件引用。
	if (/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith("file:")) return null
	try {
		return decodeURIComponent(source.split(/[?#]/, 1)[0]).split("/").pop() || null
	} catch {
		return null
	}
}

function fileDisplayName(fileName: string): string {
	const extensionIndex = fileName.lastIndexOf(".")
	return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
}

function parseHtmlFiles(html: string, files: File[]): MixedClipboardContent | null {
	if (!html) return null
	const container = new DOMParser().parseFromString(html, "text/html").body
	container.querySelectorAll("script, style, iframe, object").forEach((node) => node.remove())
	const prefix = `MAGICCLIPBOARD${crypto.randomUUID().replaceAll("-", "")}`
	const replacements: Array<{ token: string; file: File; originalText: string }> = []
	for (const node of container.querySelectorAll("img[src], a[href]")) {
		if (!container.contains(node)) continue
		const source = node.getAttribute(node.tagName === "IMG" ? "src" : "href") ?? ""
		const name = localFileName(source)
		const matches = files.filter((file) => file.name === name)
		if (matches.length !== 1) continue
		const file = matches[0]
		if (node.tagName === "IMG" && !file.type.startsWith("image/")) continue
		const token = `${prefix}${replacements.length}END`
		replacements.push({ token, file, originalText: node.textContent?.trim() || file.name })
		node.replaceWith(container.ownerDocument.createTextNode(token))
	}
	if (replacements.length === 0) return null
	const markdown = htmlToClipboardMarkdown(container)
	const markers: FileMarker[] = []
	for (const { token, file } of replacements) {
		const start = markdown.indexOf(token)
		if (start < 0) return null
		markers.push({ start, end: start + token.length, file })
	}
	markers.sort((a, b) => a.start - b.start)
	const parts = partsFromMarkers(markdown, markers)
	for (const part of parts) {
		if (part.type !== "file") continue
		part.originalText =
			replacements.find((replacement) => replacement.token === part.originalText)
				?.originalText ?? part.file.name
	}
	const matchedFiles = new Set(markers.map((marker) => marker.file))
	for (const file of files) {
		if (matchedFiles.has(file)) continue
		parts.push({ type: "text", text: "\n" }, { type: "file", file, originalText: "" })
	}
	return { parts, ordered: matchedFiles.size === files.length }
}

export function parseMixedClipboard(
	text: string,
	html: string,
	files: File[],
	options: ParseMixedClipboardOptions = {},
): MixedClipboardContent {
	let normalizedText = text.replace(/\r\n?/g, "\n")
	// Finder 等文件管理器可能返回路径、完整文件名，或隐藏扩展名后的显示名称；
	// 后两种只接受 Clipboard API 的补读结果，避免吞掉事件中主动携带的同名正文。
	const lines = normalizedText.trim().split("\n")
	const remainingFiles = [...files]
	const isFileList =
		lines.length === files.length &&
		lines.every((line) => {
			const source = line.trim()
			const isExplicitLocalReference = /^(?:file:|\/)/.test(source)
			if (!isExplicitLocalReference && !options.textFromClipboardApi) return false
			const name = localFileName(source)
			const index = name
				? remainingFiles.findIndex(
						(file) =>
							file.name === name ||
							(options.textFromClipboardApi && fileDisplayName(file.name) === name),
					)
				: -1
			if (index < 0) return false
			remainingFiles.splice(index, 1)
			return true
		})
	if (isFileList) normalizedText = ""
	const wechat = parseWeChatMixedClipboard(normalizedText, files)
	if (wechat) return wechat
	// 微信头和消息正文以原始文本为准；HTML 退化不能把日期头或未匹配文件静默改写。
	if (isWechatChatText(normalizedText))
		return {
			parts: [
				{ type: "text", text: normalizedText },
				...files.flatMap((file): MixedClipboardPart[] => [
					{ type: "text", text: "\n" },
					{ type: "file", file, originalText: "" },
				]),
			],
			ordered: files.length === 0,
		}
	const htmlFiles = parseHtmlFiles(html, files)
	if (htmlFiles) return htmlFiles

	let body = normalizedText
	if (html) {
		const container = new DOMParser().parseFromString(html, "text/html").body
		container.querySelectorAll("script, style, iframe, object").forEach((node) => node.remove())
		if (container.textContent?.trim()) body = htmlToClipboardMarkdown(container) || body
	}
	const parts: MixedClipboardPart[] = body ? [{ type: "text", text: body }] : []
	for (const file of files) {
		if (parts.length > 0) parts.push({ type: "text", text: "\n" })
		parts.push({ type: "file", file, originalText: "" })
	}
	return { parts, ordered: !body.trim() }
}
