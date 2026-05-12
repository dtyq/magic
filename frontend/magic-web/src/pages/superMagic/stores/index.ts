import { makeAutoObservable, runInAction, toJS } from "mobx"
import pubsub from "@/utils/pubsub"
import { unionBy, get, set, merge } from "lodash-es"
import dayjs from "@/lib/dayjs"
import type { SuperMagicChunkMessage } from "@/types/chat/intermediate_message"
import {
	createDomainEventRegistry,
	createTopicMessageListenerRegistry,
	resolveCrewDomainEvent,
	resolveTaskDomainEvent,
} from "./listener-registry"
import { persistMessageToStorage } from "./persistence"
import {
	getRawMessageNode,
	transformRawMessage,
	sortMessages,
	addOneToBigNumberString,
	isToolCallsEqual,
	isToolCallsMatch,
	isToolCallArgumentsComplete,
	getCharsPerTick,
	adjustSliceEnd,
	createStreamState,
	getDefaultTopicMeta,
} from "./message-transforms"

// Re-export types (preserves all existing public type exports)
export type {
	MessageItem,
	RawSuperMagicMessageNode,
	RawSuperMagicMessageEnvelope,
	RegisterTopicMessageListenerParams,
	TopicMessageListenerPayload,
	CrewDomainEventPayload,
	TaskDomainEventPayload,
	DomainEventPayload,
	RegisterDomainEventListenerParams,
} from "./types"

// Re-export value exports
export { isV2Message } from "./message-transforms"
// import { db } from "./storage"

// Export Role Store
export { roleStore } from "./RoleStore"
// Export File Icon Store
export { fileIconStore } from "./fileIconStore"

// Export Suggestion Store
export { suggestionStore } from "./SuggestionStore"

// ─── Internal type imports ───────────────────────────────────

import type {
	SuperMagicStoreTopicId,
	TopicMessageNode,
	TopicMessageListenerPayload,
	DomainEventPayload,
	RawSuperMagicMessageNode,
	RawSuperMagicIMMessage,
	RawSuperMagicMessageSequence,
	RawSuperMagicMessageEnvelope,
	PendingUserMessageEnvelope,
	SharedMessageItem,
	MessageItem,
	StreamState,
	ToolCall,
	ToolStreamStepResult,
	ToolStreamMessageState,
	ToolResponseState,
	TopicMeta,
	RegisterDomainEventListenerParams,
} from "./types"

function resolveDomainEvents(payload: TopicMessageListenerPayload): DomainEventPayload[] {
	return [resolveCrewDomainEvent(payload), resolveTaskDomainEvent(payload)].filter(
		(event): event is DomainEventPayload => Boolean(event),
	)
}

export class SuperMagicStore {
	// 消息
	messages: Map<SuperMagicStoreTopicId, MessageItem[]> = new Map()
	// 消息缓冲区
	buffer: Map<
		SuperMagicStoreTopicId,
		{ isProcessing: boolean; messages: RawSuperMagicMessageEnvelope[] }
	> = new Map()
	// 消息内容（卡片形式）
	messageMap: Map<string, unknown> = new Map()
	// 工具调用响应最新态（key: <topic_id, tool_call_id>）
	toolResponseMap: Map<string, Map<string, ToolResponseState>> = new Map()
	/** 话题消息元数据 */
	topicMeta: Map<SuperMagicStoreTopicId, TopicMeta> = new Map()
	/** 话题Id映射( < IM话题Id, 超麦话题Id > ) */
	topicMap: Map<string, string> = new Map()
	/** 当前可见话题 ID，仅该话题执行定时器驱动的打字机渲染 */
	activeTopicId: string | null = null

	/** 话题消息监听注册中心：用于消息到达阶段的订阅/发布 */
	private topicMessageListenerRegistry = createTopicMessageListenerRegistry<
		MessageItem,
		TopicMessageNode
	>()
	/** 领域事件注册中心：用于将消息变更转换后的领域事件统一分发 */
	private domainEventRegistry = createDomainEventRegistry<DomainEventPayload>()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	private emitDomainEvents(payload: TopicMessageListenerPayload) {
		resolveDomainEvents(payload).forEach((event) => {
			this.domainEventRegistry.emit(event)
		})
	}

	private emitTopicMessageArrived(payload: TopicMessageListenerPayload) {
		this.topicMessageListenerRegistry.emit(payload)
	}

	/**
	 * 设置当前可见话题。切换后自动回放已完成的流式快照（场景 2）
	 * 并恢复仍在进行中的流式渲染定时器（场景 1）。
	 */
	setActiveTopicId(topicId: string | null) {
		const prevTopicId = this.activeTopicId
		this.activeTopicId = topicId
		if (topicId && topicId !== prevTopicId) {
			this.replayPendingSnapshots(topicId)
			this.resumeActiveStreams(topicId)
		}
	}

