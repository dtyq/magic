/* eslint-disable class-methods-use-this */
import { isAiConversation } from "@/opensource/stores/chatNew/helpers/conversation"
import type { CreateTopicMessage, DeleteTopicMessage, UpdateTopicMessage } from "@/types/chat/topic"
import type { SeqResponse } from "@/types/request"
import { nanoid } from "nanoid"
import Logger from "@/utils/log/Logger"
import type Conversation from "@/opensource/models/chat/conversation"
import Topic from "@/opensource/models/chat/topic"
import topicStore from "@/opensource/stores/chatNew/topic"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { ChatApi } from "@/apis"
import conversationService from "../conversation/ConversationService"
import TopicDBServices from "./TopicDBServices"
import TopicCacheServices from "./TopicCacheServices"
import MessageService from "../message/MessageService"

// 创建专用的日志记录器
const logger = new Logger("ChatTopic", "blue")

class ChatTopicService {
	/**
	 * 魔法ID
	 */
	magicId: string | undefined

	/**
	 * 组织编码
	 */
	organizationCode: string | undefined

	/**
	 * 最后初始化的话题列表的会话ID
	 */
	lastConversationId: string | undefined

	/**
	 * 初始化
	 * @param magicId 账户 ID
	 * @param organizationCode 组织编码
	 */
	init(magicId: string, organizationCode: string) {
		this.magicId = magicId
		this.organizationCode = organizationCode
	}

	/**
	 * 初始化话题列表
	 * @param conversation 会话
	 */
	async initTopicList(conversation: Conversation) {
		// 如果会话ID相同，则不进行初始化
		if (this.lastConversationId === conversation.id) {
			return
		}

		// 缓存当前会话列表
		if (this.lastConversationId) {
			TopicCacheServices.setTopicCache(this.lastConversationId, topicStore.topicList)
		}

		this.lastConversationId = conversation.id

		// 如果缓存中存在话题列表，则优先使用缓存
		if (TopicCacheServices.hasTopicCache(conversation.id)) {
			const cachedTopics = TopicCacheServices.getTopicCache(conversation.id) || []
			topicStore.setTopicList(cachedTopics)

			if (conversation.isAiConversation && !conversation.current_topic_id) {
				conversationService.switchTopic(conversation.id, cachedTopics[0]?.id)
			}
		} else {
			// 从数据库加载话题列表
			await TopicDBServices.loadTopicsFromDB(conversation.id)
				.then((topics = []) => {
					// 如果数据库中有数据，则更新话题列表和缓存
					topicStore.setTopicList(topics)
					TopicCacheServices.setTopicCache(conversation.id, topics)

					if (
						conversation.isAiConversation &&
						!conversation.current_topic_id &&
						topics.length
					) {
						conversationService.switchTopic(conversation.id, topics[0].id)
					}
				})
				.catch((error: any) => {
					logger.log(error)
				})
		}

		await this.fetchTopicList()

		// 如果没有话题，创建一个话题
		logger.log("topicStore.topicList ====> ", topicStore.topicList)
		if (!topicStore.topicList.length) {
			await this.createTopic()
		}
	}

	/**
	 * 应用创建话题消息
	 * @param message 消息
	 */
	applyCreateTopicMessage(message: SeqResponse<CreateTopicMessage>) {
		logger.log(
			`[applyCreateTopicMessage] 开始应用创建话题消息，会话ID: ${message.conversation_id}`,
		)
		try {
			const newTopic = new Topic(message.message.create_topic)
			logger.log(`[applyCreateTopicMessage] 新话题信息:`, newTopic)

			if (conversationStore.currentConversation?.id === message.conversation_id) {
				logger.log(`[applyCreateTopicMessage] 更新当前会话的UI状态`)
				// 更新 UI 状态
				topicStore.unshiftTopic(newTopic)
				logger.log("topicStore.topicList ====> ", topicStore.topicList)
				// 更新数据库
				TopicDBServices.addTopicToDB(newTopic)
			} else if (TopicCacheServices.hasTopicCache(message.conversation_id)) {
				logger.log(`[applyCreateTopicMessage] 更新缓存中的话题列表`)
				const cachedTopics = TopicCacheServices.getTopicCache(message.conversation_id)!
				const newTopics = [newTopic, ...cachedTopics]
				TopicCacheServices.setTopicCache(message.conversation_id, newTopics)

				// 更新数据库
				TopicDBServices.addTopicToDB(newTopic)
			}
			logger.log(`[applyCreateTopicMessage] 应用创建话题消息完成`)
		} catch (err) {
			logger.log("applyCreateTopicMessage error", err)
		}
	}

