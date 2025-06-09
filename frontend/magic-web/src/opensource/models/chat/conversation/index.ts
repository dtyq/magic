import { isAiConversation } from "@/opensource/stores/chatNew/helpers/conversation"
import { ConversationStatus, type ConversationFromService } from "@/types/chat/conversation"
import { makeAutoObservable } from "mobx"
import { MessageReceiveType } from "@/types/chat"
import type { ConversationObject, LastReceiveMessage } from "./types"
import { cloneDeep } from "lodash-es"

class Conversation {
	/**
	 * 会话ID
	 */
	id: string

	/**
	 * 用户ID
	 */
	user_id: string

	/**
	 * 接收类型
	 */
	receive_type: number

	/**
	 * 接收ID
	 */
	receive_id: string

	/**
	 * 接收组织编码
	 */
	receive_organization_code: string

	/**
	 * 是否免打扰
	 */
	is_not_disturb: 0 | 1

	/**
	 * 是否置顶
	 */
	is_top: 0 | 1

	/**
	 * 是否标记
	 */
	is_mark: number

	/**
	 * 额外信息
	 */
	extra: any

	/**
	 * 状态
	 */
	status: number

	/**
	 * 最后一条消息
	 */
	last_receive_message: LastReceiveMessage | undefined

	/**
	 * 话题面板是否默认打开
	 */
	topic_default_open: boolean

	/**
	 * 组织编码
	 */
	user_organization_code: string

	/**
	 * 当前话题ID
	 */
	current_topic_id: string

	/**
	 * 未读消息数量
	 */
	unread_dots: number

	/**
	 * 话题未读数量
	 */
	topic_unread_dots: Map<string, number>

	/**
	 * 会话输入状态
	 */
	receive_inputing: boolean

	/**
	 * 最后一条消息时间
	 */
	last_receive_message_time: number

	constructor(data: ConversationFromService | Conversation | ConversationObject) {
		this.id = data.id
		this.user_id = data.user_id
		this.receive_type = data.receive_type
		this.receive_id = data.receive_id
		this.receive_organization_code = data.receive_organization_code
		this.is_not_disturb = data.is_not_disturb
		this.is_top = data.is_top
		this.is_mark = data.is_mark
		this.extra = data.extra
		this.status = data.status
		this.topic_default_open = isAiConversation(data.receive_type)
		this.user_organization_code = data.user_organization_code
		this.current_topic_id = (data as ConversationObject).current_topic_id
		this.unread_dots = (data as ConversationObject)?.unread_dots ?? 0
		this.topic_unread_dots = (data as ConversationObject)?.topic_unread_dots ?? new Map()
		this.receive_inputing = false
		this.last_receive_message = (
			data as Conversation | ConversationObject
		)?.last_receive_message
		this.last_receive_message_time =
			(data as ConversationObject)?.last_receive_message_time ?? 0
		makeAutoObservable(this, {}, { autoBind: true })
	}

	toObject(): ConversationObject {
		const res = {
			id: this.id,
			user_id: this.user_id,
			receive_type: this.receive_type,
			receive_id: this.receive_id,
			receive_organization_code: this.receive_organization_code,
			is_not_disturb: this.is_not_disturb,
			is_top: this.is_top,
			is_mark: this.is_mark,
			extra: this.extra,
			status: this.status,
			last_receive_message: this.last_receive_message,
			topic_default_open: this.topic_default_open,
			user_organization_code: this.user_organization_code,
			current_topic_id: this.current_topic_id,
			unread_dots: this.unread_dots,
			topic_unread_dots: new Map(this.topic_unread_dots),
			receive_inputing: this.receive_inputing,
			last_receive_message_time: this.last_receive_message_time,
		}

		return cloneDeep(res)
	}

	/**
	 * 是否是AI会话
	 */
	get isAiConversation() {
		return isAiConversation(this.receive_type)
	}

	/**
	 * 是否是群聊
	 */
	get isGroupConversation() {
		return this.receive_type === MessageReceiveType.Group
	}

