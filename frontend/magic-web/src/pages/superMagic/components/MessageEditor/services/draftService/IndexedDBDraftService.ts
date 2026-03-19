import Dexie, { Table } from "dexie"
import { DraftData, DraftKey, DraftServiceInterface, DraftVersionInfo } from "../../types"
import {
	generateKey,
	genDraftVersionId,
	generateVersionKey,
	generateLegacyKey,
	isEqualData,
	hasMeaningfulData,
} from "./utils"

// Dexie table interfaces
interface DraftRecord extends Omit<DraftData, "topicId"> {
	key: string
	projectId: string
	topicId?: string
}

interface DraftVersionRecord extends Omit<DraftData, "topicId"> {
	versionKey: string
	projectId: string
	topicId?: string
	versionId: string
	versionTimestamp: number
	isAutoSaved: boolean
}

// Dexie database class
class MessageEditorDraftsDB extends Dexie {
	drafts!: Table<DraftRecord>
	draftVersions!: Table<DraftVersionRecord>

	constructor() {
		super("MessageEditorDraftsV2")
		this.version(4).stores({
			drafts: "key, projectId, topicId, workspaceId, updatedAt, [workspaceId+projectId+topicId]",
			draftVersions:
				"versionKey, projectId, topicId, workspaceId, versionTimestamp, updatedAt, [workspaceId+projectId+topicId], [workspaceId+projectId]",
		})
	}
}

/**
 * IndexedDB Draft Service
 * Primary implementation using Dexie for better performance and larger storage
 */
export class IndexedDBDraftService implements DraftServiceInterface {
	private db: MessageEditorDraftsDB

	constructor() {
		this.db = new MessageEditorDraftsDB()
	}

	/**
	 * Initialize database connection (Dexie handles this automatically)
	 */
	private async initDB(): Promise<MessageEditorDraftsDB> {
		// Dexie handles database initialization automatically
		// Just ensure the database is open
		await this.db.open()
		return this.db
	}

	/**
	 * Save draft data to IndexedDB
	 */
	async saveDraft(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
	): Promise<void> {
		try {
			await this.initDB()
			const now = Date.now()
			const draftKey = generateKey(key)

			// Check if draft already exists to determine if it's a create or update
			const existingDraft = await this.db.drafts.get(draftKey)

			const draftData: DraftRecord = {
				...data,
				key: draftKey,
				projectId: key.projectId,
				topicId: key.topicId,
				createdAt: existingDraft?.createdAt ?? now,
				updatedAt: now,
			}

			await this.db.drafts.put(draftData)
		} catch (error) {
			console.error("Error saving draft:", error)
			throw error
		}
	}

	/**
	 * Save draft version to IndexedDB
	 */
	async saveDraftVersion(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
		force: boolean = false,
	): Promise<void> {
		try {
			await this.initDB()

			// Generate a unique version ID if not provided
			const versionData = {
				...data,
				versionId: data.versionId || genDraftVersionId(),
				versionTimestamp: data.versionTimestamp || Date.now(),
				isAutoSaved: data.isAutoSaved ?? true,
			}

			const versionKey = generateVersionKey(key, versionData.versionId)

			// 取最后一个不是同个版本并且有意义的草稿
			const latestDraft = await this.loadFirstDifferentTimeVersion(
				key,
				versionData.versionTimestamp,
			)

			// 如果只有一个版本，或者没有版本，并且本次数据没有意义，则不保存
			if (!latestDraft && !hasMeaningfulData(data) && !force) {
				console.log("no meaningful data")
				return
			}

			// 如果数据一样，删除此版本
			if (isEqualData(data, latestDraft) && latestDraft?.versionId) {
				console.log("deleteVersionKey", versionKey)
				await this.db.draftVersions.delete(versionKey)
				console.log("deleteVersionKey success", versionKey)
				return
			}

			const latestVersion = await this.loadLatestDraftVersion(key)

			// Ignore version if it's the same as the latest version
			if (isEqualData(versionData, latestVersion) && !force) {
				return
			}

			const now = Date.now()

			// Check if version already exists
			const existingVersion = await this.db.draftVersions.get(versionKey)

			const draftVersionData: DraftVersionRecord = {
				...versionData,
				versionKey: versionKey,
				projectId: key.projectId,
				topicId: key.topicId,
				workspaceId: key.workspaceId,
				createdAt: existingVersion?.createdAt ?? now,
				updatedAt: now,
			}

			await this.db.draftVersions.put(draftVersionData)
		} catch (error) {
			console.error("Error saving draft version:", error)
			throw error
		}
	}

