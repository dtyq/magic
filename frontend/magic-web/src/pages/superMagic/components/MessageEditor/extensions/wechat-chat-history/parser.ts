import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { getMentionDisplayName } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { SUPER_PLACEHOLDER_TYPE } from "../super-placeholder/const"
import type { WechatChatSnapshot, WechatMessage, WechatMediaState } from "./types"

const DATE_LINE = /^(\d{4}年\d{1,2}月\d{1,2}日)[ \t]+(\d{1,2}:\d{2}(?::\d{2})?)$/

interface SourceLine {
	text: string
	mentions: TiptapMentionAttributes[]
	from: number
	to: number
	mediaState?: WechatMediaState
}

export function isWechatInstruction(node: JSONContent): boolean {
	return (
		node.type === "paragraph" &&
		(node.attrs?.wechatInstruction === true ||
			node.content?.some((child) => child.type === SUPER_PLACEHOLDER_TYPE) === true)
	)
}

/** 位置跟随原生段落和 inline 节点；附件只取该消息内的真实 mention，不按名称关联。 */
function sourceLines(content: JSONContent[], position: number): SourceLine[] {
	const lines: SourceLine[] = []
	let offset = position
	for (const paragraph of content) {
		const mediaState = paragraph.attrs?.wechatMediaState as WechatMediaState | undefined
		let cursor = offset + 1
		let line: SourceLine = { text: "", mentions: [], from: cursor, to: cursor }
		for (const child of paragraph.content ?? []) {
			if (child.type === "text") {
				const pieces = (child.text ?? "").split("\n")
				pieces.forEach((piece, index) => {
					if (index) {
						lines.push(line)
						cursor += 1
						line = { text: "", mentions: [], from: cursor, to: cursor }
					}
					line.text += piece
					cursor += piece.length
					line.to = cursor
				})
			} else if (child.type === "hardBreak") {
				lines.push(line)
				cursor += 1
				line = { text: "", mentions: [], from: cursor, to: cursor }
			} else {
				if (child.type === "mention" && child.attrs) {
					const attrs = child.attrs as TiptapMentionAttributes
					if (
						attrs.type === MentionItemType.PROJECT_FILE ||
						attrs.type === MentionItemType.USER_FILE ||
						attrs.type === MentionItemType.UPLOAD_FILE
					)
						line.mentions.push(attrs)
					else line.text += `@${getMentionDisplayName(attrs)}`
				}
				cursor += 1
				line.to = cursor
			}
		}
		lines.push(line)
		if (mediaState) line.mediaState = mediaState
		offset = cursor + 1
	}
	return lines
}

export function parseWechatChat(content: JSONContent[], position = 0): WechatChatSnapshot {
	const source = isWechatInstruction(content.at(-1) ?? {}) ? content.slice(0, -1) : content
	const lines = sourceLines(source, position)
	const headers: number[] = []
	lines.forEach((line, index) => {
		if (line.text.trim() && DATE_LINE.test(lines[index + 1]?.text.trim() ?? ""))
			headers.push(index)
	})
	const messages: WechatMessage[] = []
	headers.forEach((start, index) => {
		const end = headers[index + 1] ?? lines.length
		const body = lines.slice(start + 2, end)
		const text = body
			.map((line) => line.text)
			.join("\n")
			.trim()
		const mentions = body.flatMap((line) => line.mentions)
		if (!text && !mentions.length) return
		const date = lines[start + 1].text.trim().match(DATE_LINE)
		if (!date) return
		const marker = text.match(/^\[(图片|视频|文件|链接)\]\s*([\s\S]*)$/)
		const url = text.match(/https?:\/\/[^\s]+/)?.[0]
		const kind =
			marker?.[1] === "图片"
				? "image"
				: marker?.[1] === "视频"
					? "video"
					: marker?.[1] === "文件"
						? "file"
						: marker?.[1] === "链接" && url
							? "link"
							: mentions.length
								? "file"
								: "text"
		messages.push({
			id: String(lines[start].from),
			sender: lines[start].text.trim(),
			date: date[1],
			time: date[2],
			text: marker && kind !== "text" ? marker[2] : text,
			kind,
			url,
			mentions,
			mediaState: body.find((line) => line.mediaState)?.mediaState,
			from: lines[start].from,
			to: lines[end - 1]?.to ?? lines[start + 1].to,
		})
	})
	return {
		messages,
		participants: [...new Set(messages.map((message) => message.sender))],
		unrecognized:
			headers.length !== messages.length ||
			lines
				.slice(0, headers[0] ?? lines.length)
				.some((line) => line.text.trim() || line.mentions.length),
	}
}

/** 只有 paste 调用此判定；手动打字、撤销和草稿恢复不创建区块或自动弹窗。 */
export function isWechatChatText(text: string): boolean {
	const content = text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line): JSONContent => ({
			type: "paragraph",
			content: line ? [{ type: "text", text: line }] : [],
		}))
	return parseWechatChat(content).messages.length > 0
}
