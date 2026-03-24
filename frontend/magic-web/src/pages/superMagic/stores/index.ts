import { makeAutoObservable, runInAction, toJS } from "mobx"
import pubsub from "@/utils/pubsub"
import { unionBy, omit, cloneDeep } from "lodash-es"
import dayjs from "@/lib/dayjs"
import type { SeqRecord } from "@/apis/modules/chat/types"
import type { ConversationQueryMessage, SuperMagicNode } from "@/types/chat/conversation_message"
import type { RawMessage } from "@/types/chat/intermediate_message"
import type { SeqResponse } from "@/types/request"
import {
	createDomainEventRegistry,
	type CrewDomainEventPayload as InternalCrewDomainEventPayload,
	type RegisterDomainEventListenerParams as InternalRegisterDomainEventListenerParams,
	type TaskDomainEventPayload as InternalTaskDomainEventPayload,
	createTopicMessageListenerRegistry,
	type RegisterTopicMessageListenerParams as InternalTopicMessageListenerParams,
	type TopicMessageListenerPayload as TopicMessageListenerEventPayload,
	resolveCrewDomainEvent,
	resolveTaskDomainEvent,
} from "./listener-registry"
// import { db } from "./storage"

// Export Role Store
export { roleStore } from "./RoleStore"

type SuperMagicStoreTopicId = string
type TopicMessageNode = unknown

export type RegisterTopicMessageListenerParams = InternalTopicMessageListenerParams<
	MessageItem,
	TopicMessageNode
>
export type TopicMessageListenerPayload = TopicMessageListenerEventPayload<
	MessageItem,
	TopicMessageNode
>
export type CrewDomainEventPayload = InternalCrewDomainEventPayload<MessageItem, TopicMessageNode>
export type TaskDomainEventPayload = InternalTaskDomainEventPayload<MessageItem, TopicMessageNode>
export type DomainEventPayload = CrewDomainEventPayload | TaskDomainEventPayload
export type RegisterDomainEventListenerParams =
	InternalRegisterDomainEventListenerParams<DomainEventPayload>

function resolveDomainEvents(payload: TopicMessageListenerPayload): DomainEventPayload[] {
	return [resolveCrewDomainEvent(payload), resolveTaskDomainEvent(payload)].filter(
		(event): event is DomainEventPayload => Boolean(event),
	)
}

export type RawSuperMagicMessageNode = SuperMagicNode
type RawSuperMagicIMMessage = ConversationQueryMessage
type RawSuperMagicMessageSequence = SeqResponse<ConversationQueryMessage>
export type RawSuperMagicMessageEnvelope = SeqRecord<ConversationQueryMessage>

interface SharedMessageItem {
	message_id?: string
	type?: string
	raw_content?: {
		rich_text?: Record<string, unknown>
	}
	[key: string]: unknown
}

function getRawMessageNode(message?: RawSuperMagicIMMessage): RawSuperMagicMessageNode {
	if (!message?.type) return {}

	return ((message as Record<string, unknown>)[message.type] as RawSuperMagicMessageNode) || {}
}

function persistMessageToStorage(
	_topicId: string,
	_value: RawMessage | RawSuperMagicMessageSequence,
) {
	try {
		void _topicId
		void _value
		// const storageName = `MAGIC_STREAM_${_topicId}`
		// const cache = JSON.parse(sessionStorage.getItem(storageName) || "[]")
		// cache.push(_value)
		// db.addToTable(_topicId, _value?.seq_id || `${performance.now()}`, _value)
	} catch (error) {
		console.log(error)
	}
}

function sortMessages<T extends { seq_id: string; status?: string }>(list: Array<T>): Array<T> {
	const result = list.sort((a, b) => {
		return a.seq_id.localeCompare(b.seq_id)
	})

	// 最后一个不是 revoked，过滤全部 revoked
	if (result[result.length - 1]?.status !== "revoked") {
		return result.filter((item) => item.status !== "revoked")
	}

	// 最后一个是 revoked，从末尾向前找连续 revoked 段的起始位置
	let firstOfLastSegment = result.length - 1
	while (firstOfLastSegment > 0 && result[firstOfLastSegment - 1].status === "revoked") {
		firstOfLastSegment--
	}

	// 保留末尾连续 revoked 段，过滤其余所有 revoked
	return result.filter((item, index) => item.status !== "revoked" || index >= firstOfLastSegment)
}