	/**
	 * Load draft data from IndexedDB
	 */
	async loadDraft(key: DraftKey): Promise<DraftData | null> {
		try {
			await this.initDB()
			const draftKey = generateKey(key)
			let draft = await this.db.drafts.get(draftKey)

			if (!draft) {
				// Backward compatibility: try legacy key
				const legacyKey = generateLegacyKey(key)
				draft = await this.db.drafts.get(legacyKey)
				if (!draft) return null
			}

			// Remove internal fields before returning
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { key: _key, projectId: _projectId, ...draftData } = draft
			return draftData as DraftData
		} catch (error) {
			console.error("Error loading draft:", error)
			return null
		}
	}

	/**
	 * Load all draft versions for a key from IndexedDB
	 */
	async loadDraftVersions(
		key: DraftKey,
		offset: number = 0,
		limit: number = 50,
	): Promise<DraftVersionInfo[]> {
		try {
			await this.initDB()

			// Use Dexie's compound index to query versions
			const versions = await this.db.draftVersions
				.where("[workspaceId+projectId+topicId]")
				.equals([key.workspaceId, key.projectId, key.topicId])
				.reverse()
				.sortBy("versionTimestamp")

			// Apply pagination manually since sortBy doesn't support offset/limit
			const paginatedVersions = versions.slice(offset, offset + limit)

			return paginatedVersions.map((version: DraftVersionRecord) => ({
				versionId: version.versionId,
				versionTimestamp: version.versionTimestamp,
				isAutoSaved: version.isAutoSaved,
				updatedAt: version.updatedAt,
				createdAt: version.createdAt,
				versionKey: version.versionKey,
				topicId: version.topicId,
			}))
		} catch (error) {
			console.error("Error loading draft versions:", error)
			return []
		}
	}

	/**
	 * Load all draft versions for a project (across all topics) from IndexedDB
	 */
	async loadProjectDraftVersions(
		key: Pick<DraftKey, "workspaceId" | "projectId">,
		offset: number = 0,
		limit: number = 50,
	): Promise<DraftVersionInfo[]> {
		try {
			await this.initDB()

			// Use Dexie's compound index to query versions by project
			const versions = await this.db.draftVersions
				.where("[workspaceId+projectId]")
				.equals([key.workspaceId, key.projectId])
				.reverse()
				.sortBy("versionTimestamp")

			// Apply pagination manually since sortBy doesn't support offset/limit
			const paginatedVersions = versions.slice(offset, offset + limit)

			return paginatedVersions.map((version: DraftVersionRecord) => ({
				versionId: version.versionId,
				versionTimestamp: version.versionTimestamp,
				isAutoSaved: version.isAutoSaved,
				updatedAt: version.updatedAt,
				createdAt: version.createdAt,
				versionKey: version.versionKey,
				topicId: version.topicId,
			}))
		} catch (error) {
			console.error("Error loading project draft versions:", error)
			return []
		}
	}

	/**
	 * Delete draft data from IndexedDB
	 */
	async deleteDraft(key: DraftKey): Promise<void> {
		try {
			await this.initDB()
			const draftKey = generateKey(key)
			await this.db.drafts.delete(draftKey)
		} catch (error) {
			console.error("Error deleting draft:", error)
			throw error
		}
	}

