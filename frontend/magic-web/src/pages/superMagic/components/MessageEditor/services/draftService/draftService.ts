import Dexie from "dexie"
import { DraftServiceInterface, DraftKey, DraftData, DraftVersionInfo } from "../../types"
import { IndexedDBDraftService } from "./IndexedDBDraftService"
import { LocalStorageDraftService } from "./LocalStorageDraftService"
import { DraftCleanupScheduler, DraftCleanupConfig } from "./DraftCleanupScheduler"

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== "undefined" && !!indexedDB
	} catch {
		return false
	}
}

async function checkIndexedDBAvailable(): Promise<boolean> {
	// 测试数据库连接
	const fn = async () => {
		const testDb = new Dexie("available-test", { allowEmptyDB: true })
		await testDb.open()
		testDb.close()
		return true
	}

	// Safari 18.6 fix: 增加超时时间并添加更详细的错误信息
	const timeoutPromise = () =>
		new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error("indexedDBConnectionFailed"))
			}, 10000) // 增加超时时间到 10 秒
		})

	try {
		return await Promise.race([fn(), timeoutPromise()])
	} catch (error) {
		console.warn("IndexedDB availability check failed, falling back to localStorage:", error)
		return false
	}
}

/**
 * Unified Draft Service
 * Automatically chooses between IndexedDB and localStorage based on browser support
 */
export class DraftService implements DraftServiceInterface {
	private storage: DraftServiceInterface | null = null
	private isUsingIndexedDB: boolean
	private cleanupScheduler: DraftCleanupScheduler | null = null

	constructor(cleanupConfig?: DraftCleanupConfig) {
		this.isUsingIndexedDB = isIndexedDBAvailable()

		// Initialize cleanup scheduler
		this.getCleanupScheduler(cleanupConfig)

		// Log which storage backend is being used
		console.log(
			`DraftService initialized with: ${
				this.isUsingIndexedDB ? "IndexedDB" : "localStorage"
			}`,
		)
	}

	private async getStorage(): Promise<DraftServiceInterface> {
		if (!this.storage) {
			try {
				await checkIndexedDBAvailable()
				this.storage = new IndexedDBDraftService()
			} catch (error) {
				console.error(error)
				this.storage = new LocalStorageDraftService()
			}
		}
		return this.storage
	}

	private async getCleanupScheduler(
		cleanupConfig?: DraftCleanupConfig,
	): Promise<DraftCleanupScheduler> {
		if (!this.cleanupScheduler) {
			const storage = await this.getStorage()
			this.cleanupScheduler = new DraftCleanupScheduler(storage, cleanupConfig)
		}
		return this.cleanupScheduler
	}

	async deleteDraftVersions(key: DraftKey): Promise<void> {
		const storage = await this.getStorage()
		if (storage.deleteDraftVersions) {
			return storage.deleteDraftVersions(key)
		}
		// Fallback: if the storage doesn't support versions, do nothing
		return Promise.resolve()
	}

	/**
	 * Save a draft version
	 */
	saveDraftVersion(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
		force?: boolean,
	): Promise<void> {
		return this.getStorage().then((storage) => {
			storage.saveDraftVersion(key, data, force)
		})
	}

	/**
	 * Load the latest draft version
	 */
	async loadLatestDraftVersion(key: DraftKey): Promise<DraftData | null> {
		const storage = await this.getStorage()
		if (storage.loadLatestDraftVersion) {
			return storage.loadLatestDraftVersion(key)
		}
		return null
	}

	/**
	 * Get information about the storage backend being used
	 */
	getStorageInfo(): { type: "indexeddb" | "localstorage"; isIndexedDB: boolean } {
		return {
			type: this.isUsingIndexedDB ? "indexeddb" : "localstorage",
			isIndexedDB: this.isUsingIndexedDB,
		}
	}

	/**
	 * Save a draft
	 */
	async saveDraft(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
	): Promise<void> {
		const storage = await this.getStorage()
		return storage.saveDraftVersion(key, data)
	}