	/**
	 * @description 初始化话题的消息列表 (messages 为desc排序，确保与 this.messages 中时间排序保持一致（从大到小）)
	 * @param topicId 话题id
	 * @param messages 消息列表
	 */
	initializeMessages(topicId: string, messages: RawSuperMagicMessageEnvelope[]) {
		const existingMessages = this.messages.get(topicId) || []
		const topicBuffer = this.getTopicBuffer(topicId)
		console.log("API 拉取的消息列表", messages)
		const bufferedMessageIds = new Set(
			topicBuffer.messages.map((item) => item?.seq?.message?.app_message_id),
		)
		const existingMessageIds = new Set(existingMessages.map((item) => item.app_message_id))
		runInAction(() => {
			const chronologicalMessages = (messages || []).slice().reverse()
			const toolResponseMap = this.toolResponseMap.get(topicId) || new Map()
			chronologicalMessages.forEach((envelope) => {
				const imMessage = envelope?.seq?.message
				const rawNode = getRawMessageNode(imMessage)
				const messageType = String(imMessage?.type || "")
				const appMessageId = imMessage?.app_message_id as string
				const correlationId = String(rawNode?.correlation_id || "")
				if (
					!bufferedMessageIds.has(appMessageId) &&
					rawNode?.event !== "before_llm_request"
				) {
					const incomingMessage: MessageItem = transformRawMessage(
						envelope?.seq as RawSuperMagicMessageSequence,
					)
					// 针对客户端的工具调用消息直接过滤
					if (incomingMessage?.type === "user_tool_call") {
						return
					}
					if (
						existingMessageIds.has(appMessageId) ||
						existingMessageIds.has(correlationId)
					) {
						const matchIndex = existingMessages.findIndex(
							(item) =>
								item?.app_message_id === appMessageId ||
								(item?.app_message_id === correlationId &&
									item?.role === rawNode?.role),
						)
						if (matchIndex > -1) {
							const existingMessage = existingMessages[matchIndex]
							if (existingMessage) {
								existingMessages[matchIndex] = {
									...existingMessage,
									...incomingMessage,
									app_message_id: existingMessage.app_message_id,
								}
							}
						}
					} else {
						existingMessages.push(incomingMessage)
					}
				}
				if (messageType === "super_magic_message") {
					if (rawNode?.role === "tool" && rawNode?.tool?.id)
						toolResponseMap.set(rawNode?.tool?.id, {
							...rawNode?.tool,
						})
				}

				this.messageMap.set(appMessageId, rawNode)
			})
			this.toolResponseMap.set(topicId, toolResponseMap)
			this.messages.set(topicId, unionBy(sortMessages(existingMessages), "app_message_id"))
		})
	}

	/**
	 * @description 加载分享的消息列表
	 * @param messages 消息列表
	 */
	loadSharedMessages(messages: SharedMessageItem[]) {
		runInAction(() => {
			messages?.forEach((sharedMessage) => {
				const messageId = String(sharedMessage?.message_id || "")
				if (sharedMessage?.type === "rich_text") {
					this.messageMap.set(messageId, {
						...sharedMessage,
						...(sharedMessage?.raw_content?.rich_text || {}),
					})
				} else if (sharedMessage?.type === "super_magic_message") {
					const rawNode = {
						...(sharedMessage?.raw_content?.super_magic_message as Record<
							string,
							unknown
						>),
					}
					if (rawNode?.role === "tool") {
						const toolPayload = (rawNode?.tool || {}) as Record<string, unknown>
						const toolCallId = String(rawNode?.tool_call_id || toolPayload?.id || "")
						if (toolCallId) {
							const topicId = String(sharedMessage?.topic_id || "")
							const toolResponse = toolPayload as ToolResponseState
							const topicToolMap = this.toolResponseMap.get(topicId) || new Map()
							topicToolMap.set(toolCallId, toolResponse)
							this.toolResponseMap.set(topicId, topicToolMap)
						}
					}

					this.messageMap.set(messageId, rawNode)
				} else {
					this.messageMap.set(messageId, sharedMessage)
				}
			})
		})
	}

	// ======================================
	// 方法 1：外部接收真实 chunk（前期正常流）
	// ======================================
	receiveChunk(message: SuperMagicChunkMessage) {
		const topicId = message?.topic_id
		persistMessageToStorage(topicId, message)
		const messageChunk = message?.[message?.type]
		const correlationId = String(messageChunk?.correlation_id || "")
		if (!topicId || !correlationId) return

		const stableAppMessageId = correlationId
		const streamState = this.getTopicStreamState(topicId, correlationId)

		if (streamState.isFinalMessageReceived) return

		const delta = messageChunk.choices[0]?.delta
		if (!delta) return

		runInAction(() => {
			const topicMeta = this.getTopicMetadata(topicId)

			if (messageChunk.choices[0]?.finish_reason || messageChunk.usage) {
				topicMeta.isStream = false
				streamState.isFinalMessageReceived = true
			} else {
				topicMeta.isStream = true
			}

			if (delta.reasoning_content) {
				streamState.reasoning_content += delta.reasoning_content
			}

			if (delta.content) {
				streamState.content += delta.content
			}

			const toolCalls = delta?.tool_calls || []
			if (toolCalls.length > 0) {
				const fn = toolCalls?.[0]?.function
				if (fn && !Array.isArray(fn) && typeof fn === "object") {
					const isNewTool = fn.name
					const toolIndex = toolCalls?.[0]?.index || 0

					if (isNewTool) {
						streamState.tool_calls[toolIndex] = toolCalls?.[0]
					} else {
						const argCache = get(
							streamState,
							["tool_calls", toolIndex, "function", "arguments"],
							"",
						)
						set(
							streamState,
							["tool_calls", toolIndex, "function", "arguments"],
							argCache + (fn.arguments || ""),
						)
					}
				}
			}

			this.startStreamRendering(topicId, stableAppMessageId)
		})
	}

	private getTopicBuffer(topicId: string) {
		if (!this.buffer.has(topicId)) {
			this.buffer.set(topicId, { isProcessing: false, messages: [] })
		}
		return this.buffer.get(topicId)! as {
			isProcessing: boolean
			messages: RawSuperMagicMessageEnvelope[]
		}
	}

