import Dexie from "dexie"

interface StorageValue {
	id: string
	value: object
}

interface StreamRecordValue {
	__websocket_record__?: {
		received_at?: unknown
		writer_sequence?: unknown
	}
	message?: {
		send_time?: unknown
	}
	send_time?: unknown
}

function asStreamRecordValue(value: object): StreamRecordValue {
	return value as StreamRecordValue
}

function getReceivedAt(value: object): number | undefined {
	const receivedAt = asStreamRecordValue(value).__websocket_record__?.received_at
	return typeof receivedAt === "number" ? receivedAt : undefined
}

function getSendTime(value: object): number | undefined {
	const record = asStreamRecordValue(value)
	const sendTime = record.message?.send_time ?? record.send_time
	return typeof sendTime === "number" ? sendTime : undefined
}

function compareNumbers(left: number | undefined, right: number | undefined): number {
	if (left === undefined && right === undefined) return 0
	if (left === undefined) return 1
	if (right === undefined) return -1
	return left - right
}

/**
 * Keep console exports in the same order as the client-side WebSocket receive log.
 * IndexedDB's `toArray()` order is storage-dependent, so metadata and the outer id
 * are used as deterministic tie-breakers after the receive timestamp.
 */
export function compareStreamRecordsForDisplay(left: StorageValue, right: StorageValue): number {
	const leftReceivedAt = getReceivedAt(left.value)
	const rightReceivedAt = getReceivedAt(right.value)
	const receivedOrder =
		leftReceivedAt !== undefined && rightReceivedAt !== undefined
			? leftReceivedAt - rightReceivedAt
			: compareNumbers(getSendTime(left.value), getSendTime(right.value))
	if (receivedOrder) return receivedOrder

	const leftWriterSequence = asStreamRecordValue(left.value).__websocket_record__?.writer_sequence
	const rightWriterSequence = asStreamRecordValue(right.value).__websocket_record__
		?.writer_sequence
	const writerOrder = compareNumbers(
		typeof leftWriterSequence === "number" ? leftWriterSequence : undefined,
		typeof rightWriterSequence === "number" ? rightWriterSequence : undefined,
	)
	if (writerOrder) return writerOrder

	return left.id.localeCompare(right.id)
}

export class DynamicDatabase extends Dexie {
	private registeredTables: Set<string> = new Set()
	private tableSchemas: Record<string, string> = {}
	private initialized = false
	private initPromise: Promise<void> | undefined
	private schemaUpdateQueue: Promise<void> = Promise.resolve()

	constructor() {
		super("MAGIC:stream-record-db")
		this.version(1).stores({})
	}

	private async init(): Promise<void> {
		if (this.initialized) return
		if (this.initPromise) return this.initPromise

		this.initPromise = (async () => {
			await this.open()

			// 恢复已存在的表结构
			this.tables.forEach((table) => {
				const tableName = table.name
				this.registeredTables.add(tableName)
				this.tableSchemas[tableName] = "id"
			})

			this.initialized = true
		})()

		try {
			await this.initPromise
		} finally {
			this.initPromise = undefined
		}
	}

	async createTable(tableName: string): Promise<void> {
		if (!tableName || typeof tableName !== "string") {
			throw new Error("表名必须是非空字符串")
		}

		await this.enqueueSchemaUpdate(async () => {
			await this.init()

			if (this.registeredTables.has(tableName)) return

			const currentVersion = this.verno

			if (this.isOpen()) this.close()

			// 保留所有已存在的表定义，并添加新表
			this.tableSchemas[tableName] = "id"

			this.version(currentVersion + 1).stores(this.tableSchemas)

			await this.open()

			this.registeredTables.add(tableName)
			this.initialized = true
		})
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

	async addManyToTable(tableName: string, values: StorageValue[]): Promise<void> {
		await this.init()

		if (!tableName || typeof tableName !== "string") {
			throw new Error("表名必须是非空字符串")
		}

		if (!Array.isArray(values) || values.length === 0) return
		if (
			values.some(
				(item) =>
					!item?.id ||
					typeof item.id !== "string" ||
					!item.value ||
					typeof item.value !== "object",
			)
		) {
			throw new Error("批量写入值必须包含非空字符串 id 和对象 value")
		}

		if (!this.registeredTables.has(tableName)) {
			await this.createTable(tableName)
		}

		const table = this.table<StorageValue>(tableName)
		await table.bulkPut(values)
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

	private async enqueueSchemaUpdate(task: () => Promise<void>): Promise<void> {
		const pendingTask = this.schemaUpdateQueue.catch(() => undefined).then(task)
		this.schemaUpdateQueue = pendingTask.then(
			() => undefined,
			() => undefined,
		)
		return pendingTask
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
				.slice()
				.sort(compareStreamRecordsForDisplay)
				.map((o) => o?.value)

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