	/**
	 * 应用更新话题消息
	 * @param message 消息
	 */
	applyUpdateTopicMessage(message: SeqResponse<UpdateTopicMessage>) {
		logger.log(
			`[applyUpdateTopicMessage] 开始应用更新话题消息，会话ID: ${message.conversation_id}`,
		)
		const updatedTopic = message.message.update_topic
		logger.log(`[applyUpdateTopicMessage] 更新话题信息:`, updatedTopic)

		if (conversationStore.currentConversation?.id === message.conversation_id) {
			logger.log(`[applyUpdateTopicMessage] 更新当前会话的UI状态`)
			// 更新 UI 状态
			topicStore.updateTopic(updatedTopic.id, { name: updatedTopic.name })

			// 更新数据库
			TopicDBServices.updateTopic(updatedTopic.id, message.conversation_id, {
				name: updatedTopic.name,
				updated_at: Date.now(),
			})
		} else if (TopicCacheServices.hasTopicCache(message.conversation_id)) {
			logger.log(`[applyUpdateTopicMessage] 更新缓存中的话题信息`)
			TopicCacheServices.updateTopicInCache(message.conversation_id, updatedTopic.id, {
				name: updatedTopic.name,
				updated_at: Date.now(),
			})

			// 更新数据库
			TopicDBServices.updateTopic(updatedTopic.id, message.conversation_id, {
				name: updatedTopic.name,
				updated_at: Date.now(),
			})
		}
		logger.log(`[applyUpdateTopicMessage] 应用更新话题消息完成`)
	}

	/**
	 * 应用删除话题消息
	 * @param message 消息
	 */
	applyDeleteTopicMessage(message: SeqResponse<DeleteTopicMessage>) {
		logger.log(
			`[applyDeleteTopicMessage] 开始应用删除话题消息，会话ID: ${message.conversation_id}`,
		)
		const conversationId = conversationStore.currentConversation?.id
		const deletedTopicId = message.message.delete_topic.id
		logger.log(`[applyDeleteTopicMessage] 要删除的话题ID: ${deletedTopicId}`)

		if (conversationId === message.conversation_id) {
			logger.log(`[applyDeleteTopicMessage] 删除当前会话的话题`)
			// 获取删除前的索引位置
			const index = topicStore.topicList.findIndex((i) => i.id === deletedTopicId)
			const topicsList = [...topicStore.topicList]
			logger.log(
				`[applyDeleteTopicMessage] 当前话题列表长度: ${topicsList.length}, 删除话题索引: ${index}`,
			)

			// 从 UI 状态中删除
			topicStore.removeTopic(deletedTopicId)

			// 如果删除的是当前话题，需要切换话题
			if (
				deletedTopicId ===
				conversationStore.currentConversation?.last_receive_message?.topic_id
			) {
				if (topicsList.length > 1) {
					const target = topicsList[(index + topicsList.length - 1) % topicsList.length]
					logger.log(`[applyDeleteTopicMessage] 切换到新话题: ${target.id}`)
					conversationService.switchTopic(message.conversation_id, target.id)
				} else {
					logger.log(`[applyDeleteTopicMessage] 无其他话题可切换，清空当前话题ID`)
					conversationService.switchTopic(message.conversation_id, undefined)
				}
			}

			// 更新数据库
			TopicDBServices.deleteTopic(deletedTopicId, message.conversation_id)
		} else if (TopicCacheServices.hasTopicCache(message.conversation_id)) {
			logger.log(`[applyDeleteTopicMessage] 从缓存中删除话题`)
			TopicCacheServices.deleteTopicFromCache(message.conversation_id, deletedTopicId)

			// 更新数据库
			TopicDBServices.deleteTopic(deletedTopicId, message.conversation_id)

			// 如果删除的是当前话题，需要切换话题
			if (
				deletedTopicId ===
				conversationStore.currentConversation?.last_receive_message?.topic_id
			) {
				const topicsList = TopicCacheServices.getTopicCache(message.conversation_id) || []
				logger.log(`[applyDeleteTopicMessage] 缓存中的话题列表长度: ${topicsList.length}`)
				if (topicsList.length) {
					const index = topicsList.findIndex((topic) => topic.id === deletedTopicId)
					const target = topicsList[(index + topicsList.length - 1) % topicsList.length]
					logger.log(`[applyDeleteTopicMessage] 切换到新话题: ${target.id}`)
					conversationService.switchTopic(message.conversation_id, target.id)
				} else {
					logger.log(`[applyDeleteTopicMessage] 缓存中无其他话题可切换，清空当前话题ID`)
					conversationService.switchTopic(message.conversation_id, undefined)
				}
			}
		}
		logger.log(`[applyDeleteTopicMessage] 应用删除话题消息完成`)
	}

