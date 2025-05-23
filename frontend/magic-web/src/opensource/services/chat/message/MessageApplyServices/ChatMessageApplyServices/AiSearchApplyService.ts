/* eslint-disable class-methods-use-this */
import type {
	AssociateQuestion,
	AggregateAISearchCardConversationMessage,
} from "@/types/chat/conversation_message"
import { AggregateAISearchCardDataType } from "@/types/chat/conversation_message"
import { StreamStatus, type SeqResponse } from "@/types/request"
import { cloneDeep, merge } from "lodash-es"
import { makeObservable, observable, toJS } from "mobx"
import MessageService from "../../MessageService"
import StreamMessageApplyServiceV2 from "../StreamMessageApplyServiceV2"
import { bigNumCompare } from "@/utils/string"

interface RelationInfo {
	message_id: string
	conversation_id: string
	topic_id: string
}

class AiSearchApplyService {
	/**
	 * 存储聚合AI搜索卡片消息ID与实际消息ID的映射关系
	 * key为app_message_id，value为包含message_id、conversation_id和topic_id的对象
	 */
	aggregateAISearchCardMessageIdMap: Record<string, RelationInfo> = {}

	/**
	 * 临时存储聚合AI搜索卡片消息
	 * key为app_message_id，value为消息对象
	 */
	tempMessageMapContent: Record<
		string,
		SeqResponse<AggregateAISearchCardConversationMessage<false>>["message"]
	> = {}

	/**
	 * 存储流式传输的seq_id
	 * key为app_message_id，value为seq_id
	 */
	llmResponseSeqIdMap: Record<string, string> = {}

	constructor() {
		makeObservable(this, {
			tempMessageMapContent: observable,
		})
	}

	/**
	 * 获取 LLM响应的seq_id 对应的 应用消息ID
	 * @param llmResponseSeqId 流式传输的seq_id
	 * @returns 应用消息ID
	 */
	getAppMessageIdByLLMResponseSeqId(llmResponseSeqId: string) {
		return this.llmResponseSeqIdMap[llmResponseSeqId]
	}

	/**
	 * 设置 LLM响应的seq_id 对应的 应用消息ID
	 * @param llmResponseSeqId 流式传输的seq_id
	 * @param appMessageId 应用消息ID
	 */
	setLLMResponseSeqId(llmResponseSeqId: string, appMessageId: string) {
		this.llmResponseSeqIdMap[llmResponseSeqId] = appMessageId
	}

	/**
	 * 记录临时消息
	 * @param appMessageId 应用消息ID
	 * @param message 原始消息
	 * @returns 转换后的消息
	 */
	recordTempMessage(
		appMessageId: string,
		message: SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	) {
		const newMessage = this.createAggregateAISearchCardMessage(message)
		this.tempMessageMapContent[appMessageId] = newMessage.message
		return newMessage
	}

	/**
	 * 获取临时消息
	 * @param appMessageId 应用消息ID
	 * @returns 临时消息或undefined
	 */
	getTempMessageContent(appMessageId: string) {
		return this.tempMessageMapContent[appMessageId]
	}

	/**
	 * 应用聚合AI搜索卡片消息
	 * 根据消息类型更新本地缓存的消息内容
	 * @param message 接收到的消息
	 */
	apply(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		switch (message.message.aggregate_ai_search_card?.type) {
			case AggregateAISearchCardDataType.SearchDeepLevel:
				this.updateSearchDeepLevel(message)
				break
			case AggregateAISearchCardDataType.AssociateQuestion:
				this.updateAssociateQuestion(message)
				break
			case AggregateAISearchCardDataType.MindMap:
				this.updateMindMap(message)
				break
			case AggregateAISearchCardDataType.Search:
				this.updateSearch(message)
				break
			case AggregateAISearchCardDataType.LLMResponse:
				this.updateLLMResponse(message)
				break
			case AggregateAISearchCardDataType.Event:
				this.updateEvent(message)
				break
			case AggregateAISearchCardDataType.PingPong:
				this.updatePingPong(message)
				break
			case AggregateAISearchCardDataType.Terminate:
				this.updateTerminate(message)
				break
			case AggregateAISearchCardDataType.PPT:
				this.updatePPT(message)
				break
			default:
				break
		}

		if (!this.getTempMessageContent(message.message.app_message_id)) {
			MessageService.addReceivedMessage(this.generateMessage(message))
			// 记录应用消息ID与实际消息ID的关系
			StreamMessageApplyServiceV2.recordMessageInfo(message)
		} else {
			const messageInfo = StreamMessageApplyServiceV2.queryMessageInfo(
				message.message.app_message_id,
			)
			// 更新消息
			MessageService.updateMessage(
				messageInfo.conversationId,
				messageInfo.topicId,
				messageInfo.messageId,
				(m) => {
					;(
						m.message as AggregateAISearchCardConversationMessage<false>
					).aggregate_ai_search_card = cloneDeep(
						this.getTempMessageContent(message.message.app_message_id)
							.aggregate_ai_search_card,
					)
					return m
				},
				true,
			)
		}
	}

