import type { SeqResponse, StreamResponseV2 } from "@/types/request"
import { StreamStatus } from "@/types/request"
import type {
	AggregateAISearchCardConversationMessage,
	AggregateAISearchCardConversationMessageV2,
	ConversationMessage,
	MarkdownConversationMessage,
	TextConversationMessage,
} from "@/types/chat/conversation_message"
import {
	AggregateAISearchCardV2Status,
	ConversationMessageType,
} from "@/types/chat/conversation_message"
import Logger from "@/utils/log/Logger"
import { isUndefined } from "lodash-es"
import AiSearchApplyService from "../ChatMessageApplyServices/AiSearchApplyService"
import MessageService from "../../MessageService"
import { appendObject, updateAggregateAISearchCardV2Status } from "./utils"
import ConversationService from "../../../conversation/ConversationService"
import { toJS } from "mobx"

const console = new Logger("StreamMessageApplyServiceV2", "blue", { console: false })

/**
 * 流式消息管理器
 *
 * @class StreamMessageApplyService
 */
class StreamMessageApplyServiceV2 {
	messageConversationMap: Record<
		string,
		{
			conversationId: string
			topicId: string
			messageId: string
			type: ConversationMessageType
		}
	> = {}

	/**
	 * 流式消息暂存区
	 */
	streamMessageMap: Record<string, StreamResponseV2[]> = {}

	/**
	 * 暂存流式消息
	 * @param streamMessage 流式消息
	 */
	addCacheStreamMessage(streamMessage: StreamResponseV2) {
		if (!this.streamMessageMap[streamMessage.target_seq_id]) {
			this.streamMessageMap[streamMessage.target_seq_id] = []
		}
		this.streamMessageMap[streamMessage.target_seq_id].push(streamMessage)
	}

	/**
	 * 是否存在暂存流式消息
	 * @param targetSeqId 目标序列ID
	 * @returns 是否存在暂存流式消息
	 */
	hasCacheStreamMessage(targetSeqId: string) {
		if (!this.streamMessageMap[targetSeqId]) {
			return false
		}
		return this.streamMessageMap[targetSeqId].length > 0
	}

	/**
	 * 应用暂存流式消息
	 * @param targetSeqId 目标序列ID
	 */
	applyCacheStreamMessage(
		targetSeqId: string,
		applyFn: (streamMessage: StreamResponseV2) => void,
	) {
		if (
			!this.streamMessageMap[targetSeqId] ||
			this.streamMessageMap[targetSeqId].length === 0
		) {
			return
		}

		const streamMessages = this.streamMessageMap[targetSeqId].slice()
		// 移除暂存流式消息
		delete this.streamMessageMap[targetSeqId]

		streamMessages.forEach((streamMessage) => {
			applyFn(streamMessage)
		})
	}

	/**
	 * 记录消息信息
	 * @param message 消息
	 */
	recordMessageInfo(
		message:
			| SeqResponse<ConversationMessage>
			| SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	) {
		switch (message.message.type) {
			case ConversationMessageType.Text:
				this.messageConversationMap[message.message_id] = {
					conversationId: message.conversation_id,
					topicId: message.message.topic_id ?? "",
					messageId: message.message_id,
					type: message.message.type,
				}
				break
			case ConversationMessageType.Markdown:
				this.messageConversationMap[message.message_id] = {
					conversationId: message.conversation_id,
					topicId: message.message.topic_id ?? "",
					messageId: message.message_id,
					type: message.message.type,
				}
				break
			case ConversationMessageType.AggregateAISearchCard:
				this.messageConversationMap[message.message.app_message_id] = {
					conversationId: message.conversation_id,
					topicId: message.message.topic_id ?? "",
					messageId: message.message_id,
					type: message.message.type,
				}
				break
			case ConversationMessageType.AggregateAISearchCardV2:
				this.messageConversationMap[message.message_id] = {
					conversationId: message.conversation_id,
					topicId: message.message.topic_id ?? "",
					messageId: message.message_id,
					type: message.message.type,
				}
				console.log(
					`[recordMessageInfo] 记录AI搜索卡片V2消息信息, messageId: ${message.message_id}, message:`,
					this.messageConversationMap[message.message_id],
				)
				break
			default:
				break
		}
	}

	/**
	 * 查询消息信息
	 * @param messageId 消息ID
	 * @returns 消息信息
	 */
	queryMessageInfo(messageId: string) {
		return this.messageConversationMap[messageId]
	}