	addUserMessage(topicId: string, baseMessage: PendingUserMessageEnvelope) {
		const rawMessage = baseMessage?.message as RawSuperMagicIMMessage
		const appMessageId = rawMessage?.app_message_id as string
		const resolvedTopicId = (rawMessage?.topic_id as string) || topicId
		if (!rawMessage || !appMessageId || !resolvedTopicId) return

		const messageList = this.messages.get(resolvedTopicId) || []
		if (messageList.some((item) => item.app_message_id === appMessageId)) return

		const lastMessage = messageList?.[messageList.length - 1]
		const seqId = lastMessage ? addOneToBigNumberString(lastMessage.seq_id) : `${Date.now()}`
		const sequence = {
			seq_id: seqId,
			message_id: appMessageId,
			refer_message_id: "",
			sender_message_id: rawMessage?.sender_id || "",
			conversation_id: baseMessage?.conversation_id || "",
			send_time: dayjs().unix(),
			magic_id: "",
			organization_code: "",
			message: {
				...rawMessage,
				send_time: dayjs().unix(),
			},
		} as RawSuperMagicMessageSequence
		const nextMessage = transformRawMessage(sequence)
		const messageNode = getRawMessageNode(rawMessage)

		runInAction(() => {
			this.messageMap.set(appMessageId, messageNode)
			this.messages.set(
				resolvedTopicId,
				unionBy(sortMessages([...messageList, nextMessage]), "app_message_id"),
			)
		})
	}

	replaceUserMessage(
		topicId: string,
		baseMessage: RawSuperMagicMessageEnvelope | RawSuperMagicMessageSequence,
	) {
		const sequence =
			"seq" in baseMessage
				? (baseMessage.seq as RawSuperMagicMessageSequence)
				: (baseMessage as RawSuperMagicMessageSequence)
		const rawMessage = sequence?.message as RawSuperMagicIMMessage
		const appMessageId = rawMessage?.app_message_id as string
		const resolvedTopicId = (rawMessage?.topic_id as string) || topicId
		if (!sequence || !rawMessage || !appMessageId || !resolvedTopicId) return

		const messageNode = getRawMessageNode(rawMessage)
		const nextMessage = transformRawMessage(sequence)
		const messageList = this.messages.get(resolvedTopicId) || []
		const messageIndex = messageList.findIndex((item) => item.app_message_id === appMessageId)

		runInAction(() => {
			const nextMessages = messageList.slice()
			if (messageIndex > -1) {
				nextMessages[messageIndex] = merge({}, nextMessages[messageIndex], nextMessage)
			} else {
				nextMessages.push(nextMessage)
			}
			this.messages.set(
				resolvedTopicId,
				unionBy(sortMessages(nextMessages), "app_message_id"),
			)
			this.messageMap.set(
				appMessageId,
				merge({}, this.messageMap.get(appMessageId), messageNode),
			)
		})
	}

	// ======================================
	// 方法 2：收到最终 message → 切换续流模式
	// ======================================
	enqueueMessage(topicId: string, baseMessage: RawSuperMagicMessageEnvelope) {
		const message = baseMessage?.seq as RawSuperMagicMessageSequence
		const msgCache = this.messages.get(topicId) || []

		const nextMessage = transformRawMessage(message)

		const msgIdSet = new Set(msgCache.map((o) => o?.app_message_id))

		const messageNode = getRawMessageNode(message?.message)

		const appMessageId = message?.message?.app_message_id as string

		const correlationId = messageNode?.correlation_id as string

		const buffer = this.getTopicBuffer(topicId)

		// 针对客户端的工具调用消息直接过滤
		if (nextMessage?.type === "user_tool_call") {
			return
		}

		const hasMessage = msgIdSet.has(appMessageId)
		const hasCorrelationIdMessage = msgIdSet.has(correlationId) && messageNode?.role !== "tool"
		const hasBufferMessage = buffer.messages.some(
			(o) => o?.seq?.message?.app_message_id === appMessageId,
		)
		if (hasMessage || hasCorrelationIdMessage || hasBufferMessage) {
			if (hasCorrelationIdMessage && correlationId) {
				// 真消息到达时，把非流式字段（status / task_id / event /
				// attachments / usage 等元信息）同步到 chunk 阶段创建的 mock 节点与卡片，
				// content / reasoning_content / tool_calls 仍走流式 catch-up，
				// 避免一次性刷新打断打字机渲染。
				// ⚠️ 必须放在 `if (streamState)` 之外：当 chunks 自带 finish_reason
				// 且 catch-up 已完成时，completeStreamRendering 会提前把 streamState
				// 从 topicMeta.content 中删掉；此时 IM 层真消息才到达，mock 节点/卡片
				// 仍然存在，元信息同步必须继续执行，否则 task_id / status / event 等
				// 非流式字段将永远停留在 getDefaultNode / getDefaultMessage 的默认值。
				this.syncFinalNodeMetadata(correlationId, messageNode)
				this.syncFinalCardMetadata(topicId, correlationId, nextMessage)

				const streamState = this.getStreamState(topicId, correlationId)
				if (streamState) {
					streamState.isFinalMessageReceived = true
					if (messageNode?.content) streamState.content = messageNode.content as string
					if (messageNode?.reasoning_content)
						streamState.reasoning_content = messageNode.reasoning_content as string

					const finalToolCalls =
						Array.isArray(messageNode?.tool_calls) && messageNode.tool_calls.length > 0
							? (messageNode.tool_calls as ToolCall[])
							: []
					streamState.tool_calls = finalToolCalls

					const cache = this.messageMap.get(correlationId) as
						| RawSuperMagicMessageNode
						| undefined
					if (cache && finalToolCalls.length === 0) {
						cache.tool_calls = []
						this.messageMap.set(correlationId, cache)
					}

					this.startStreamRendering(topicId, correlationId)
				} else {
					this.syncToolCallsToolField(correlationId, messageNode)
				}
				persistMessageToStorage(topicId, message, true)
			}
			return
		}

		persistMessageToStorage(topicId, message, true)

		if (nextMessage?.type === "rich_text") {
			const topicId = nextMessage?.topic_id || ""
			const messages = this.messages.get(topicId) || []
			runInAction(() => {
				this.messageMap.set(appMessageId, messageNode)
				this.messages.set(topicId, [...messages, nextMessage])
			})
			return
		}

		if (nextMessage?.type === "super_magic_message") {
			const buffer = this.getTopicBuffer(topicId)
			const bufferIndex = buffer?.messages.findIndex(
				(o) =>
					o?.seq?.message?.app_message_id === baseMessage?.seq?.message?.app_message_id,
			)
			if (bufferIndex < 0) {
				buffer?.messages.push(baseMessage)
				console.log(
					"%c 【DEBUG】 插入队列",
					"background-color: red;color: white;padding:0 4px",
					JSON.parse(JSON.stringify(buffer)),
					JSON.parse(JSON.stringify(baseMessage)),
				)
			}
			this.processMessageBuffer(topicId)
		}
	}

