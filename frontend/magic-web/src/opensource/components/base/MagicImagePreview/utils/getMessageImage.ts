import type { ConversationMessage } from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import type { JSONContent } from "@tiptap/core"
import { memoize } from "lodash-es"
import { MAX_RECURSION_DEPTH } from "@/const/other"
import type { ImagePreviewInfo } from "@/types/chat/preview"

/**
 * 收集 markdown 中的图片
 */
export const collectMarkdownImages = memoize((mdText?: string): string[] => {
	if (!mdText) {
		return []
	}

	const matches = mdText.matchAll(/!\[(.*?)\]\((.*?)\)/g)
	const images = Array.from(matches).map((match) => match[2])
	return images
})

/**
 * 递归遍历所有节点，收集匹配的节点
 * @param data
 * @param matchTypes
 * @param matchList
 * @returns
 */
export const collectRichTextNodes = memoize(
	(
		data: string | JSONContent | undefined,
		matchTypes: string[],
		matchList: JSONContent[] = [],
		depth = 0,
	) => {
		if (depth >= MAX_RECURSION_DEPTH) return matchList

		if (typeof data === "string") {
			try {
				data = JSON.parse(data) as JSONContent
			} catch (error) {
				return matchList
			}
		}

		if (!data) return matchList
		if (!data.content) {
			if (data.type && matchTypes.includes(data.type)) {
				matchList.push(data)
			}
			return matchList
		}

		data.content.forEach((item) => {
			collectRichTextNodes(item, matchTypes, matchList, depth + 1)
		})

		return matchList
	},
)

type MessageImageInfo = Omit<ImagePreviewInfo, "conversationId">

const map = new Map<string, MessageImageInfo[]>()

/**
 * 根据不同类型的消息，获取消息中的图片
 * @param message 消息
 * @param index 图片索引
 * @returns
 */
export const getConversationMessageImages = async (
	messageId: string,
	message?: ConversationMessage,
): Promise<MessageImageInfo[]> => {
	if (!messageId) return []

	if (map.has(messageId)) {
		return map.get(messageId) ?? []
	}

	let result = [] as Omit<ImagePreviewInfo, "conversationId">[]

	switch (message?.type) {
		case ConversationMessageType.Text:
			const textImages = collectMarkdownImages(message.text?.content)
			for (let i = 0; i < textImages.length; i += 1) {
				const item = textImages[i]
				result.push({
					url: item,
					messageId,
					ext: { ext: "jpg", mime: "image/jpeg" }, // 默认认为是 jpg
					index: i,
				})
			}
			break
		case ConversationMessageType.Markdown:
			const markdownImages = collectMarkdownImages(message.markdown?.content)
			for (let i = 0; i < markdownImages.length; i += 1) {
				const item = markdownImages[i]
				result.push({
					url: item,
					messageId,
					ext: { ext: "jpg", mime: "image/jpeg" }, // 默认认为是 jpg
					index: i,
				})
			}
			break
		case ConversationMessageType.RichText:
			const richTextImages = collectRichTextNodes(message.rich_text?.content, ["image"])
			for (let i = 0; i < richTextImages.length; i += 1) {
				const item = richTextImages[i]

				result.push({
					fileId: item.attrs?.file_id,
					messageId,
					ext: { ext: item?.attrs?.file_extension },
					index: i,
				})
			}
			break
		case ConversationMessageType.Image:
			result = message.image?.file_id
				? [{ fileId: message.image?.file_id, messageId, index: 0 }]
				: []
			break
		case ConversationMessageType.Voice:
			result = message.voice?.file_id
				? [{ fileId: message.voice?.file_id, messageId, index: 0 }]
				: []
			break
		case ConversationMessageType.Files:
			result =
				message.files?.attachments?.map((item, index) => {
					return {
						fileId: item.file_id,
						messageId,
						ext: { ext: item.file_extension },
						index,
					}
				}) ?? []
			break
		default:
			break
	}

	map.set(messageId, result)

	return result
}
