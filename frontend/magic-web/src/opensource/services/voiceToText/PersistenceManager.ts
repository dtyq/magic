import type { PersistenceStorage, RecordingSession } from "./index"
import Dexie, { type Table } from "dexie"

const DB_NAME = "VoiceToTextStorage"
const DB_VERSION = 2 // Incremented for pendingChunks support
const STORE_NAME = "recording_sessions"
const MAX_PENDING_CHUNKS = 50 // Maximum number of chunks to keep in memory
const MAX_PENDING_SIZE = 10 * 1024 * 1024 // 10MB maximum size for pending chunks

// LocalStorage fallback requires serialized chunks
interface StoredLocalSessionData extends Omit<RecordingSession, "pendingChunks"> {
	pendingChunks: string[]
}

// Direct storage interface - no serialization needed
interface RecordingSessionEntity extends RecordingSession {
	pendingChunks: ArrayBuffer[]
}

class VoiceToTextDatabase extends Dexie {
	public recordingSessions!: Table<RecordingSessionEntity, string>

	constructor() {
		super(DB_NAME)
		this.version(DB_VERSION).stores({
			[STORE_NAME]: "&recordingId, createdAt, updatedAt, isRecording",
		})
		this.recordingSessions = this.table(STORE_NAME)
	}
}

/**
 * Dexie-based persistence storage manager for voice recording sessions
 * 基于 Dexie 的语音录制会话持久化存储管理器
 */
class IndexedDBPersistenceManager implements PersistenceStorage {
	private database: VoiceToTextDatabase | null = null
	private databasePromise: Promise<VoiceToTextDatabase> | null = null

	private async getDatabase(): Promise<VoiceToTextDatabase> {
		if (this.database) return this.database
		if (this.databasePromise) return this.databasePromise
		if (typeof indexedDB === "undefined") {
			throw new Error("IndexedDB is not supported in this environment")
		}
		const db = new VoiceToTextDatabase()
		this.databasePromise = db.open().then(() => {
			this.database = db
			return db
		})
		return this.databasePromise
	}

	private async getTable(): Promise<Table<RecordingSessionEntity, string>> {
		const db = await this.getDatabase()
		return db.recordingSessions
	}

	async saveSession(session: RecordingSession): Promise<void> {
		const table = await this.getTable()
		// Ensure ArrayBuffer arrays are properly handled and add timestamp
		const entity: RecordingSessionEntity = {
			...session,
			updatedAt: Date.now(),
			pendingChunks: session.pendingChunks ?? [],
		}
		await table.put(entity)
	}

	async getSession(recordingId: string): Promise<RecordingSession | null> {
		const table = await this.getTable()
		const entity = await table.get(recordingId)
		return entity || null
	}

	async getAllSessions(): Promise<RecordingSession[]> {
		const table = await this.getTable()
		const entities = await table.toArray()
		return entities
	}

	async deleteSession(recordingId: string): Promise<void> {
		const table = await this.getTable()
		await table.delete(recordingId)
	}

	async cleanExpiredSessions(maxAge: number): Promise<void> {
		const table = await this.getTable()
		const cutoffTime = Date.now() - maxAge
		const keys = await table.where("updatedAt").belowOrEqual(cutoffTime).primaryKeys()
		if (!keys.length) return
		await table.bulkDelete(keys)
	}

	async clear(): Promise<void> {
		const table = await this.getTable()
		await table.clear()
	}

	async appendToPendingChunks(recordingId: string, chunk: ArrayBuffer): Promise<void> {
		const table = await this.getTable()
		const session = await table.get(recordingId)

		if (!session) {
			throw new Error(`Session ${recordingId} not found`)
		}

		// Initialize pendingChunks if not present
		if (!session.pendingChunks) {
			session.pendingChunks = []
		}

		// Check size limits
		const totalSize = session.pendingChunks.reduce((sum, c) => sum + c.byteLength, 0)
		if (totalSize + chunk.byteLength > MAX_PENDING_SIZE) {
			throw new Error(`Pending chunks size limit exceeded (${MAX_PENDING_SIZE} bytes)`)
		}

		if (session.pendingChunks.length >= MAX_PENDING_CHUNKS) {
			// Remove oldest chunks if limit exceeded
			session.pendingChunks = session.pendingChunks.slice(-MAX_PENDING_CHUNKS + 1)
		}

		session.pendingChunks.push(chunk)
		session.updatedAt = Date.now()

		await table.put(session)
	}

