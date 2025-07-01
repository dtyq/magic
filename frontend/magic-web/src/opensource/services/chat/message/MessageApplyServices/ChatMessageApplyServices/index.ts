/* eslint-disable class-methods-use-this */
import type {
	AIImagesMessage,
	AggregateAISearchCardConversationMessage,
	AggregateAISearchCardConversationMessageV2,
	ConversationMessage,
} from "@/types/chat/conversation_message"
import {
	AggregateAISearchCardV2Status,
	AIImagesDataType,
	ConversationMessageStatus,
	ConversationMessageType,
	HDImageDataType,
} from "@/types/chat/conversation_message"
import pubsub from "@/utils/pubsub"
import type { SeqResponse } from "@/types/request"

// 导入新的服务
import MessageService from "@/opensource/services/chat/message/MessageService"

// 消息存储和状态管理
import type { CMessage } from "@/types/chat"
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import { getSlicedText } from "@/opensource/services/chat/conversation/utils"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import MessageStore from "@/opensource/stores/chatNew/message"
import chatTopicService from "@/opensource/services/chat/topic"
import DotsService from "@/opensource/services/chat/dots/DotsService"
import AiImageApplyService from "./AiImageApplyService"
import AiSearchApplyService from "./AiSearchApplyService"
import { bigNumCompare } from "@/utils/string"
import OrganizationDotsStore from "@/opensource/stores/chatNew/dots/OrganizationDotsStore"
import { userStore } from "@/opensource/models/user"
import StreamMessageApplyServiceV2 from "../StreamMessageApplyServiceV2"
import ConversationDbService from "../../../conversation/ConversationDbService"
import { ApplyMessageOptions } from "@/types/chat/message"

// 消息事件监听器类型
type MessageEventListener = (message: SeqResponse<CMessage>, options?: ApplyMessageOptions) => void

/**
 * 聊天消息应用服务
 * 负责处理各种聊天类型的消息并应用相应的业务逻辑
 */
class ChatMessageApplyService {
	// 事件监听器集合
	private eventListeners: Record<string, MessageEventListener[]> = {
		onApply: [], // 任何消息应用时触发
	}

	/**
	 * 订阅消息应用事件
	 * @param eventName 事件名称
	 * @param listener 事件监听器函数
	 * @returns 取消订阅的函数
	 */
	subscribe(eventName: string, listener: MessageEventListener): () => void {
		if (!this.eventListeners[eventName]) {
			this.eventListeners[eventName] = []
		}
		this.eventListeners[eventName].push(listener)

		// 返回取消订阅函数
		return () => {
			this.unsubscribe(eventName, listener)
		}
	}

	/**
	 * 取消订阅消息应用事件
	 * @param eventName 事件名称
	 * @param listener 要移除的监听器函数
	 */
	unsubscribe(eventName: string, listener: MessageEventListener): void {
		if (!this.eventListeners[eventName]) return

		this.eventListeners[eventName] = this.eventListeners[eventName].filter(
			(l) => l !== listener,
		)
	}

	/**
	 * 发布事件
	 * @param eventName 事件名称
	 * @param message 消息对象
	 * @param options 应用选项
	 */
	private publish(
		eventName: string,
		message: SeqResponse<CMessage>,
		options: ApplyMessageOptions = {},
	): void {
		if (!this.eventListeners[eventName]) return

		for (const listener of this.eventListeners[eventName]) {
			listener(message, options)
		}
	}

	/**
	 * 判断是否为聊天消息
	 * @param message 消息对象
	 * @returns 是否为聊天消息
	 */
	isChatMessage(message: SeqResponse<CMessage>) {
		return [
			ConversationMessageType.Text,
			ConversationMessageType.RichText,
			ConversationMessageType.Markdown,
			ConversationMessageType.MagicSearchCard,
			ConversationMessageType.Files,
			ConversationMessageType.Image,
			ConversationMessageType.Video,
			ConversationMessageType.Voice,
			ConversationMessageType.AggregateAISearchCard,
			ConversationMessageType.AggregateAISearchCardV2,
			ConversationMessageType.HDImage,
			ConversationMessageType.AiImage,
			ConversationMessageType.RecordingSummary,
		].includes(message.message.type as ConversationMessageType)
	}

	/**
	 * 判断是否为聊天消息
	 * @param message 消息对象
	 * @returns 是否为聊天消息
	 */
	isChatHistoryMessage(message: SeqResponse<CMessage>) {
		if (message.message.type === ConversationMessageType.AiImage) {
			return message.message.ai_image_card?.type === AIImagesDataType.GenerateComplete
		}

		if (message.message.type === ConversationMessageType.HDImage) {
			return (
				message.message.image_convert_high_card?.type === HDImageDataType.GenerateComplete
			)
		}

		return [
			ConversationMessageType.Text,
			ConversationMessageType.RichText,
			ConversationMessageType.Markdown,
			ConversationMessageType.MagicSearchCard,
			ConversationMessageType.Files,
			ConversationMessageType.Image,
			ConversationMessageType.Video,
			ConversationMessageType.Voice,
			ConversationMessageType.AggregateAISearchCard,
			ConversationMessageType.AggregateAISearchCardV2,
			ConversationMessageType.HDImage,
			ConversationMessageType.AiImage,
			ConversationMessageType.RecordingSummary,
		].includes(message.message.type as ConversationMessageType)
	}