	/** 注册指定话题的新消息到达监听，仅响应增量 arrived 事件。 */
	registerTopicMessageListener(params: RegisterTopicMessageListenerParams) {
		return this.topicMessageListenerRegistry.register(params)
	}

	/**
	 * 流式已完成（streamState 已删除）后真消息才到达时，
	 * 将真消息 tool_calls 各项上的 tool 字段同步到 messageMap 缓存。
	 */
	private syncToolCallsToolField(
		correlationId: string,
		finalNode: RawSuperMagicMessageNode | undefined,
	) {
		if (!correlationId || !finalNode) return
		const finalToolCalls = Array.isArray(finalNode.tool_calls)
			? (finalNode.tool_calls as ToolCall[])
			: []
		if (finalToolCalls.length === 0) return

		const cache = this.messageMap.get(correlationId) as RawSuperMagicMessageNode | undefined
		if (!cache || !Array.isArray(cache.tool_calls)) return

		const cacheToolCalls = cache.tool_calls as ToolCall[]
		let mutated = false
		finalToolCalls.forEach((ft, i) => {
			if (ft.tool && cacheToolCalls[i]) {
				cacheToolCalls[i].tool = ft.tool
				mutated = true
			}
		})
		if (mutated) {
			this.messageMap.set(correlationId, cache)
		}
	}

	/**
	 * 将真消息节点中的非流式元信息合并到 chunk 阶段创建的 mock 节点。
	 * 跳过 content / reasoning_content / tool_calls（由 startStreamRendering
	 * 渐进 catch-up），也跳过 correlation_id（mock 已经按它建表）。
	 */
	private syncFinalNodeMetadata(
		correlationId: string,
		finalNode: RawSuperMagicMessageNode | undefined,
	) {
		if (!correlationId || !finalNode) return
		const cache = this.messageMap.get(correlationId) as RawSuperMagicMessageNode | undefined
		if (!cache) return

		const streamControlledKeys = new Set([
			"content",
			"reasoning_content",
			"tool_calls",
			"correlation_id",
		])

		let mutated = false
		Object.entries(finalNode as Record<string, unknown>).forEach(([key, value]) => {
			if (streamControlledKeys.has(key)) return
			if (value === undefined) return
			if ((cache as Record<string, unknown>)[key] === value) return
			;(cache as Record<string, unknown>)[key] = value
			mutated = true
		})

		if (mutated) {
			this.messageMap.set(correlationId, cache)
		}
	}

	/**
	 * 将真消息卡片中的身份 / 状态字段合并到 mock 卡片。保留 mock 卡片的
	 * app_message_id（== correlationId），避免替换主键导致 React key 抖动
	 * 或下游订阅错位。
	 */
	private syncFinalCardMetadata(
		topicId: string,
		correlationId: string,
		finalCard: MessageItem | undefined,
	) {
		if (!topicId || !correlationId || !finalCard) return
		const messages = this.messages.get(topicId)
		if (!messages?.length) return

		const cardIndex = messages.findIndex((item) => item.app_message_id === correlationId)
		if (cardIndex < 0) return

		const existingCard = messages[cardIndex]
		const patchableKeys: Array<string> = [
			"magic_message_id",
			"conversation_id",
			"sender_id",
			"send_time",
			"seq_id",
			"status",
			"event",
			"refer_message_id",
			"parent_correlation_id",
			"topic_id",
			"type",
		]

		let mutated = false
		const merged: MessageItem = { ...existingCard }
		patchableKeys.forEach((key) => {
			const next = (finalCard as Record<string, unknown>)[key]
			if (next === undefined || next === null || next === "") return
			if ((merged as Record<string, unknown>)[key] === next) return
			;(merged as Record<string, unknown>)[key] = next
			mutated = true
		})

		if (!mutated) return
		const nextMessages = messages.slice()
		nextMessages[cardIndex] = merged
		this.messages.set(topicId, nextMessages)
	}