function shouldNotifyMessageUpdate({
	previousMessage,
	nextMessage,
	previousMessageNode,
	nextMessageNode,
}: {
	previousMessage?: MessageItem
	nextMessage: MessageItem
	previousMessageNode?: unknown
	nextMessageNode?: unknown
}) {
	if (!previousMessage) return true
	const previousNode = previousMessageNode as CrewToolMessageNode | undefined
	const nextNode = nextMessageNode as CrewToolMessageNode | undefined

	return (
		previousMessage.seq_id !== nextMessage.seq_id ||
		previousMessage.status !== nextMessage.status ||
		previousMessage.event !== nextMessage.event ||
		previousMessage.role !== nextMessage.role ||
		previousNode?.status !== nextNode?.status ||
		previousNode?.event !== nextNode?.event ||
		previousNode?.tool?.name !== nextNode?.tool?.name ||
		previousNode?.tool?.status !== nextNode?.tool?.status
	)
}

function transformRawMessage(message: RawSuperMagicMessageSequence): MessageItem {
	// IM 消息体
	const imMessage = message?.message || {}
	// 超麦消息体
	const msg = getRawMessageNode(imMessage)
	return {
		// 获取 IM 消息体中除 type 外的其他字段
		...omit(imMessage, [imMessage?.type]),
		// 调试专用
		debug: msg,
		// 同步 IM 消息体
		topic_id: imMessage?.topic_id as string,
		type: imMessage?.type as string,
		app_message_id: imMessage?.app_message_id as string,
		magic_message_id: imMessage?.magic_message_id as string,
		send_time: imMessage?.send_time as number,
		status: imMessage?.status as string,
		// 同步超麦消息体
		event: msg?.event as string,
		parent_correlation_id: msg?.parent_correlation_id || "",
		correlation_id: (msg?.correlation_id || msg?.tool?.id) as string,
		role: (msg?.role || "user") as MessageItem["role"],
		seq_id: message?.seq_id as string,
		refer_message_id: message?.refer_message_id as string,
	} as MessageItem
}

export interface MessageItem {
	app_message_id: string
	/** 消息相关联Id */
	correlation_id: string
	/** 父消息相关联Id */
	parent_correlation_id: string
	debug: RawSuperMagicMessageNode
	/** 事件 */
	event: string
	magic_message_id: string
	/** 引用消息关联id（用于超麦的“从此处创建新话题，复制对话列表”） */
	refer_message_id: string
	/** 消息归属 */
	role: "assistant" | "user"
	/** 发送时间 */
	send_time: number
	/** 唯一id */
	seq_id: string
	/** IM 的消息状态（消息是否已读） */
	status: string
	/** IM 的话题id */
	topic_id: string
	/** 消息类型() */
	type: string

	[key: string]: unknown
}

interface TopicMeta {
	/** 当前是否正在处于流式开启中 */
	isStream: boolean
	/** 当前是否正在流式交互中 */
	isStreamLoading: boolean
	/** 当前话题流式运行时定时器 */
	timer: NodeJS.Timeout | null
	/** 当前流式文本数据映射（Record<当前流式卡片关联id - correlationId，当前流式文本内容>） */
	content: Record<
		string,
		{
			/** 当前流式渲染所在位置（表示文本下标） */
			index: number
			/** 当前文本块完整内容 */
			content: string
			/** 流式处理状态（-1:未开始流式、0开始流式、1正在接受流式内容、2结束流式） */
			status: number
		}
	>
}

const defaultTopicMeta: TopicMeta = {
	timer: null,
	isStream: false,
	isStreamLoading: false,
	content: {},
}

