/* eslint-disable class-methods-use-this */
import { ConversationGroupKey } from "@/const/chat"
import Conversation from "@/opensource/models/chat/conversation"
import { isAiConversation } from "@/opensource/stores/chatNew/helpers/conversation"
import type { ControlEventMessageType } from "@/types/chat/control_message"
import { MessageReceiveType } from "@/types/chat"
import type { ConversationFromService } from "@/types/chat/conversation"
import { ConversationStatus } from "@/types/chat/conversation"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import MessageService from "@/opensource/services/chat/message/MessageService"
import MessageCacheService from "@/opensource/services/chat/message/MessageCacheService"
import conversationSidebarStore from "@/opensource/stores/chatNew/conversationSidebar"
import EditorStore from "@/opensource/stores/chatNew/messageUI/editor"
import MessageStore from "@/opensource/stores/chatNew/message"
import { groupBy, last } from "lodash-es"
import MagicModal from "@/opensource/components/base/MagicModal"
import { t } from "i18next"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import groupInfoService from "@/opensource/services/groupInfo"
import userInfoService from "@/opensource/services/userInfo"
import chatTopicService from "../topic"
import ConversationDbServices from "./ConversationDbService"
import ConversationCacheServices from "./ConversationCacheService"
import ConversationBotDataService from "./ConversationBotDataService"
import ConversationTaskService from "./ConversationTaskService"
import { getConversationGroupKey, getSlicedText } from "./utils"
import DotsService from "../dots/DotsService"
import { ChatApi } from "@/apis"
import { User } from "@/types/user"
import { userStore } from "@/opensource/models/user"
import LastConversationService from "./LastConversationService"
import MessageReplyService from "../message/MessageReplyService"
import groupInfoStore from "@/opensource/stores/groupInfo"
import { fetchPaddingData } from "@/utils/request"
import { bigNumCompare } from "@/utils/string"

/**
 * 会话服务
 */
class ConversationService {
	/**
	 * 魔法ID
	 */
	magicId: string | undefined

	/**
	 * 组织编码
	 */
	organizationCode: string | undefined

	/**
	 * 正在切换会话
	 */
	switching: boolean = false

	/**
	 * 初始化
	 * @param magicId 账户 ID
	 * @param organizationCode 组织编码
	 * @param userInfo 用户信息
	 */
	async init(magicId: string, organizationCode: string, userInfo?: User.UserInfo | null) {
		this.magicId = magicId
		this.organizationCode = organizationCode

		// 获取缓存的侧边栏会话组
		const cache = ConversationCacheServices.getCacheConversationSiderbarGroups(
			magicId,
			organizationCode,
		)

		if (cache) {
			conversationSidebarStore.setConversationSidebarGroups(cache)

			// 从数据库加载会话
			await this.loadConversationsFromDB(userInfo?.user_id)
		} else {
			// 没有拉取过，拉取当前组织的会话
			await this.refreshConversationData()
		}

		// 开始消息数据预热， 压入下一个宏任务
		setTimeout(() => {
			MessageCacheService.initConversationsMessage(userInfo)
		})
	}

	/**
	 * 重置会话
	 */
	reset() {
		conversationSidebarStore.resetConversationSidebarGroups()
		conversationStore.reset()
		this.magicId = undefined
		this.organizationCode = undefined
	}

	/**
	 * 刷新会话数据
	 * @param conversationList 会话列表
	 */
	refreshConversationData(conversationList?: Conversation[]) {
		const ids = conversationList ? conversationList.map((item) => item.id) : undefined
		return fetchPaddingData(({ page_token }) => {
			return ChatApi.getConversationList(ids, {
				page_token,
				status: ConversationStatus.Normal,
			})
		})
			.then((items) => {
				if (items.length) {
					// 更新会话信息
					this.replaceConversations(items)
				}
			})
			.then(() => {
				// 重新拉取一遍用户信息和群聊信息, 保证数据最新
				this.refreshConversationReceiveData()
			})
	}

	/**
	 * 更新多个会话信息
	 * @param filteredConversationList 会话列表
	 */
	replaceConversations(filteredConversationList: ConversationFromService[]) {
		conversationStore.replaceConversations(filteredConversationList)

		// 重新计算侧边栏会话
		this.calcSidebarConversations()

		// 更新数据库
		ConversationDbServices.updateConversations(
			Object.values(conversationStore.conversations).map((item) => item.toObject()),
		)
	}