	/**
	 * 获取话题列表
	 * @returns 话题列表
	 */
	fetchTopicList() {
		const conversationId = this.lastConversationId

		// 设置加载状态
		topicStore.setLoading(true)

		logger.log(`[fetchTopicList] 开始获取话题列表，会话ID=${conversationId}`)

		if (!conversationId) {
			logger.warn("[fetchTopicList] 会话ID不存在，无法获取话题列表")
			topicStore.setLoading(false)
			return Promise.reject()
		}

		if (!isAiConversation(conversationStore.currentConversation?.receive_type)) {
			topicStore.setLoading(false)
			return Promise.resolve([])
		}

		return ChatApi.getTopicList(conversationId)
			.then((res) => {
				// 将 API 返回的话题列表转换为 Topic 实例数组
				const topicsData = res?.reverse() ?? []
				const topics = topicsData.map((topicData) => new Topic(topicData))

				// 更新 UI 状态
				topicStore.setTopicList(topics)

				// 缓存话题列表
				TopicCacheServices.setTopicCache(conversationId, topics)

				// 持久化话题列表到数据库
				TopicDBServices.saveTopicsToDB(conversationId, topics)

				// 如果当前话题ID不存在，或者当前话题ID不在话题列表中，则更新当前话题ID
				const conversation = conversationStore.getConversation(conversationId)
				if (
					conversation.isAiConversation &&
					(!conversation?.current_topic_id ||
						!topics.find((i) => i.id === conversation?.current_topic_id))
				) {
					if (topics.length && conversationStore.currentConversation) {
						logger.log(
							`[fetchTopicList] 当前会话未设置话题ID，设置为第一个话题：${topics[0].id}`,
						)
						conversationService.switchTopic(conversationId, topics[0].id)
					}
				}

				logger.log(`[fetchTopicList] 获取话题列表成功，话题数量=${topics.length}`)
				return topics
			})
			.finally(() => {
				topicStore.setLoading(false)
			})
	}

	/**
	 * 更新话题
	 * @param topicId 话题ID
	 * @param topicName 话题名称
	 * @returns 话题列表
	 */
	updateTopic(topicId: string, topicName: string) {
		const conversationId = conversationStore.currentConversation?.id

		if (!conversationId) {
			logger.error("conversationId 不存在")
			return Promise.reject()
		}

		return ChatApi.updateTopic(conversationId, topicId, topicName).then(() => {
			// 更新 UI 状态
			topicStore.updateTopic(topicId, { name: topicName })

			// 更新数据库
			TopicDBServices.updateTopic(topicId, conversationId, { name: topicName })

			return this.fetchTopicList()
		})
	}

	/**
	 * 获取并设置魔法话题名称
	 * @param topicId 话题ID
	 * @param force 是否强制更新
	 * @returns 魔法话题名称
	 */
	getAndSetMagicTopicName(topicId: string, force = false) {
		const conversationId = conversationStore.currentConversation?.id
		if (!conversationId) {
			return Promise.reject(new Error("conversationId 不存在"))
		}

		const topicName = topicStore.topicList.find((i) => i.id === topicId)?.name

		// 如果话题名称存在，并且不是强制更新，则不自动调用
		if (topicName && !force) {
			return Promise.resolve()
		}

		// 如果当前会话不是 AI 会话，则不调用
		if (!isAiConversation(conversationStore.currentConversation?.receive_type))
			return Promise.resolve()

		return ChatApi.getMagicTopicName(conversationId, topicId)
			.then((res) => {
				return this.updateTopic(topicId, res.name)
			})
			.catch((error: any) => {
				logger.log(error)
			})
	}

	/**
	 * 设置当前会话话题
	 * @param topicId 话题ID
	 */
	setCurrentConversationTopic(topicId: string | undefined) {
		const conversationId = conversationStore.currentConversation?.id
		logger.log(
			`[setCurrentConversationTopic] 开始设置当前话题，会话ID=${conversationId}，话题ID=${
				topicId || "空"
			}`,
		)

		if (!conversationId) {
			logger.warn("[setCurrentConversationTopic] 会话ID不存在，无法设置话题")
			return
		}

		logger.log(`[setCurrentConversationTopic] 更新会话当前话题ID`)
		conversationService.switchTopic(conversationId, topicId)

		// 切换话题后，重新初始化渲染消息列表，并在初始化完成后立即滚动到底部
		logger.log(`[setCurrentConversationTopic] 开始初始化渲染消息列表`)
		MessageService.initMessages(conversationId, topicId ?? "")
	}

