import { ApplyMessageOptions, FullMessage } from "@/opensource/types/chat/message"
import { EVENTS } from "./events"
import {
	ConversationMessageSend,
	ConversationMessageStatus,
	SendStatus,
	ConversationMessage,
} from "@/opensource/types/chat/conversation_message"
import MessageDispatchService from "@/opensource/services/chat/message/MessageDispatchService"
import { SeqResponse } from "@/opensource/types/request"
import { CMessage } from "@/opensource/types/chat"
import ConversationDispatchService from "@/opensource/services/chat/conversation/ConversationDispatchService"
import { CONVERSATION_TOP_STATUS, CONVERSATION_NO_DISTURB_STATUS } from "./constant"
import { User } from "@/opensource/types/user"
import UserDispatchService from "@/opensource/services/user/UserDispatchService"
import OrganizationDispatchService from "@/opensource/services/chat/dots/OrganizationDispatchService"
import { userStore } from "@/opensource/models/user"
import MagicModal from "@/opensource/components/base/MagicModal"
import { BroadcastChannelSender } from ".."
import { toJS, reaction } from "mobx"
import { t } from "i18next"
import { ContactApi } from "@/opensource/apis"
import { userTransformer } from "@/opensource/models/user/transformers"
import { ModalStateManager } from "./modalStateManager"
import { validateSwitchOperation, getLatestState } from "./stateValidator"
import { generateEventId, handleRouteRedirect } from "./utils"
import { service } from "@/opensource/services"
import { Config } from "@/opensource/models/config/types"
import type { ConfigService } from "@/opensource/services/config/ConfigService"
import { eventFactory, logger } from "./instances"

// 注册事件处理器

/****** 消息相关 ******/

// 应用消息
eventFactory.on(
	EVENTS.ADD_SEND_MESSAGE,
	(data: { renderMessage: FullMessage; message: ConversationMessageSend }) => {
		MessageDispatchService.addSendMessage(data.renderMessage, data.message)
	},
)

// 更新发送消息
eventFactory.on(
	EVENTS.UPDATE_SEND_MESSAGE,
	(data: { response: SeqResponse<ConversationMessage>; sendStatus: SendStatus }) => {
		MessageDispatchService.updateSendMessage(data.response, data.sendStatus)
	},
)

// 应用消息
eventFactory.on(
	EVENTS.APPLY_MESSAGE,
	(data: { message: SeqResponse<CMessage>; options: ApplyMessageOptions }) => {
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
		MessageDispatchService.updateMessageStatus(data.messageId, data.sendStatus, data.seenStatus)
	},
)

// 更新消息ID
eventFactory.on(EVENTS.UPDATE_MESSAGE_ID, (data: { tempId: string; messageId: string }) => {
	MessageDispatchService.updateMessageId(data.tempId, data.messageId)
})

// 删除消息
eventFactory.on(EVENTS.DELETE_MESSAGE, (data: { conversationId: string; messageId: string }) => {
	// console.log("DELETE_MESSAGE", data)
	// 处理删除消息事件
})

// 更新消息
eventFactory.on(EVENTS.UPDATE_MESSAGE, (data) => {
	// console.log("UPDATE_MESSAGE", data)
})

// 应用多条消息
eventFactory.on(EVENTS.APPLY_MESSAGES, (data) => {
	// console.log("APPLY_MESSAGES", data)
})

/****** 会话相关 ******/

// 置顶会话
eventFactory.on(EVENTS.SET_TOP_CONVERSATION, (data: { conversationId: string }) => {
	ConversationDispatchService.setTopConversationStatus(
		data.conversationId,
		CONVERSATION_TOP_STATUS.TOP,
	)
})

// 取消置顶会话
eventFactory.on(EVENTS.CANCEL_TOP_CONVERSATION, (data: { conversationId: string }) => {
	ConversationDispatchService.setTopConversationStatus(
		data.conversationId,
		CONVERSATION_TOP_STATUS.NOT_TOP,
	)
})

// 消息免打扰
eventFactory.on(EVENTS._NO_DISTURB_STATUS, (data: { conversationId: string }) => {
	ConversationDispatchService.setNotDisturbStatus(
		data.conversationId,
		CONVERSATION_NO_DISTURB_STATUS.NO_DISTURB,
	)
})

// 取消免打扰状态
eventFactory.on(EVENTS.CANCEL_SET_NO_DISTURB_STATUS, (data: { conversationId: string }) => {
	ConversationDispatchService.setNotDisturbStatus(
		data.conversationId,
		CONVERSATION_NO_DISTURB_STATUS.NORMAL,
	)
})

// 更新会话红点
eventFactory.on(
	EVENTS.UPDATE_CONVERSATION_DOT,
	(data: { conversationId: string; count: number }) => {
		// console.log("UPDATE_CONVERSATION_DOT", data)
		// 处理更新会话红点事件
	},
)