	apply(streamMessage: StreamResponseV2) {
		console.log(`[apply] 开始应用流式消息，目标序列ID: ${streamMessage.target_seq_id}`)

		const targetSeqInfo = this.queryMessageInfo(streamMessage.target_seq_id)
		const aggregateAISearchCardSeqInfo = this.queryMessageInfo(
			AiSearchApplyService.getAppMessageIdByLLMResponseSeqId(streamMessage.target_seq_id),
		)

		if (!targetSeqInfo && !aggregateAISearchCardSeqInfo) {
			console.log(`[apply] 未找到消息信息，先暂存, streamMessage:`, streamMessage)
			// 如果未找到消息信息，先暂存，等待消息信息更新后，再应用
			this.addCacheStreamMessage(streamMessage)
			return
		}

		const type = targetSeqInfo?.type ?? aggregateAISearchCardSeqInfo?.type

		switch (type) {
			case ConversationMessageType.Text:
				console.log(`[apply] 处理文本类型消息`)
				this.applyCacheStreamMessage(
					streamMessage.target_seq_id,
					this.applyTextStreamMessage,
				)
				this.applyTextStreamMessage(streamMessage)
				break
			case ConversationMessageType.Markdown:
				console.log(`[apply] 处理Markdown类型消息`)
				this.applyCacheStreamMessage(
					streamMessage.target_seq_id,
					this.applyMarkdownStreamMessage,
				)
				this.applyMarkdownStreamMessage(streamMessage)
				break
			case ConversationMessageType.AggregateAISearchCard:
				console.log(`[apply] 处理AI搜索卡片类型消息`)
				this.applyCacheStreamMessage(
					streamMessage.target_seq_id,
					this.applyAggregateAISearchCardStreamMessage,
				)
				this.applyAggregateAISearchCardStreamMessage(streamMessage)
				break
			case ConversationMessageType.AggregateAISearchCardV2:
				console.log(`[apply] 处理AI搜索卡片V2类型消息`)
				this.applyCacheStreamMessage(
					streamMessage.target_seq_id,
					this.applyAggregateAISearchCardV2StreamMessage,
				)
				this.applyAggregateAISearchCardV2StreamMessage(streamMessage)
				break
			default:
				console.log(`[apply] 未知消息类型`)
				break
		}
	}