	/**
	 * 追加推理内容
	 * @param appMessageId 应用消息ID
	 * @param reasoningContent 推理内容
	 */
	appendReasoningContent(seqId: string, reasoningContent: string) {
		const appMessageId = this.getAppMessageIdByLLMResponseSeqId(seqId)
		const localMessage = this.getTempMessageContent(appMessageId)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.reasoning_content =
			(localMessage.aggregate_ai_search_card!.reasoning_content ?? "") + reasoningContent

		const messageInfo = StreamMessageApplyServiceV2.queryMessageInfo(appMessageId)
		if (!messageInfo) return

		// 更新视图数据
		MessageService.updateMessage(
			messageInfo.conversationId,
			messageInfo.topicId,
			messageInfo.messageId,
			(m) => {
				const textMessage = m.message as AggregateAISearchCardConversationMessage
				if (textMessage.aggregate_ai_search_card) {
					textMessage.aggregate_ai_search_card.reasoning_content =
						localMessage.aggregate_ai_search_card!.reasoning_content
				}
				return m
			},
		)
	}

	/**
	 * 追加内容
	 * @param seqId 流式传输的seq_id
	 * @param content 内容
	 */
	appendContent(seqId: string, content: string) {
		const appMessageId = this.getAppMessageIdByLLMResponseSeqId(seqId)
		const localMessage = this.getTempMessageContent(appMessageId)
		if (!localMessage) return
		// 更新缓存
		localMessage.aggregate_ai_search_card!.llm_response =
			(localMessage.aggregate_ai_search_card!.llm_response ?? "") + content

		const messageInfo = StreamMessageApplyServiceV2.queryMessageInfo(appMessageId)
		if (!messageInfo) return

		// 更新视图数据
		MessageService.updateMessage(
			messageInfo.conversationId,
			messageInfo.topicId,
			messageInfo.messageId,
			(m) => {
				const textMessage = m.message as AggregateAISearchCardConversationMessage
				if (textMessage.aggregate_ai_search_card) {
					textMessage.aggregate_ai_search_card.llm_response =
						localMessage.aggregate_ai_search_card!.llm_response
				}
				return m
			},
		)
	}

	/**
	 * 生成新消息
	 * @param message 原始消息
	 * @returns 转换后的消息
	 */
	generateMessage(
		message: SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	): SeqResponse<AggregateAISearchCardConversationMessage<false>> {
		const {
			message: { app_message_id },
		} = message
		const tempMessage = this.getTempMessageContent(app_message_id)

		if (tempMessage) {
			return {
				...message,
				message: {
					...message.message,
					aggregate_ai_search_card: toJS(tempMessage.aggregate_ai_search_card),
				},
			}
		}

		return this.recordTempMessage(app_message_id, message)
	}

	/**
	 * 创建聚合 AI 搜索卡片消息
	 * 将原始消息转换为可以在本地存储和展示的格式
	 * @param message 原始消息
	 * @returns 转换后的可本地使用的消息
	 */
	createAggregateAISearchCardMessage(
		message: SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	): SeqResponse<AggregateAISearchCardConversationMessage<false>> {
		return {
			...message,
			message: {
				...message.message,
				aggregate_ai_search_card: {
					llm_response: undefined,
					associate_questions: {},
					mind_map: undefined,
					search: {},
					event: [],
					finish: false,
					error: false,
					ppt: undefined,
					search_deep_level: undefined,
					reasoning_content: message.message.aggregate_ai_search_card?.reasoning_content,
					stream_options: message.message.aggregate_ai_search_card?.stream_options,
				},
			},
		}
	}