// 更新话题红点
eventFactory.on(
	EVENTS.UPDATE_TOPIC_DOT,
	(data: { conversationId: string; topicId: string; count: number }) => {
		// console.log("UPDATE_TOPIC_DOT", data)
		// 处理更新话题红点事件
	},
)

/****** 用户相关 ******/
// 登出
eventFactory.on(EVENTS.LOGOUT, (data: { magicId?: string }) => {
	try {
		const modalStateManager = ModalStateManager.getInstance()
		const logoutMagicId = data?.magicId
		const currentUserInfo = userStore.user.userInfo
		const currentMagicId = currentUserInfo?.magic_id
		const pendingOperation = modalStateManager.getPendingOperation()

		// 判断退出的是当前账号还是其他账号
		const isLoggingOutCurrentAccount = !logoutMagicId || logoutMagicId === currentMagicId

		// 判断退出的是否是 pending 操作的目标账号
		let isLoggingOutTargetAccount = false
		if (pendingOperation) {
			if (pendingOperation.type === "organization") {
				isLoggingOutTargetAccount =
					logoutMagicId === pendingOperation.data.userInfo?.magic_id
			} else if (pendingOperation.type === "account") {
				isLoggingOutTargetAccount = logoutMagicId === pendingOperation.data.magicId
			}
		}

		// LOGOUT 事件只负责清理弹窗和待处理操作，不执行 reset
		// reset 操作由后续的 DELETE_ACCOUNT 事件统一处理，避免状态不一致

		// 场景1：退出的是当前账号，需要清理所有资源（但不 reset，等 DELETE_ACCOUNT 处理）
		if (isLoggingOutCurrentAccount) {
			modalStateManager.destroyOrganizationModal()
			modalStateManager.destroyAccountModal()
			modalStateManager.cleanupAccountReaction()
			modalStateManager.clearPendingOperation()
			// 注意：不调用 reset()，让 DELETE_ACCOUNT 事件统一处理
			logger.log("LOGOUT: 当前账号退出，已清理所有弹窗和资源")
			return
		}

		// 场景2：退出的是 pending 操作的目标账号，需要关闭相关弹窗并清理待处理操作
		if (isLoggingOutTargetAccount && pendingOperation) {
			if (pendingOperation.type === "organization") {
				modalStateManager.destroyOrganizationModal()
				modalStateManager.clearPendingOperation()
				logger.log("LOGOUT: 目标账号退出（组织切换），已关闭组织切换弹窗")
			} else if (pendingOperation.type === "account") {
				modalStateManager.destroyAccountModal()
				modalStateManager.cleanupAccountReaction()
				modalStateManager.clearPendingOperation()
				logger.log("LOGOUT: 目标账号退出（账号切换），已关闭账号切换弹窗")
			}
			return
		}

		// 场景3：退出的是其他账号，清理相关资源（但不 reset）
		modalStateManager.destroyOrganizationModal()
		modalStateManager.destroyAccountModal()
		modalStateManager.cleanupAccountReaction()
		modalStateManager.clearPendingOperation()
		// 注意：不调用 reset()，让 DELETE_ACCOUNT 事件统一处理
		logger.log("LOGOUT: 其他账号退出，已清理所有弹窗和资源")
	} catch (error) {
		logger.error("LOGOUT error", error)
		// 确保 cleanup 被调用
		try {
			const modalStateManager = ModalStateManager.getInstance()
			modalStateManager.cleanup()
		} catch (cleanupError) {
			logger.error("LOGOUT cleanup error", cleanupError)
		}
	}
})

// 登录
eventFactory.on(EVENTS.LOGIN, (data) => {
	// console.log("LOGIN", data)
})

// // 切换用户
// eventFactory.on(EVENTS.SWITCH_USER, (data) => {
// 	console.log("SWITCH_USER", data)
// })

// // 执行切换用户
// eventFactory.on(EVENTS.DO_SWITCH_USER, (data) => {
// 	console.log("DO_SWITCH_USER", data)
// })

/**
 * @description 切换组织
 * @param data
 */
