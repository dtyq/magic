import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { cloneDeep, throttle } from "lodash-es"
import { logger as Logger } from "@/infrastructure/logger"
import {
	DraftData,
	DraftKey,
	DraftServiceInterface,
	DraftVersionInfo,
	QueueDraftMetadata,
} from "../../types"
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
	private lastSaveTimestamp = 0
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
		queueDraft?: QueueDraftMetadata
	}): Promise<void> {
		// 已发送正文与空输入按同一队列顺序保存，避免旧自动保存恢复已发送内容。
		await this.saveDraftStrict({
			...data,
			value: data.value ?? undefined,
			mentionItems: data.mentionItems ?? [],
			versionId: `${genDraftVersionId(Date.now())}/sent`,
		})
		await this.saveDraftStrict(
			{ ...data, value: undefined, mentionItems: [], queueDraft: undefined },
			true,
			true,
		)
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
		queueDraft?: QueueDraftMetadata
	}): Promise<void> {
		const draftKey = {
			userId: data.queueDraft?.userId,
			organizationCode: data.queueDraft?.organizationCode,
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

		if (entry.inFlight)
			return entry.inFlight.then(
				() => undefined,
				() => undefined,
			)

		const write = (async () => {
			while (entry.pending && !entry.strictDepth) {
				const next = entry.pending
				const submitVersion = entry.pendingVersion
				entry.pending = null

				const latestVersion = this.versionByKey.get(compositeKey) ?? 0
				if (submitVersion < latestVersion) continue

				try {
					// Always overwrite existing draft since we removed auto-save versioning
					await this.storage.saveDraftVersion(draftKey, next.draftData)
					await this.storage.saveDraft(draftKey, {
						...next.draftData,
						isCurrentSnapshot: true,
					})

					// If a clear happened during the save, ensure the draft is not resurrected
					const latestAfterSave = this.versionByKey.get(compositeKey) ?? 0
					if (submitVersion < latestAfterSave) {
						await this.storage.deleteDraft(draftKey)
						continue
					}
				} catch (error) {
					logger.error({
						eventKey: "save_draft_failed",
						errorKind: "unknown",
						error: error,
						message: "Failed to save draft:",
					})
					// continue loop to try pending saves if any
				}
			}
		})()
		entry.inFlight = write
		try {
			await write
		} finally {
			if (entry.inFlight === write) entry.inFlight = null
		}
	}

	/** 显式交接必须确认持久化成功；普通自动保存仍沿用原有错误容错。 */
	async saveDraftStrict(
		data: Omit<DraftData, "createdAt" | "updatedAt">,
		newVersion = false,
		current = false,
	): Promise<void> {
		const key = this.getCompositeKey(data.workspaceId, data.projectId, data.topicId)
		const entry: DraftQueueEntry = this.entries.get(key) ?? {
			inFlight: null,
			pending: null,
			pendingVersion: 0,
		}
		const snapshot = cloneDeep(data)
		delete snapshot.isCurrentSnapshot
		snapshot.versionTimestamp = this.nextSaveTimestamp()
		snapshot.isAutoSaved = false
		if (snapshot.queueDraft) snapshot.versionId = `queue/${snapshot.queueDraft.clientSyncId}`
		else if (newVersion) snapshot.versionId = `saved/${crypto.randomUUID()}`
		// 严格保存是顺序边界：此前的自动保存先完成，此后的输入不能被旧快照覆盖。
		const previous = entry.inFlight
		const previousPending = entry.pending
		entry.pending = null
		entry.strictDepth = (entry.strictDepth ?? 0) + 1
		const write = (async () => {
			await previous?.catch(() => undefined)
			if (previousPending) {
				await this.storage.saveDraftVersion(
					previousPending.draftData,
					previousPending.draftData,
				)
				await this.storage.saveDraft(previousPending.draftData, {
					...previousPending.draftData,
					isCurrentSnapshot: true,
				})
			}
			await this.storage.saveDraftVersion(data, snapshot, true)
			if (current)
				await this.storage.saveDraft(data, { ...snapshot, isCurrentSnapshot: true })
		})()
		entry.inFlight = write
		this.entries.set(key, entry)
		try {
			await write
		} finally {
			entry.strictDepth = (entry.strictDepth ?? 1) - 1
			if (entry.inFlight === write) {
				entry.inFlight = null
				// 等待存储期间，自动保存可能重新写入 pending。
				const pending = entry.pending as DraftQueueEntry["pending"]
				entry.pending = null
				if (pending) void this.saveDraft(pending.draftData)
			}
		}
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
			logger.error({
				eventKey: "clear_draft_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to clear draft:",
			})
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

	private nextSaveTimestamp(): number {
		this.lastSaveTimestamp = Math.max(Date.now(), this.lastSaveTimestamp + 1)
		return this.lastSaveTimestamp
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
		queueDraft?: QueueDraftMetadata
	}): PreparedSavePayload {
		const draftData: Omit<DraftData, "createdAt" | "updatedAt"> = cloneDeep({
			versionTimestamp: this.nextSaveTimestamp(),
			value: data.value || undefined,
			queueDraft: data.queueDraft,
			...(data.queueDraft && { versionId: `queue/${data.queueDraft.clientSyncId}` }),
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
		const current = await this.storage.loadDraft(key)
		if (current?.isCurrentSnapshot) return current
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
	strictDepth?: number
	inFlight: Promise<void> | null
	pending: PreparedSavePayload | null
	pendingVersion: number
}
