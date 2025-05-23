import type { StreamResponse, SeqResponse } from "@/types/request"
import { StreamStatus } from "@/types/request"
import type {
	AggregateAISearchCardConversationMessage,
	ConversationMessage,
	MarkdownConversationMessage,
	TextConversationMessage,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import Logger from "@/utils/log/Logger"
import { isUndefined } from "lodash-es"
import AiSearchApplyService from "../ChatMessageApplyServices/AiSearchApplyService"
import MessageService from "../../MessageService"
import type { StreamMessageTask } from "./types"
import { sliceMessage } from "./utils"
import ConversationService from "../../../conversation/ConversationService"

const console = new Logger("StreamMessageApplyService", "blue", { console: false })

/**
 * 流式消息管理器
 * @deprecated 已废弃，使用 StreamMessageApplyServiceV2 替代
 *
 * @class StreamMessageApplyService
 */
class StreamMessageApplyService {
	taskMap: Record<string, StreamMessageTask>

	messageConversationMap: Record<
		string,
		{
			conversationId: string
			topicId: string
			messageId: string
			type: ConversationMessageType
		}
	> = {}

	constructor() {
		this.taskMap = {}
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

	/**
	 * 添加任务
	 * @param messageId 消息ID
	 * @param message 消息
	 */
	addToTaskMap(messageId: string, message: StreamResponse, run: boolean = true) {
		console.log(`[addToTaskMap] 开始添加任务，消息ID: ${messageId}, 是否立即执行: ${run}`)
		const task = this.taskMap[messageId]

		if (task) {
			// 将消息分割成单个字符并添加到任务队列
			const slicedMessages = sliceMessage(message)
			task.tasks.push(...slicedMessages)

			if (task.status === "init") {
				task.status = "doing"
			}

			if (!task.triggeredRender && run) {
				this.executeType(messageId)
			}
		} else {
			// 创建新任务并添加消息
			const slicedMessages = sliceMessage(message)
			this.taskMap[messageId] = {
				status: "init",
				tasks: slicedMessages,
				triggeredRender: false,
			}

			if (run) {
				this.executeType(messageId)
			}
		}
	}

	/**
	 * 判断是否存在任务
	 * @param messageId 消息ID
	 * @returns 是否存在任务
	 */
	hasTask(messageId: string) {
		return this.taskMap[messageId]
	}

	/**
	 * 完成任务
	 * @param messageId 消息ID
	 */
	finishTask(messageId: string) {
		const task = this.taskMap[messageId]
		if (task) {
			task.status = "done"
		}
	}

	/**
	 * 创建任务对象
	 * @param message 消息
	 * @returns 任务对象
	 */
	static createObject(message?: StreamResponse): StreamMessageTask {
		return {
			status: "init",
			tasks: message ? sliceMessage(message) : [],
			triggeredRender: false,
		}
	}

	/**
	 * 从任务列表中移除任务
	 * @param messageId 消息ID
	 */
	removeFromTaskMap(messageId: string) {
		delete this.taskMap[messageId]
	}

	/**
	 * 改变任务ID
	 * @param oldMessageId 旧消息ID
	 * @param newMessageId 新消息ID
	 */
	changeTaskId(oldMessageId: string, newMessageId: string) {
		this.taskMap[newMessageId] = this.taskMap[oldMessageId]
		delete this.taskMap[oldMessageId]
	}

	/**
	 * 执行任务
	 * @param messageId 消息ID
	 */
	executeType(messageId: string) {
		console.log(`[executeType] 开始执行任务，消息ID: ${messageId}`)
		const task = this.taskMap[messageId]
		if (task) {
			task.triggeredRender = true
			console.log(`[executeType] 任务状态: ${task.status}, 剩余任务数: ${task.tasks.length}`)

			// 创建字符缓冲区，用于平滑字符输出
			const buffer: StreamResponse[] = []
			// 控制输出速度的基础字符间隔时间(ms)
			const baseInterval = 10
			// 上次输出的时间戳
			let lastOutputTime = Date.now()
			// 字符输出间隔(ms)
			let outputInterval = baseInterval
			// 字符预加载阈值，当缓冲区字符数低于此值时主动拉取更多任务
			const bufferThreshold = 10
			// 平均字符输出速率，单位: 字符/秒
			const avgOutputRate = 40
			// 用于计算平均输出速度的窗口大小
			const speedWindowSize = 20
			// 最近输出的字符时间间隔记录
			const recentIntervals: number[] = []

			const processNextChunk = () => {
				const now = Date.now()
				const timeSinceLastOutput = now - lastOutputTime

				// 补充缓冲区
				if (buffer.length < bufferThreshold && task.tasks.length > 0) {
					// 从任务队列中获取新字符到缓冲区
					const newChars = task.tasks.splice(0, Math.min(30, task.tasks.length))
					buffer.push(...newChars)
				}

				// 处理输出逻辑
				if (buffer.length > 0 && timeSinceLastOutput >= outputInterval) {
					// 从缓冲区获取一个字符进行处理
					const message = buffer.shift()
					if (message) {
						this.appendStreamMessage(messageId, message)
					}

					// 更新时间戳
					lastOutputTime = now

					// 根据内容复杂度调整输出间隔
					const contentLength =
						message?.content?.length ||
						message?.llm_response?.length ||
						message?.reasoning_content?.length ||
						0

					// 调整输出间隔，保持稳定的打字机效果
					// 存储当前间隔到历史记录中
					recentIntervals.push(outputInterval)
					// 保持窗口大小固定
					if (recentIntervals.length > speedWindowSize) {
						recentIntervals.shift()
					}

					// 计算平均间隔，使输出更加平滑
					const avgInterval =
						recentIntervals.reduce((sum, val) => sum + val, 0) /
						(recentIntervals.length || 1)

					// 动态调整输出间隔
					if (task.status === "done") {
						// 任务已完成，可以稍微加快速度，但仍保持平滑
						outputInterval = Math.max(10, avgInterval * 0.9)
					} else {
						// 根据内容长度和当前平均速率动态调整
						const targetInterval = 1000 / avgOutputRate // 目标间隔时间
						// 在当前平均间隔和目标间隔之间平滑过渡
						outputInterval = avgInterval * 0.7 + targetInterval * 0.3
						// 内容长度影响：长内容稍微延长间隔，短内容保持正常
						if (contentLength > 1) {
							outputInterval = Math.min(outputInterval * 1.2, 80)
						}
						// 确保间隔在合理范围内
						outputInterval = Math.max(15, Math.min(outputInterval, 50))
					}
				}

				// 继续处理或结束条件
				if (buffer.length > 0 || task.tasks.length > 0 || task.status !== "done") {
					// 使用requestAnimationFrame获得更平滑的动画效果
					requestAnimationFrame(() => {
						processNextChunk()
					})
				} else if (
					task.status === "done" &&
					buffer.length === 0 &&
					task.tasks.length === 0
				) {
					// 所有任务完成，标记流结束
					this.removeFromTaskMap(messageId)
				}
			}

			// 开始处理
			processNextChunk()
		} else {
			console.log(`[executeType] 任务不存在，创建新任务: ${messageId}`)
			this.taskMap[messageId] = StreamMessageApplyService.createObject()
		}
	}

	/**
	 * 追加流式消息
	 * @param targetId 目标ID
	 * @param message 消息
	 */
	appendStreamMessage(targetId: string, message: StreamResponse) {
		const { content, reasoning_content, llm_response } = message
		const targetSeqInfo = this.queryMessageInfo(targetId)
		const aISearchSeqInfo = this.queryMessageInfo(
			AiSearchApplyService.getAppMessageIdByLLMResponseSeqId(targetId),
		)

		switch (true) {
			case Boolean(content):
				if (!targetSeqInfo) return
				MessageService.updateMessage(
					targetSeqInfo.conversationId,
					targetSeqInfo.topicId,
					targetSeqInfo.messageId,
					(m) => {
						const textMessage = m.message as TextConversationMessage
						if (textMessage.text) {
							textMessage.text.content = (textMessage.text.content || "") + content
						}
						return m
					},
				)
				break
			case Boolean(llm_response):
				// 更新 ai 搜索缓存数据
				AiSearchApplyService.appendContent(targetId, llm_response)
				break
			case Boolean(reasoning_content):
				if (targetSeqInfo) {
					MessageService.updateMessage(
						targetSeqInfo.conversationId,
						targetSeqInfo.topicId,
						targetSeqInfo.messageId,
						(m) => {
							const textMessage = m.message as
								| TextConversationMessage
								| MarkdownConversationMessage
							switch (true) {
								case textMessage.type === ConversationMessageType.Text:
									if (textMessage.text) {
										textMessage.text.reasoning_content =
											(textMessage.text.reasoning_content || "") +
											reasoning_content
										if (textMessage.text.stream_options) {
											textMessage.text.stream_options.status =
												StreamStatus.Streaming
											textMessage.text.stream_options.stream = true
										}
									}
									break
								case textMessage.type === ConversationMessageType.Markdown:
									if (textMessage.markdown) {
										textMessage.markdown.reasoning_content =
											(textMessage.markdown.reasoning_content || "") +
											reasoning_content
										if (textMessage.markdown.stream_options) {
											textMessage.markdown.stream_options.status =
												StreamStatus.Streaming
											textMessage.markdown.stream_options.stream = true
										}
									}
									break
								default:
									break
							}
							return m
						},
					)
				} else if (aISearchSeqInfo) {
					AiSearchApplyService.appendReasoningContent(targetId, reasoning_content)
				}
				break
			default:
				break
		}
	}

	apply(streamMessage: StreamResponse) {
		console.log(`[apply] 开始应用流式消息，目标序列ID: ${streamMessage.target_seq_id}`)

		const targetSeqInfo = this.queryMessageInfo(streamMessage.target_seq_id)
		const aggregateAISearchCardSeqInfo = this.queryMessageInfo(
			AiSearchApplyService.getAppMessageIdByLLMResponseSeqId(streamMessage.target_seq_id),
		)

		if (!targetSeqInfo && !aggregateAISearchCardSeqInfo) return

		const type = targetSeqInfo?.type ?? aggregateAISearchCardSeqInfo?.type

		switch (type) {
			case ConversationMessageType.Text:
				console.log(`[apply] 处理文本类型消息`)
				this.applyTextStreamMessage(streamMessage)
				break
			case ConversationMessageType.Markdown:
				console.log(`[apply] 处理Markdown类型消息`)
				this.applyMarkdownStreamMessage(streamMessage)
				break
			case ConversationMessageType.AggregateAISearchCard:
				console.log(`[apply] 处理AI搜索卡片类型消息`)
				this.applyAggregateAISearchCardStreamMessage(streamMessage)
				break
			default:
				console.log(`[apply] 未知消息类型，使用默认处理方式`)
				this.applyDefaultStreamMessage(streamMessage)
				break
		}
	}

	/**
	 * 应用文本流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyTextStreamMessage(streamMessage: StreamResponse) {
		console.log(`[applyTextStreamMessage] 开始处理文本流式消息，状态: ${streamMessage.status}`)
		const { target_seq_id, reasoning_content, status, content } = streamMessage
		const { messageId, conversationId, topicId } = this.queryMessageInfo(target_seq_id)!

		if ([StreamStatus.Start, StreamStatus.Streaming].includes(status)) {
			if (reasoning_content) {
				console.log(`[applyTextStreamMessage] 处理推理内容`)
				this.addToTaskMap(target_seq_id, streamMessage)
			} else if (content) {
				console.log(`[applyTextStreamMessage] 处理内容`)
				this.addToTaskMap(target_seq_id, streamMessage)
			}
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
				text: content.slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.text.content": content,
				"message.text.reasoning_content": reasoning_content,
				"message.text.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)
		}
		this.finishTask(target_seq_id)
		console.log(`[applyTextStreamMessage] 文本流式消息处理完成`)
	}

	/**
	 * 应用markdown流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyMarkdownStreamMessage(streamMessage: StreamResponse) {
		console.log(
			`[applyMarkdownStreamMessage] 开始处理Markdown流式消息，状态: ${streamMessage.status}`,
		)
		const { reasoning_content, content, status, target_seq_id } = streamMessage
		const { messageId, conversationId, topicId } = this.queryMessageInfo(target_seq_id)!

		if ([StreamStatus.Streaming, StreamStatus.Start].includes(status)) {
			if (reasoning_content) {
				console.log(`[applyMarkdownStreamMessage] 处理推理内容`)
				this.addToTaskMap(target_seq_id, streamMessage)
			} else if (content) {
				console.log(`[applyMarkdownStreamMessage] 处理内容`)
				this.addToTaskMap(target_seq_id, streamMessage)
			}
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
				return m
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.Markdown,
				text: content.slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.markdown.content": content,
				"message.markdown.reasoning_content": reasoning_content,
				"message.markdown.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)
		}
		this.finishTask(target_seq_id)
		console.log(`[applyMarkdownStreamMessage] Markdown流式消息处理完成`)
	}

	/**
	 * 应用聚合AI搜索卡片流式消息
	 * @param streamMessage 流式消息
	 * @param message 消息
	 */
	applyAggregateAISearchCardStreamMessage(message: StreamResponse) {
		console.log(
			`[applyAggregateAISearchCardStreamMessage] 开始处理AI搜索卡片流式消息，状态: ${message.status}`,
		)
		const { reasoning_content, llm_response } = message
		const { status, target_seq_id } = message
		const { messageId, conversationId, topicId } = this.queryMessageInfo(
			AiSearchApplyService.getAppMessageIdByLLMResponseSeqId(target_seq_id),
		)!

		if (!isUndefined(status) && [StreamStatus.Streaming, StreamStatus.Start].includes(status)) {
			if (reasoning_content) {
				console.log(`[applyAggregateAISearchCardStreamMessage] 处理推理内容`)
				this.addToTaskMap(target_seq_id, message)
			} else if (llm_response) {
				console.log(`[applyAggregateAISearchCardStreamMessage] 处理LLM响应内容`)
				this.addToTaskMap(target_seq_id, message)
			}
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
				return m
			})

			// 更新最后一条消息
			ConversationService.updateLastReceiveMessage(conversationId, {
				time: Date.now(),
				seq_id: messageId,
				type: ConversationMessageType.AggregateAISearchCard,
				text: llm_response.slice(0, 50),
				topic_id: topicId,
			})

			// 落库
			MessageService.updateDbMessage(messageId, conversationId, {
				"message.aggregate_ai_search_card.llm_response": llm_response,
				"message.aggregate_ai_search_card.reasoning_content": reasoning_content,
				"message.aggregate_ai_search_card.stream_options.status": StreamStatus.End,
			} as Partial<SeqResponse<ConversationMessage>>)

			this.finishTask(target_seq_id)
		}
		console.log(`[applyAggregateAISearchCardStreamMessage] AI搜索卡片流式消息处理完成`)
	}

	applyDefaultStreamMessage(streamMessage: StreamResponse) {
		const { target_seq_id, reasoning_content, status, content } = streamMessage

		if ([StreamStatus.Start, StreamStatus.Streaming].includes(status)) {
			if (reasoning_content) {
				this.addToTaskMap(target_seq_id, streamMessage, false)
			} else if (content) {
				this.addToTaskMap(target_seq_id, streamMessage, false)
			}
		} else if (status === StreamStatus.End) {
			this.finishTask(target_seq_id)
		}
	}
}

export default new StreamMessageApplyService()