async function handleSwitchOrganization(data: {
	userInfo: User.UserInfo
	magicOrganizationCode: string
}) {
	// 【日志追踪】记录事件处理开始
	const currentState = getLatestState()
	const modalStateManager = ModalStateManager.getInstance()
	const pendingOperation = modalStateManager.getPendingOperation()

	logger.log("🔄 SWITCH_ORGANIZATION: 事件处理开始", {
		target: {
			magicId: data.userInfo?.magic_id,
			userId: data.userInfo?.user_id,
			organizationCode: data.magicOrganizationCode,
		},
		current: {
			magicId: currentState.currentUserInfo?.magic_id,
			userId: currentState.currentUserInfo?.user_id,
			organizationCode: currentState.currentOrganizationCode,
		},
		pending: pendingOperation
			? {
					type: pendingOperation.type,
					targetMagicId:
						pendingOperation.type === "organization"
							? pendingOperation.data.userInfo?.magic_id
							: pendingOperation.data.magicId,
					targetOrgCode: pendingOperation.data.magicOrganizationCode,
					age: Date.now() - pendingOperation.timestamp,
				}
			: null,
		accountsCount: currentState.accounts.length,
		timestamp: new Date().toISOString(),
	})

	// 验证必要参数
	if (!data.userInfo || !data.userInfo.magic_id) {
		logger.warn("SWITCH_ORGANIZATION: userInfo 或 magic_id 缺失，忽略操作")
		return
	}

	const eventId = generateEventId(
		"organization",
		data.userInfo.magic_id,
		data.magicOrganizationCode,
	)

	try {
		// 事件去重：检查是否已有相同事件在处理
		const existingEvent = modalStateManager.getEventFromQueue(eventId)
		if (existingEvent && Date.now() - existingEvent.timestamp < 1000) {
			logger.log("SWITCH_ORGANIZATION: 事件去重，忽略重复事件", { eventId })
			return
		}

		// 创建待处理操作
		const pendingOperation = {
			type: "organization" as const,
			data: {
				userInfo: data.userInfo,
				magicOrganizationCode: data.magicOrganizationCode,
			},
			timestamp: Date.now(),
			eventId,
		}

		modalStateManager.addEventToQueue(eventId, pendingOperation)

		const state = getLatestState()
		const currentUserInfo = state.currentUserInfo
		const currentOrganizationCode = state.currentOrganizationCode

		// 条件1：同账号下切换组织
		if (
			currentUserInfo &&
			currentUserInfo.magic_id === data.userInfo.magic_id &&
			(currentUserInfo?.user_id !== data.userInfo.user_id ||
				currentOrganizationCode !== data.magicOrganizationCode)
		) {
			// 验证操作是否仍然有效
			const validationResult = validateSwitchOperation(pendingOperation)
			if (!validationResult.isValid) {
				logger.warn("SWITCH_ORGANIZATION: 操作验证失败", validationResult.reason)
				modalStateManager.destroyOrganizationModal()
				modalStateManager.removeEventFromQueue(eventId)
				return
			}

			modalStateManager.destroyOrganizationModal()

			const modal = MagicModal.confirm({
				title: t("broadcastChannel.organization.title", { ns: "common" }),
				content: t("broadcastChannel.organization.content", { ns: "common" }),
				okText: t("broadcastChannel.organization.confirm", { ns: "common" }),
				cancelText: t("broadcastChannel.organization.cancel", { ns: "common" }),
				centered: true,
				onOk: () => {
					// 重新获取最新状态并验证
					const latestState = getLatestState()
					const latestValidation = validateSwitchOperation(pendingOperation)

					if (!latestValidation.isValid) {
						logger.warn(
							"SWITCH_ORGANIZATION onOk: 操作验证失败",
							latestValidation.reason,
						)
						modalStateManager.destroyOrganizationModal()
						modalStateManager.clearPendingOperation()
						modalStateManager.removeEventFromQueue(eventId)
						return
					}

					// 检查目标账号是否仍然存在
					const targetAccountExists = latestState.accounts.some(
						(acc) => acc.magic_id === data.userInfo.magic_id,
					)

					if (!targetAccountExists) {
						logger.warn("SWITCH_ORGANIZATION onOk: 目标账号不存在")
						modalStateManager.destroyOrganizationModal()
						modalStateManager.clearPendingOperation()
						modalStateManager.removeEventFromQueue(eventId)
						return
					}

					UserDispatchService.switchOrganization({
						userInfo: data.userInfo,
						magicOrganizationCode: data.magicOrganizationCode,
					})
					modalStateManager.destroyOrganizationModal()
					modalStateManager.clearPendingOperation()
					modalStateManager.removeEventFromQueue(eventId)
				},
				onCancel: () => {
					const latestState = getLatestState()
					if (latestState.currentUserInfo && latestState.currentOrganizationCode) {
						BroadcastChannelSender.switchOrganization({
							userInfo: toJS(latestState.currentUserInfo),
							magicOrganizationCode: toJS(latestState.currentOrganizationCode),
						})
					}
					modalStateManager.destroyOrganizationModal()
					modalStateManager.clearPendingOperation()
					modalStateManager.removeEventFromQueue(eventId)
				},
			})

			modalStateManager.setOrganizationModal(modal)
			modalStateManager.setPendingOperation(pendingOperation)
		}
		// 条件2：跨账号且切换账号弹窗存在，则关闭切换组织弹窗，执行切换账号的逻辑
		else if (
			currentUserInfo &&
			currentUserInfo.magic_id !== data.userInfo.magic_id &&
			modalStateManager.getAccountModal()
		) {
			modalStateManager.destroyOrganizationModal()
			await handleSwitchAccount({
				magicId: data.userInfo.magic_id,
				magicUserId: data.userInfo.user_id,
				magicOrganizationCode: data.magicOrganizationCode,
			})
			modalStateManager.removeEventFromQueue(eventId)
		}
		// 条件3：跨账号但切换账号弹窗不存在，应该显示账号切换弹窗
		else if (
			currentUserInfo &&
			currentUserInfo.magic_id !== data.userInfo.magic_id &&
			!modalStateManager.getAccountModal()
		) {
			modalStateManager.destroyOrganizationModal()
			await handleSwitchAccount({
				magicId: data.userInfo.magic_id,
				magicUserId: data.userInfo.user_id,
				magicOrganizationCode: data.magicOrganizationCode,
			})
			modalStateManager.removeEventFromQueue(eventId)
		}
		// 条件4：其他情况（状态已同步或无效）
		else {
			modalStateManager.destroyOrganizationModal()
			modalStateManager.removeEventFromQueue(eventId)
		}
	} catch (error) {
		logger.error("SWITCH_ORGANIZATION", error)
		// 错误恢复：清理资源
		try {
			modalStateManager.destroyOrganizationModal()
			modalStateManager.clearPendingOperation()
			modalStateManager.removeEventFromQueue(eventId)
		} catch (cleanupError) {
			logger.error("SWITCH_ORGANIZATION cleanup error", cleanupError)
		}
	}
}