export class SuperMagicStore {
	// 消息
	messages: Map<SuperMagicStoreTopicId, MessageItem[]> = new Map()
	// 消息缓冲区
	buffer: Map<SuperMagicStoreTopicId, MessageItem[]> = new Map()
	// 消息内容（卡片形式）
	messageMap: Map<string, unknown> = new Map()
	/** 话题消息元数据 */
	topicMeta: Map<SuperMagicStoreTopicId, TopicMeta> = new Map()
	/** 话题Id映射( < IM话题Id, 超麦话题Id > ) */
	topicMap: Map<string, string> = new Map()
	private topicMessageListenerRegistry = createTopicMessageListenerRegistry<
		MessageItem,
		TopicMessageNode
	>()
	private domainEventRegistry = createDomainEventRegistry<DomainEventPayload>()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	registerDomainEventListener(params: RegisterDomainEventListenerParams) {
		return this.domainEventRegistry.register(params)
	}

	// messages 为desc排序，确保与 this.messages 中时间排序保持一致（从大到小）
	initializeMessages(topicId: string, messages: RawSuperMagicMessageEnvelope[]) {
		const msgCache = this.messages.get(topicId) || []
		const msgBufferCache = this.buffer.get(topicId) || []
		console.log("API 拉取的消息列表", messages)
		// 针对消息初始化设置中，需要有序保留已处理消息、缓存区消息(针对已处理消息，当且仅当不存在缓存区中的所有消息皆为已处理需写入已处理消息队列)
		const bufferCacheIds = new Set(msgBufferCache.map((o) => o.app_message_id))
		// 针对已处理消息需要更新消息内容
		const msgCacheIds = new Set(msgCache.map((o) => o.app_message_id))
		runInAction(() => {
			messages?.reverse()?.forEach((m) => {
				const msg = m?.seq?.message
				const messageNode = getRawMessageNode(msg)
				const appMessageId = msg?.app_message_id as string
				if (
					!bufferCacheIds.has(appMessageId) &&
					messageNode?.event !== "before_llm_request"
				) {
					const newCard: MessageItem = transformRawMessage(
						m?.seq as RawSuperMagicMessageSequence,
					)
					// 当且存在已处理过的消息时需要更新消息内容，否则直接插入已处理消息
					if (msgCacheIds.has(appMessageId)) {
						const index = msgCache.findIndex((o) => o?.app_message_id === appMessageId)
						if (index > -1) {
							msgCache[index] = newCard
						}
					} else {
						msgCache.push(newCard)
					}
				}

				this.messageMap.set(appMessageId, messageNode)
			})
			this.messages.set(topicId, unionBy(sortMessages(msgCache), "app_message_id"))
		})
	}

	// 加载分享的消息列表
	loadSharedMessages(messages: SharedMessageItem[]) {
		runInAction(() => {
			messages?.forEach((o) => {
				if (o?.type === "rich_text") {
					this.messageMap.set(o?.message_id, {
						...o,
						...(o?.raw_content?.rich_text || {}),
					})
				} else {
					this.messageMap.set(o?.message_id, o)
				}
			})
		})
	}