	/**
	 * 初始化
	 * @param magicId 账户 ID
	 * @param organizationCode 组织编码
	 * @param conversations 会话列表
	 */
	initOnFirstLoad(
		magicId: string,
		organizationCode: string,
		conversations: ConversationFromService[],
	) {
		this.magicId = magicId
		this.organizationCode = organizationCode

		this.initConversations(conversations)
	}

	/**
	 * 群聊解散
	 * @param conversationId 会话
	 */
	groupConversationDisband(conversationId: string) {
		MagicModal.info({
			content: t("chat.groupDisbandTip.disbandGroup", { ns: "interface" }),
			centered: true,
			okText: t("common.confirm", { ns: "interface" }),
			closable: false,
		})

		this.deleteConversation(conversationId)
		conversationStore.setCurrentConversation(undefined)
	}

	/**
	 * 切换会话
	 * @param conversation 会话
	 */
	async switchConversation(conversation?: Conversation) {
		if (!conversation) {
			conversationStore.setCurrentConversation(undefined)
			return
		}

		if (conversationStore.currentConversation?.id === conversation.id) return

		if (this.switching) return
		this.switching = true

		try {
			EditorStore.setLastConversationId(conversationStore.currentConversation?.id ?? "")
			EditorStore.setLastTopicId(
				conversationStore.currentConversation?.current_topic_id ?? "",
			)

			conversationStore.setCurrentConversation(conversation)

			// 如果会话被删除（比如群聊被解散），则弹窗提示，并切换到下一个会话
			if (
				conversation.status === ConversationStatus.Deleted &&
				conversation.isGroupConversation
			) {
				this.groupConversationDisband(conversation.id)
				return
			}

			// 清除Bot信息
			ConversationBotDataService.clearBotInfo()
			// 清除Agent信息
			ConversationTaskService.clearAgentInfo()

			// 设置编辑器状态
			EditorStore.setConversationId(conversation.id)
			EditorStore.setTopicId(conversation.current_topic_id ?? "")

			// 获取会话用户/群组信息
			if (!conversation.isGroupConversation) {
				userInfoService.fetchUserInfos([conversation.receive_id], 2)
			}

			// 如果是AI会话
			if (conversation.isAiConversation) {
				await this.initAiConversation(conversation)
			}

			// 重置引用消息
			MessageReplyService.reset()

			// 初始化会话消息
			this.initConversationMessages(conversation)

			// 如果是群聊
			if (conversation.isGroupConversation) {
				this.initGroupConversation(conversation)
			}

			// 设置最后会话
			LastConversationService.setLastConversation(
				this.magicId,
				this.organizationCode,
				conversation.id,
			)
		} catch (error) {
			console.error(error)
		} finally {
			this.switching = false
		}
	}

	initConversationMessages(conversation: Conversation) {
		// 当前话题
		const messageTopicId = conversation.isAiConversation ? conversation.current_topic_id : ""

		// 如果 AI 会话且没有话题 id，则重置消息列表
		if (conversation.isAiConversation && !messageTopicId) {
			MessageService.reset()
		} else {
			// 初始化消息列表
			MessageService.initMessages(conversation.id, messageTopicId).then(() => {
				const lastMessage = last(MessageStore.messages)
				if (lastMessage) {
					// 更新最后一条消息渲染
					this.updateLastReceiveMessage(conversation.id, {
						time: lastMessage.message.send_time,
						seq_id: lastMessage.message_id,
						...getSlicedText(lastMessage.message, lastMessage.revoked),
						topic_id: lastMessage.message.topic_id ?? "",
					})
				} else {
					this.clearLastReceiveMessage(conversation.id)
				}
			})
		}

		// 减少未读数量
		console.log(
			"conversation.topic_unread_dots ====> ",
			conversation.topic_unread_dots.get(messageTopicId),
		)
		DotsService.reduceTopicUnreadDots(
			conversation.user_organization_code,
			conversation.id,
			messageTopicId,
			conversation.topic_unread_dots.get(messageTopicId) ?? 0,
		)
	}

