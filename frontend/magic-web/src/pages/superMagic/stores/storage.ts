import Dexie from "dexie"

interface StorageValue {
	id: string
	value: object
}

export class DynamicDatabase extends Dexie {
	private registeredTables: Set<string> = new Set()
	private tableSchemas: Record<string, string> = {}
	private initialized = false

	constructor() {
		super("MAGIC:stream-record-db")
		this.version(1).stores({})
	}

	private async init(): Promise<void> {
		if (this.initialized) return

		await this.open()

		// 恢复已存在的表结构
		this.tables.forEach((table) => {
			const tableName = table.name
			this.registeredTables.add(tableName)
			this.tableSchemas[tableName] = "id"
		})

		this.initialized = true
	}

	async createTable(tableName: string): Promise<void> {
		await this.init()

		if (!tableName || typeof tableName !== "string") {
			throw new Error("表名必须是非空字符串")
		}

		if (this.registeredTables.has(tableName)) {
			return
		}

		const currentVersion = this.verno

		this.close()

		// 保留所有已存在的表定义，并添加新表
		this.tableSchemas[tableName] = "id"

		this.version(currentVersion + 1).stores(this.tableSchemas)

		await this.open()

		this.registeredTables.add(tableName)
		this.initialized = true
	}

	async addToTable(tableName: string, id: string, value: object): Promise<void> {
		await this.init()

		if (!tableName || typeof tableName !== "string") {
			throw new Error("表名必须是非空字符串")
		}

		if (!id || typeof id !== "string") {
			throw new Error("id必须是非空字符串")
		}

		if (!value || typeof value !== "object") {
			throw new Error("value必须是对象类型")
		}

		if (!this.registeredTables.has(tableName)) {
			await this.createTable(tableName)
		}

		const table = this.table<StorageValue>(tableName)
		await table.put({ id, value })
	}

	async queryAllFromTable(tableName: string): Promise<StorageValue[]> {
		await this.init()

		if (!tableName || typeof tableName !== "string") {
			throw new Error("表名必须是非空字符串")
		}

		if (!this.registeredTables.has(tableName)) {
			await this.createTable(tableName)
		}

		const table = this.table<StorageValue>(tableName)
		return await table.toArray()
	}
}

const db = new DynamicDatabase()

// @ts-ignore
window.getStreamRecords = (tableName: string) => {
	db.queryAllFromTable(tableName)
		.then((res) => {
			/** keep-console */
			console.groupCollapsed(
				`%c超麦话题流式记录 ${tableName}: ${res.length} 条`,
				"background: green;color: #fff;padding: 0 4px",
			)

			const messages = res
				.map((o) => o?.value)
				.sort((a: any, b: any) => {
					const aa = a?.message?.send_time || a?.send_time
					const bb = b?.message?.send_time || b?.send_time
					return aa - bb
				})

			const agentReplVerify = new Map()
			const correlationIdMap = new Map()
			messages.forEach((o: any) => {
				const id = o?.message?.general_agent_card?.correlation_id
				const event = o?.message?.general_agent_card?.event
				if (id && event?.indexOf("agent_reply") > -1) {
					correlationIdMap.set(id, o)
					if (!agentReplVerify.has(id)) {
						agentReplVerify.set(id, [])
					}
					const cache = agentReplVerify.get(id)
					cache.push(event)
					agentReplVerify.set(id, cache)
				}
			})
			const isDiffContent = messages.every((o: any) => {
				const id = o?.raw?.raw_data?.correlation_id
				if (id && o?.type === "type" && o?.raw?.raw_data?.status === 2) {
					const lastContent = correlationIdMap.get(id)
					return (
						o?.raw?.raw_data?.content ===
						lastContent?.message?.[lastContent?.message?.type]?.content
					)
				}
				return true
			})
			const isAgentReplVerify = agentReplVerify.values().every((arr) => {
				const [a] = arr
				if (a.indexOf("agent_reply") > -1) {
					return arr.length === 2
				}
				return true
			})
			/** keep-console */
			console.log("agent_reply 消息对合法：", isAgentReplVerify)
			/** keep-console */
			console.log("检查流式结果匹配：", isDiffContent)
			/** keep-console */
			console.log("流水：", messages)
			/** keep-console */
			console.groupEnd()
		})
		.catch(console.error)
}
export { db }
export type { StorageValue }