	private processMessageBuffer(topicId: string) {
		const buffer = this.getTopicBuffer(topicId)
		if (buffer.messages.length > 0 && !buffer.isProcessing) {
			buffer.isProcessing = true
			const nextMessage = buffer.messages.shift()

			const messageNode = getRawMessageNode(nextMessage?.seq?.message)

			const message = transformRawMessage(nextMessage?.seq as RawSuperMagicMessageSequence)

			if (messageNode?.role === "tool") {
				if (messageNode?.status === "suspended") {
					this.handleTopicSuspended(topicId)
				}

				const topicMeta = this.getTopicMetadata(topicId)
				if (topicMeta.timer) {
					console.log(
						"%c 【DEBUG】 消费队列 - 工具（等待流式完成，toolResponseMap 已更新）",
						"background-color: orange;color: white;padding:0 4px",
						JSON.parse(JSON.stringify(buffer)),
					)
					buffer.messages.unshift(nextMessage!)
					buffer.isProcessing = false
					return
				}
				const toolResponseMap = this.toolResponseMap.get(topicId) || new Map()
				if (messageNode?.tool?.id) {
					toolResponseMap.set(messageNode?.tool?.id || "", {
						...messageNode?.tool,
					})
				}
				this.toolResponseMap.set(topicId, toolResponseMap)

				console.log(
					"%c 【DEBUG】 消费队列 - 工具",
					"background-color: pink;color: white;padding:0 4px",
					JSON.parse(JSON.stringify(buffer)),
				)
				const messages = this.messages.get(topicId) || []
				messages.push(message)
				this.messages.set(topicId, unionBy(sortMessages(messages), "app_message_id"))
				this.messageMap.set(message?.app_message_id, messageNode)

				this.emitTopicMessageArrived({
					topicId,
					message,
					messageNode,
					stage: "arrived",
				})
				this.emitDomainEvents({
					topicId,
					message,
					messageNode,
					stage: "arrived",
				})

				buffer.isProcessing = false
				this.processMessageBuffer(topicId)
			} else {
				const streamState = this.getTopicStreamState(
					topicId,
					messageNode?.correlation_id as string,
				)
				streamState.isFinalMessageReceived = true
				const topicMeta = this.getTopicMetadata(topicId)
				if (topicMeta.timer) {
					console.log(
						"%c 【DEBUG】 消费队列 - 流式（等待流式完成）",
						"background-color: orange;color: white;padding:0 4px",
						JSON.parse(JSON.stringify(buffer)),
					)
					buffer.messages.unshift(nextMessage!)
					buffer.isProcessing = false
					return
				}

				console.log(
					"%c 【DEBUG】 消费队列 - 流式",
					"background-color: pink;color: white;padding:0 4px",
					JSON.parse(JSON.stringify(nextMessage)),
				)
				streamState.content = messageNode?.content || ""
				streamState.reasoning_content = (messageNode?.reasoning_content as string) || ""
				streamState.tool_calls = (messageNode?.tool_calls as ToolCall[]) || []
				this.startStreamRendering(topicId, messageNode?.correlation_id as string)

				// 首次真消息（无 chunk 前置）场景：startStreamRendering 只会用
				// getDefaultNode / getDefaultMessage 创建空壳 mock，真消息里的
				// status / task_id / event / attachments / usage 等非流式字段不会被自动写入。
				// 这里与路径 A 保持一致，补一次元信息同步，避免下游读到默认占位值。
				const correlationId = messageNode?.correlation_id as string
				if (correlationId) {
					this.syncFinalNodeMetadata(
						correlationId,
						messageNode as RawSuperMagicMessageNode,
					)
					this.syncFinalCardMetadata(topicId, correlationId, message)
				}
			}
		}
	}

	private startStreamRendering(topicId: string, correlationId: string) {
		const topicMeta = this.getTopicMetadata(topicId)
		if (topicMeta?.timer) {
			return
		}

		const streamState = this.getTopicStreamState(topicId, correlationId)
		let cache = this.messageMap.get(correlationId || "") as RawSuperMagicMessageNode

		if (!cache) {
			this.messageMap.set(correlationId || "", this.getDefaultNode(correlationId || ""))
			cache = this.messageMap.get(correlationId || "") as RawSuperMagicMessageNode

			const messages = this.messages.get(topicId) || []
			const lastMessage = messages[messages.length - 1]
			const seqId = lastMessage ? addOneToBigNumberString(lastMessage.seq_id) : "1"

			const card = this.getDefaultMessage({
				topic_id: topicId,
				correlation_id: correlationId,
				app_message_id: correlationId,
				seq_id: seqId,
			}) as any

			this.messages.set(topicId, unionBy(sortMessages([...messages, card]), "app_message_id"))
		}

		if (topicId !== this.activeTopicId) {
			if (streamState.isFinalMessageReceived) {
				this.flushStreamToCompletion(topicId, correlationId)
			}
			return
		}

		const progressed = this.resumeFromCurrentStateV2(topicId, correlationId)

		if (streamState.isFinalMessageReceived && streamState.stage === "done") {
			const isStreamContentSame = streamState.content === cache?.content
			const isStreamReasoningContentSame =
				streamState.reasoning_content === cache?.reasoning_content
			const isStreamToolCallsSame = isToolCallsEqual(
				streamState.tool_calls,
				(cache?.tool_calls as ToolCall[]) || [],
			)
			if (isStreamContentSame && isStreamReasoningContentSame && isStreamToolCallsSame) {
				console.log(
					"%c 【DEBUG】 流式终止 V1",
					"background-color: black;color: white;padding:0 4px",
				)
				this.completeStreamRendering(topicId, correlationId)
				return
			}
		}
		if (!progressed && !streamState.isFinalMessageReceived) {
			// 流式无新数据且未收到最终消息 → 定时器停止
			// 但 buffer 中可能有等待处理的消息（如 suspended），需要排空
			const buffer = this.getTopicBuffer(topicId)
			if (buffer.messages.length > 0) {
				this.processMessageBuffer(topicId)
			}
			return
		}

		topicMeta.timer = setTimeout(() => {
			runInAction(() => {
				topicMeta.timer = null
				this.startStreamRendering(topicId, correlationId)
			})
		}, 16)
	}

	/**
	 * 不可见话题收到 final 后：保存视觉快照，一次性写入 messageMap，
	 * 然后 completeStreamRendering 以正常排空 buffer / 触发事件。
	 */
	private flushStreamToCompletion(topicId: string, correlationId: string) {
		const streamState = this.getTopicStreamState(topicId, correlationId)
		const cache = this.messageMap.get(correlationId) as RawSuperMagicMessageNode
		if (!cache || !streamState) return

		const topicMeta = this.getTopicMetadata(topicId)
		topicMeta.streamSnapshots.set(correlationId, {
			reasoning_content: streamState.reasoning_content || "",
			content: (streamState.content as string) || "",
			tool_calls: Array.isArray(cache.tool_calls)
				? ([...(cache.tool_calls as ToolCall[])] as ToolCall[])
				: [],
		})

		cache.reasoning_content = streamState.reasoning_content
		cache.content = streamState.content
		cache.tool_calls = streamState.tool_calls
		this.messageMap.set(correlationId, cache)

		this.completeStreamRendering(topicId, correlationId)
	}