	/**
	 * 生成新话题数据
	 * @param conversationId 会话ID
	 * @returns 新话题数据
	 */
	static genNewTopicData(conversationId: string, id: string): Topic {
		const now = Date.now()
		return new Topic({
			id,
			name: "新话题",
			description: "新话题",
			conversation_id: conversationId,
			created_at: now,
			updated_at: now,
		})
	}

	/**
	 * 创建话题
	 * @param topicName 话题名称
	 */
	createTopic(topicName?: string) {
		const conversationId = conversationStore.currentConversation?.id
		logger.log(
			`[createTopic] 开始创建话题，会话ID=${conversationId}，话题名称=${
				topicName || "未命名"
			}`,
		)

		if (!conversationId) {
			logger.warn("[createTopic] 会话ID不存在，无法创建话题")
			return Promise.reject()
		}

		const tempId = nanoid()
		const tempTopic = ChatTopicService.genNewTopicData(conversationId, tempId)

		// 更新 UI 状态
		topicStore.unshiftTopic(tempTopic)

		// 更新缓存
		TopicCacheServices.addTopicToCache(conversationId, tempTopic)

		return ChatApi.createTopic(topicName, conversationId).then((res) => {
			if (res.data.seq.message.create_topic) {
				const newTopicId = res.data.seq.message.create_topic.id
				logger.log(`[createTopic] 话题创建成功，新话题ID=${newTopicId}`)

				// 先清空消息渲染列表
				logger.log(`[createTopic] 清空消息渲染列表`)
				// this.chatBusiness.messageRenderBusiness.clearRenderMessages()

				// 更新当前话题ID
				logger.log(`[createTopic] 更新会话当前话题ID`)
				conversationService.switchTopic(conversationId, newTopicId)

				// 更新话题列表
				logger.log(`[createTopic] 更新话题列表`)
				const newTopic = new Topic(res.data.seq.message.create_topic)

				// 替换临时话题
				topicStore.replaceTopic(tempId, newTopic)

				// 更新数据库
				TopicDBServices.addTopicToDB(newTopic)

				// 重新初始化消息列表
				logger.log(`[createTopic] 开始初始化渲染消息列表`)
				// this.chatBusiness.messageRenderBusiness.initRenderMessages(10, () => {
				// 	// 初始化完成后立即滚动到底部，使用非平滑滚动以提高速度
				// 	logger.log(`[createTopic] 初始化完成，触发滚动到底部事件`)
				// 	const scrollEvent = new CustomEvent("conversation-scroll-to-bottom", {
				// 		detail: { smooth: false },
				// 	})
				// 	document.dispatchEvent(scrollEvent)
				// })

				return this.fetchTopicList()
			}
			return this.fetchTopicList()
		})
	}

	/**
	 * 删除话题
	 * @param deleteTopicId 删除的话题ID
	 */
	async removeTopic(deleteTopicId: string) {
		const conversationId = conversationStore.currentConversation?.id

		if (!conversationId) {
			logger.error("conversationId 不存在")
			return
		}

		const promise = ChatApi.deleteTopic(conversationId, deleteTopicId)

		const deleteId = deleteTopicId

		if (!deleteId) return

		// 如果最后一条消息是当前话题，则清空最后一条消息
		if (conversationStore.currentConversation?.last_receive_message?.topic_id === deleteId) {
			conversationService.clearLastReceiveMessage(conversationId)
		}

		// 获取删除前的索引位置和话题列表副本
		const index = topicStore.topicList.findIndex((i) => i.id === deleteTopicId)
		const nextTopicId = topicStore.topicList[(index + 1) % topicStore.topicList.length]?.id

		if (conversationStore.currentConversation?.current_topic_id === deleteTopicId) {
			// 有下一个话题，则切换到下一个话题
			if (nextTopicId && nextTopicId !== deleteTopicId) {
				conversationService.switchTopic(conversationId, nextTopicId)
			} else {
				// 没有下一个话题，则清空当前话题ID
				conversationService.clearCurrentTopic(conversationId)
			}
		}

		// 从 UI 状态中删除
		topicStore.removeTopic(deleteTopicId)

		// 更新数据库
		TopicDBServices.deleteTopic(deleteTopicId, conversationId)

		// 删除话题消息
		MessageService.removeTopicMessages(conversationId, deleteTopicId)

		// 删除话题后，重新获取话题列表
		promise.finally(() => {
			this.fetchTopicList()
		})
	}
}

export default new ChatTopicService()