	async loadDraft(key: DraftKey): Promise<DraftData | null> {
		const storage = await this.getStorage()
		return storage.loadDraft(key)
	}

	async deleteDraft(key: DraftKey): Promise<void> {
		const storage = await this.getStorage()
		return storage.deleteDraft(key)
	}

	async clearAllDrafts(): Promise<void> {
		const storage = await this.getStorage()
		return storage.clearAllDrafts()
	}

	async loadDraftVersions(key: DraftKey): Promise<DraftVersionInfo[]> {
		const storage = await this.getStorage()
		if (storage.loadDraftVersions) {
			return storage.loadDraftVersions(key)
		}
		// Fallback: if the storage doesn't support versions, return empty array
		return []
	}

	async loadProjectDraftVersions(
		key: Pick<DraftKey, "workspaceId" | "projectId">,
		offset?: number,
		limit?: number,
	): Promise<DraftVersionInfo[]> {
		const storage = await this.getStorage()
		if (storage.loadProjectDraftVersions) {
			return storage.loadProjectDraftVersions(key, offset, limit)
		}
		// Fallback: if the storage doesn't support project versions, return empty array
		return []
	}

	async loadDraftByVersion(key: DraftKey, versionId: string): Promise<DraftData | null> {
		const storage = await this.getStorage()
		if (storage.loadDraftByVersion) {
			return storage.loadDraftByVersion(key, versionId)
		}
		// Fallback: if the storage doesn't support versions, return null
		return null
	}

	async deleteDraftVersion(key: DraftKey, versionId: string): Promise<void> {
		const storage = await this.getStorage()
		if (storage.deleteDraftVersion) {
			return storage.deleteDraftVersion(key, versionId)
		}
		// Fallback: if the storage doesn't support versions, do nothing
		return Promise.resolve()
	}

	async cleanupExpiredVersions(retentionDays?: number): Promise<void> {
		const storage = await this.getStorage()
		if (storage.cleanupExpiredVersions) {
			// Use provided retentionDays or fallback to scheduler config
			const cleanupScheduler = await this.getCleanupScheduler()
			const effectiveRetentionDays =
				retentionDays ?? cleanupScheduler.getConfig().retentionDays
			return storage.cleanupExpiredVersions(effectiveRetentionDays)
		}
		// Fallback: if the storage doesn't support versions, do nothing
		return Promise.resolve()
	}

	close(): void {
		this.getStorage().then((storage) => {
			if ("close" in storage && typeof storage.close === "function") {
				storage.close()
			}
		})
		this.getCleanupScheduler().then((cleanupScheduler) => {
			// Stop the cleanup scheduler
			cleanupScheduler.stop()
		})
	}

	/**
	 * Start the cleanup scheduler
	 */
	startCleanupScheduler(): void {
		this.getCleanupScheduler().then((cleanupScheduler) => {
			cleanupScheduler.start()
		})
	}

	/**
	 * Stop the cleanup scheduler
	 */
	stopCleanupScheduler(): void {
		this.getCleanupScheduler().then((cleanupScheduler) => {
			cleanupScheduler.stop()
		})
	}

	/**
	 * Manually trigger cleanup (can be called even when scheduler is stopped)
	 */
	async runCleanup(): Promise<void> {
		const cleanupScheduler = await this.getCleanupScheduler()
		return cleanupScheduler.runCleanup()
	}

	/**
	 * Update cleanup configuration
	 */
	updateCleanupConfig(config: Partial<DraftCleanupConfig>): void {
		this.getCleanupScheduler().then((cleanupScheduler) => {
			cleanupScheduler.updateConfig(config)
		})
	}

	/**
	 * Get cleanup scheduler status
	 */
	async getCleanupStatus() {
		const cleanupScheduler = await this.getCleanupScheduler()
		return cleanupScheduler.getStatus()
	}

	/**
	 * Check if cleanup is due
	 */
	async isCleanupDue(): Promise<boolean> {
		const cleanupScheduler = await this.getCleanupScheduler()
		return cleanupScheduler.isCleanupDue()
	}
}