	private completeStreamRendering(topicId: string, correlationId?: string) {
		const meta = this.getTopicMetadata(topicId)
		meta.isStreamLoading = false
		if (meta.timer) {
			clearTimeout(meta.timer)
			meta.timer = null
		}
		if (correlationId && meta.content?.has(correlationId)) {
			meta.content.delete(correlationId)
		}
		this.topicMeta.set(topicId, meta)

		if (correlationId) {
			const messages = this.messages.get(topicId) || []
			const targetMessage = messages.find(
				(m) => m.correlation_id === correlationId || m.app_message_id === correlationId,
			)
			if (targetMessage) {
				const payload = {
					topicId,
					message: targetMessage,
					messageNode:
						this.getMessageNode(targetMessage.app_message_id) ||
						this.getMessageNode(correlationId),
					stage: "arrived" as const,
				} satisfies TopicMessageListenerPayload
				this.emitTopicMessageArrived(payload)
				this.emitDomainEvents(payload)
			}
		}

		const buffer = this.getTopicBuffer(topicId)
		buffer.isProcessing = false
		this.processMessageBuffer(topicId)

		if (meta.content?.size && !meta.timer) {
			const nextCorrelationId = meta.content.keys().next().value
			if (nextCorrelationId) {
				this.startStreamRendering(topicId, nextCorrelationId)
			}
		}
	}

	private handleTopicSuspended(topicId: string) {
		const topicMeta = this.topicMeta.get(topicId)
		if (!topicMeta?.content) return

		const toolResponseMap = this.toolResponseMap.get(topicId) || new Map()

		topicMeta.content.forEach((streamState, correlationId) => {
			if (streamState.isFinalMessageReceived) return

			const validToolCalls = streamState.tool_calls.filter(isToolCallArgumentsComplete)

			streamState.tool_calls = validToolCalls
			streamState.isFinalMessageReceived = true

			const cache = this.messageMap.get(correlationId) as RawSuperMagicMessageNode | undefined
			if (cache) {
				;(cache as any).tool_calls = validToolCalls.length > 0 ? validToolCalls : []
				this.messageMap.set(correlationId, cache)
			}

			validToolCalls.forEach((tc) => {
				if (tc.id && !toolResponseMap.has(tc.id)) {
					toolResponseMap.set(tc.id, {
						...tc.tool,
						id: tc.id,
						name: tc.tool?.name || tc.function?.name || "",
						status: "suspended",
						remark: "任务已中断",
					} satisfies ToolResponseState)
				}
			})

			this.completeStreamRendering(topicId, correlationId)
		})

		this.fillInterruptedToolResponses(topicId, toolResponseMap)
		this.toolResponseMap.set(topicId, toolResponseMap)
	}

	/**
	 * 从消息列表末尾向前回溯，为所有缺少 toolResponse 的 tool_call 补填中断状态。
	 * 遇到所有 tool_calls 都已有 response 的 assistant 消息时停止回溯。
	 */
	private fillInterruptedToolResponses(
		topicId: string,
		toolResponseMap: Map<string, ToolResponseState>,
	) {
		const messages = this.messages.get(topicId) || []
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i]
			if (msg.role !== "assistant") continue

			const node = this.messageMap.get(msg.app_message_id) as
				| RawSuperMagicMessageNode
				| undefined
			const toolCalls = (node?.tool_calls as ToolCall[]) || []
			if (toolCalls.length === 0) continue

			let hasUnresolved = false
			toolCalls.forEach((tc) => {
				if (tc.id && !toolResponseMap.has(tc.id)) {
					hasUnresolved = true
					toolResponseMap.set(tc.id, {
						...tc.tool,
						id: tc.id,
						name: tc.tool?.name || tc.function?.name || "",
						status: "suspended",
						remark: "任务已中断",
					} satisfies ToolResponseState)
				}
			})

