import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import type { JSONContent } from "@tiptap/react"
import { cloneDeep, throttle } from "lodash-es"
import { logger as Logger } from "@/opensource/utils/log"
import { DraftData, DraftKey, DraftServiceInterface, DraftVersionInfo } from "../../types"
import { DraftService } from "./draftService"
import { genDraftVersionId } from "./utils"

const logger = Logger.createLogger("DraftManager")

/**
 * Enhanced Draft Manager
 * Provides high-level draft management with file caching integration
 */
export class DraftManager {
	private storage: DraftServiceInterface
	private entries = new Map<string, DraftQueueEntry>()
	private versionByKey = new Map<string, number>()

	constructor(storage?: DraftServiceInterface) {
		this.storage = storage || new DraftService()
	}

	/**
	 * Create a new empty draft
	 */
	async createSentDraft(data: {
		workspaceId: string
		topicId: string
		projectId: string
		value?: JSONContent | null
		mentionItems?: MentionListItem[]
	}): Promise<DraftQueueEntry> {
		const draftKey = {
			workspaceId: data.workspaceId,
			projectId: data.projectId,
			topicId: data.topicId,
		}
		const compositeKey = this.getCompositeKey(
			draftKey.workspaceId,
			draftKey.projectId,
			draftKey.topicId,
		)
		const entry = this.entries.get(compositeKey) ?? {
			inFlight: null,
			pending: null,
			pendingVersion: 0,
		}

		// Append a new empty version as the latest without altering existing versions
		// Use a unique versionId to avoid overwriting time-based keys
		const versionTimestamp = Date.now()
		const uniqueVersionId = `${genDraftVersionId(versionTimestamp)}/sent`
		entry.inFlight = Promise.all([
			// 发送出去的内容保存一个版本
			this.storage.saveDraftVersion(
				draftKey,
				{
					workspaceId: data.workspaceId,
					projectId: data.projectId,
					topicId: data.topicId,
					mentionItems: data.mentionItems || [],
					value: data.value || undefined,
					isAutoSaved: false,
					versionId: uniqueVersionId,
					versionTimestamp,
				},
				true,
			),
			// 把最新版本设置为空
			this.storage.saveDraftVersion(
				draftKey,
				{
					workspaceId: data.workspaceId,
					projectId: data.projectId,
					topicId: data.topicId,
					mentionItems: [],
					value: undefined,
				},
				true,
			),
		]).finally(() => {
			entry.inFlight = null
		})

		this.entries.set(compositeKey, entry)
		return entry
	}

	/**
	 * Save draft with provided data including file cache management
	 */
	async saveDraft(data: {
		workspaceId: string
		topicId: string
		projectId: string
		value?: JSONContent | null
		mentionItems?: MentionListItem[]
	}): Promise<void> {
		const draftKey = {
			workspaceId: data.workspaceId,
			projectId: data.projectId,
			topicId: data.topicId,
		}
		const compositeKey = this.getCompositeKey(
			draftKey.workspaceId,
			draftKey.projectId,
			draftKey.topicId,
		)

		// Prepare payload and enqueue per key
		const payload = this.prepareSavePayload(data)
		const currentVersion = this.versionByKey.get(compositeKey) ?? 0
		const entry = this.entries.get(compositeKey) ?? {
			inFlight: null,
			pending: null,
			pendingVersion: currentVersion,
		}
		entry.pending = payload
		entry.pendingVersion = currentVersion
		this.entries.set(compositeKey, entry)

		if (entry.inFlight) return entry.inFlight as Promise<void>

		entry.inFlight = (async () => {
			while (entry.pending) {
				const next = entry.pending
				const submitVersion = entry.pendingVersion
				entry.pending = null

				const latestVersion = this.versionByKey.get(compositeKey) ?? 0
				if (submitVersion < latestVersion) continue

				try {
					// Always overwrite existing draft since we removed auto-save versioning
					await this.storage.saveDraftVersion(draftKey, next.draftData)

					// If a clear happened during the save, ensure the draft is not resurrected
					const latestAfterSave = this.versionByKey.get(compositeKey) ?? 0
					if (submitVersion < latestAfterSave) {
						await this.storage.deleteDraft(draftKey)
						continue
					}
				} catch (error) {
					logger.error("Failed to save draft:", error)
					// continue loop to try pending saves if any
				}
			}
			entry.inFlight = null
		})()

		return entry.inFlight as Promise<void>
	}