	/**
	 * 取消置顶
	 */
	unTop() {
		this.is_top = 0
	}

	/**
	 * 置顶
	 */
	top() {
		this.is_top = 1
	}

	/**
	 * 设置话题面板默认打开
	 * @param open 是否打开
	 */
	setTopicDefaultOpen(open: boolean) {
		this.topic_default_open = open
	}

	/**
	 * 比较消息时间
	 * @param messageTime 消息时间
	 * @returns 最大时间
	 */
	getLastMessageTime(messageTime: number) {
		return Math.max(messageTime, this.last_receive_message_time)
	}

	/**
	 * 设置最后一条消息
	 * @param message 最后一条消息
	 */
	setLastReceiveMessageAndLastReceiveTime(message: LastReceiveMessage | undefined) {
		this.last_receive_message = message

		console.trace("setLastReceiveMessageAndLastReceiveTime", this.id, message)

		this.last_receive_message_time = this.getLastMessageTime(message?.time ?? 0)
	}

	/**
	 * 设置当前话题ID
	 * @param topicId 话题ID
	 */
	setCurrentTopicId(topicId: string) {
		this.current_topic_id = topicId
	}

	/**
	 * 设置会话免打扰
	 * @param isNotDisturb 是否免打扰
	 */
	setNotDisturb(isNotDisturb: 0 | 1) {
		this.is_not_disturb = isNotDisturb
	}

	/**
	 * 隐藏会话
	 */
	hidden() {
		this.status = ConversationStatus.Hidden
	}

	/**
	 * 更新未读消息数量
	 * @param dots 未读消息数量
	 */
	addUnreadDots(dots: number = 1) {
		this.unread_dots += dots
	}

	/**
	 * 减少未读消息数量
	 * @param dots 未读消息数量
	 */
	reduceUnreadDots(dots: number = 1) {
		this.unread_dots = Math.max(this.unread_dots - dots, 0)
	}

	/**
	 * 重置未读消息数量
	 */
	resetUnreadDots() {
		this.unread_dots = 0
	}

	/**
	 * 设置会话状态
	 * @param status 状态
	 */
	setStatus(status: number) {
		this.status = status
	}

	/**
	 * 增加话题未读数量
	 * @param topicId 话题ID
	 * @param dots 未读数量
	 */
	addTopicUnreadDots(topicId: string, dots: number = 1) {
		this.topic_unread_dots.set(topicId, (this.topic_unread_dots.get(topicId) || 0) + dots)
	}

	/**
	 * 减少话题未读数量
	 * @param topicId 话题ID
	 * @param dots 未读数量
	 */
	reduceTopicUnreadDots(topicId: string, dots: number = 1) {
		this.topic_unread_dots.set(
			topicId,
			Math.max((this.topic_unread_dots.get(topicId) || 0) - dots, 0),
		)
	}

	/**
	 * 重置话题未读数量
	 */
	resetTopicUnreadDots(topicId: string, num: number = 0) {
		this.topic_unread_dots.set(topicId, num)
	}

	/**
	 * 重置所有未读数量
	 */
	resetAllTopicUnreadDots() {
		this.topic_unread_dots.clear()
	}

	/**
	 * 设置会话输入状态
	 * @param inputing 输入状态
	 */
	setReceiveInputing(inputing: boolean) {
		this.receive_inputing = inputing
	}

	/**
	 * 更新会话数据
	 * @param data 会话数据
	 */
	updateFromRemote(data: ConversationFromService) {
		this.id = data.id
		this.user_id = data.user_id
		this.receive_type = data.receive_type
		this.receive_id = data.receive_id
		this.receive_organization_code = data.receive_organization_code
		this.is_not_disturb = data.is_not_disturb
		this.is_top = data.is_top
		this.is_mark = data.is_mark
		this.extra = data.extra
		this.status = data.status
		this.user_organization_code = data.user_organization_code
	}
}

export default Conversation