			if (!hasUnresolved) break
		}
	}

	private resumeFromCurrentStateV2(topicId: string, appMessageId: string): boolean {
		const streamState = this.getTopicStreamState(topicId, appMessageId)
		const messageMap = this.messageMap.get(appMessageId) || this.getDefaultNode(appMessageId)

		const finalContent = streamState.content || ""
		const finalReasoningContent = streamState.reasoning_content || ""
		const finalTools = streamState.tool_calls || []

		// --------------------------
		// 1. 续流思考（直接补全）
		// --------------------------
		if (!messageMap?.reasoning_content) {
			messageMap.reasoning_content = ""
		}
		if (finalReasoningContent && finalReasoningContent !== messageMap?.reasoning_content) {
			if (
				messageMap.reasoning_content &&
				!finalReasoningContent.startsWith(messageMap.reasoning_content)
			) {
				messageMap.reasoning_content = finalReasoningContent
			}
			if (finalReasoningContent.length > messageMap?.reasoning_content?.length) {
				streamState.stage = "reasoning_content"
			}
			const currentReasoningContent = messageMap?.reasoning_content
			const remainingReasoningContent = finalReasoningContent.slice(
				currentReasoningContent.length,
			)
			console.log("【LS】 reasoning_content", streamState.stage)
			const rcStep = adjustSliceEnd(
				remainingReasoningContent,
				getCharsPerTick(remainingReasoningContent.length),
			)
			messageMap.reasoning_content += remainingReasoningContent.slice(0, rcStep)
			this.messageMap.set(appMessageId, messageMap)
			return true
		}

		// --------------------------
		// 2. 续流正文（从当前截断位置续流）
		// --------------------------
		if (!messageMap?.content) {
			messageMap.content = ""
		}
		if (finalContent && finalContent !== messageMap?.content) {
			if (messageMap.content && !finalContent.startsWith(messageMap.content)) {
				messageMap.content = finalContent
			}
			if (finalContent.length > messageMap?.content?.length) {
				streamState.stage = "content"
			}
			const currentContent = messageMap?.content
			const remainingContent = finalContent.slice(currentContent.length)
			console.log("【LS】 content", streamState.stage)
			const cStep = adjustSliceEnd(remainingContent, getCharsPerTick(remainingContent.length))
			messageMap.content += remainingContent.slice(0, cStep)
			this.messageMap.set(appMessageId, messageMap)
			return true
		}

		// --------------------------
		// 3. 续流工具（基于 topicMeta.tool_calls 续流到 messageMap）
		// --------------------------
		if (!Array.isArray(messageMap.tool_calls)) messageMap.tool_calls = []
		if (!isToolCallsEqual(messageMap.tool_calls, finalTools)) {
			if (
				!isToolCallsMatch(
					messageMap.tool_calls,
					finalTools.slice(0, messageMap.tool_calls.length),
				)
			) {
				messageMap.tool_calls = finalTools
			}
			streamState.stage = "tool"

			console.log("【LS】 tool_calls", streamState.stage)
			const toolStepResult = this.streamToolCallsBySingleUnit(
				messageMap,
				streamState,
				finalTools,
			)
			this.messageMap.set(appMessageId, messageMap)
			if (!toolStepResult.progressed && toolStepResult.done) return false
			return true
		}

		if (streamState.isFinalMessageReceived) {
			if (finalTools.length > 0 && Array.isArray(messageMap.tool_calls)) {
				let toolSynced = false
				finalTools.forEach((ft, i) => {
					if (
						ft.tool &&
						messageMap.tool_calls?.[i] &&
						messageMap.tool_calls[i].tool !== ft.tool
					) {
						messageMap.tool_calls[i].tool = ft.tool
						toolSynced = true
					}
				})
				if (toolSynced) this.messageMap.set(appMessageId, messageMap)
			}
			streamState.stage = "done"
		}
		console.log("【LS】 done", streamState.stage)
		return false
	}

	private streamToolCallsBySingleUnit(
		messageMap: ToolStreamMessageState,
		streamState: StreamState,
		finalTools: ToolCall[],
	): ToolStreamStepResult {
		if (!Array.isArray(finalTools) || finalTools.length === 0) {
			streamState.currentToolIndex = 0
			return { progressed: false, done: true }
		}

		let startIndex = Math.max(streamState.currentToolIndex || 0, 0)

		for (let j = 0; j < Math.min(startIndex, finalTools.length); j++) {
			const cur = get(messageMap, ["tool_calls", j, "function", "arguments"], "")
			const fin = finalTools[j]?.function?.arguments || ""
			if (cur.length < fin.length) {
				startIndex = j
				break
			}
		}

		for (let i = startIndex; i < finalTools.length; i++) {
			const finalTool = finalTools[i]
			const toolId = finalTool?.id || String(i)
			const toolType = finalTool?.type || "function"
			const toolName = finalTool?.function?.name || ""
			const toolLabel = finalTool?.function?.label || ""
			const finalArgs = finalTool?.function?.arguments || ""
			const finalToolResponse = finalTool?.tool
			const currentArgs = get(messageMap, ["tool_calls", i, "function", "arguments"], "")

			if (!messageMap.tool_calls[i]) {
				messageMap.tool_calls[i] = {
					id: toolId,
					type: toolType,
					index: i,
					function: {
						name: toolName,
						label: toolLabel,
						arguments: "",
					},
					...(finalToolResponse ? { tool: finalToolResponse } : {}),
				}
			}

			set(messageMap, ["tool_calls", i, "id"], toolId)
			set(messageMap, ["tool_calls", i, "type"], toolType)
			set(messageMap, ["tool_calls", i, "index"], i)
			set(messageMap, ["tool_calls", i, "function", "name"], toolName)
			set(messageMap, ["tool_calls", i, "function", "label"], toolLabel)
			if (finalToolResponse) {
				set(messageMap, ["tool_calls", i, "tool"], finalToolResponse)
			}

			if (currentArgs.length < finalArgs.length) {
				const remaining = finalArgs.length - currentArgs.length
				const step = getCharsPerTick(remaining)
				const safeEnd = adjustSliceEnd(finalArgs, currentArgs.length + step)
				const nextChunk = finalArgs.slice(currentArgs.length, safeEnd)
				set(messageMap, ["tool_calls", i, "function", "arguments"], currentArgs + nextChunk)
				streamState.currentToolIndex = i
				messageMap.tool_calls = messageMap.tool_calls.slice(0, i + 1)
				return { progressed: true, done: false }
			}

			streamState.currentToolIndex = i + 1
			messageMap.tool_calls = messageMap.tool_calls.slice(0, i + 1)
			return {
				progressed: true,
				done: streamState.currentToolIndex >= finalTools.length,
			}
		}

		streamState.currentToolIndex = finalTools.length
		return { progressed: false, done: true }
	}

	/**
	 * 切回话题时：将不可见期间已完成的流式快照回退到视觉位置，
	 * 重建 StreamState 并启动打字机追平动画（场景 2）。
	 */
	private replayPendingSnapshots(topicId: string) {
		const topicMeta = this.topicMeta.get(topicId)
		if (!topicMeta?.streamSnapshots?.size) return

		const entries = Array.from(topicMeta.streamSnapshots.entries())
		topicMeta.streamSnapshots.clear()

		for (const [correlationId, snapshot] of entries) {
			const cache = this.messageMap.get(correlationId) as RawSuperMagicMessageNode
			if (!cache) continue

			const fullReasoningContent = (cache.reasoning_content as string) || ""
			const fullContent = (cache.content as string) || ""
			const fullToolCalls = Array.isArray(cache.tool_calls)
				? ([...(cache.tool_calls as ToolCall[])] as ToolCall[])
				: []

			cache.reasoning_content = snapshot.reasoning_content
			cache.content = snapshot.content
			cache.tool_calls = snapshot.tool_calls
			this.messageMap.set(correlationId, cache)

			const replayState = createStreamState()
			replayState.reasoning_content = fullReasoningContent
			replayState.content = fullContent
			replayState.tool_calls = fullToolCalls
			replayState.isFinalMessageReceived = true
			topicMeta.content.set(correlationId, replayState)
		}

		const firstCorrelationId = entries[0]?.[0]
		if (firstCorrelationId) {
			this.startStreamRendering(topicId, firstCorrelationId)
		}
	}

	/**
	 * 切回话题时：恢复仍在进行中（chunk 尚未结束）的流式渲染定时器。
	 */
	private resumeActiveStreams(topicId: string) {
		const topicMeta = this.topicMeta.get(topicId)
		if (!topicMeta?.content?.size || topicMeta.timer) return

		const firstCorrelationId = topicMeta.content.keys().next().value
		if (firstCorrelationId) {
			this.startStreamRendering(topicId, firstCorrelationId)
		}
	}

	isTopicStreaming(topicId: string): boolean {
		return (this.topicMeta.get(topicId)?.content?.size ?? 0) > 0
	}

	/**
	 * @description 获取消息节点
	 * @param appMessageId 消息id
	 * @returns 消息节点
	 */
	getMessageNode(appMessageId?: string) {
		return this.messageMap.get(appMessageId || "")
	}

	private getTopicMetadata(topicId: string): TopicMeta {
		if (!this.topicMeta.has(topicId)) {
			this.topicMeta.set(topicId, getDefaultTopicMeta())
		}
		return this.topicMeta.get(topicId)!
	}

	private getTopicStreamState(topicId: string, correlationId: string): StreamState {
		const topicMeta = this.getTopicMetadata(topicId)

		if (!topicMeta.content?.has(correlationId)) {
			topicMeta.content?.set(correlationId, createStreamState())
		}

		const streamState = topicMeta.content?.get(correlationId)
		return streamState as StreamState
	}

	getStreamState(topicId: string, correlationId: string): StreamState | undefined {
		return this.topicMeta.get(topicId)?.content?.get(correlationId)
	}

	private getDefaultNode(correlationId: string): any {
		return {
			attachments: [],
			content: "",
			correlation_id: correlationId,
			name: null,
			reasoning_content: "",
			role: "assistant",
			status: "running",
			tool: null,
			tool_call_id: null,
			tool_calls: null,
			topic_id: "",
			usage: null,
		}
	}

	private getDefaultMessage(node: Record<string, string>) {
		return {
			type: "super_magic_message",
			unread_count: 0,
			sender_id: "sender_id",
			send_time: dayjs().unix(),
			status: "unread",
			event: null,
			parent_correlation_id: "",
			role: "assistant",
			refer_message_id: "",
			...node,
		}
	}

	/**
	 * @description 处理超麦流式消息
	 * @param message 消息
	 */
	handleSuperMagicChunkMessage(message: SuperMagicChunkMessage) {}

	/**
	 * @description 设置测试消息(DEBUG 专用)
	 * @param topicId 话题id
	 */
	setTest(topicId: string) {
		this.messages.set(topicId, [
			{
				magic_message_id: "35ef35e5b262aaf728408aefda28f4d6",
				app_message_id: "ml4spbx3-r3j3lwr6mjh",
				topic_id: topicId,
				type: "rich_text",
				unread_count: 0,
				sender_id: "usi_5f2de55e890e1df920df700e569bc64f",
				send_time: dayjs().unix(),
				status: "read",
				parent_correlation_id: "",
				role: "user",
				seq_id: "876836510905307136",
				refer_message_id: "",
			},
		])
		this.messageMap.set("ml4spbx3-r3j3lwr6mjh", {
			instructs: [
				{
					value: "normal",
					instruction: null,
				},
			],
			extra: {
				super_agent: {
					chat_mode: "normal",
					topic_pattern: "general",
					agent_code: null,
					model: {
						model_id: "gemini-3-pro-preview",
					},
					image_model: {
						model_id: "gemini-2.5-flash-image-preview",
					},
					enable_web_search: true,
					processed_by_api: null,
				},
			},
			content:
				'{"type":"doc","content":[{"type":"paragraph","attrs":{"suggestion":"，最好能生成一个时间轴图表"},"content":[{"type":"text","text":"帮我整理"漫威"宇宙中的英雄与电影，我需要从钢铁侠开始到现在的蜘蛛侠，每年上映的漫威宇宙电影有哪些？，并列出对应的主要英雄角色、电影海报、上映时间等等，行程可视化的html，按照时间线排序。"}]}]}',
		})
	}

	registerDomainEventListener(params: RegisterDomainEventListenerParams) {
		return this.domainEventRegistry.register(params)
	}
}

export const superMagicStore = new SuperMagicStore()
// @ts-ignore
window.base = () => {
	console.log(/** keep-console */ "messages      ", toJS(superMagicStore.messages))
	console.log(/** keep-console */ "toolResponseMap", toJS(superMagicStore.toolResponseMap))
	console.log(/** keep-console */ "messageMap    ", toJS(superMagicStore.messageMap))
	console.log(/** keep-console */ "buffer        ", toJS(superMagicStore.buffer))
	console.log(/** keep-console */ "topicMeta  ", toJS(superMagicStore.topicMeta))
}

// @ts-ignore
window.superMagicStore = superMagicStore

pubsub.subscribe("super_magic_chunk_message", (message: SuperMagicChunkMessage) => {
	superMagicStore.receiveChunk(message)
})
