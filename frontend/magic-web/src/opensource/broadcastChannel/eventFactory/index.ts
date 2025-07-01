import { ApplyMessageOptions, FullMessage } from "@/types/chat/message"
import { EventFactory } from "./eventFactory"
import { EVENTS } from "./events"
import {
	ConversationMessageSend,
	ConversationMessageStatus,
	SendStatus,
	ConversationMessage,
} from "@/types/chat/conversation_message"
import MessageDispatchService from "@/opensource/services/chat/message/MessageDispatchService"
import { SeqResponse } from "@/types/request"
import { CMessage } from "@/types/chat"
import ConversationDsipatchService from "@/opensource/services/chat/conversation/ConversationDispatchService"
import { CONVERSATION_TOP_STATUS, CONVERSATION_NO_DISTURB_STATUS } from "./constant"
import { User } from "@/types/user"
import UserDispatchService from "@/opensource/services/user/UserDispatchService"
import OrganizationDispatchService from "@/opensource/services/chat/dots/OrganizationDispatchService"
import { userStore } from "@/opensource/models/user"
import MagicModal from "@/opensource/components/base/MagicModal"
import { BroadcastChannelSender } from ".."
import { toJS } from "mobx"
import { t } from "i18next"

const eventFactory = new EventFactory()

// 注册事件处理器

/****** 消息相关 ******/

// 应用消息
eventFactory.on(
	EVENTS.ADD_SEND_MESSAGE,
	(data: { renderMessage: FullMessage; message: ConversationMessageSend }) => {
		console.log("ADD_SEND_MESSAGE", data)
		MessageDispatchService.addSendMessage(data.renderMessage, data.message)
	},
)

// 更新发送消息
eventFactory.on(
	EVENTS.UPDATE_SEND_MESSAGE,
	(data: { response: SeqResponse<ConversationMessage>; sendStatus: SendStatus }) => {
		console.log("UPDATE_SEND_MESSAGE", data)
		MessageDispatchService.updateSendMessage(data.response, data.sendStatus)
	},
)

// 应用消息
eventFactory.on(
	EVENTS.APPLY_MESSAGE,
	(data: { message: SeqResponse<CMessage>; options: ApplyMessageOptions }) => {
		console.log("APPLY_MESSAGE ==========", data)
		MessageDispatchService.applyMessage(data.message, data.options)
	},
)

// 更新消息状态
eventFactory.on(
	EVENTS.UPDATE_MESSAGE_STATUS,
	(data: {
		messageId: string
		sendStatus?: SendStatus
		seenStatus?: ConversationMessageStatus
	}) => {
		console.log("UPDATE_MESSAGE_STATUS", data)
		MessageDispatchService.updateMessageStatus(data.messageId, data.sendStatus, data.seenStatus)
	},
)

// 更新消息ID
eventFactory.on(EVENTS.UPDATE_MESSAGE_ID, (data: { tempId: string; messageId: string }) => {
	console.log("UPDATE_MESSAGE_ID", data)
	MessageDispatchService.updateMessageId(data.tempId, data.messageId)
})

// 删除消息
eventFactory.on(EVENTS.DELETE_MESSAGE, (data: { conversationId: string; messageId: string }) => {
	console.log("DELETE_MESSAGE", data)
	// 处理删除消息事件
})

// 更新消息
eventFactory.on(EVENTS.UPDATE_MESSAGE, (data) => {
	console.log("UPDATE_MESSAGE", data)
})

// 应用多条消息
eventFactory.on(EVENTS.APPLY_MESSAGES, (data) => {
	console.log("APPLY_MESSAGES", data)
})

/****** 会话相关 ******/

// 置顶会话
eventFactory.on(EVENTS.SET_TOP_CONVERSATION, (data: { conversationId: string }) => {
	console.log("SET_TOP_CONVERSATION", data)
	ConversationDsipatchService.setTopConversationStatus(
		data.conversationId,
		CONVERSATION_TOP_STATUS.TOP,
	)
})

// 取消置顶会话
eventFactory.on(EVENTS.CANCEL_TOP_CONVERSATION, (data: { conversationId: string }) => {
	console.log("CANCEL_TOP_CONVERSATION", data)
	ConversationDsipatchService.setTopConversationStatus(
		data.conversationId,
		CONVERSATION_TOP_STATUS.NOT_TOP,
	)
})

// 消息免打扰
eventFactory.on(EVENTS._NO_DISTURB_STATUS, (data: { conversationId: string }) => {
	console.log("_NO_DISTURB_STATUS", data)
	ConversationDsipatchService.setNotDisturbStatus(
		data.conversationId,
		CONVERSATION_NO_DISTURB_STATUS.NO_DISTURB,
	)
})

// 取消免打扰状态
eventFactory.on(EVENTS.CANCEL_SET_NO_DISTURB_STATUS, (data: { conversationId: string }) => {
	console.log("CANCEL_SET_NO_DISTURB_STATUS", data)
	ConversationDsipatchService.setNotDisturbStatus(
		data.conversationId,
		CONVERSATION_NO_DISTURB_STATUS.NORMAL,
	)
})

// 更新会话红点
eventFactory.on(
	EVENTS.UPDATE_CONVERSATION_DOT,
	(data: { conversationId: string; count: number }) => {
		console.log("UPDATE_CONVERSATION_DOT", data)
		// 处理更新会话红点事件
	},
)

// 更新话题红点
eventFactory.on(
	EVENTS.UPDATE_TOPIC_DOT,
	(data: { conversationId: string; topicId: string; count: number }) => {
		console.log("UPDATE_TOPIC_DOT", data)
		// 处理更新话题红点事件
	},
)

/****** 用户相关 ******/

// 登出
eventFactory.on(EVENTS.LOGOUT, (data) => {
	console.log("LOGOUT", data)
})