	async clearPendingChunks(recordingId: string): Promise<void> {
		const table = await this.getTable()
		const session = await table.get(recordingId)

		if (session) {
			session.pendingChunks = []
			session.updatedAt = Date.now()
			await table.put(session)
		}
	}

	async getPendingChunksInfo(recordingId: string): Promise<{ count: number; totalSize: number }> {
		const table = await this.getTable()
		const session = await table.get(recordingId)

		if (!session || !session.pendingChunks) {
			return { count: 0, totalSize: 0 }
		}

		const totalSize = session.pendingChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
		return { count: session.pendingChunks.length, totalSize }
	}

	async popPendingChunks(recordingId: string, count?: number): Promise<ArrayBuffer[]> {
		const table = await this.getTable()
		const session = await table.get(recordingId)

		if (!session || !session.pendingChunks || session.pendingChunks.length === 0) {
			return []
		}

		const numToTake = count ?? session.pendingChunks.length
		const chunks = session.pendingChunks.slice(0, numToTake)
		session.pendingChunks = session.pendingChunks.slice(numToTake)
		session.updatedAt = Date.now()

		await table.put(session)
		return chunks
	}

	close(): void {
		if (!this.database) return
		this.database.close()
		this.database = null
		this.databasePromise = null
	}
}

/**
 * Fallback storage manager using localStorage for environments without IndexedDB
 * 降级存储管理器，使用 localStorage，适用于不支持 IndexedDB 的环境
 */
class LocalStoragePersistenceManager implements PersistenceStorage {
	private readonly storageKey = "voice_recording_sessions"

	/**
	 * Get all sessions from localStorage
	 * 从 localStorage 获取所有会话
	 */
	private getAllFromStorage(): Record<string, StoredLocalSessionData> {
		try {
			const data = localStorage.getItem(this.storageKey)
			return data ? JSON.parse(data) : {}
		} catch (error) {
			console.warn("Failed to parse localStorage data:", error)
			return {}
		}
	}

