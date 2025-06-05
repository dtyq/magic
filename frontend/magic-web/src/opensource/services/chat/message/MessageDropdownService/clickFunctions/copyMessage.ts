import MessageDropdownStore from "@/opensource/stores/chatNew/messageUI/Dropdown"
import {
	ConversationMessageType,
	AggregateAISearchCardContent,
	AggregateAISearchCardContentV2,
	AggregateAISearchCardEvent,
} from "@/types/chat/conversation_message"
import type { FullMessage } from "@/types/chat/message"
import { getRichMessagePasteText } from "@/opensource/pages/chatNew/components/ChatSubSider/utils"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageImagePreview"
import { t } from "i18next"
import { CitationRegexes } from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown/remarkPlugins/remarkCitation"

/**
 * 选择元素文本
 * @param el 元素
 */
function selectElementText(el: Node) {
	// @ts-ignore
	if (document.selection) {
		// IE8 以下处理
		// @ts-ignore
		const oRange = document.body.createTextRange()
		oRange.moveToElementText(el)
		oRange.select()
	} else {
		const selection = window.getSelection() // get Selection object from currently user selected text
		selection?.removeAllRanges() // unselect any user selected text (if any)
		const range = document.createRange() // create new range object
		range.selectNodeContents(el) // set range to encompass desired element text
		selection?.addRange(range) // add range to Selection object to select it
	}
}

/**
 * 复制选区
 * @param el 元素
 */
function copySelection(el: HTMLElement) {
	selectElementText(el)
	let copySuccess // var to check whether execCommand successfully executed
	try {
		// 复制选区
		window.navigator.clipboard.write([
			new ClipboardItem({
				"text/html": new Blob([el.innerHTML], { type: "text/html" }),
				"text/plain": new Blob([el.innerText], { type: "text/plain" }),
			}),
		])
		const selection = window.getSelection() // get Selection object from currently user selected text
		selection?.removeAllRanges() // unselect any user selected text (if any)
		copySuccess = true
	} catch (e) {
		copySuccess = false
	}
	return copySuccess
}

/**
 * 生成 AI 搜索卡片文本
 * @param message 消息
 * @returns 文本
 */
function genAggregateAISearchCardText(message?: AggregateAISearchCardContent) {
	if (!message) return ""

	const result = `${message.llm_response}

## 事件

${genMarkdownTableText(message.event)}

## 来源

${message.search["0"]?.map((item, index) => `${index + 1}. [${item.name}](${item.url})`).join("\n")}
`

	return CitationRegexes.reduce((acc, regex) => {
		return acc.replace(regex, (_, $1) => `[${$1}]`)
	}, result)
}

/**
 * 生成 AI 搜索卡片事件文本
 * @param message 消息
 * @returns 文本
 */
function genMarkdownTableText(message?: AggregateAISearchCardEvent[]) {
	return `
| ${t("chat.aggregate_ai_search_card.eventName", { ns: "interface" })} | ${t(
		"chat.aggregate_ai_search_card.eventTime",
		{ ns: "interface" },
	)} | ${t("chat.aggregate_ai_search_card.eventDescription", { ns: "interface" })} |
| --- | --- | --- |
${message?.map((item) => `| ${item.name} | ${item.time} | ${item.description} |`).join("\n")}
`
}

/**
 * 生成 AI 搜索卡片文本
 * @param message 消息
 * @returns 文本
 */
function genAggregateAISearchCardV2Text(message?: AggregateAISearchCardContentV2) {
	if (!message) return ""

	const result = `${message.summary?.content}

## 事件

${genMarkdownTableText(message.events)}

## 来源

${message.no_repeat_search_details
	?.map((item, index) => `${index + 1}. [${item.name}](${item.url})`)
	.join("\n")}
`

	return CitationRegexes.reduce((acc, regex) => {
		return acc.replace(regex, (_, $1) => `[${$1}]`)
	}, result)
}

/**
 * 获取消息文本
 * @param message 消息
 * @returns 消息文本
 */
function getMessageText(message: FullMessage) {
	switch (message?.message.type) {
		case ConversationMessageType.Text:
			return message.message.text?.content ?? ""
		case ConversationMessageType.RichText:
			return getRichMessagePasteText(message.message.rich_text?.content) ?? ""
		case ConversationMessageType.Markdown:
			return message.message.markdown?.content ?? ""
		case ConversationMessageType.AggregateAISearchCard:
			return genAggregateAISearchCardText(message.message.aggregate_ai_search_card)
		case ConversationMessageType.AggregateAISearchCardV2:
			return genAggregateAISearchCardV2Text(message.message.aggregate_ai_search_card_v2)
		default:
			return ""
	}
}

/**
 * 复制消息
 * @param messageId 消息ID
 * @param e 事件
 */
function copyMessage(messageId: string, e: EventTarget | null) {
	console.log("copyMessage", messageId)
	const message = MessageDropdownStore.currentMessage

	switch (message?.message.type) {
		case ConversationMessageType.RichText:
			const target = document.querySelector(
				`#message_copy_${message?.message_id} .ProseMirror`,
			) as HTMLElement
			if (target) {
				copySelection(target)
			}
			break
		case ConversationMessageType.AiImage:
		case ConversationMessageType.HDImage:
			if (e instanceof HTMLImageElement) {
				MessageFilePreviewService.copy(e)
			}
			break
		case ConversationMessageType.AggregateAISearchCard:
		case ConversationMessageType.AggregateAISearchCardV2:
		case ConversationMessageType.Text:
		case ConversationMessageType.Markdown:
		default:
			navigator.clipboard.writeText(getMessageText(message as FullMessage))
	}
}

export default copyMessage
export { selectElementText, copySelection, getMessageText }