// 切换组织
eventFactory.on(EVENTS.SWITCH_ORGANIZATION, handleSwitchOrganization)

// 更新组织红点
eventFactory.on(
	EVENTS.UPDATE_ORGANIZATION_DOT,
	(data: { magicId: string; organizationCode: string; count: number; seqId?: string }) => {
		OrganizationDispatchService.updateOrganizationDot(data)
	},
)

// 更新组织
eventFactory.on(EVENTS.UPDATE_ORGANIZATION, (data) => {
	// console.log("UPDATE_ORGANIZATION", data)
})

/**
 * @description 切换账号
 * @param data
 */
async function handleSwitchAccount(data: {
	magicId: string
	magicUserId: string
	magicOrganizationCode: string
}) {
	// 【日志追踪】记录事件处理开始
	const currentState = getLatestState()
	const modalStateManager = ModalStateManager.getInstance()
	const pendingOperation = modalStateManager.getPendingOperation()

	logger.log("🔄 SWITCH_ACCOUNT: 事件处理开始", {
		target: {
			magicId: data.magicId,
			userId: data.magicUserId,
			organizationCode: data.magicOrganizationCode,
		},
		current: {
			magicId: currentState.currentUserInfo?.magic_id,
			userId: currentState.currentUserInfo?.user_id,
			organizationCode: currentState.currentOrganizationCode,
		},
		pending: pendingOperation
			? {
					type: pendingOperation.type,
					targetMagicId:
						pendingOperation.type === "organization"
							? pendingOperation.data.userInfo?.magic_id
							: pendingOperation.data.magicId,
					targetOrgCode: pendingOperation.data.magicOrganizationCode,
					age: Date.now() - pendingOperation.timestamp,
				}
			: null,
		accountsCount: currentState.accounts.length,
		timestamp: new Date().toISOString(),
	})

	const eventId = generateEventId("account", data.magicId, data.magicOrganizationCode)

	try {
		// 事件去重：检查是否已有相同事件在处理
		const existingEvent = modalStateManager.getEventFromQueue(eventId)
		if (existingEvent && Date.now() - existingEvent.timestamp < 1000) {
			logger.log("SWITCH_ACCOUNT: 事件去重，忽略重复事件", { eventId })
			return
		}

		// 创建待处理操作
		const pendingOperation = {
			type: "account" as const,
			data: {
				magicId: data.magicId,
				magicUserId: data.magicUserId,
				magicOrganizationCode: data.magicOrganizationCode,
			},
			timestamp: Date.now(),
			eventId,
		}

		modalStateManager.addEventToQueue(eventId, pendingOperation)

		const state = getLatestState()
		const currentUserInfo = state.currentUserInfo

		// 如果当前账号不存在，则直接切换
		const account = currentUserInfo
			? userStore.account.getAccountByMagicId(currentUserInfo?.magic_id)
			: null
		const newAccount = userStore.account.getAccountByMagicId(data?.magicId)
		if (!account && newAccount) {
			await UserDispatchService.switchAccount({
				magicId: data.magicId,
				magicOrganizationCode: data.magicOrganizationCode,
			})
			modalStateManager.destroyAccountModal()
			handleRouteRedirect(newAccount)
			modalStateManager.removeEventFromQueue(eventId)
			return
		}

		if (currentUserInfo && currentUserInfo.magic_id !== data.magicId) {
			modalStateManager.destroyAccountModal()
			modalStateManager.cleanupAccountReaction()

			// 订阅当前用户信息的变更，当且仅当当前账号被删除下触发（在其他tab被删除当前账号信息场景），则关闭切换账号弹窗，默认选择其他tab中正在使用的账号
			const cancel = reaction(
				() => userStore.account.accounts.length,
				async () => {
					const magicIds = new Set(userStore.account.accounts.map((o) => o.magic_id))
					if (!magicIds.has(currentUserInfo.magic_id)) {
						await UserDispatchService.switchAccount({
							magicId: data.magicId,
							magicOrganizationCode: data.magicOrganizationCode,
						})
						modalStateManager.destroyAccountModal()
						modalStateManager.cleanupAccountReaction()
						modalStateManager.clearPendingOperation()
						modalStateManager.removeEventFromQueue(eventId)
						cancel?.()
					}
				},
			)

			modalStateManager.setAccountReactionCancel(cancel)

			// 验证操作是否仍然有效
			const validationResult = validateSwitchOperation(pendingOperation)
			if (!validationResult.isValid) {
				logger.warn("SWITCH_ACCOUNT: 操作验证失败", validationResult.reason)
				modalStateManager.cleanupAccountReaction()
				modalStateManager.removeEventFromQueue(eventId)
				return
			}

			const modal = MagicModal.confirm({
				title: t("broadcastChannel.account.title", { ns: "common" }),
				content: t("broadcastChannel.account.content", { ns: "common" }),
				okText: t("broadcastChannel.account.confirm", { ns: "common" }),
				cancelText: t("broadcastChannel.account.cancel", { ns: "common" }),
				centered: true,
				onOk: async () => {
					// 重新获取最新状态并验证
					const latestState = getLatestState()
					const latestValidation = validateSwitchOperation(pendingOperation)

					if (!latestValidation.isValid) {
						logger.warn("SWITCH_ACCOUNT onOk: 操作验证失败", latestValidation.reason)
						modalStateManager.destroyAccountModal()
						modalStateManager.cleanupAccountReaction()
						modalStateManager.clearPendingOperation()
						modalStateManager.removeEventFromQueue(eventId)
						return
					}

					// 检查目标账号是否仍然存在
					const targetAccountExists = latestState.accounts.some(
						(acc) => acc.magic_id === data.magicId,
					)

					if (!targetAccountExists) {
						logger.warn("SWITCH_ACCOUNT onOk: 目标账号不存在")
						modalStateManager.destroyAccountModal()
						modalStateManager.cleanupAccountReaction()
						modalStateManager.clearPendingOperation()
						modalStateManager.removeEventFromQueue(eventId)
						return
					}

					await UserDispatchService.switchAccount({
						magicId: data.magicId,
						magicOrganizationCode: data.magicOrganizationCode,
					})
					modalStateManager.destroyAccountModal()
					modalStateManager.cleanupAccountReaction()
					modalStateManager.clearPendingOperation()
					modalStateManager.removeEventFromQueue(eventId)

					handleRouteRedirect(newAccount || null)
				},
				onCancel: () => {
					const latestState = getLatestState()
					if (latestState.currentUserInfo) {
						BroadcastChannelSender.switchAccount({
							magicId: latestState.currentUserInfo.magic_id,
							magicUserId: latestState.currentUserInfo.user_id,
							magicOrganizationCode: latestState.currentUserInfo.organization_code,
						})
					}
					modalStateManager.destroyAccountModal()
					modalStateManager.cleanupAccountReaction()
					modalStateManager.clearPendingOperation()
					modalStateManager.removeEventFromQueue(eventId)
				},
			})

			modalStateManager.setAccountModal(modal)
			modalStateManager.setPendingOperation(pendingOperation)
		}
		// 先切换到跨账号，再跨回来当前账号下的其他组织，需要执行切换组织的逻辑
		else if (
			currentUserInfo &&
			currentUserInfo.organization_code !== data.magicOrganizationCode
		) {
			modalStateManager.destroyAccountModal()

			const userInfo = await ContactApi.getAccountUserInfo({
				organization_code: data.magicOrganizationCode,
			})

			if (userInfo) {
				await handleSwitchOrganization({
					userInfo: userTransformer(userInfo),
					magicOrganizationCode: data.magicOrganizationCode,
				})
			}
			modalStateManager.removeEventFromQueue(eventId)
		} else {
			modalStateManager.destroyAccountModal()
			modalStateManager.removeEventFromQueue(eventId)
		}
	} catch (error) {
		logger.error("SWITCH_ACCOUNT", error)
		// 错误恢复：清理资源
		try {
			modalStateManager.destroyAccountModal()
			modalStateManager.cleanupAccountReaction()
			modalStateManager.clearPendingOperation()
			modalStateManager.removeEventFromQueue(eventId)
		} catch (cleanupError) {
			logger.error("SWITCH_ACCOUNT cleanup error", cleanupError)
		}
	}
}

