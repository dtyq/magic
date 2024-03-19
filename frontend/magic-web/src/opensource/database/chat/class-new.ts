import { platformKey } from "@/opensource/utils/storage"
import Dexie from "dexie"
import { ChatDb } from "./types"

export const ChatDbSchemaStorageKey = (magicId: string) => platformKey(`chat-db-schema/${magicId}`)

/**
 * 聊天数据库
 */
class ChatDatabase {
	db: ChatDb | null = null

	magicId: string | undefined

	private isAvailable: boolean = true

	constructor() {
		try {
			this.db = new Dexie(this.getLocalSchemaKey("default")) as ChatDb
			const { version, schema } = this.getLocalDbSchema("default")
			this.db.version(version).stores(schema)
			this.checkAvailability()
		} catch (error) {
			console.warn("IndexedDB initialization failed:", error)
			this.isAvailable = false
			this.db = null
		}
	}

	/**
	 * Check if IndexedDB is available and working
	 */
	private async checkAvailability() {
		if (!this.db) {
			this.isAvailable = false
			return
		}

		try {
			const fn = async () => {
				await this.db?.open()
			}
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error("indexedDB connection failed"))
				}, 5000)
			})
			await Promise.race([fn(), timeoutPromise])
			// Try to perform a simple operation to verify DB is working
			this.isAvailable = true
		} catch (error) {
			console.warn("IndexedDB availability check failed:", error)
			this.isAvailable = false
			this.db = null
		}
	}

	/**
	 * Check if database is available
	 */
	isDbAvailable(): boolean {
		return this.isAvailable && this.db !== null
	}

	/**
	 * Retry database initialization
	 */
	async retryInitialization(): Promise<boolean> {
		try {
			if (!this.magicId) {
				console.warn("Cannot retry initialization without magicId")
				return false
			}

			this.db = new Dexie(this.getLocalSchemaKey(this.magicId)) as ChatDb
			const { version, schema } = this.getLocalDbSchema(this.magicId)
			this.db.version(version).stores(schema)
			await this.checkAvailability()
			return this.isAvailable
		} catch (error) {
			console.warn("Database retry initialization failed:", error)
			this.isAvailable = false
			this.db = null
			return false
		}
	}

	/**
	 * Get database status information
	 */
	getStatus() {
		return {
			isAvailable: this.isAvailable,
			hasDb: this.db !== null,
			magicId: this.magicId,
		}
	}

	switchDb(magicId: string) {
		try {
			this.magicId = magicId
			this.db = new Dexie(this.getLocalSchemaKey(magicId)) as ChatDb
			const { version, schema } = this.getLocalDbSchema(magicId)
			this.db.version(version).stores(schema)
			this.checkAvailability()
		} catch (error) {
			console.warn(`Failed to switch database for magicId: ${magicId}`, error)
			this.isAvailable = false
			this.db = null
		}
	}

	/**
	 * 更新数据库 schema
	 * @param schemaChanges 数据库 schema 变更
	 * @returns
	 */
	async changeSchema(schemaChanges: Record<string, string>) {
		if (!this.isDbAvailable() || !this.magicId) return undefined

		try {
			const oldDb = this.db
			if (!oldDb) throw new Error("Database instance is null")
			const newDb = new Dexie(oldDb.name)

			newDb.on("blocked", () => false)

			// Workaround: If DB is empty from tables, it needs to be recreated
			if (oldDb.tables.length === 0) {
				await oldDb.delete()
				newDb.version(1).stores(schemaChanges)
				return (await newDb.open()) as ChatDb
			}

			// Extract current schema in dexie format:
			const currentSchema = oldDb.tables.reduce((result, { name, schema }) => {
				// @ts-ignore
				result[name] = [
					`&${schema.primKey.src}`,
					...schema.indexes.map((idx) => idx.src),
				].join(", ")
				return result
			}, {})

			// 保存旧的数据库引用，以便回滚
			const previousDb = oldDb

			try {
				// Tell Dexie about current schema:
				newDb.version(previousDb.verno).stores(currentSchema)
				// Tell Dexie about next schema:
				newDb.version(previousDb.verno + 1).stores({
					...currentSchema,
					...schemaChanges,
				})

				// 先尝试打开新数据库
				await newDb.open()

				// 成功后再关闭旧数据库
				oldDb.close()

				// set schema
				this.setLocalDbSchema(
					{
						version: previousDb.verno + 1,
						schema: {
							...currentSchema,
							...schemaChanges,
						},
					},
					this.magicId,
				)

				this.db = newDb as ChatDb
				return this.db
			} catch (error) {
				// 如果升级失败，关闭新数据库并保持使用旧数据库
				await newDb.close()
				throw error
			}
		} catch (error) {
			console.error("Schema change failed:", error)
			this.isAvailable = false
			this.db = null
			throw new Error("Failed to update database schema")
		}
	}

	/**
	 * 本地数据库 schema 的 key
	 */
	getLocalSchemaKey(magicId: string) {
		return ChatDbSchemaStorageKey(magicId)
	}

	get defaultSchema() {
		return {
			conversation: "&id, user_organization_code",
			conversation_dots: "&conversation_id",
			organization_dots: "&organization_code",
			topic_dots: "&conversation_topic_id",
			pending_messages: "&message_id",
			disband_group_unconfirm: "&conversation_id",
			file_urls: "&file_id",
			current_conversation_id: "&organization_code",
			record_summary_message_queue: "&send_time",
			text_avatar_cache: "&text",
			topic_list: "&conversation_id",
			editor_draft: "&key, topic_id, conversation_id",
			knowledge_file_urls: "&file_key, expires, cached_at",
		}
	}

	/**
	 * 获取消息表的默认schema
	 * @param conversationId 会话ID
	 * @returns 消息表schema
	 */
	getMessageTableSchema() {
		return `&seq_id, message.topic_id, [message.topic_id+message.send_time], message.send_time, message.type, [message.type+message.topic_id], message.magic_message_id`
	}

	/**
	 * 获取本地数据库的 schema
	 * @returns
	 */
	getLocalDbSchema(magicId: string) {
		return JSON.parse(
			localStorage.getItem(this.getLocalSchemaKey(magicId)) ||
				JSON.stringify({ version: 1, schema: this.defaultSchema }),
		)
	}

	/**
	 * 缓存本地数据库的 schema，用于下次打开时恢复
	 * @param schema
	 */
	setLocalDbSchema(schema: { version: number; schema: Record<string, string> }, magicId: string) {
		localStorage.setItem(this.getLocalSchemaKey(magicId), JSON.stringify(schema))
	}

	/**
	 * 获取会话表
	 * @returns 会话表
	 */
	getConversationTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.conversation) {
			try {
				this.changeSchema({
					conversation: this.defaultSchema.conversation,
				})
			} catch (error) {
				console.warn("Failed to create conversation table:", error)
				return undefined
			}
		}
		return this.db?.conversation
	}

	getTopicListTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.topic_list) {
			try {
				this.changeSchema({
					topic_list: this.defaultSchema.topic_list,
				})
			} catch (error) {
				console.warn("Failed to create topic_list table:", error)
				return undefined
			}
		}
		return this.db?.topic_list
	}

	getFileUrlsTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.file_urls) {
			try {
				this.changeSchema({
					file_urls: this.defaultSchema.file_urls,
				})
			} catch (error) {
				console.warn("Failed to create file_urls table:", error)
				return undefined
			}
		}
		return this.db?.file_urls
	}

	getTextAvatarTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.text_avatar_cache) {
			try {
				this.changeSchema({
					text_avatar_cache: "&text",
				})
			} catch (error) {
				console.warn("Failed to create text_avatar_cache table:", error)
				return undefined
			}
		}
		return this.db?.text_avatar_cache
	}

	getEditorDraftTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.editor_draft) {
			try {
				this.changeSchema({
					editor_draft: this.defaultSchema.editor_draft,
				})
			} catch (error) {
				console.warn("Failed to create editor_draft table:", error)
				return undefined
			}
		}
		return this.db?.editor_draft
	}

	/**
	 * 获取消息表的表名
	 * @param conversationId 会话ID
	 * @returns 消息表表名
	 */
	getMessageTableName(conversationId: string) {
		return `conversation_message/${conversationId}`
	}

	/**
	 * 获取待发送消息表
	 * @returns 待发送消息表
	 */
	getPendingMessagesTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.pending_messages) {
			try {
				this.changeSchema({
					pending_messages: this.defaultSchema.pending_messages,
				})
			} catch (error) {
				console.warn("Failed to create pending_messages table:", error)
				return undefined
			}
		}
		return this.db?.pending_messages
	}

	/**
	 * 创建消息表
	 * @param conversationId 会话ID
	 * @returns 消息表
	 */
	async createMessageTable(conversationId: string) {
		const tableName = this.getMessageTableName(conversationId)

		if (!this.isDbAvailable()) {
			return undefined
		}

		try {
			return this.db?.table(tableName)
		} catch (err) {
			// 表不存在，创建表
			const schema = {
				[tableName]: this.getMessageTableSchema(),
			}

			await this.changeSchema(schema)
			return this.db?.table(tableName)
		}
	}

	/**
	 * 获取消息表
	 * @param conversationId 会话ID
	 * @returns 消息表
	 */
	getMessageTable(conversationId: string) {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.table(this.getMessageTableName(conversationId))) {
			try {
				this.createMessageTable(conversationId)
			} catch (error) {
				console.warn("Failed to create message table:", error)
				return undefined
			}
		}
		return this.db?.table(this.getMessageTableName(conversationId))
	}

	/**
	 * 获取录音总结消息队列表
	 * @returns 录音总结消息队列表
	 */
	getRecordSummaryMessageQueueTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.record_summary_message_queue) {
			return undefined
		}
		return this.db?.record_summary_message_queue
	}

	getKnowledgeFileUrlsTable() {
		if (!this.isDbAvailable()) return undefined

		if (!this.db?.knowledge_file_urls) {
			return undefined
		}
		return this.db?.knowledge_file_urls
	}
}

export default ChatDatabase