	/**
	 * 初始化群聊会话
	 * @param conversation 会话
	 */
	initGroupConversation(conversation: Conversation) {
		// 拉取群聊信息
		groupInfoService.fetchGroupInfos([conversation.receive_id]).then((res) => {
			if (res.length) {
				groupInfoStore.setCurrentGroup(res[0])
			}
		})
		// 拉取群聊成员
		groupInfoService.fetchGroupMembers(conversation.receive_id)
	}

	/**
	 * 初始化AI会话
	 * @param conversation 会话
	 */
	async initAiConversation(conversation: Conversation) {
		// 初始化话题列表
		await chatTopicService.initTopicList(conversation)
		const userInfo = userStore.user.userInfo
		// 预热话题消息
		setTimeout(() => {
			MessageCacheService.initTopicsMessage(userInfo)
		})

		// 初始化会话 agent 信息
		this.initConversationBotInfo(conversation)
	}

	/**
	 * 初始化会话 agent 信息
	 * @param conversation 会话
	 * @returns 会话
	 */
	initConversationBotInfo(conversation: Conversation) {
		// 获取机器人信息
		return ChatApi.getAiAssistantBotInfo({ user_id: conversation.receive_id }).then(
			async (botInfo) => {
				if (!botInfo) {
					console.error("botInfo is null, receive_id:", conversation.receive_id)
					return
				}
				// 获取定时任务列表
				ConversationTaskService.switchAgent(botInfo.root_id)
				// 初始化快捷指令
				return ChatApi.getConversationList([conversation.id]).then(({ items }) => {
					if (items.length) {
						ConversationBotDataService.switchConversation(
							conversation.id,
							items[0].receive_id,
							botInfo,
							items[0].instructs,
						)
					}
				})
			},
		)
	}
	/**
	 * 创建会话
	 * @param receiveType 接收者类型
	 * @param uid 用户ID
	 * @returns 会话
	 */
	async createConversation(receiveType: MessageReceiveType, uid: string) {
		const { data } = await ChatApi.createConversation(receiveType, uid)

		if (conversationStore.hasConversation(data.seq.message.open_conversation.id)) {
			return conversationStore.getConversation(data.seq.message.open_conversation.id)
		}

		const { items } = await ChatApi.getConversationList([data.seq.message.open_conversation.id])

		return this.addNewConversation(items[0])
	}

	/**
	 * 从数据库加载会话
	 * @param calcSidebarConversations 是否计算侧边栏会话
	 */
	loadConversationsFromDB(userId: string | undefined, calcSidebarConversations = true) {
		if (!this.organizationCode || !userId) return
		return ConversationDbServices.loadNormalConversationsFromDB(
			this.organizationCode,
			userId,
		).then((conversations) => {
			console.log("loadConversationsFromDB ====> ", conversations)

			const conversationList = conversations.map((item) => new Conversation(item))

			conversationStore.setConversations(conversationList)

			// 如果当前会话为空,或者不是当前组织的会话，则设置当前会话
			if (
				!conversationStore.currentConversation ||
				conversationStore.currentConversation.user_organization_code !==
					this.organizationCode
			) {
				const lastConversation = conversationStore.getConversation(
					LastConversationService.getLastConversation(
						this.magicId,
						this.organizationCode,
					) ?? conversationList?.[0]?.id,
				)
				this.switchConversation(lastConversation)
			}

			if (calcSidebarConversations) {
				this.calcSidebarConversations()
			}

			// 刷新会话数据
			this.refreshConversationData(conversationList)
		})
	}

	/**
	 * 计算侧边栏会话
	 */
	calcSidebarConversations() {
		const sidebarGroups = conversationStore.calcSidebarConversations(
			Object.keys(conversationStore.conversations),
			conversationStore.conversations,
		)

		console.log("sidebarGroups ====> ", sidebarGroups)

		conversationSidebarStore.setConversationSidebarGroups(sidebarGroups)
		ConversationCacheServices.cacheConversationSiderbarGroups(
			this.magicId,
			this.organizationCode,
			sidebarGroups,
		)
	}

