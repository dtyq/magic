import type { Collection, Table, UpdateSpec } from "dexie"
import { Dexie } from "dexie"
import type { SeqResponse } from "@/types/request"
import {
	ConversationMessageStatus,
	type ConversationMessage,
	type ConversationMessageSend,
	type SendStatus,
} from "@/types/chat/conversation_message"
import type { CMessage } from "@/types/chat"
import type { SeenMessage } from "@/types/chat/seen_message"
import { logger as Logger } from "@/utils/log"
import chatDb from "@/database/chat"

const logger = Logger.createLogger("MessageDbService")

class MessageDbService {
	/**
	 * 获取待发送消息表
	 * @returns 待发送消息表
	 */
	private getPendingMessagesTable() {
		return chatDb.getPendingMessagesTable()
	}

	/**
	 * 创建消息表
	 * @param conversationId 会话ID
	 * @returns 消息表
	 */
	async createMessageTable(conversationId: string) {
		return chatDb.createMessageTable(conversationId)
	}

	/**
	 * 批量创建消息表
	 * @param conversationIds 会话ID
	 */
	async createMessageTables(conversationIds: string[]) {
		await chatDb.changeSchema(
			conversationIds.reduce(
				(acc, id) => {
					acc[chatDb.getMessageTableName(id)] = chatDb.getMessageTableSchema()
					return acc
				},
				{} as Record<string, string>,
			),
		)
	}

	/**
	 * 获取消息表
	 * @param conversationId 会话ID
	 * @returns 消息表
	 */
	async getMessageTable(conversationId: string) {
		try {
			const table = chatDb.getMessageTable(conversationId)
			return table as Table<SeqResponse<ConversationMessage>>
		} catch (err) {
			// 尝试创建表
			try {
				const t = await this.createMessageTable(conversationId)
				return t
			} catch (createErr) {
				// 如果创建失败，可能是索引问题，尝试重建索引
				logger.warn(`创建消息表失败，尝试重建索引: ${conversationId}`, createErr)
				throw new Error("创建消息表失败")
				// await this.rebuildMessageTableIndex(conversationId)

				// // 重新获取表
				// return ChatBusiness.getChatDb().table(tableName) as Table<
				// 	SeqResponse<ConversationMessage>
				// >
			}
		}
	}