	// 设置话题的消息列表中的消息卡片
	enqueueMessage(topicId: string, baseMessage: RawSuperMagicMessageEnvelope) {
		const message = baseMessage?.seq as RawSuperMagicMessageSequence
		const nextMessage = transformRawMessage(message)
		// 流式状态下的就先写入缓冲区，非流式状态下直接写入。
		const msgCache = this.messages.get(topicId) || []
		const msgBufferCache = this.buffer.get(topicId) || []

		const msgIdSet = new Set(msgCache.map((o) => o?.app_message_id))
		const msgBufferIdSet = new Set(msgBufferCache.map((o) => o?.app_message_id))

		const messageNode = getRawMessageNode(message?.message)

		/** [Polyfill]: 过滤已处理的app_message_id（兜底 web 中的 MessageService 事件分发导致事件重复问题） */
		const appMessageId = message?.message?.app_message_id as string

		if (
			msgBufferIdSet.has(appMessageId) ||
			/** [Polyfill]: 兼容处理 before_llm_request 无效信息过滤 */
			messageNode?.event === "before_llm_request"
		) {
			return
		}
		if (msgIdSet.has(appMessageId)) {
			// 针对已经过滤的消息，为确保消息状态最新需要更新消息元数据
			const previousMessage = msgCache.find((o) => o?.app_message_id === appMessageId)
			const previousMessageNode = this.getMessageNode(appMessageId)
			runInAction(() => {
				const msg = message?.message
				const messageMapCache = this.messageMap.get(appMessageId) as
					| Record<string, unknown>
					| undefined
				if (messageMapCache) {
					this.messageMap.set(appMessageId, {
						...messageMapCache,
						/** 针对流式文本禁止替换，否则破坏流式设计 */
						...omit(messageNode, ["content"]),
					})
				}

				const msgIndex = msgCache.findLastIndex((o) => o?.seq_id === message?.seq_id)
				if (msgIndex > -1) {
					msgCache[msgIndex] = Object.assign(msgCache[msgIndex], {
						...omit(msg, [msg?.type]),
					})
					this.messages.set(topicId, unionBy(sortMessages(msgCache), "app_message_id"))
				}
			})
			const nextMessageNode = this.getMessageNode(nextMessage.app_message_id)
			if (
				shouldNotifyMessageUpdate({
					previousMessage,
					nextMessage,
					previousMessageNode,
					nextMessageNode,
				})
			) {
				const payload = {
					topicId,
					message: nextMessage,
					messageNode: nextMessageNode,
					stage: "arrived",
				} satisfies TopicMessageListenerPayload
				this.emitTopicMessageArrived(payload)
				this.emitDomainEvents(payload)
			}
			return
		}
		// console.log("setMessage ---------->", topicId, message)
		this.topicMap.set(message?.message?.topic_id as string, messageNode?.topic_id as string)
		persistMessageToStorage(messageNode?.topic_id as string, message)
		// 需要判断当前是否正在流式交互
		runInAction(() => {
			this.messageMap.set(appMessageId, messageNode)
			msgBufferCache.push(nextMessage)

			if (
				["before_agent_reply", "after_agent_reply"].includes(messageNode?.event as string)
			) {
				const topicMeta = this.getTopicMetadata(topicId)
				// 消息关联 id
				const messageCorrelationId = messageNode?.correlation_id as string

				topicMeta.isStream = true
				if (!topicMeta.content[messageCorrelationId]) {
					topicMeta.content[messageCorrelationId] = {
						content: "",
						index: 0,
						status: 0,
					}
				}

				/** 兼容流式（因流式基于 intermediate 类型推送不稳定，所以兜底判断是否已经获取了流式内容，如果存在则开始流失（使用内存中已获取的流式内容进行流式）） */
				// if (msg?.[msg?.type]?.event === "before_agent_reply") {
				// 	if (topicMeta.content[messageCorrelationId]) {
				// 		this.startStreamRendering(topicId, messageCorrelationId)
				// 	}
				// }

				/** 兼容流式（因流式基于 intermediate 类型推送不稳定，所以兜底下根据 after_agent_reply 结束流式） */
				if (messageNode?.event === "after_agent_reply") {
					topicMeta.content[messageCorrelationId] = {
						index: 0,
						status: 2,
						content: (topicMeta.content[messageCorrelationId].content =
							messageNode?.content || ""), // 这里直接设置文本会导致流式内容部分重复，text 前面部分内容已被消费，需要优雅处理
					}
					topicMeta.isStream = false
				}
				this.topicMeta.set(topicId, topicMeta)
			}
			this.buffer.set(
				topicId,
				unionBy(
					msgBufferCache.sort((a, b) => {
						return a.seq_id.localeCompare(b.seq_id)
					}),
					"app_message_id",
				),
			)
		})

		const payload = {
			topicId,
			message: nextMessage,
			messageNode: this.getMessageNode(nextMessage.app_message_id),
			stage: "arrived",
		} satisfies TopicMessageListenerPayload
		this.emitTopicMessageArrived(payload)
		this.emitDomainEvents(payload)
		this.processMessageBuffer(topicId)
	}