	/**
	 * 应用文本流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyTextStreamMessage = (streamMessage: StreamResponseV2) => {
		const {
			streams: {
				stream_options: { status } = { status: StreamStatus.Streaming },
				...keyPaths
			},
			target_seq_id,
		} = streamMessage
		console.log(`[applyTextStreamMessage] 开始处理文本流式消息，状态: ${status}`)
		const { messageId, conversationId, topicId } = this.queryMessageInfo(target_seq_id)!

		if ([StreamStatus.Start, StreamStatus.Streaming].includes(status)) {
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as TextConversationMessage

				for (const keyPath of Object.keys(keyPaths)) {
					appendObject(textMessage.text, keyPath.split("."), keyPaths[keyPath])
				}

				return m
			})
		} else if (status === StreamStatus.End) {
			console.log(`[applyTextStreamMessage] 处理结束状态消息`)

			// 更新消息状态
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as TextConversationMessage
				if (textMessage.text) {
					if (textMessage.text.stream_options) {
						textMessage.text.stream_options.status = StreamStatus.End
					}
				}
				return m
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.Text,
				text: (keyPaths.content as string).slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.text.content": keyPaths.content,
				"message.text.reasoning_content": keyPaths.reasoning_content,
				"message.text.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)
		}
		console.log(`[applyTextStreamMessage] 文本流式消息处理完成`)
	}

	/**
	 * 应用markdown流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyMarkdownStreamMessage = (streamMessage: StreamResponseV2) => {
		const {
			streams: {
				stream_options: { status } = { status: StreamStatus.Streaming },
				...keyPaths
			},
			target_seq_id,
		} = streamMessage
		console.log(`[applyMarkdownStreamMessage] 开始处理Markdown流式消息，状态: ${status}`)

		const { messageId, conversationId, topicId } = this.queryMessageInfo(target_seq_id)

		if ([StreamStatus.Streaming, StreamStatus.Start].includes(status)) {
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as MarkdownConversationMessage

				for (const keyPath of Object.keys(keyPaths)) {
					appendObject(textMessage.markdown, keyPath.split("."), keyPaths[keyPath])
				}

				return { ...m }
			})
		} else if (status === StreamStatus.End) {
			console.log(`[applyMarkdownStreamMessage] 处理结束状态消息`)
			// 更新消息状态
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const markdownMessage = m.message as MarkdownConversationMessage
				if (markdownMessage.markdown) {
					// PS： 这里不更新内容，因为内容是流式消息，由打字机去更新就好了
					if (markdownMessage.markdown.stream_options) {
						markdownMessage.markdown.stream_options.status = StreamStatus.End
					}
				}
				return { ...m }
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.Markdown,
				text: (keyPaths.content as string).slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.markdown.content": keyPaths.content,
				"message.markdown.reasoning_content": keyPaths.reasoning_content,
				"message.markdown.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)
		}
		console.log(`[applyMarkdownStreamMessage] Markdown流式消息处理完成`)
	}

	/**
	 * 应用聚合AI搜索卡片流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyAggregateAISearchCardStreamMessage = (message: StreamResponseV2) => {
		const {
			streams: {
				stream_options: { status } = { status: StreamStatus.Streaming },
				...keyPaths
			},
			target_seq_id,
		} = message

		console.log(
			`[applyAggregateAISearchCardStreamMessage] 开始处理AI搜索卡片流式消息，状态: ${status}`,
		)

		const { messageId, conversationId, topicId } = this.queryMessageInfo(
			AiSearchApplyService.getAppMessageIdByLLMResponseSeqId(target_seq_id),
		)

		if (!isUndefined(status) && [StreamStatus.Streaming, StreamStatus.Start].includes(status)) {
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as AggregateAISearchCardConversationMessage<false>

				for (const keyPath of Object.keys(keyPaths)) {
					const keyPathsArray = keyPath.split(".")
					appendObject(
						textMessage.aggregate_ai_search_card,
						keyPathsArray,
						keyPaths[keyPath],
					)
				}

				return { ...m }
			})
		} else if (status === StreamStatus.End) {
			console.log(`[applyAggregateAISearchCardStreamMessage] 处理结束状态消息`)

			// 更新根问题的回答
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as AggregateAISearchCardConversationMessage
				if (textMessage.aggregate_ai_search_card) {
					// PS： 这里不更新内容，因为内容是流式消息，由打字机去更新就好了
					if (textMessage.aggregate_ai_search_card.stream_options) {
						textMessage.aggregate_ai_search_card.stream_options.status =
							StreamStatus.End
					}
				}
				return { ...m }
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.AggregateAISearchCard,
				text: (keyPaths.llm_response as string).slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.aggregate_ai_search_card.llm_response": keyPaths.llm_response,
				"message.aggregate_ai_search_card.reasoning_content": keyPaths.reasoning_content,
				"message.aggregate_ai_search_card.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)
		}
		console.log(`[applyAggregateAISearchCardStreamMessage] AI搜索卡片流式消息处理完成`)
	}

	/**
	 * 应用AI搜索卡片V2流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyAggregateAISearchCardV2StreamMessage = (streamMessage: StreamResponseV2) => {
		const {
			streams: {
				stream_options: { status } = { status: StreamStatus.Streaming },
				...keyPaths
			},
			target_seq_id,
		} = streamMessage

		console.log(`开始处理AI搜索卡片V2流式消息，状态: ${status}`)

		const { messageId, conversationId, topicId } = this.queryMessageInfo(target_seq_id)

		if ([StreamStatus.Streaming, StreamStatus.Start].includes(status)) {
			const updated = MessageService.updateMessage(
				conversationId,
				topicId,
				messageId,
				(m) => {
					const textMessage = m.message as AggregateAISearchCardConversationMessageV2

					for (const keyPath of Object.keys(keyPaths)) {
						const keyPathsArray = keyPath.split(".")

						appendObject(
							textMessage.aggregate_ai_search_card_v2,
							keyPathsArray,
							keyPaths[keyPath],
						)

						// 更新状态
						updateAggregateAISearchCardV2Status(
							textMessage.aggregate_ai_search_card_v2,
							keyPath,
							keyPaths[keyPath],
						)
					}

					return { ...m }
				},
			)

			console.log(` 更新消息:`, toJS(updated))
		} else if (status === StreamStatus.End) {
			console.log(`处理结束状态消息`)
			// 更新消息状态
			MessageService.updateMessage(conversationId, topicId, messageId, (m) => {
				const textMessage = m.message as AggregateAISearchCardConversationMessageV2
				if (textMessage.aggregate_ai_search_card_v2) {
					// PS： 这里不更新内容，因为内容是流式消息，由打字机去更新就好了
					if (textMessage.aggregate_ai_search_card_v2.stream_options) {
						textMessage.aggregate_ai_search_card_v2.stream_options.status =
							StreamStatus.End
						textMessage.aggregate_ai_search_card_v2.status =
							AggregateAISearchCardV2Status.isEnd
					}
				}
				return { ...m }
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.AggregateAISearchCardV2,
				text:
					(
						keyPaths.summary as { content: string; reasoning_content: string }
					)?.content?.slice(0, 50) ?? "",
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.aggregate_ai_search_card_v2": { ...streamMessage.streams },
			} as Partial<SeqResponse<ConversationMessage>>)
		}
	}
}

export default new StreamMessageApplyServiceV2()