	/**
	 * 刷新 会话接收者 数据
	 */
	refreshConversationReceiveData() {
		const {
			[MessageReceiveType.Group]: groupIds = [],
			[MessageReceiveType.User]: userIds = [],
			[MessageReceiveType.Ai]: aiIds = [],
		} = groupBy(Object.values(conversationStore.conversations), (item) => item.receive_type)

		// 拉取群聊信息
		if (groupIds.length) {
			groupInfoService.fetchGroupInfos(groupIds.map((item) => item.receive_id))
		}

		// 拉取用户信息
		const allUserIds = [...new Set([...aiIds, ...userIds])]
		if (allUserIds.length) {
			userInfoService.fetchUserInfos(
				allUserIds.map((item) => item.receive_id),
				2,
			)
		}
	}

	/**
	 * 更改置顶状态
	 * @param conversationId 会话
	 * @param isTop 是否置顶
	 */
	updateTopStatus(conversationId: string, isTop: 0 | 1) {
		// 更新会话状态（包含分组移动逻辑）
		conversationStore.updateTopStatus(conversationId, isTop)

		// 更新数据库
		ConversationDbServices.updateTopStatus(conversationId, isTop)

		// 更新缓存
		this.cacheConversationSiderbarGroups()
	}

	setTopStatus(conversationId: string, isTop: 0 | 1) {
		ChatApi.topConversation(conversationId, isTop)
		this.updateTopStatus(conversationId, isTop)
	}

	/**
	 * 设置会话免打扰
	 * @param conversationId 会话
	 * @param isNotDisturb 是否免打扰
	 */
	notDisturbConversation(conversationId: string, isNotDisturb: 0 | 1) {
		conversationStore.updateConversationDisturbStatus(conversationId, isNotDisturb)
		// 更新数据库
		ConversationDbServices.updateNotDisturbStatus(conversationId, isNotDisturb)
	}

	/**
	 * 设置会话免打扰状态
	 * @param conversationId 会话
	 * @param isNotDisturb 是否免打扰
	 */
	setNotDisturbStatus(conversationId: string, isNotDisturb: 0 | 1) {
		ChatApi.muteConversation(conversationId, isNotDisturb)
		this.notDisturbConversation(conversationId, isNotDisturb)
	}

	/**
	 * 更新会话主题默认打开
	 * @param conversation 会话
	 * @param open 是否打开
	 */
	updateTopicOpen(conversation: Conversation, open: boolean) {
		if (!conversation) return

		// 如果是AI会话，需要更新数据
		if (isAiConversation(conversation.receive_type)) {
			conversation.setTopicDefaultOpen(open)
			conversationStore.updateConversationTopicDefaultOpen(conversation.id, open)

			// 更新数据库
			ConversationDbServices.updateTopicDefaultOpen(conversation.id, open)
		}

		conversationStore.setTopicOpen(open)
	}

	/**
	 * 插入会话记录
	 * @param menuKey 菜单组
	 * @param ids 会话ID
	 */
	unshiftConversations(menuKey: ConversationGroupKey, ...ids: string[]) {
		if (!this.organizationCode) return

		conversationStore.updateSidebarGroup(menuKey, ids)

		// 更新缓存
		this.cacheConversationSiderbarGroups()
	}

	/**
	 * 缓存侧边栏会话组
	 */
	private cacheConversationSiderbarGroups() {
		ConversationCacheServices.cacheConversationSiderbarGroups(
			this.magicId,
			this.organizationCode,
			conversationSidebarStore.getConversationSiderbarGroups(),
		)
	}

	/**
	 * 从数据库添加会话
	 * @param conversationId 会话ID
	 */
	async addNewConversationFromDB(conversationId: string) {
		const conversation = await ConversationDbServices.getConversation(conversationId)
		if (conversation) {
			conversationStore.initConversations([conversation as Conversation])
		}
	}

	addNewConversation(conversation: ConversationFromService) {
		const newConversation = conversationStore.addNewConversation(conversation)

		// 更新缓存
		this.cacheConversationSiderbarGroups()

		ConversationDbServices.addConversationsToDB([newConversation])

		return newConversation
	}

	/**
	 * 添加会话
	 * @param conversationShouldHandle 会话
	 */
	initConversations(conversationShouldHandle: ConversationFromService[]) {
		if (!this.organizationCode) return

		const conversations = conversationShouldHandle.map((item) => new Conversation(item))

		// 添加到会话 store
		conversationStore.initConversations(conversations)
		// 更新缓存
		this.cacheConversationSiderbarGroups()

		// 持久化到数据库
		ConversationDbServices.addConversationsToDB(conversations)
	}