	/** 开始消费 buffer 中的消息卡片 */
	private processMessageBuffer(topicId: string) {
		const messagesBuffer = this.buffer.get(topicId) || []
		const messages = this.messages.get(topicId) || []

		if (messagesBuffer.length > 0) {
			const currentMsgBuffer = messagesBuffer[0] // 获取第一个元素
			const currentMsg = messages?.[messages.length - 1] // 获取第一个元素

			/** [Polyfill]：当且仅当缓冲区中消息卡片已在 this.messages 中则跳过当前执行且移除缓冲区中卡片 */
			const messagesIds = new Set(messages.map((o) => o.app_message_id))
			if (messagesIds.has(currentMsgBuffer?.app_message_id)) {
				this.buffer.set(topicId, messagesBuffer.slice(1, messagesBuffer.length))
				this.processMessageBuffer(topicId)
				return
			}

			/**
			 * 这里通过业务层判断，是否能够将当前消息卡片写入 messages 中，以下场景
			 * 1. 涉及流式输出的场景下，需要确保消息卡片在存在多个 correlation_id 一致时，在流式过程中只设置前者，流式输出完成后继续设置后者
			 */
			const streamLock =
				currentMsgBuffer?.event !== "after_agent_reply" &&
				currentMsg?.event !== "before_agent_reply"
			/** [Polyfill]: 兼容 after_agent_reply 没有返回 before_agent_reply 导致消息列表停止执行问题 */
			const isStreamPolyFill =
				currentMsgBuffer?.event === "after_agent_reply" && !currentMsgBuffer?.correlation_id
			/** 兼容终止消息发送 */
			const isMessageTermination = currentMsgBuffer?.event === "agent_suspended"

			if (streamLock || isStreamPolyFill || isMessageTermination) {
				this.executeBufferMessage(topicId)
				/** [Fix] before_agent_reply 被移入 messages 后立即触发流式渲染，避免依赖 timer 重试导致的延迟 */
				if (
					currentMsgBuffer?.event === "before_agent_reply" &&
					currentMsgBuffer?.correlation_id &&
					this.getTopicMetadata(topicId).content[currentMsgBuffer.correlation_id]
				) {
					this.startStreamRendering(topicId, currentMsgBuffer.correlation_id)
				}
				this.processMessageBuffer(topicId)
			}
			/** [Polyfill]: 兼容 before_llm_request 在 before_agent_reply、after_agent_reply 消息对中间问题 */
			const isSkip = currentMsgBuffer?.event === "before_llm_request"
			if (isSkip) {
				runInAction(() => {
					this.buffer.set(topicId, messages.slice(1, messages.length))
				})
			}

			if (currentMsg?.event === "before_agent_reply") {
				// 流式前置卡片、开始流式
				this.startStreamRendering(topicId, currentMsg?.correlation_id)
			}
		}
	}

	// 消费缓冲区中的一条消息卡片
	executeBufferMessage(topicId: string) {
		const messages = this.buffer.get(topicId) || []

		if (messages.length > 0) {
			runInAction(() => {
				const [currentCard, ..._rest] = messages
				const msg = this.messages.get(topicId) || []
				msg.push(currentCard)
				this.messages.set(topicId, unionBy(sortMessages(msg), "app_message_id"))
				this.buffer.set(topicId, _rest)
			})
		}
	}

	getMessageNode(appMessageId?: string) {
		return this.messageMap.get(appMessageId || "")
	}

	private emitDomainEvents(payload: TopicMessageListenerPayload) {
		resolveDomainEvents(payload).forEach((event) => {
			this.domainEventRegistry.emit(event)
		})
	}

	private emitTopicMessageArrived(payload: TopicMessageListenerPayload) {
		this.topicMessageListenerRegistry.emit(payload)
	}

	// 获取指定话题的元数据
	getTopicMetadata(topicId: string): TopicMeta {
		if (!this.topicMeta.has(topicId)) {
			runInAction(() => {
				this.topicMeta.set(topicId, cloneDeep(defaultTopicMeta))
			})
		}
		return this.topicMeta.get(topicId) || cloneDeep(defaultTopicMeta)
	}

	/** 获取指定话题下对应消息节点的流式状态 */
	getStreamMetadata(topicId: string, correlationId: string) {
		const topicMeta = this.getTopicMetadata(topicId)
		if (!topicMeta.content?.[correlationId]) {
			return {
				content: "",
				index: 0,
				status: -1,
			}
		}
		return topicMeta.content?.[correlationId]
	}