	/**
	 * Clear draft with file cache cleanup
	 */
	async clearVersions({
		workspaceId,
		projectId,
		topicId,
	}: {
		workspaceId: string
		projectId: string
		topicId: string
	}): Promise<void> {
		const draftKey = {
			workspaceId,
			projectId,
			topicId,
		}

		if (!draftKey) return

		try {
			const compositeKey = this.getCompositeKey(workspaceId, projectId, topicId)
			const entry = this.entries.get(compositeKey)
			if (entry) entry.pending = null

			await this.storage.deleteDraftVersions(draftKey)
		} catch (error) {
			logger.error("Failed to clear draft:", error)
		}
	}

	/**
	 * Delete draft version
	 */
	async deleteDraftVersion(key: DraftKey, versionId: string): Promise<void> {
		const compositeKey = this.getCompositeKey(key.workspaceId, key.projectId, key.topicId)
		await this.storage.deleteDraftVersion(key, versionId)
		this.entries.delete(compositeKey)
	}

	/**
	 * Create throttled save draft function
	 */
	createThrottledSaveDraft(delay = 1000) {
		return throttle(this.saveDraft.bind(this), delay, { leading: false, trailing: true })
	}

	/**
	 * Get composite key
	 */
	private getCompositeKey(workspaceId: string | undefined, projectId: string, topicId?: string) {
		return `${workspaceId || "global"}:${projectId}:${topicId || "default"}`
	}

	/**
	 * Prepare save payload
	 */
	private prepareSavePayload(data: {
		workspaceId?: string
		topicId: string
		projectId: string
		value?: JSONContent | null
		mentionItems?: MentionListItem[]
	}): PreparedSavePayload {
		const draftData: Omit<DraftData, "createdAt" | "updatedAt"> = cloneDeep({
			value: data.value || undefined,
			mentionItems: data.mentionItems || [],
			workspaceId: data.workspaceId || "global",
			projectId: data.projectId,
			topicId: data.topicId,
		})

		return { draftData }
	}

	/**
	 * Load latest draft version
	 */
	async loadLatestDraftVersion(key: DraftKey): Promise<DraftData | null> {
		const draft = await this.storage.loadLatestDraftVersion(key)
		if (!draft) {
			// 如果draft不存在，则尝试从legacyDraft中迁移数据
			const legacyDraft = await this.storage.loadDraft(key)
			if (legacyDraft) {
				// 迁移数据
				await this.saveDraft({
					workspaceId: key.workspaceId,
					projectId: key.projectId,
					topicId: key.topicId,
					value: legacyDraft.value,
					mentionItems: legacyDraft.mentionItems,
				})

				// 迁移后，重新加载draft
				const latestDraft = await this.storage.loadLatestDraftVersion(key)
				if (latestDraft) {
					return latestDraft
				}
			}
			return null
		}

		return draft
	}

	/**
	 * Load draft versions
	 */
	async loadDraftVersions(key: DraftKey): Promise<DraftVersionInfo[]> {
		const versions = await this.storage.loadDraftVersions(key)
		return versions
	}

	/**
	 * Load draft versions for a project (across all topics)
	 */
	async loadProjectDraftVersions(
		key: Pick<DraftKey, "workspaceId" | "projectId">,
		offset?: number,
		limit?: number,
	): Promise<DraftVersionInfo[]> {
		const versions = await this.storage.loadProjectDraftVersions(key, offset, limit)
		return versions
	}

	/**
	 * Load draft by version id
	 */
	async loadDraftByVersion(draftKey: DraftKey, versionId: string) {
		const version = await this.storage.loadDraftByVersion(draftKey, versionId)
		return version
	}
}

// Export singleton instance with cleanup scheduler enabled
export const draftService = new DraftService({
	cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
	retentionDays: 15, // 15 days
	runImmediately: false,
	enabled: true,
})

// Start the cleanup scheduler when the service is created
draftService.startCleanupScheduler()

// Export enhanced draft manager instance
export const draftManager = new DraftManager(draftService)

// Export classes for testing purposes
export { DraftService }
export { isIndexedDBAvailable } from "./draftService"

// Export cleanup-related classes and types
export { DraftCleanupScheduler } from "./DraftCleanupScheduler"
export type { DraftCleanupConfig } from "./DraftCleanupScheduler"

// Export lifecycle management
export { draftServiceLifecycle } from "./DraftServiceLifecycle"

interface PreparedSavePayload {
	draftData: Omit<DraftData, "createdAt" | "updatedAt">
}

interface DraftQueueEntry {
	inFlight: Promise<void | [void, void]> | null
	pending: PreparedSavePayload | null
	pendingVersion: number
}