	/**
	 * 添加消息
	 * @param conversationId 会话ID
	 * @param message 消息
	 */
	async addMessage(conversationId: string, message: SeqResponse<CMessage>) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			table
				.put(message)
				.then((res) => {
					logger.log("addMessage success", res)
				})
				.catch((err) => {
					logger.error("addMessage error", err)
					throw err
				})
		}
	}

	/**
	 * 添加多条消息
	 * @param conversationId 会话ID
	 * @param messages 消息列表
	 */
	public async addMessages(conversationId: string, messages: SeqResponse<CMessage>[]) {
		try {
			const tableName = chatDb.getMessageTableName(conversationId)
			await this.createMessageTable(tableName)

			const messageList = messages.map((message) => ({
				...message,
				conversation_id: conversationId,
			}))

			const table = await this.getMessageTable(conversationId)
			if (!table) {
				throw new Error("Failed to get message table")
			}

			await Promise.all(messageList.map((message) => table.add(message).catch()))
			return { success: true, count: messageList.length }
		} catch (error) {
			// 记录错误信息
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: errorMessage }
		}
	}

	/**
	 * 获取会话消息分页
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param page 页码
	 * @param pageSize 每页数量
	 * @returns 消息分页
	 */
	async getMessagesByPage(
		conversationId: string,
		topicId: string = "",
		page: number = 1,
		pageSize: number = 10,
	) {
		const table = await this.getMessageTable(conversationId)

		if (!table) {
			return {
				messages: [],
				total: 0,
				page,
				pageSize,
				totalPages: 1,
			}
		}

		// 使用复合索引优化查询性能
		const query = table
			.where("[message.topic_id+message.send_time]")
			.between([topicId, Dexie.minKey], [topicId, Dexie.maxKey])
			// 过滤本地删除的消息
			.filter((message) => !message.message.is_local_deleted)

		// 获取总数
		const total = await query.count()

		// 计算偏移量
		const offset = (page - 1) * pageSize

		// 获取分页数据
		const messages = await query
			.reverse() // 按时间倒序
			.offset(offset)
			.limit(pageSize)
			.toArray()

		return {
			messages,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		}
	}

	/**
	 * 获取会话消息(不分页)
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @returns 消息
	 */
	async getMessages(conversationId: string, topicId: string = "") {
		const rows = await this.getMessageList(conversationId, topicId)
		logger.log("rows ====> ", rows)
		return rows?.toArray() ?? []
	}

	/**
	 * 删除消息
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 */
	async removeMessage(conversationId: string, messageId: string) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			table.delete(messageId)
		}
	}

	/**
	 * 获取会话消息列表
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @returns 消息列表
	 */
	private async getMessageList(
		conversationId: string,
		topicId: string = "",
	): Promise<Collection<any> | undefined> {
		try {
			const table = await this.getMessageTable(conversationId)

			if (!table) {
				return undefined
			}

			try {
				if (topicId) {
					// 使用复合索引优化查询性能
					return table
						.where("[message.topic_id+message.send_time]")
						.between([topicId, Dexie.minKey], [topicId, Dexie.maxKey])
				}
				// 使用复合索引优化查询性能
				return table
					.where("[message.topic_id+message.send_time]")
					.between(["", Dexie.minKey], ["", Dexie.maxKey])
			} catch (indexError) {
				// 如果复合索引查询失败，回退到普通索引
				logger.error("使用复合索引查询失败，回退到普通索引", indexError)

				if (topicId) {
					return table.where("message.topic_id").equals(topicId)
				}
				return table.where("message.topic_id").equals("")
			}
		} catch (error) {
			// // 尝试处理索引错误
			// const handled = await this.handleIndexError(error, conversationId)

			// if (handled) {
			// 	// 如果成功处理了索引错误，重新尝试查询
			// 	return this.getMessages(conversationId, topicId)
			// }

			// 索引失败使用普通索引
			logger.error("数据库访问错误，无法获取消息", error)
			const table = await this.getMessageTable(conversationId)

			if (topicId) {
				return table?.where("message.topic_id").equals(topicId)
			}
			return table?.where("message.topic_id").equals("")
		}
	}

	/**
	 * 添加待发送消息
	 * @param message 待发送消息
	 * @returns 待发送消息ID
	 */
	async addPendingMessage(message: ConversationMessageSend) {
		const table = this.getPendingMessagesTable()
		if (!table) {
			throw new Error("Failed to get pending messages table")
		}
		return table.put(message)
	}

	/**
	 * 获取待发送消息
	 * @param messageId 消息ID
	 * @returns 待发送消息
	 */
	async getPendingMessage(messageId: string) {
		const table = this.getPendingMessagesTable()
		if (!table) {
			throw new Error("Failed to get pending messages table")
		}
		return table.get(messageId)
	}

	/**
	 * 删除待发送消息
	 * @param messageId 消息ID
	 * @returns 删除结果
	 */
	async deletePendingMessage(messageId: string) {
		const table = this.getPendingMessagesTable()
		if (!table) {
			throw new Error("Failed to get pending messages table")
		}
		return table.delete(messageId)
	}

	/**
	 * 更新待发送消息状态
	 * @param messageId 消息ID
	 * @param status 状态
	 * @returns 更新结果
	 */
	async updatePendingMessageStatus(
		messageId: string,
		status: SendStatus,
	): Promise<string | null> {
		const table = this.getPendingMessagesTable()
		if (!table) {
			throw new Error("Failed to get pending messages table")
		}
		// 先获取现有消息，然后更新状态
		const existingMessage = await table.get(messageId)
		if (existingMessage) {
			return table.put({
				...existingMessage,
				status,
			})
		}

		return null
	}

	/**
	 * 标记消息为已撤回
	 * @param messageId 消息ID
	 */
	async flagMessageRevoked(conversationId: string, messageId: string) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			const existingMessage = await table.get(messageId)
			if (existingMessage) {
				table.update(messageId, {
					"message.revoked": true,
				})
			}
		}
	}

	/**
	 * 更新消息
	 * @param conversationId 会话ID
	 * @param message 消息
	 */
	async replaceMessage(conversationId: string, message: SeqResponse<ConversationMessage>) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			table.update(message.message_id, message)
		}
	}

	/**
	 * 更新消息状态
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @param message 消息
	 */
	updateMessageStatus(
		conversationId: string,
		messageId: string,
		message: SeqResponse<SeenMessage>,
	) {
		this.getMessageTable(conversationId).then((table) => {
			if (table) {
				table
					.update(messageId, {
						"message.status":
							message.message.unread_count > 0
								? message.message.status
								: ConversationMessageStatus.Read,
						"message.unread_count": message.message.unread_count,
					})
					.then((res) => {
						logger.log("updateMessageStatus success", res)
					})
					.catch((err) => {
						logger.error("updateMessageStatus error", err)
					})
			}
		})
	}

	/**
	 * 更新消息未读数
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @param unreadCount 未读数
	 */
	updateMessageUnreadCount(conversationId: string, messageId: string, unreadCount: number) {
		this.getMessageTable(conversationId).then((table) => {
			if (table) {
				table
					.update(messageId, {
						"message.unread_count": unreadCount,
					})
					.then((res) => {
						logger.log("updateMessageUnreadCount success", res, messageId)
					})
					.catch((err) => {
						logger.error("updateMessageUnreadCount error", err)
					})
			}
		})
	}

	/**
	 * 更新消息
	 * @param localMessageId 消息ID
	 * @param conversation_id 会话ID
	 * @param changes 消息
	 */
	async updateMessage(
		localMessageId: string,
		conversation_id: string,
		changes: UpdateSpec<SeqResponse<ConversationMessage>>,
	) {
		const table = await this.getMessageTable(conversation_id)
		if (table) {
			table.update(localMessageId, changes).catch((err) => {
				logger.error("updateMessage error", err)
			})
		}
	}

	/**
	 * 删除话题消息
	 * @param conversationId 会话ID
	 * @param deleteTopicId 话题ID
	 */
	async removeTopicMessages(conversationId: string, deleteTopicId: string) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			table.where("message.topic_id").equals(deleteTopicId).delete()
		}
	}

	/**
	 * 获取消息
	 * @param conversationId 会话ID
	 * @param magicMessageId 消息ID
	 * @returns 消息
	 */
	async getMessageByMagicMessageId(conversationId: string, magicMessageId: string) {
		const table = await this.getMessageTable(conversationId)
		if (table) {
			return table.get({
				"message.magic_message_id": magicMessageId,
			})
		}
		return null
	}
}

export default MessageDbService