	// 通过关联 Id 查找 messageId
	findMessageIdByCorrelation(topicId: string, correlationId: string) {
		let appMessageId: null | string = null
		const msg = this.messages.get(topicId) || []
		for (let i = 0, len = msg.length; i < len; i += 1) {
			if (msg[i]?.correlation_id === correlationId) {
				appMessageId = msg[i]?.app_message_id
			}
		}
		return appMessageId
	}

	/** 流式任务开始 */
	private startStreamRendering(topicId: string, correlationId: string) {
		const topicMeta = this.getTopicMetadata(topicId)
		if (topicMeta?.timer) {
			clearTimeout(topicMeta?.timer)
		}
		const { content, index, status } = this.getStreamMetadata(topicId, correlationId)
		const appMessageId = this.findMessageIdByCorrelation(topicId, correlationId)
		const cache = this.messageMap.get(appMessageId || "") as RawSuperMagicMessageNode

		// 当且仅当存在存在流式缓冲以及对应消息卡片时才触发流式
		if (appMessageId) {
			runInAction(() => {
				/** IMPORTANT: 当且仅当流式状态中文本内容存在待流式处理时才进行流式处理 */
				/**
				 * 旧逻辑只基于 `cache.content.length` 推进流式内容，
				 * 但在流式消息和 HTML 预览增强场景下，`cache.content.length` 与 `index` 可能会短暂不同步，导致内容重复推进、局部回退，
				 * 这里增加 `safeRenderedLength`，先对齐“当前已渲染长度”和“store 推进下标”，再继续推进后续内容，保证流式渲染更稳定。
				 */
				const renderedLength = cache.content?.length || 0
				const safeRenderedLength = Math.min(Math.max(renderedLength, index), content.length)
				if (renderedLength < safeRenderedLength) {
					cache.content = content.slice(0, safeRenderedLength)
				}

				if (safeRenderedLength < content.length) {
					// 缓存区是否存在多个消息节点
					const hasNextCard = (this.buffer.get(topicId) || []).length > 0
					// 每次渲染最大 5 个字符
					topicMeta.content[correlationId].index = Math.min(
						safeRenderedLength + (hasNextCard ? 5 : 1),
						content.length,
					)
					cache.content = content.slice(0, topicMeta.content[correlationId].index)

					if (cache.content?.length > 0) {
						topicMeta.isStreamLoading = true
					}

					this.topicMeta.set(topicId, topicMeta)
					this.messageMap.set(appMessageId, cache)
				}
			})
		}
		/** (流式结束判断): 流式内容为空 */
		const isStreamContentEmpty = content.length === 0
		/** [Polyfill]: (流式结束判断): 流式内容与实际返回结果不一致（agent重试兜底）*/
		const isStreamContentDiff = cache?.content && content.indexOf(cache.content) < 0
		/** (流式结束判断): 流式文本一致 */
		const isStreamContentSame = content && cache?.content === content
		if (status === 2 && (isStreamContentSame || isStreamContentEmpty || isStreamContentDiff)) {
			this.completeStreamRendering(topicId)
			return
		}
		// 流式结束以及文本为0时，则流式可结束
		const isFinishStream =
			!topicMeta?.isStream &&
			(isStreamContentSame || isStreamContentEmpty || isStreamContentDiff)
		// 当流式正在进行、或者当前流式文本内容还未流式完，则继续流式（需要增加流式结束以及文本为0时）
		if (topicMeta?.isStream || content.length > index || !isFinishStream) {
			runInAction(() => {
				const hasNextCard = (this.buffer.get(topicId) || []).length > 0
				// 默认流式频率
				const time = content.length > 30 ? 3 : 6
				// 慢速流式频率
				const slowTime = content.length > 30 ? 5 : 20
				topicMeta.timer = setTimeout(
					() => {
						runInAction(() => {
							const meta = this.getTopicMetadata(topicId)
							if (meta.timer) {
								clearTimeout(meta.timer)
								meta.timer = null
							}
							this.topicMeta.set(topicId, meta)
							this.startStreamRendering(topicId, correlationId)
						})
					},
					hasNextCard ? time : slowTime,
				)
				this.topicMeta.set(topicId, topicMeta)
			})
		} else {
			this.completeStreamRendering(topicId)
		}
	}