	/**
	 * 更新当前话题ID
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 */
	switchTopic(conversationId: string, topicId: string | undefined) {
		console.log("switchTopic ====> ", conversationId, topicId)
		if (!conversationId) return
		EditorStore.setLastConversationId(conversationStore.currentConversation?.id ?? "")
		EditorStore.setLastTopicId(conversationStore.currentConversation?.current_topic_id ?? "")

		const conversation = conversationStore.conversations[conversationId]
		if (conversation) {
			const tId = topicId ?? ""
			conversation.setCurrentTopicId(tId)

			// 减少当前话题未读数量
			const topicUnreadDots = conversation.topic_unread_dots.get(tId) ?? 0
			if (topicUnreadDots > 0) {
				DotsService.reduceTopicUnreadDots(
					conversation.user_organization_code,
					conversationId,
					tId,
					topicUnreadDots,
				)
			}

			conversationStore.updateConversationCurrentTopicId(conversationId, topicId ?? "")

			// 重置引用消息
			MessageReplyService.reset()

			this.initConversationMessages(conversation)

			// 更新数据库
			ConversationDbServices.updateCurrentTopicId(conversationId, topicId ?? "")
		}
	}

	clearCurrentTopic(conversationId: string) {
		if (!conversationId) return
		EditorStore.setLastConversationId(conversationStore.currentConversation?.id ?? "")
		EditorStore.setLastTopicId(conversationStore.currentConversation?.current_topic_id ?? "")

		const conversation = conversationStore.conversations[conversationId]
		if (conversation) {
			conversationStore.updateConversationCurrentTopicId(conversationId, "")

			// 减少当前话题未读数量
			const topicUnreadDots = conversation.topic_unread_dots.get("") ?? 0
			if (topicUnreadDots > 0) {
				DotsService.reduceTopicUnreadDots(
					conversation.user_organization_code,
					conversationId,
					"",
					topicUnreadDots,
				)
			}

			// 重置引用消息
			MessageReplyService.reset()

			this.initConversationMessages(conversation)

			// 更新数据库
			ConversationDbServices.updateCurrentTopicId(conversationId, "")
		}
	}

	/**
	 * 删除会话
	 * @param conversation 会话
	 */
	deleteConversation(conversationId: string) {
		if (!conversationId) return
		const nextConversationId = conversationStore.removeConversation(conversationId)
		// 如果删除的是当前会话，则切换到下一个会话
		if (
			nextConversationId &&
			// 如果当前会话为空，或者当前会话ID与删除的会话ID一致
			(!conversationStore.currentConversation?.id ||
				conversationStore.currentConversation?.id === conversationId)
		) {
			this.switchConversation(conversationStore.getConversation(nextConversationId))
		}
		// 缓存侧边栏会话组
		this.cacheConversationSiderbarGroups()
		// 从数据库中删除
		// ConversationDbServices.deleteConversation(conversationId)
	}

	/**
	 * 删除会话
	 * @param conversationIds 会话ID列表
	 */
	deleteConversations(conversationIds: string[]) {
		if (!conversationIds.length) return
		conversationStore.removeConversations(conversationIds)
		// 缓存侧边栏会话组
		this.cacheConversationSiderbarGroups()
		// 从数据库中删除
		// ConversationDbServices.deleteConversations(conversationIds)
	}

