import { SeqResponse } from "@/types/request"
import { MagicBroadcastChannel } from "./broadcastChannel"
import { EVENTS } from "./eventFactory/events"
import {
	ConversationMessageSend,
	ConversationMessageStatus,
	ConversationMessage,
	SendStatus,
} from "@/types/chat/conversation_message"
import { FullMessage, ApplyMessageOptions } from "@/types/chat/message"
import type { CMessage } from "@/types/chat"
import { User } from "@/types/user"

const magicBroadcastChannel = new MagicBroadcastChannel("magic-chat-broadcast-channel")

export const BroadcastChannelSender = {
	addSendMessage: (renderMessage: FullMessage, message: ConversationMessageSend) => {
		magicBroadcastChannel.send({
			type: EVENTS.ADD_SEND_MESSAGE,
			payload: {
				renderMessage,
				message,
			},
		})
	},

	updateSendMessage: (response: SeqResponse<ConversationMessage>, sendStatus: SendStatus) => {
		magicBroadcastChannel.send({
			type: EVENTS.UPDATE_SEND_MESSAGE,
			payload: {
				response,
				sendStatus,
			},
		})
	},

	updateMessageStatus: (
		messageId: string,
		sendStatus?: SendStatus | undefined,
		seenStatus?: ConversationMessageStatus | undefined,
	) => {
		magicBroadcastChannel.send({
			type: EVENTS.UPDATE_MESSAGE_STATUS,
			payload: {
				messageId,
				sendStatus,
				seenStatus,
			},
		})
	},

	updateMessageId: (tempId: string, messageId: string) => {
		magicBroadcastChannel.send({
			type: EVENTS.UPDATE_MESSAGE_ID,
			payload: {
				tempId,
				messageId,
			},
		})
	},

	applyMessage: (message: SeqResponse<CMessage>, options: ApplyMessageOptions) => {
		console.log("applyMessage ========== ", message, options)
		magicBroadcastChannel.send({
			type: EVENTS.APPLY_MESSAGE,
			payload: {
				message,
				options,
			},
		})
	},

	/**
	 * 切换账号
	 * @param targetUserId
	 * @param fallbackUserInfo
	 */
	switchAccount: ({
		magicId,
		magicUserId,
		magicOrganizationCode,
	}: {
		magicId: string
		magicUserId: string
		magicOrganizationCode: string
	}) => {
		magicBroadcastChannel.send({
			type: EVENTS.SWITCH_ACCOUNT,
			payload: {
				magicId,
				magicUserId,
				magicOrganizationCode,
			},
		})
	},

	/**
	 * 切换组织
	 * @param targetUserId
	 * @param targetOrganizationCode
	 * @param fallbackUserInfo
	 */
	switchOrganization: ({
		userInfo,
		magicOrganizationCode,
	}: {
		userInfo: User.UserInfo
		magicOrganizationCode: string
	}) => {
		magicBroadcastChannel.send({
			type: EVENTS.SWITCH_ORGANIZATION,
			payload: {
				userInfo,
				magicOrganizationCode,
			},
		})
	},

	/**
	 * 添加账号
	 * @param userAccount
	 */
	addAccount: (userAccount: User.UserAccount) => {
		magicBroadcastChannel.send({
			type: EVENTS.ADD_ACCOUNT,
			payload: { userAccount },
		})
	},

	/**
	 * 删除账号
	 * @param magicId
	 */
	deleteAccount: (
		magicId?: string,
		{ navigateToLogin = true }: { navigateToLogin?: boolean } = {},
	) => {
		magicBroadcastChannel.send({
			type: EVENTS.DELETE_ACCOUNT,
			payload: { magicId, navigateToLogin },
		})
	},

	/**
	 * 更新组织红点
	 * @param data
	 * @param data.organizationCode 组织编码
	 * @param data.count 数量
	 * @param data.seqId 序号
	 */
	updateOrganizationDot: (data: {
		magicId: string
		organizationCode: string
		count: number
		seqId?: string
	}) => {
		magicBroadcastChannel.send({
			type: EVENTS.UPDATE_ORGANIZATION_DOT,
			payload: data,
		})
	},
}