	/**
	 * 应用聊天类消息
	 * @param message 待应用的消息
	 * @param options 应用选项
	 */
	apply(message: SeqResponse<CMessage>, options: ApplyMessageOptions = {}) {
		// const { isHistoryMessage = false } = options
		console.log("ChatMessageApplyService apply message =====> ", message, options)

		// 发布全局消息应用事件
		this.publish("onApply", message, options)

		switch (message.message.type) {
			case ConversationMessageType.Text:
				pubsub.publish("super_magic_new_message", message)
				StreamMessageApplyServiceV2.recordMessageInfo(
					message as SeqResponse<ConversationMessage>,
				)
				this.applyConversationMessage(message as SeqResponse<ConversationMessage>, options)
				break
			case ConversationMessageType.Markdown:
				StreamMessageApplyServiceV2.recordMessageInfo(
					message as SeqResponse<ConversationMessage>,
				)
				this.applyConversationMessage(message as SeqResponse<ConversationMessage>, options)
				break
			case ConversationMessageType.AggregateAISearchCardV2:
				console.log(`[apply] 处理AI搜索卡片V2消息, message:`, message)
				StreamMessageApplyServiceV2.recordMessageInfo(
					message as SeqResponse<ConversationMessage>,
				)
				console.log(
					`[apply] 处理AI搜索卡片V2消息, message:`,
					StreamMessageApplyServiceV2.queryMessageInfo(message.message_id),
				)

				const msg = message as SeqResponse<AggregateAISearchCardConversationMessageV2>
				if (msg.message.aggregate_ai_search_card_v2?.status === undefined) {
					// 初始化状态
					msg.message.aggregate_ai_search_card_v2!.status =
						AggregateAISearchCardV2Status.isSearching
				}

				this.applyConversationMessage(msg, options)

				console.log(
					`[apply] 处理AI搜索卡片V2消息, applied message:`,
					MessageStore.messages.find((m) => m.message_id === message.message_id),
				)
				break
			case ConversationMessageType.RichText:
			case ConversationMessageType.MagicSearchCard:
			case ConversationMessageType.Files:
			case ConversationMessageType.Image:
			case ConversationMessageType.Video:
			case ConversationMessageType.Voice:
				this.applyConversationMessage(message as SeqResponse<ConversationMessage>, options)
				break
			case ConversationMessageType.AggregateAISearchCard:
				this.applyAggregateAISearchCardMessage(
					message as SeqResponse<AggregateAISearchCardConversationMessage>,
				)
				break
			case ConversationMessageType.HDImage:
			case ConversationMessageType.AiImage:
				this.applyAiImageMessage(message as SeqResponse<AIImagesMessage>, options)
				break
			case ConversationMessageType.RecordingSummary:
				// TODO: 实现录音摘要处理器
				break
			default:
				break
		}
	}

	/**
	 * 应用会话消息
	 * @param message 会话消息对象
	 */
	async applyConversationMessage(
		message: SeqResponse<ConversationMessage>,
		options: ApplyMessageOptions = {},
	) {
		const { isHistoryMessage = false } = options
		let conversation = ConversationStore.getConversation(message.conversation_id)

		if (!conversation) {
			await ConversationService.addNewConversationFromDB(message.conversation_id)
		}

		conversation = ConversationStore.getConversation(message.conversation_id)

		MessageService.addReceivedMessage(message)

		// 如果是 AI 会话，并且当前没有话题 Id，自动设置上
		if (!conversation.current_topic_id && message.message.topic_id) {
			conversation.setCurrentTopicId(message.message.topic_id ?? "")
			ConversationDbService.updateConversation(message.conversation_id, {
				current_topic_id: message.message.topic_id ?? "",
			})

			// 如果当前会话是当前会话，则切换话题
			if (ConversationStore.currentConversation?.id === message.conversation_id) {
				ConversationService.switchTopic(message.conversation_id, message.message.topic_id)
			}
		}

		if (
			ConversationStore.currentConversation?.id === message.conversation_id &&
			ConversationStore.currentConversation?.current_topic_id === message.message.topic_id &&
			conversation?.isAiConversation
		) {
			// 如果是 AI 会话，此时消息列表的数量为 2，调用智能重命名
			if (MessageStore.messages.length === 2 && !isHistoryMessage) {
				// 调用智能重命名
				chatTopicService.getAndSetMagicTopicName(message.message.topic_id ?? "")
			}
		}

		// 更新会话最后一条消息
		ConversationService.updateLastReceiveMessage(message.conversation_id, {
			time: message.message.send_time,
			seq_id: message.seq_id,
			...getSlicedText(message.message, message.message.revoked),
			topic_id: message.message.topic_id ?? "",
		})

		if (!conversation.is_not_disturb) {
			// 把会话顶到最上面
			ConversationService.moveConversationFirst(message.conversation_id)

			// 如果不是自己的消息且消息seqid大于组织红点seqid, 则添加会话红点（通知视图更新）
			if (
				!isHistoryMessage &&
				message.message.sender_id !== userStore.user.userInfo?.user_id &&
				message.message.status === ConversationMessageStatus.Unread &&
				bigNumCompare(
					message.seq_id,
					OrganizationDotsStore.getOrganizationDotSeqId(
						conversation.user_organization_code,
					),
				) > 0
			) {
				DotsService.addConversationUnreadDots(
					conversation.user_organization_code,
					message.conversation_id,
					message.message.topic_id ?? "",
					message.seq_id,
					1,
				)
			}
		}
	}

	/**
	 * 应用聚合AI搜索卡片消息
	 * @param message 聚合AI搜索卡片消息对象
	 */
	async applyAggregateAISearchCardMessage(
		message: SeqResponse<AggregateAISearchCardConversationMessage>,
	) {
		AiSearchApplyService.apply(message)
	}

	/**
	 * 应用AI图像消息
	 * @param message AI图像消息对象
	 * @param options 应用选项
	 */
	applyAiImageMessage(message: SeqResponse<AIImagesMessage>, options: ApplyMessageOptions = {}) {
		AiImageApplyService.apply(message, options)
	}
}

export default new ChatMessageApplyService()