	/**
	 * 更新最后一条消息
	 * @param conversationId 会话ID
	 * @param message 最后一条消息
	 */
	updateLastReceiveMessage(
		conversationId: string,
		message: {
			time: number
			seq_id: string
			type: ConversationMessageType | ControlEventMessageType
			text: string
			topic_id: string
		} | null,
	) {
		if (!conversationId) return

		if (!message) {
			message = {
				time: 0,
				seq_id: "",
				type: ConversationMessageType.Text,
				text: "",
				topic_id: "",
			}
		}

		// 如果消息没有文本，则不更新 (大概率是流式消息，最开始没有内容，在流式结束完之后会再次更新)
		if (!message.text) return

		const time = conversationStore
			.getConversation(conversationId)
			?.getLastMessageTime(message.time)

		if (conversationStore.hasConversation(conversationId)) {
			const conversation = conversationStore.getConversation(conversationId)

			const messageTopicId = message.topic_id ?? ""
			const conversationTopicId = conversation.current_topic_id ?? ""

			// 如果消息seq_id小于会话最后一条消息seq_id，则不更新
			if (
				conversation.last_receive_message?.seq_id &&
				bigNumCompare(message.seq_id, conversation.last_receive_message?.seq_id ?? "") < 0
			)
				return

			// 如果不是当前会话，并且消息话题ID与会话话题ID不一致，则更新会话话题ID 和 最后一条消息
			if (conversationId !== conversationStore.currentConversation?.id) {
				// 如果消息话题ID与会话话题ID不一致，则更新会话话题ID
				if (messageTopicId !== conversationTopicId) {
					conversationStore.updateConversationCurrentTopicId(
						conversationId,
						messageTopicId,
					)
				}
				conversation.setLastReceiveMessageAndLastReceiveTime(message)
				// 更新数据库
				ConversationDbServices.updateConversation(conversationId, {
					last_receive_message_time: time,
					current_topic_id: messageTopicId,
					last_receive_message: message,
				})
			}
			// 如果是当前会话，并且消息话题ID与会话话题ID一致，则更新最后一条消息
			else if (
				conversationId === conversationStore.currentConversation?.id &&
				messageTopicId === conversationTopicId
			) {
				conversation.setLastReceiveMessageAndLastReceiveTime(message)
				// 更新数据库
				ConversationDbServices.updateConversation(conversationId, {
					last_receive_message_time: time,
					last_receive_message: message,
				})
			}
		}
	}

	/**
	 * 清空最后一条消息
	 * @param conversationId 会话ID
	 */
	clearLastReceiveMessage(conversationId: string) {
		if (!conversationId) return
		conversationStore.updateConversationLastMessage(conversationId, undefined)
		// 更新数据库
		ConversationDbServices.updateConversation(conversationId, {
			last_receive_message: undefined,
		})
	}
	/**
	 * 开始会话输入
	 * @param conversation_id 会话ID
	 */
	startConversationInput(conversationId: string) {
		conversationStore.updateConversationReceiveInputing(conversationId, true)
	}

	/**
	 * 结束会话输入
	 */
	endConversationInput(conversationId: string) {
		conversationStore.updateConversationReceiveInputing(conversationId, false)
	}

	/**
	 * 是否存在解散群聊未确认记录
	 * @param id 会话ID
	 * @returns 是否存在解散群聊未确认记录
	 */
	hasConversationDisbandGroupUnConfirmRecord(id: string) {
		console.log("id", id)
		// FIXME: 临时返回 true
		return true
	}

	/**
	 * 确认解散群聊
	 * @param id 会话ID
	 */
	confirmDisbandGroupConversation(id: string) {
		if (!id) return

		// FIXME: 临时返回 true
		console.log("confirmDisbandGroupConversation", id)
	}

	/**
	 * 更新会话状态
	 * @param conversation_id 会话ID
	 * @param status 状态
	 */
	updateConversationStatus(conversation_id: string, status: ConversationStatus) {
		if (!conversation_id) return

		const conversation = conversationStore.conversations[conversation_id]
		if (conversation) {
			conversation.status = status

			conversationStore.updateConversationStatus(conversation_id, status)

			// 更新数据库
			ConversationDbServices.updateStatus(conversation_id, status)
		}
	}

	/**
	 * 移动会话到最上面
	 * @param conversation_id 会话ID
	 */
	moveConversationFirst(conversation_id: string) {
		if (!conversation_id) return

		const conversation = conversationStore.getConversation(conversation_id)
		if (!conversation) return

		let menuKey = getConversationGroupKey(conversation)

		if (conversation.is_top) {
			menuKey = ConversationGroupKey.Top
		}

		conversationSidebarStore.moveConversationFirst(conversation_id, menuKey)

		if ([ConversationGroupKey.User, ConversationGroupKey.AI].includes(menuKey)) {
			conversationSidebarStore.moveConversationFirst(
				conversation_id,
				ConversationGroupKey.Single,
			)
		}

		// 更新缓存
		this.cacheConversationSiderbarGroups()
	}
}

export default new ConversationService()