	/**
	 * Save all sessions to localStorage
	 * 保存所有会话到 localStorage
	 */
	private saveAllToStorage(sessions: Record<string, StoredLocalSessionData>): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(sessions))
		} catch (error) {
			throw new Error(`Failed to save to localStorage: ${(error as Error).message}`)
		}
	}

	/**
	 * Convert ArrayBuffer to base64 for localStorage storage
	 * 将 ArrayBuffer 转换为 base64 用于 localStorage 存储
	 */
	private encodeChunks(chunks?: ArrayBuffer[]): string[] {
		if (!chunks) return []
		return chunks.map((chunk) => {
			const uint8Array = new Uint8Array(chunk)
			let binary = ""
			for (let i = 0; i < uint8Array.length; i++) {
				binary += String.fromCharCode(uint8Array[i])
			}
			return btoa(binary)
		})
	}

	/**
	 * Convert base64 back to ArrayBuffer
	 * 将 base64 转换回 ArrayBuffer
	 */
	private decodeChunks(encodedChunks?: string[]): ArrayBuffer[] {
		if (!encodedChunks) return []
		return encodedChunks.map((encoded) => {
			const binary = atob(encoded)
			const uint8Array = new Uint8Array(binary.length)
			for (let i = 0; i < binary.length; i++) {
				uint8Array[i] = binary.charCodeAt(i)
			}
			return uint8Array.buffer
		})
	}

	async saveSession(session: RecordingSession): Promise<void> {
		const sessions = this.getAllFromStorage()

		// Encode ArrayBuffer chunks for localStorage
		sessions[session.recordingId] = {
			...session,
			pendingChunks: this.encodeChunks(session.pendingChunks),
			updatedAt: Date.now(),
		}

		this.saveAllToStorage(sessions)
	}

	async getSession(recordingId: string): Promise<RecordingSession | null> {
		const sessions = this.getAllFromStorage()
		const sessionData = sessions[recordingId]

		if (!sessionData) return null

		// Decode ArrayBuffer chunks
		return {
			...sessionData,
			pendingChunks: this.decodeChunks(sessionData.pendingChunks),
		}
	}

	async getAllSessions(): Promise<RecordingSession[]> {
		const sessions = this.getAllFromStorage()

		return Object.values(sessions).map((sessionData) => ({
			...sessionData,
			pendingChunks: this.decodeChunks(sessionData.pendingChunks),
		})) as RecordingSession[]
	}

	async deleteSession(recordingId: string): Promise<void> {
		const sessions = this.getAllFromStorage()
		delete sessions[recordingId]
		this.saveAllToStorage(sessions)
	}

	async cleanExpiredSessions(maxAge: number): Promise<void> {
		const sessions = this.getAllFromStorage()
		const cutoffTime = Date.now() - maxAge

		const validSessions: Record<string, StoredLocalSessionData> = {}

		for (const [recordingId, sessionData] of Object.entries(sessions)) {
			if (sessionData.updatedAt && sessionData.updatedAt > cutoffTime) {
				validSessions[recordingId] = sessionData
			}
		}

		this.saveAllToStorage(validSessions)
	}

	async clear(): Promise<void> {
		localStorage.removeItem(this.storageKey)
	}

	async appendToPendingChunks(recordingId: string, chunk: ArrayBuffer): Promise<void> {
		const sessions = this.getAllFromStorage()
		const session = sessions[recordingId]

		if (!session) {
			throw new Error(`Session ${recordingId} not found`)
		}

		// Decode existing chunks
		const pendingChunks = this.decodeChunks(session.pendingChunks)

		// Check size limits
		const totalSize = pendingChunks.reduce((sum, c) => sum + c.byteLength, 0)
		if (totalSize + chunk.byteLength > MAX_PENDING_SIZE) {
			throw new Error(`Pending chunks size limit exceeded (${MAX_PENDING_SIZE} bytes)`)
		}

		if (pendingChunks.length >= MAX_PENDING_CHUNKS) {
			// Remove oldest chunks if limit exceeded
			pendingChunks.splice(0, pendingChunks.length - MAX_PENDING_CHUNKS + 1)
		}

		pendingChunks.push(chunk)

		// Re-encode and save
		session.pendingChunks = this.encodeChunks(pendingChunks)
		session.updatedAt = Date.now()
		sessions[recordingId] = session

		this.saveAllToStorage(sessions)
	}

	async clearPendingChunks(recordingId: string): Promise<void> {
		const sessions = this.getAllFromStorage()
		const session = sessions[recordingId]

		if (session) {
			session.pendingChunks = []
			session.updatedAt = Date.now()
			sessions[recordingId] = session
			this.saveAllToStorage(sessions)
		}
	}

	async getPendingChunksInfo(recordingId: string): Promise<{ count: number; totalSize: number }> {
		const sessions = this.getAllFromStorage()
		const session = sessions[recordingId]

		if (!session || !session.pendingChunks) {
			return { count: 0, totalSize: 0 }
		}

		const pendingChunks = this.decodeChunks(session.pendingChunks)
		const totalSize = pendingChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
		return { count: pendingChunks.length, totalSize }
	}

	async popPendingChunks(recordingId: string, count?: number): Promise<ArrayBuffer[]> {
		const sessions = this.getAllFromStorage()
		const session = sessions[recordingId]

		if (!session || !session.pendingChunks || session.pendingChunks.length === 0) {
			return []
		}

		const pendingChunks = this.decodeChunks(session.pendingChunks)
		const numToTake = count ?? pendingChunks.length
		const chunks = pendingChunks.slice(0, numToTake)

		// Update session with remaining chunks
		session.pendingChunks = this.encodeChunks(pendingChunks.slice(numToTake))
		session.updatedAt = Date.now()
		sessions[recordingId] = session

		this.saveAllToStorage(sessions)
		return chunks
	}
}

/**
 * Create persistence storage manager with fallback support
 * 创建支持降级的持久化存储管理器
 */
export function createPersistenceStorage(): PersistenceStorage {
	// Check if IndexedDB is available
	if (typeof indexedDB !== "undefined") {
		try {
			return new IndexedDBPersistenceManager()
		} catch (error) {
			console.warn("Failed to initialize IndexedDB, falling back to localStorage:", error)
		}
	}

	// Fallback to localStorage
	if (typeof localStorage !== "undefined") {
		return new LocalStoragePersistenceManager()
	}

	// If neither storage method is available, throw error
	throw new Error("No storage method available: neither IndexedDB nor localStorage is supported")
}

export { IndexedDBPersistenceManager, LocalStoragePersistenceManager }
