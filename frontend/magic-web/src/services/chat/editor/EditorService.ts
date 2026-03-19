import { ReportFileUploadsResponse } from "@/apis/modules/file"
import { JSONContent } from "@tiptap/core"

/** APIs */
import { ChatApi } from "@/apis"

/** Services */
import MessageService from "@/services/chat/message/MessageService"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"

/** Stores */
import ConversationStore from "@/stores/chatNew/conversation"
import MessageReplyStore from "@/stores/chatNew/messageUI/Reply"
import startPageStore from "@/stores/chatNew/startPage"
import EditorStore from "@/stores/chatNew/messageUI/editor"

export interface SendData {
	jsonValue: JSONContent | undefined
	normalValue: string
	files: ReportFileUploadsResponse[]
	onlyTextContent: boolean
	isLongMessage?: boolean
}

/**
 * 编辑器服务
 */
class EditorService {
	/**
	 * 获取AI自动补全
	 * @param text 文本
	 * @param signal 可选的AbortSignal用于取消请求
	 * @returns 自动补全结果
	 */
	fetchAiAutoCompletion = async (text: string, signal?: AbortSignal) => {
		try {
			if (text.trim() === "") return ""
			const res = await ChatApi.getConversationAiAutoCompletion(
				{
					conversation_id: EditorStore.conversationId ?? "",
					topic_id: EditorStore.topicId ?? "",
					message: text,
				},
				signal,
			)
			const { conversation_id } = res.request_info
			// 如果会话id不一致,则返回空字符串
			if (conversation_id !== EditorStore.conversationId) return ""
			// 如果输入框没有内容,则返回空字符串
			if (!EditorStore.value) return ""
			return res.choices[0].message.content
		} catch (error) {
			console.error(error)
			return Promise.resolve("")
		}
	}

	/**
	 * 发送消息
	 * @param data 发送数据
	 */
	send = ({
		jsonValue,
		normalValue,
		onlyTextContent = true,
		files,
		isLongMessage = false,
	}: SendData) => {
		if (!ConversationStore.currentConversation?.id) {
			console.error("请先选择一个会话")
			// message.error("请先选择一个会话")
			return
		}
		// 长消息
		if (isLongMessage) {
			MessageService.sendLongMessage(
				ConversationStore.currentConversation?.id ?? "",
				{
					jsonValue,
					normalValue,
					onlyTextContent,
					files,
				},
				MessageReplyStore.replyMessageId,
			)
		} else {
			// 短消息
			MessageService.sendMessage(
				ConversationStore.currentConversation?.id ?? "",
				{
					jsonValue,
					normalValue,
					onlyTextContent,
					files,
				},
				MessageReplyStore.replyMessageId,
			)
		}

		// 关闭文生图启动页
		if (ConversationBotDataService.startPage) {
			startPageStore.closeStartPage()
		}
	}
}

export default new EditorService()