	/**
	 * 更新搜索深度
	 * 处理类型为SearchDeepLevel的消息，更新搜索深度相关信息
	 * @param receiveMessage 接收到的消息
	 */
	updateSearchDeepLevel(
		receiveMessage: SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	) {
		const { aggregate_ai_search_card: { search_deep_level = undefined } = {}, app_message_id } =
			receiveMessage.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.search_deep_level = search_deep_level
	}

	/**
	 * 更新关联问题
	 * 处理类型为AssociateQuestion的消息，更新关联问题列表
	 * @param message 接收到的消息
	 */
	updateAssociateQuestion(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card: { associate_questions = {} } = {}, app_message_id } =
			message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.associate_questions = Object.entries(
			associate_questions,
		).reduce((acc, [key, value]) => {
			if (typeof value === "string") {
				acc[key] = {
					title: value,
					llm_response: null,
					search_keywords: null,
					total_words: 0,
				}
			} else {
				acc[key] = merge(
					{
						title: value,
						llm_response: null,
						search_keywords: null,
						total_words: 0,
					},
					value,
				)
			}
			return acc
		}, {} as Record<string, AssociateQuestion>)
	}

	/**
	 * 更新思维导图
	 * 处理类型为MindMap的消息，更新思维导图数据
	 * @param message 接收到的消息
	 */
	updateMindMap(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card, app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.mind_map =
			aggregate_ai_search_card?.mind_map ?? undefined
	}

	/**
	 * 更新搜索结果
	 * 处理类型为Search的消息，更新搜索结果及相关元数据
	 * @param message 接收到的消息
	 */
	updateSearch(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card, app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage || !aggregate_ai_search_card) return

		const parentId = aggregate_ai_search_card.parent_id
		if (!parentId) return

		if (!localMessage.aggregate_ai_search_card!.search?.[parentId]) {
			localMessage.aggregate_ai_search_card!.search[parentId] = []
		}
		if (aggregate_ai_search_card.search) {
			localMessage.aggregate_ai_search_card!.search[parentId] =
				aggregate_ai_search_card.search
		}

		// parentId 为 "0" 时，表示是根问题,不存储
		if (parentId !== "0") {
			if (!localMessage.aggregate_ai_search_card!.associate_questions?.[parentId]) {
				localMessage.aggregate_ai_search_card!.associate_questions[parentId] = {
					title: "",
					llm_response: null,
					search_keywords: null,
					total_words: 0,
				}
			}
			localMessage.aggregate_ai_search_card!.associate_questions[parentId].search_keywords =
				aggregate_ai_search_card.search_keywords ?? []

			// 更新总字数
			localMessage.aggregate_ai_search_card!.associate_questions[parentId].total_words =
				aggregate_ai_search_card.total_words ?? 0

			// 更新检索到的页面总数
			localMessage.aggregate_ai_search_card!.associate_questions[parentId].match_count =
				aggregate_ai_search_card.match_count ?? 0

			// 更新阅读的页面总数
			localMessage.aggregate_ai_search_card!.associate_questions[parentId].page_count =
				aggregate_ai_search_card.page_count ?? 0
		}
	}

	/**
	 * 更新LLM响应
	 * 处理类型为LLMResponse的消息，更新AI回答内容
	 * 对于根问题和关联问题分别进行处理
	 * @param message 接收到的消息
	 */
	updateLLMResponse(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card, app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage || !aggregate_ai_search_card) return

		const parentId = aggregate_ai_search_card.parent_id
		if (!parentId) return

		if (parentId !== "0") {
			/**
			 * 通过关键问题 ID 找到关联问题，并更新关联问题的回答
			 */
			const associateQuestion =
				localMessage.aggregate_ai_search_card!.associate_questions?.[parentId]
			if (associateQuestion) {
				associateQuestion.llm_response = aggregate_ai_search_card.llm_response ?? null
			} else {
				console.warn("关键问题未找到", parentId, message)
			}
		} else {
			/**
			 * 更新根问题的回答
			 */
			localMessage.aggregate_ai_search_card!.llm_response =
				aggregate_ai_search_card.llm_response ?? undefined
			localMessage.aggregate_ai_search_card!.stream_options =
				aggregate_ai_search_card.stream_options ?? undefined

			this.updateAggregateAISearchCardLlmResponseByStreamOptions(localMessage, message)
		}
	}

	/**
	 * 更新事件
	 * 处理类型为Event的消息，更新事件列表
	 * @param message 接收到的消息
	 */
	updateEvent(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card, app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.event = aggregate_ai_search_card?.event ?? []
	}

	/**
	 * 更新Ping-Pong状态
	 * 处理类型为PingPong的消息，将消息标记为完成状态
	 * @param message 接收到的消息
	 */
	updatePingPong(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const {
			message: { app_message_id },
		} = message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) {
			return
		}
		if (localMessage.aggregate_ai_search_card?.finish === false) {
			localMessage.aggregate_ai_search_card.finish = true
		}
	}

	/**
	 * 更新终止状态
	 * 处理类型为Terminate的消息，标记错误状态并移除消息
	 * @param message 接收到的消息
	 */
	updateTerminate(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.error = true

		// 移除消息
		MessageService.removeMessage(
			message.conversation_id,
			message.message_id,
			message.conversation_id,
		)

		// 标记为完成
		if (localMessage.aggregate_ai_search_card?.finish === false) {
			localMessage.aggregate_ai_search_card.finish = true
		}
	}

	/**
	 * 更新PPT
	 * 处理类型为PPT的消息，更新PPT数据
	 * @param message 接收到的消息
	 */
	updatePPT(message: SeqResponse<AggregateAISearchCardConversationMessage<true>>) {
		const { aggregate_ai_search_card, app_message_id } = message.message
		const localMessage = this.getTempMessageContent(app_message_id)
		if (!localMessage) return
		localMessage.aggregate_ai_search_card!.ppt = aggregate_ai_search_card?.ppt ?? undefined
	}

	/**
	 * 更新聚合 AI 搜索卡片 LLM 响应
	 * 根据流式选项更新LLM响应内容，处理流式传输的开始和结束状态
	 * @param localMessage 本地存储的消息
	 * @param message 接收到的消息
	 */
	updateAggregateAISearchCardLlmResponseByStreamOptions(
		localMessage: SeqResponse<AggregateAISearchCardConversationMessage<false>>["message"],
		message: SeqResponse<AggregateAISearchCardConversationMessage<true>>,
	) {
		const { aggregate_ai_search_card } = message.message
		if (!aggregate_ai_search_card) return
		const { stream_options } = aggregate_ai_search_card
		// 如果不是流式传输，则直接更新LLM响应
		if (!stream_options || !stream_options.stream) {
			localMessage.aggregate_ai_search_card!.llm_response =
				message.message.aggregate_ai_search_card?.llm_response ?? ""
			return
		}

		// 如果是流式传输，则根据流式传输的状态更新LLM响应
		const { status } = stream_options
		if (status === StreamStatus.End) {
			// 流式传输结束，更新LLM响应
			localMessage.aggregate_ai_search_card!.llm_response =
				message.message.aggregate_ai_search_card?.llm_response ?? ""
		} else if (status === StreamStatus.Start) {
			this.setLLMResponseSeqId(message.seq_id, message.message.app_message_id)

			// 压到下一轮事件循环，确保流式传输开始时，消息信息已经记录
			setTimeout(() => {
				// 流式传输开始，添加到任务队列
				StreamMessageApplyServiceV2.apply({
					target_seq_id: message.seq_id,
					// @ts-ignore
					streams: {
						stream_options: {
							status: StreamStatus.Start,
						},
						reasoning_content:
							message.message.aggregate_ai_search_card?.reasoning_content ?? "",
						content: "",
						llm_response: "",
					},
				})
			})
		}
	}

	/**
	 * 合并AI搜索消息
	 * @param aiSearchMessages
	 * @returns
	 */
	combineAiSearchMessage(
		aiSearchMessages: SeqResponse<AggregateAISearchCardConversationMessage<true>>[],
	) {
		if (aiSearchMessages.length === 0) return

		aiSearchMessages.sort((a, b) =>
			bigNumCompare(
				a.message.aggregate_ai_search_card?.id ?? "",
				b.message.aggregate_ai_search_card?.id ?? "",
			),
		)

		const combinedMessage = this.createAggregateAISearchCardMessage(aiSearchMessages[0])
		for (let i = 1; i < aiSearchMessages.length; i++) {
			const message = aiSearchMessages[i]
			switch (message.message.aggregate_ai_search_card?.type) {
				case AggregateAISearchCardDataType.SearchDeepLevel:
					combinedMessage.message.aggregate_ai_search_card!.search_deep_level =
						message.message.aggregate_ai_search_card!.search_deep_level
					break
				case AggregateAISearchCardDataType.AssociateQuestion:
					combinedMessage.message.aggregate_ai_search_card!.associate_questions =
						Object.entries(
							message.message.aggregate_ai_search_card!.associate_questions ?? {},
						).reduce((acc, [key, value]) => {
							if (typeof value === "string") {
								acc[key] = {
									title: value,
									llm_response: null,
									search_keywords: null,
									total_words: 0,
								}
							} else {
								acc[key] = merge(
									{
										title: value,
										llm_response: null,
										search_keywords: null,
										total_words: 0,
									},
									value,
								)
							}
							return acc
						}, {} as Record<string, AssociateQuestion>)
					break
				case AggregateAISearchCardDataType.MindMap:
					combinedMessage.message.aggregate_ai_search_card!.mind_map =
						message.message.aggregate_ai_search_card!.mind_map
					break
				case AggregateAISearchCardDataType.Search:
					const parentId = message.message.aggregate_ai_search_card!.parent_id

					combinedMessage.message.aggregate_ai_search_card!.search[parentId] =
						message.message.aggregate_ai_search_card!.search ?? []

					if (parentId !== "0") {
						if (
							!combinedMessage.message.aggregate_ai_search_card!
								.associate_questions?.[parentId]
						) {
							combinedMessage.message.aggregate_ai_search_card!.associate_questions[
								parentId
							] = {
								title: "",
								llm_response: null,
								search_keywords: null,
								total_words: 0,
							}
						}
						combinedMessage.message.aggregate_ai_search_card!.associate_questions[
							parentId
						].search_keywords =
							message.message.aggregate_ai_search_card!.search_keywords ?? []

						// 更新总字数
						combinedMessage.message.aggregate_ai_search_card!.associate_questions[
							parentId
						].total_words = message.message.aggregate_ai_search_card!.total_words ?? 0

						// 更新检索到的页面总数
						combinedMessage.message.aggregate_ai_search_card!.associate_questions[
							parentId
						].match_count = message.message.aggregate_ai_search_card!.match_count ?? 0

						// 更新阅读的页面总数
						combinedMessage.message.aggregate_ai_search_card!.associate_questions[
							parentId
						].page_count = message.message.aggregate_ai_search_card!.page_count ?? 0
					}
					break
				case AggregateAISearchCardDataType.LLMResponse:
					if (message.message.aggregate_ai_search_card?.parent_id === "0") {
						combinedMessage.message.aggregate_ai_search_card!.llm_response =
							message.message.aggregate_ai_search_card!.llm_response
					} else if (message.message.aggregate_ai_search_card?.parent_id) {
						const parentId = message.message.aggregate_ai_search_card!.parent_id
						combinedMessage.message.aggregate_ai_search_card!.associate_questions[
							parentId
						].llm_response =
							message.message.aggregate_ai_search_card!.llm_response ?? null
					}
					break
				case AggregateAISearchCardDataType.Event:
					combinedMessage.message.aggregate_ai_search_card!.event =
						message.message.aggregate_ai_search_card!.event
					break
				case AggregateAISearchCardDataType.PingPong:
					combinedMessage.message.aggregate_ai_search_card!.finish = true
					break
				case AggregateAISearchCardDataType.Terminate:
					combinedMessage.message.aggregate_ai_search_card!.error = true
					break
				case AggregateAISearchCardDataType.PPT:
					combinedMessage.message.aggregate_ai_search_card!.ppt =
						message.message.aggregate_ai_search_card!.ppt
					break
			}
		}
		return combinedMessage
	}
}

export default new AiSearchApplyService()
