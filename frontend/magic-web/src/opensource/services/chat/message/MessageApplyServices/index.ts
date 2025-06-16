import type { SeqResponse } from "@/types/request"
import { MessageReceiveType, type CMessage } from "@/types/chat"
import { bigNumCompare } from "@/utils/string"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { ConversationStatus } from "@/types/chat/conversation"
import { ChatApi } from "@/apis"
import ChatMessageApplyService from "./ChatMessageApplyServices"
import ControlMessageApplyService from "./ControlMessageApplyService"
import messageSeqIdService from "../MessageSeqIdService"
import ConversationService from "../../conversation/ConversationService"
import pubsub from "@/utils/pubsub"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"
import { ApplyMessageOptions } from "@/types/chat/message"
import userInfoService from "@/opensource/services/userInfo"
import groupInfoService from "@/opensource/services/groupInfo"
import { ConversationMessageType } from "@/types/chat/conversation_message"

/**
 * 自定义消息处理器接口
 */
export interface ICustomMessageHandler {
	// 是否匹配
	isMatch: (message: SeqResponse<CMessage>) => boolean
	// 处理消息
	apply: (message: SeqResponse<CMessage>, options: ApplyMessageOptions) => void
}

/**
 * 消息应用服务
 * 负责处理和应用各种类型的消息（控制类、聊天类和流式消息）
 */
class MessageApplyService {
	// 正在拉取的会话列表
	fetchingPromiseMap: Record<string, Promise<void>> = {}

	// 自定义消息处理器注册表
	private customHandlers: Map<string, ICustomMessageHandler> = new Map()

	/**
	 * 注册自定义消息处理器
	 * @param id 处理器唯一标识
	 * @param handler 自定义消息处理器
	 * @param overwrite 是否覆盖已存在的处理器，默认为true
	 * @returns 是否成功注册
	 */
	registerCustomHandler(
		id: string,
		handler: ICustomMessageHandler,
		overwrite: boolean = true,
	): boolean {
		if (this.customHandlers.has(id) && !overwrite) {
			console.warn(`处理器 ${id} 已存在，无法重复注册`)
			return false
		}
		this.customHandlers.set(id, handler)
		return true
	}

	/**
	 * 取消注册自定义消息处理器
	 * @param id 要移除的处理器ID
	 * @returns 是否成功移除
	 */
	unregisterCustomHandler(id: string): boolean {
		return this.customHandlers.delete(id)
	}

	/**
	 * 获取已注册的自定义处理器
	 * @returns 当前已注册的所有处理器
	 */
	getCustomHandlers(): Record<string, ICustomMessageHandler> {
		return Object.fromEntries(this.customHandlers.entries())
	}

	/**
	 * 执行消息应用
	 * @param message 消息
	 * @param options 应用选项
	 */
	async doApplyMessage(message: SeqResponse<CMessage>, options: ApplyMessageOptions) {
		const conversation = ConversationStore.getConversation(message.conversation_id)

		console.log("applyMessage =====> conversation ====> ", conversation)
		if (!conversation) {
			// 如果会话不存在，则拉取会话列表
			if (!this.fetchingPromiseMap[message.conversation_id]) {
				this.fetchingPromiseMap[message.conversation_id] = ChatApi.getConversationList([
					message.conversation_id,
				]).then(({ items }) => {
					const conversation = items[0]

					delete this.fetchingPromiseMap[message.conversation_id]
					if (items.length === 0) return
					if (conversation.status === ConversationStatus.Normal) {
						ConversationService.addNewConversation(conversation)
						switch (conversation.receive_type) {
							case MessageReceiveType.User:
							case MessageReceiveType.Ai:
								userInfoService.fetchUserInfos([conversation.receive_id], 2)
								break
							case MessageReceiveType.Group:
								groupInfoService.fetchGroupInfos([conversation.receive_id])
								break
							default:
								break
						}
					}
				})
			}

			await this.fetchingPromiseMap[message.conversation_id]
		}

		switch (true) {
			case ControlMessageApplyService.isControlMessage(message):
				ControlMessageApplyService.apply(message, { ...options, isFromOtherTab: true })
				break
			case ChatMessageApplyService.isChatMessage(message):
				ChatMessageApplyService.apply(message, { ...options, isFromOtherTab: true })
				break
			case message?.message?.type === ConversationMessageType.SuperMagic:
				pubsub.publish("super_magic_new_message", message)
				break
			default:
				// 检查是否有自定义处理器可以处理该消息
				for (const handler of this.customHandlers.values()) {
					if (handler.isMatch(message)) {
						handler.apply(message, { ...options, isFromOtherTab: true })
						return
					}
				}
				break
		}
	}

	/**
	 * 应用一条消息
	 * @param message 待应用的消息
	 * @param options 应用选项
	 */
	async applyMessage(
		message: SeqResponse<CMessage>,
		options: ApplyMessageOptions = {
			isHistoryMessage: false,
			sortCheck: true,
			updateLastSeqId: true,
		},
	) {
		const { sortCheck = true } = options

		// 检查消息是否已经被应用过
		if (
			sortCheck &&
			bigNumCompare(
				message.seq_id,
				messageSeqIdService.getOrganizationRenderSeqId(message.organization_code) ?? "",
			) <= 0
		) {
			console.warn("此消息已应用", message.seq_id)
			return
		}

		BroadcastChannelSender.applyMessage(message, options)
		this.doApplyMessage(message, options)
	}
}

export default new MessageApplyService()
