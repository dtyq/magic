import Dexie, { type Table } from "dexie"

const DB_NAME = "HtmlScreenshotStorage"
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000

function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
	if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer()
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as ArrayBuffer)
		reader.onerror = () => reject(reader.error)
		reader.readAsArrayBuffer(blob)
	})
}

interface ScreenshotRecord {
	id: string
	bytes: ArrayBuffer
	type: string
	createdAt: number
	expiresAt: number
}

class HtmlScreenshotDexie extends Dexie {
	images!: Table<ScreenshotRecord, string>

	constructor() {
		super(DB_NAME)
		this.version(1).stores({ images: "id, expiresAt" })
	}
}

const SWEEP_INTERVAL_MS = 60 * 1000

/** Small IndexedDB store keyed by capture id. */
class HtmlScreenshotDatabase {
	private db = new HtmlScreenshotDexie()
	private lastSweepAt = 0

	constructor() {
		void this.deleteExpired().catch(() => undefined)
	}

	async put(id: string, blob: Blob, retentionMs = DEFAULT_RETENTION_MS): Promise<void> {
		await this.sweepExpiredIfDue()
		const now = Date.now()
		await this.db.images.put({
			id,
			bytes: await readBlobBytes(blob),
			type: blob.type,
			createdAt: now,
			expiresAt: now + retentionMs,
		})
	}

	async get(id: string): Promise<Blob | null> {
		const record = await this.db.images.get(id)
		if (!record) return null
		if (record.expiresAt < Date.now()) {
			await this.db.images.delete(id)
			return null
		}
		return new Blob([record.bytes], { type: record.type || "image/png" })
	}

	async delete(id: string): Promise<void> {
		await this.db.images.delete(id)
	}

	async deleteExpired(now = Date.now()): Promise<number> {
		this.lastSweepAt = now
		return this.db.images.where("expiresAt").below(now).delete()
	}

	private async sweepExpiredIfDue(now = Date.now()): Promise<void> {
		if (now - this.lastSweepAt < SWEEP_INTERVAL_MS) return
		await this.deleteExpired(now)
	}

	async reset(): Promise<void> {
		this.db.close()
		await Dexie.delete(DB_NAME)
		this.db = new HtmlScreenshotDexie()
		this.lastSweepAt = 0
	}
}

export const htmlScreenshotDatabase = new HtmlScreenshotDatabase()

/** Test-only: drop the Dexie database so cases stay isolated. */
export async function resetHtmlScreenshotDatabase(): Promise<void> {
	await htmlScreenshotDatabase.reset()
}