// 切换账号
eventFactory.on(EVENTS.SWITCH_ACCOUNT, handleSwitchAccount)

// 更新用户信息
eventFactory.on(EVENTS.UPDATE_USER_INFO, (data: { userInfo: User.UserInfo }) => {
	try {
		UserDispatchService.updateUserInfo(data)
	} catch (error) {
		logger.error("UPDATE_USER_INFO error", error)
	}
})

// 添加账号
eventFactory.on(EVENTS.ADD_ACCOUNT, async (data: { userAccount: User.UserAccount }) => {
	try {
		const modalStateManager = ModalStateManager.getInstance()
		const pendingOperation = modalStateManager.getPendingOperation()
		const newAccountMagicId = data.userAccount.magic_id

		// Check if account already exists to avoid re-initialization
		const existingAccount = userStore.account.getAccountByMagicId(newAccountMagicId)
		const accountAlreadyExists = !!existingAccount

		if (accountAlreadyExists) {
			logger.log("ADD_ACCOUNT: 账号已存在，使用更新逻辑而非添加", {
				magicId: newAccountMagicId,
			})

			// Update existing account instead of adding
			UserDispatchService.updateAccount({
				magicId: newAccountMagicId,
				userAccount: data.userAccount,
			})

			// If there's a pending operation, update its timestamp
			if (pendingOperation) {
				if (pendingOperation.type === "organization") {
					const targetMagicId = pendingOperation.data.userInfo?.magic_id
					if (targetMagicId === newAccountMagicId) {
						modalStateManager.updatePendingOperation({
							...pendingOperation,
							timestamp: Date.now(),
						})
						logger.log("ADD_ACCOUNT: 更新组织切换待处理操作的时间戳")
					}
				} else if (pendingOperation.type === "account") {
					const targetMagicId = pendingOperation.data.magicId
					if (targetMagicId === newAccountMagicId) {
						modalStateManager.updatePendingOperation({
							...pendingOperation,
							timestamp: Date.now(),
						})
						logger.log("ADD_ACCOUNT: 更新账号切换待处理操作的时间戳")
					}
				}
			}

			return
		}

		// 如果当前有组织切换弹窗打开
		if (pendingOperation?.type === "organization") {
			const targetMagicId = pendingOperation.data.userInfo?.magic_id

			// 检查目标账号是否在新添加的账号列表中
			if (targetMagicId === newAccountMagicId) {
				// 目标账号已添加，重新验证操作有效性
				const validationResult = validateSwitchOperation(pendingOperation)

				if (validationResult.isValid) {
					// 更新待处理操作的时间戳
					modalStateManager.updatePendingOperation({
						...pendingOperation,
						timestamp: Date.now(),
					})
					logger.log("ADD_ACCOUNT: 目标账号已添加，保持组织切换弹窗")
				} else {
					// 验证失败，检查当前账号是否已变化
					const currentUserInfo = userStore.user.userInfo
					if (currentUserInfo && currentUserInfo.magic_id !== targetMagicId) {
						// 当前账号已变化，关闭组织弹窗，显示账号切换弹窗
						modalStateManager.destroyOrganizationModal()
						modalStateManager.clearPendingOperation()

						// 调用 handleSwitchAccount 显示账号切换弹窗
						if (
							targetMagicId &&
							pendingOperation.data.userInfo &&
							pendingOperation.data.magicOrganizationCode
						) {
							handleSwitchAccount({
								magicId: targetMagicId,
								magicUserId: pendingOperation.data.userInfo.user_id,
								magicOrganizationCode: pendingOperation.data.magicOrganizationCode,
							})
						}
						logger.log("ADD_ACCOUNT: 当前账号已变化，切换到账号切换弹窗")
					} else {
						// 其他原因导致验证失败，关闭弹窗
						modalStateManager.destroyOrganizationModal()
						modalStateManager.clearPendingOperation()
						logger.warn("ADD_ACCOUNT: 操作验证失败，关闭组织切换弹窗")
					}
				}
			} else {
				// 目标账号不在新添加的账号列表中
				// 新添加的账号与组织切换的目标账号不同，应该关闭组织切换弹窗，显示账号切换弹窗
				const currentUserInfo = userStore.user.userInfo
				if (
					currentUserInfo &&
					currentUserInfo.magic_id !== newAccountMagicId &&
					userStore.account.accounts.some(
						(acc) => acc.magic_id === currentUserInfo.magic_id,
					)
				) {
					// 关闭组织切换弹窗
					modalStateManager.destroyOrganizationModal()
					modalStateManager.clearPendingOperation()
					// 先添加账号到列表，以便 handleSwitchAccount 的验证逻辑能够通过
					userStore.account.setAccount(data.userAccount)
					logger.log(
						"ADD_ACCOUNT: 新账号与组织切换目标账号不同，关闭组织切换弹窗，显示账号切换弹窗",
					)
					await handleSwitchAccount({
						magicId: newAccountMagicId,
						magicUserId: data.userAccount.magic_user_id,
						magicOrganizationCode: data.userAccount.organizationCode,
					})
					// 注意：这里不执行 UserDispatchService.addAccount，因为已经手动添加了账号
					// 且 handleSwitchAccount 会处理切换逻辑（显示弹窗或直接切换）
					return
				} else {
					// 保持组织切换弹窗，但仍需添加账号
					logger.log("ADD_ACCOUNT: 目标账号不在新添加的账号列表中，保持组织切换弹窗")
				}
			}
		}

		// 如果当前有账号切换弹窗打开
		if (pendingOperation?.type === "account") {
			const targetMagicId = pendingOperation.data.magicId

			// 检查新添加的账号是否是目标账号
			if (targetMagicId === newAccountMagicId) {
				// 更新待处理操作的时间戳
				modalStateManager.updatePendingOperation({
					...pendingOperation,
					timestamp: Date.now(),
				})
				logger.log("ADD_ACCOUNT: 目标账号已添加，保持账号切换弹窗")
			} else {
				// 新添加的账号不是目标账号，应该关闭当前弹窗，显示新的账号切换弹窗
				const currentUserInfo = userStore.user.userInfo
				if (
					currentUserInfo &&
					currentUserInfo.magic_id !== newAccountMagicId &&
					userStore.account.accounts.some(
						(acc) => acc.magic_id === currentUserInfo.magic_id,
					)
				) {
					// 关闭当前账号切换弹窗
					modalStateManager.destroyAccountModal()
					modalStateManager.cleanupAccountReaction()
					modalStateManager.clearPendingOperation()
					// 先添加账号到列表，以便 handleSwitchAccount 的验证逻辑能够通过
					userStore.account.setAccount(data.userAccount)
					logger.log(
						"ADD_ACCOUNT: 新账号与当前目标账号不同，关闭当前弹窗，显示新的账号切换弹窗",
					)
					await handleSwitchAccount({
						magicId: newAccountMagicId,
						magicUserId: data.userAccount.magic_user_id,
						magicOrganizationCode: data.userAccount.organizationCode,
					})
					// 注意：这里不执行 UserDispatchService.addAccount，因为已经手动添加了账号
					// 且 handleSwitchAccount 会处理切换逻辑（显示弹窗或直接切换）
					return
				}
			}
		}

		// 如果当前没有待处理操作，且新添加的账号与当前账号不同，应该显示账号切换弹窗
		if (!pendingOperation) {
			const currentUserInfo = userStore.user.userInfo

			// 检查新添加的账号是否与当前账号不同
			if (
				currentUserInfo &&
				currentUserInfo.magic_id !== newAccountMagicId &&
				userStore.account.accounts.some((acc) => acc.magic_id === currentUserInfo.magic_id)
			) {
				// 当前账号存在且与新添加的账号不同，显示账号切换弹窗
				// 先添加账号到列表，以便 handleSwitchAccount 的验证逻辑能够通过
				userStore.account.setAccount(data.userAccount)
				logger.log("ADD_ACCOUNT: 新账号与当前账号不同，显示账号切换弹窗")
				await handleSwitchAccount({
					magicId: newAccountMagicId,
					magicUserId: data.userAccount.magic_user_id,
					magicOrganizationCode: data.userAccount.organizationCode,
				})
				// 注意：这里不执行 UserDispatchService.addAccount，因为已经手动添加了账号
				// 且 handleSwitchAccount 会处理切换逻辑（显示弹窗或直接切换）
				return
			}
		}

		// 执行原有的添加账号逻辑
		UserDispatchService.addAccount(data)
	} catch (error) {
		logger.error("ADD_ACCOUNT error", error)
		// 不中断流程，继续执行原有逻辑
		try {
			UserDispatchService.addAccount(data)
		} catch (fallbackError) {
			logger.error("ADD_ACCOUNT fallback error", fallbackError)
		}
	}
})

