import { ControlEventMessageType } from "@/types/chat/control_message"
import type { CMessage } from "@/types/chat"
import i18next from "i18next"
import { isNumber, memoize } from "lodash-es"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import type {
	ConversationMessage,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import type { SeqResponse } from "@/types/request"
import { generateText, generateHTML } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import MagicEmojiNode from "@/components/base/MagicRichEditor/extensions/magicEmoji"
import { MentionExtension } from "@/components/business/MentionPanel/tiptap-plugin"
import MagicEmoji from "@/components/base/MagicEmoji"
import { emojiFilePathCache } from "@/components/base/MagicEmojiPanel/cache"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { ImageExtension } from "@/components/base/MagicRichEditor/extensions/image"
import { QuickInstructionNodeChatSubSiderExtension } from "../quick-instruction/extension"
import { extractSourcePlaceholders } from "../ChatMessageList/components/MessageFactory/components/AiSearch/utils"

/**
 * 获取最后一条消息
 * @param messages 有序消息列表
 * @param targetIndex 目标消息索引
 * @returns
 */
export function getLastMessage(
	messages: ConversationMessage[] | undefined,
	targetIndex?: number,
): ConversationMessage | undefined {
	// 如果没有消息，或者要查找的消息不存在，返回 undefined
	if (!messages || !messages.length || (isNumber(targetIndex) && targetIndex < 0))
		return undefined

	const index = targetIndex ?? messages.length - 1
	const lastMessage = messages[index]
	if (!lastMessage) return undefined
	// if (lastMessage.message.type === MessageType.Empty) {
	// 	// 如果还是空消息，返回上一个消息的内容
	// 	return getLastMessage(messages, index - 1)
	// }

	return lastMessage
}

export const generateRichText = memoize(
	(content: string, type: "html" | "text" = "text"): string => {
		try {
			switch (type) {
				case "html":
					return generateHTML(JSON.parse(content), [
						StarterKit,
						TextAlign,
						TextStyle,
						MagicEmojiNode,
						MentionExtension,
						QuickInstructionNodeChatSubSiderExtension,
						ImageExtension,
					])
				case "text":
					return generateText(JSON.parse(content), [
						StarterKit,
						TextAlign,
						TextStyle,
						MagicEmojiNode,
						MentionExtension,
						QuickInstructionNodeChatSubSiderExtension,
						ImageExtension,
					])
				default:
					return ""
			}
		} catch (error) {
			console.error(error)
			return ""
		}
	},
	(content, type) => JSON.stringify({ content, type }),
)

/**
 * 获取富文本消息 HTML 内容
 * @param content
 * @returns
 */
export function getRichTextHtml(content?: string) {
	if (!content) return ""
	return generateRichText(content, "html")
}

// 缓存 emoji 正则表达式
const createMagicEmojiRegex = memoize(() => {
	// 创建匹配所有魔法表情的正则表达式
	// 例如: 匹配 [smile], [laugh] 等格式
	return new RegExp(
		Array.from(emojiFilePathCache.keys())
			.map((item) => `\\[${item}\\]`)
			.join("|"),
		"g",
	)
})

// 使用缓存的正则表达式
export const magicEmojiRegex = createMagicEmojiRegex()

/**
 * 递归查找并替换表情符号
 * @param content 需要处理的文本内容
 */
const findAndReplaceMagicEmoji = (content?: string) => {
	if (!content) return content

	const splitArray = extractSourcePlaceholders(content, magicEmojiRegex)
	return splitArray.map((item) => {
		// 检查是否是表情符号格式
		if (item.match(magicEmojiRegex)) {
			// 提取表情符号代码 (去掉前后的方括号)
			const code = item.slice(1, -1)
			// 如果是有效的表情符号代码，返回对应的组件
			if (emojiFilePathCache.has(code)) {
				return <MagicEmoji key={code} code={code} width={16} />
			}
			return item
		}
		// 不是表情符号则原样返回
		return item
	})
}

/**
 * 获取富文本消息 粘贴文本
 * @param content
 * @returns
 */
export const getRichMessagePasteText = (content?: string) => {
	try {
		if (!content) return ""
		return generateText(JSON.parse(content), [
			StarterKit,
			TextAlign,
			TextStyle,
			MagicEmojiNode.extend({
				renderText(props) {
					return `[${props.node.attrs.code}]`
				},
			}),
			MentionExtension,
			QuickInstructionNodeChatSubSiderExtension,
			ImageExtension,
		])
	} catch (error) {
		console.error(error)
		return ""
	}
}

/**
 * 获取消息文本内容
 * @param message 消息
 * @returns 消息文本内容
 */
export function getMessageText(
	message: SeqResponse<CMessage> | ConversationMessageSend | undefined,
	onlyText = true,
): string | undefined {
	if (!message) return ""
	switch (message.message.type) {
		case ControlEventMessageType.OpenConversation:
			return undefined
		case ConversationMessageType.Text:
			return onlyText
				? message.message.text?.content
				: (findAndReplaceMagicEmoji(message.message.text?.content) as string)
		case ConversationMessageType.RichText:
			if (!message.message.rich_text?.content) return ""
			return onlyText
				? generateRichText(message.message.rich_text?.content)
				: (findAndReplaceMagicEmoji(
					generateRichText(message.message.rich_text?.content),
				) as string)
		case ConversationMessageType.Markdown:
			return onlyText
				? message.message.markdown?.content
				: (findAndReplaceMagicEmoji(message.message.markdown?.content) as string)
		case ConversationMessageType.MagicSearchCard:
			return i18next.t("chat.subSider.specialCardMessage", { ns: "interface" })
		case ConversationMessageType.Files:
			return i18next.t("chat.subSider.files", { ns: "interface" })
		case ConversationMessageType.AggregateAISearchCard:
			return i18next.t("chat.subSider.aggregateAISearchCard", { ns: "interface" })
		default:
			return ""
	}
}