	/**
	 * Delete all draft versions for a key from IndexedDB
	 */
	async deleteDraftVersions(key: DraftKey): Promise<void> {
		try {
			await this.initDB()

			// Use Dexie's compound index to delete all versions for this key
			await this.db.draftVersions
				.where("[workspaceId+projectId+topicId]")
				.equals([key.workspaceId, key.projectId, key.topicId])
				.delete()
		} catch (error) {
			console.error("Error deleting draft versions:", error)
			throw error
		}
	}

	/**
	 * Load the latest draft version from IndexedDB
	 */
	async loadLatestDraftVersion(key: DraftKey): Promise<DraftData | null> {
		const versions = await this.loadDraftVersions(key, 0, 1)
		if (versions.length === 0) return null
		// Since versions are sorted by timestamp descending, the first one is the latest
		return this.loadDraftByVersion(key, versions[0].versionId)
	}

	/**
	 * Load the first different time version from IndexedDB
	 */
	async loadFirstDifferentTimeVersion(
		key: DraftKey,
		currentTimestamp: number,
	): Promise<DraftData | null> {
		const versions = await this.loadDraftVersions(key)
		if (versions.length === 0) {
			return null
		}

		const versionId = genDraftVersionId(currentTimestamp)

		// find the first version that is different from the current timestamp
		for (let i = 0; i < versions.length; i++) {
			if (versions[i].versionId !== versionId) {
				const version = await this.loadDraftByVersion(key, versions[i].versionId)
				if (version && hasMeaningfulData(version)) {
					return version
				}
			}
		}
		return null
	}

	/**
	 * Load a specific draft version from IndexedDB
	 */
	async loadDraftByVersion(key: DraftKey, versionId: string): Promise<DraftData | null> {
		try {
			await this.initDB()
			const versionKey = generateVersionKey(key, versionId)
			const version = await this.db.draftVersions.get(versionKey)

			if (!version) {
				return null
			}

			// Remove internal fields before returning

			const {
				versionKey: _versionKey,
				projectId: _projectId,
				topicId: _topicId,
				versionTimestamp: _versionTimestamp,
				isAutoSaved: _isAutoSaved,
				...draftData
			} = version
			return draftData as DraftData
		} catch (error) {
			console.error("Error loading draft version:", error)
			return null
		}
	}

	/**
	 * Clear all drafts from IndexedDB
	 */
	async clearAllDrafts(): Promise<void> {
		try {
			await this.initDB()
			await this.db.drafts.clear()
		} catch (error) {
			console.error("Error clearing all drafts:", error)
			throw error
		}
	}

	/**
	 * Delete a specific draft version from IndexedDB
	 */
	async deleteDraftVersion(key: DraftKey, versionId: string): Promise<void> {
		try {
			await this.initDB()
			const versionKey = generateVersionKey(key, versionId)
			await this.db.draftVersions.delete(versionKey)
			console.log("deleteDraftVersion", key, versionId)
		} catch (error) {
			console.error("Error deleting draft version:", error)
			throw error
		}
	}

	/**
	 * Cleanup expired draft versions (older than retentionDays)
	 */
	async cleanupExpiredVersions(retentionDays = 7): Promise<void> {
		try {
			await this.initDB()

			// Calculate the timestamp for retention period ago
			const retentionPeriodInMs = retentionDays * 24 * 60 * 60 * 1000
			const retentionThreshold = Date.now() - retentionPeriodInMs

			// Delete expired versions using Dexie's where clause
			await this.db.draftVersions.where("versionTimestamp").below(retentionThreshold).delete()

			// Also cleanup expired auto-saved versions from the main drafts store
			await this.db.draftVersions
				.where("updatedAt")
				.below(retentionThreshold)
				.and((draft) => draft.isAutoSaved === true)
				.delete()
		} catch (error) {
			console.error("Error cleaning up expired draft versions:", error)
		}
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close()
		}
	}
}