// 更新账号
eventFactory.on(
	EVENTS.UPDATE_ACCOUNT,
	(data: { magicId: string; userAccount: Partial<User.UserAccount> }) => {
		try {
			UserDispatchService.updateAccount(data)
		} catch (error) {
			logger.error("UPDATE_ACCOUNT error", error)
		}
	},
)

// 删除账号
eventFactory.on(
	EVENTS.DELETE_ACCOUNT,
	async (data: { magicId?: string; navigateToLogin?: boolean }) => {
		try {
			const modalStateManager = ModalStateManager.getInstance()
			const pendingOperation = modalStateManager.getPendingOperation()
			const currentUserInfo = userStore.user.userInfo
			const accounts = userStore.account.accounts
			const deletedMagicId = data.magicId

			// 场景1：删除当前账号（data.magicId === undefined 或 data.magicId === currentUserInfo.magic_id）
			const isCurrentAccountDeleted =
				!deletedMagicId || (currentUserInfo && currentUserInfo.magic_id === deletedMagicId)

			if (isCurrentAccountDeleted) {
				// 如果存在账号切换弹窗，应该强制切换到目标账号
				if (pendingOperation?.type === "account") {
					const targetMagicId = pendingOperation.data.magicId
					const targetOrganizationCode = pendingOperation.data.magicOrganizationCode

					// 检查目标账号是否仍然存在
					const targetAccountExists = accounts.some(
						(acc) => acc.magic_id === targetMagicId,
					)

					if (targetAccountExists && targetMagicId && targetOrganizationCode) {
						// 强制切换到目标账号
						logger.log(
							"DELETE_ACCOUNT: 当前账号已删除，强制切换到目标账号",
							targetMagicId,
						)
						await UserDispatchService.switchAccount({
							magicId: targetMagicId,
							magicOrganizationCode: targetOrganizationCode,
						})
						// 清理弹窗和资源
						modalStateManager.destroyAccountModal()
						modalStateManager.cleanupAccountReaction()
						modalStateManager.clearPendingOperation()
						// 执行原有的删除账号逻辑
						UserDispatchService.deleteAccount(data)
						return
					}
					// 如果目标账号不存在，清理所有弹窗和资源
					else {
						modalStateManager.destroyAccountModal()
						modalStateManager.cleanupAccountReaction()
						modalStateManager.clearPendingOperation()
					}
				}
				// 如果存在组织切换弹窗，也应该清理
				else if (pendingOperation?.type === "organization") {
					modalStateManager.destroyOrganizationModal()
					modalStateManager.clearPendingOperation()
				}

				// 关闭所有弹窗
				modalStateManager.destroyOrganizationModal()
				modalStateManager.destroyAccountModal()

				// 清理所有资源
				modalStateManager.cleanup()

				// 如果账号列表为空
				if (accounts.length === 0) {
					modalStateManager.reset()
					logger.log("DELETE_ACCOUNT: 账号列表为空，已清理所有弹窗和资源")
				} else {
					logger.log("DELETE_ACCOUNT: 当前账号已删除，已清理所有弹窗和资源")
				}
			}
			// 场景2：删除目标账号
			else if (pendingOperation) {
				let isTargetAccountDeleted = false

				if (pendingOperation.type === "organization") {
					const targetMagicId = pendingOperation.data.userInfo?.magic_id
					isTargetAccountDeleted = targetMagicId === deletedMagicId

					if (isTargetAccountDeleted) {
						// 检查目标账号是否真的被删除
						const targetAccountExists = accounts.some(
							(acc) => acc.magic_id === targetMagicId,
						)

						if (!targetAccountExists) {
							modalStateManager.destroyOrganizationModal()
							modalStateManager.clearPendingOperation()
							logger.log("DELETE_ACCOUNT: 目标账号已删除，关闭组织切换弹窗")
						}
					}
				} else if (pendingOperation.type === "account") {
					const targetMagicId = pendingOperation.data.magicId
					isTargetAccountDeleted = targetMagicId === deletedMagicId

					if (isTargetAccountDeleted) {
						// 检查目标账号是否真的被删除
						const targetAccountExists = accounts.some(
							(acc) => acc.magic_id === targetMagicId,
						)

						if (!targetAccountExists) {
							modalStateManager.destroyAccountModal()
							modalStateManager.cleanupAccountReaction()
							modalStateManager.clearPendingOperation()
							logger.log("DELETE_ACCOUNT: 目标账号已删除，关闭账号切换弹窗")
						}
					}
				}

				// 场景3：删除其他账号（不影响当前操作）
				if (!isTargetAccountDeleted) {
					logger.log("DELETE_ACCOUNT: 删除的账号不影响当前操作")
				}
			}

			// 执行原有的删除账号逻辑
			UserDispatchService.deleteAccount(data)
		} catch (error) {
			logger.error("DELETE_ACCOUNT error", error)
			// 确保资源清理
			try {
				const modalStateManager = ModalStateManager.getInstance()
				modalStateManager.cleanup()
			} catch (cleanupError) {
				logger.error("DELETE_ACCOUNT cleanup error", cleanupError)
			}
			// 继续执行原有逻辑
			try {
				UserDispatchService.deleteAccount(data)
			} catch (fallbackError) {
				logger.error("DELETE_ACCOUNT fallback error", fallbackError)
			}
		}
	},
)

// 国际化语言切换
eventFactory.on(EVENTS.SWITCH_LANGUAGE, (data: Config.LanguageValue) => {
	service.get<ConfigService>("configService").setLanguage(data)
	import("@/opensource/lib/dayjs").then((module) => {
		module.switchLanguage?.(data)
	})
})

import "./callbacks/others"

export default eventFactory