// 执行登出
eventFactory.on(EVENTS.DO_LOGOUT, (data) => {
	console.log("DO_LOGOUT", data)
})

// 登录
eventFactory.on(EVENTS.LOGIN, (data) => {
	console.log("LOGIN", data)
})

// 执行登录
eventFactory.on(EVENTS.DO_LOGIN, (data) => {
	console.log("DO_LOGIN", data)
})

// // 切换用户
// eventFactory.on(EVENTS.SWITCH_USER, (data) => {
// 	console.log("SWITCH_USER", data)
// })

// // 执行切换用户
// eventFactory.on(EVENTS.DO_SWITCH_USER, (data) => {
// 	console.log("DO_SWITCH_USER", data)
// })

let switchOrganizationModal: ReturnType<typeof MagicModal.confirm> | null = null

// 切换组织
eventFactory.on(
	EVENTS.SWITCH_ORGANIZATION,
	(data: { userInfo: User.UserInfo; magicOrganizationCode: string }) => {
		const currentUserInfo = userStore.user.userInfo
		const currentOrganizationCode = userStore.user.organizationCode

		if (
			currentUserInfo &&
			(currentUserInfo?.user_id !== data.userInfo.user_id ||
				currentOrganizationCode !== data.magicOrganizationCode)
		) {
			switchOrganizationModal?.destroy()
			switchOrganizationModal = MagicModal.confirm({
				title: t("broadcastChannel.organization.title", { ns: "common" }),
				content: t("broadcastChannel.organization.content", { ns: "common" }),
				okText: t("broadcastChannel.organization.confirm", { ns: "common" }),
				cancelText: t("broadcastChannel.organization.cancel", { ns: "common" }),
				centered: true,
				onOk: () => {
					UserDispatchService.switchOrganization({
						userInfo: data.userInfo,
						magicOrganizationCode: data.magicOrganizationCode,
					})
					switchOrganizationModal?.destroy()
				},
				onCancel: () => {
					BroadcastChannelSender.switchOrganization({
						userInfo: toJS(currentUserInfo),
						magicOrganizationCode: toJS(currentOrganizationCode),
					})
					switchOrganizationModal?.destroy()
				},
			})
		} else {
			if (switchOrganizationModal) {
				switchOrganizationModal.destroy()
			}
		}
	},
)

// 执行切换组织
eventFactory.on(EVENTS.DO_SWITCH_ORGANIZATION, (data) => {
	console.log("DO_SWITCH_ORGANIZATION", data)
})

// 更新组织红点
eventFactory.on(
	EVENTS.UPDATE_ORGANIZATION_DOT,
	(data: { magicId: string; organizationCode: string; count: number; seqId?: string }) => {
		OrganizationDispatchService.updateOrganizationDot(data)
	},
)

// 执行更新组织红点
eventFactory.on(EVENTS.DO_UPDATE_ORGANIZATION_DOT, (data) => {
	console.log("DO_UPDATE_ORGANIZATION_DOT", data)
})

// 更新组织
eventFactory.on(EVENTS.UPDATE_ORGANIZATION, (data) => {
	console.log("UPDATE_ORGANIZATION", data)
})

// 执行更新组织
eventFactory.on(EVENTS.DO_UPDATE_ORGANIZATION, (data) => {
	console.log("DO_UPDATE_ORGANIZATION", data)
})

let switchAccountModal: ReturnType<typeof MagicModal.confirm> | null = null

// 切换账号
eventFactory.on(
	EVENTS.SWITCH_ACCOUNT,
	(data: { magicId: string; magicUserId: string; magicOrganizationCode: string }) => {
		const currentUserInfo = userStore.user.userInfo

		if (currentUserInfo && currentUserInfo.magic_id !== data.magicId) {
			switchAccountModal?.destroy()
			switchAccountModal = MagicModal.confirm({
				title: t("broadcastChannel.account.title", { ns: "common" }),
				content: t("broadcastChannel.account.content", { ns: "common" }),
				okText: t("broadcastChannel.account.confirm", { ns: "common" }),
				cancelText: t("broadcastChannel.account.cancel", { ns: "common" }),
				centered: true,
				onOk: () => {
					UserDispatchService.switchAccount({
						magicId: data.magicId,
						magicUserId: data.magicUserId,
						magicOrganizationCode: data.magicOrganizationCode,
					})
					switchAccountModal?.destroy()
				},
				onCancel: () => {
					BroadcastChannelSender.switchAccount({
						magicId: currentUserInfo.magic_id,
						magicUserId: currentUserInfo.user_id,
						magicOrganizationCode: currentUserInfo.organization_code,
					})
					switchAccountModal?.destroy()
				},
			})
		} else {
			if (switchAccountModal) {
				switchAccountModal.destroy()
			}
		}
	},
)

// 执行切换账号
eventFactory.on(EVENTS.DO_SWITCH_ACCOUNT, (data) => {
	console.log("DO_SWITCH_ACCOUNT", data)
})

// 添加账号
eventFactory.on(EVENTS.ADD_ACCOUNT, (data: { userAccount: User.UserAccount }) => {
	UserDispatchService.addAccount(data)
})

// 执行添加账号
eventFactory.on(EVENTS.DO_ADD_ACCOUNT, (data) => {
	console.log("DO_ADD_ACCOUNT", data)
})

// 删除账号
eventFactory.on(EVENTS.DELETE_ACCOUNT, (data: { magicId?: string; navigateToLogin?: boolean }) => {
	UserDispatchService.deleteAccount(data)
})

// 执行删除账号
eventFactory.on(EVENTS.DO_DELETE_ACCOUNT, (data) => {
	console.log("DO_DELETE_ACCOUNT", data)
})

export default eventFactory