	/** 流式任务完成 */
	private completeStreamRendering(topicId: string) {
		const meta = this.getTopicMetadata(topicId)
		meta.isStreamLoading = false
		this.topicMeta.set(topicId, meta)
		// 流式结束，需要流转下一个卡片
		this.executeBufferMessage(topicId)
		this.processMessageBuffer(topicId)
	}

	// 流式数据插入(文本内容)
	handleStreamMessage(message: RawMessage) {
		const topicId = message?.topic_id
		const correlationId = message?.raw?.raw_data?.correlation_id
		const msg = message?.raw?.raw_data

		const text = msg?.content
		const streamStatus = msg?.stream_status || 0 // 0:开始、1:进行中、2:结束
		const topicMeta = this.getTopicMetadata(topicId)
		// 缓冲区中的流式状态（流式文本、流式处理位置）
		const { content } = this.getStreamMetadata(topicId, correlationId)

		const imTopicId = this.topicMap.get(topicId)
		if (imTopicId) {
			persistMessageToStorage(imTopicId, message)
		}

		// /** [Polyfill]: 判断已处理消息中是否存在有效 correlation_id，没有则不处理 */ 兜底移除，默认都在接收对应流式消息卡片时创建 topicMeta.[topicId].content
		// const messages = this.messages.get(topicId) || []
		// const buffer = this.buffer.get(topicId) || []
		// const result = messages.some((o) => o?.correlation_id === correlationId)
		// const buffer2 = buffer.some((o) => o?.correlation_id === correlationId)
		// if (!result && !buffer2) {
		// 	console.log(
		// 		`%c stream message ${topicId} 没有找到对应要处理的消息------>`,
		// 		"background:red;color: #fff;padding: 0 4px",
		// 		correlationId,
		// 		message,
		// 	)
		// 	return
		// }

		// 预处理数据格式
		if (!topicMeta.content[correlationId]) {
			topicMeta.content[correlationId] = {
				content: "",
				index: 0,
				status: -1,
			}
		}
		/** 卡片消息比流式消息快(优先接收到消息卡片数据，流式数据还没接收到) ，默认正常 */
		runInAction(() => {
			// 直接修改对象属性，MobX 会检测到变化
			console.log(
				`%c stream message ${topicId} 1------>`,
				"background:red;color: #fff;padding: 0 4px",
				dayjs().format("HH:mm:ss:SSS"),
				streamStatus,
				correlationId,
				text,
			)
			if (streamStatus === 1) {
				topicMeta.content[correlationId].content = content + text
				topicMeta.content[correlationId].status = 1
				this.topicMeta.set(topicId, topicMeta)
			} else if (streamStatus === 0) {
				// 流式开始，需要阻塞下一张消息卡片的渲染
				topicMeta.isStream = true
				topicMeta.content[correlationId].status = 0
				topicMeta.content[correlationId].content = text
				this.topicMeta.set(topicId, topicMeta)
				this.startStreamRendering(topicId, correlationId)
			} else if (streamStatus === 2) {
				// 流式完成，需要继续渲染下一张消息卡片（如果存在）
				topicMeta.isStream = false
				// topicMeta.isStreamLoading = false
				topicMeta.content[correlationId].status = 2
				topicMeta.content[correlationId].content = text // 这里直接设置文本会导致流式内容部分重复，text 前面部分内容已被消费，需要优雅处理
				this.topicMeta.set(topicId, topicMeta)
			}
		})
	}
}

export const superMagicStore = new SuperMagicStore()
window.base = () => {
	console.log(/** keep-console */ "messages      ", toJS(superMagicStore.messages))
	console.log(/** keep-console */ "messageMap    ", toJS(superMagicStore.messageMap))
	console.log(/** keep-console */ "buffer        ", toJS(superMagicStore.buffer))
	console.log(/** keep-console */ "topicMeta  ", toJS(superMagicStore.topicMeta))
}

declare global {
	interface Window {
		base: () => void
		superMagicStore: SuperMagicStore
	}
}

window.superMagicStore = superMagicStore
pubsub.subscribe("super_magic_stream_message", (message: RawMessage) => {
	superMagicStore.handleStreamMessage(message)
})
