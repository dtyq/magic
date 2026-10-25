import { isShadowed, unshadow } from "@/utils/shadow"
import {
	DEFAULT_FILE_SAVE_DRAFT_LIMITS,
	estimateSaveRecordBytes,
	listDraftFileIdsToDrop,
	type FileSaveDraftLimits,
} from "./draftLimits"
import { IndexedDbFileSavePersistence } from "./persistence"
import {
	FILE_SAVE_FAIL_REASON,
	FILE_SAVE_STATUS,
	FileSaveConflictError,
	FileSavePermanentError,
	FileSaveRetryableError,
	type FileSaveFailReason,
	type FileSaveJob,
	type FileSavePersistence,
	type FileSaveQueueOptions,
	type FileSaveSnapshot,
	type FileSaveStatus,
	type StoredFileSaveRecord,
} from "./types"

const DEFAULT_BACKOFF_MS = [1000, 3000, 8000]
const DEFAULT_MAX_ATTEMPTS = 4

export type DraftApplyHandler = (content: unknown) => void | Promise<void>

export function stringifySaveContent(content: unknown): string {
	return typeof content === "string" ? content : JSON.stringify(content)
}

export function isRetryableSaveError(error: unknown): boolean {
	if (error instanceof FileSaveRetryableError) return true
	if (error instanceof FileSaveConflictError || error instanceof FileSavePermanentError) {
		return false
	}
	if (error instanceof TypeError) return true
	const status = getErrorStatus(error)
	if (status !== undefined) {
		return status === 0 || status === 429 || status >= 500
	}
	const message = error instanceof Error ? error.message : String(error)
	return /network|timeout|failed to fetch|econnreset|offline/i.test(message)
}

export function getErrorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object") return undefined
	if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
		return (error as { status: number }).status
	}
	const response = (error as { response?: { status?: unknown } }).response
	if (response && typeof response.status === "number") return response.status
	return undefined
}

function failReasonFromError(error: unknown): FileSaveFailReason {
	if (error instanceof FileSaveConflictError) return FILE_SAVE_FAIL_REASON.Conflict
	if (isRetryableSaveError(error)) return FILE_SAVE_FAIL_REASON.Network
	return FILE_SAVE_FAIL_REASON.Permanent
}

interface FileSaveEntry {
	fileId: string
	status: FileSaveStatus
	queued?: FileSaveJob
	inflight?: FileSaveJob
	lastSyncedContent?: string
	baselineVersion?: string
	failReason?: FileSaveFailReason
	attempt: number
	running: boolean
	/** Remote version reached by the last successful persist in this drain. */
	syncedVersion?: string
}

/** Queued follow-ups start from a stale baseline once an earlier save lands. */
function pickBaselineVersion(jobVersion?: string, syncedVersion?: string): string | undefined {
	if (!syncedVersion) return jobVersion
	if (!jobVersion) return syncedVersion
	const job = Number(jobVersion)
	const synced = Number(syncedVersion)
	if (Number.isNaN(job) || Number.isNaN(synced)) return jobVersion
	return synced > job ? syncedVersion : jobVersion
}

function defaultDelay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms)
	})
}

/**
 * Per-file save queue: one in-flight persist, latest pending content wins,
 * retryable errors back off, and unsynced drafts stay in IndexedDB.
 */
export class FileSaveQueue {
	private readonly entries = new Map<string, FileSaveEntry>()
	private readonly listeners = new Set<() => void>()
	private readonly flushWaiters = new Map<string, Array<(ok: boolean) => void>>()
	private readonly restoreHandlers = new Map<string, () => void | Promise<void>>()
	private readonly draftApplyHandlers = new Map<string, DraftApplyHandler>()
	private readonly draftWrites = new Map<string, Promise<void>>()
	private readonly failureRevealTokens = new Map<string, number>()
	private readonly persistence: FileSavePersistence
	private readonly delay: (ms: number) => Promise<void>
	private readonly now: () => number
	private readonly maxAttempts: number
	private readonly backoffMs: number[]
	private readonly draftLimits: FileSaveDraftLimits
	private revision = 0
	private recovered = false
	private beforeUnloadAttached = false

	constructor(options: FileSaveQueueOptions = {}) {
		this.persistence = options.persistence ?? new IndexedDbFileSavePersistence()
		this.delay = options.delay ?? defaultDelay
		this.now = options.now ?? (() => Date.now())
		this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
		this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS
		this.draftLimits = {
			ttlMs: options.draftTtlMs ?? DEFAULT_FILE_SAVE_DRAFT_LIMITS.ttlMs,
			maxRecords: options.maxDraftRecords ?? DEFAULT_FILE_SAVE_DRAFT_LIMITS.maxRecords,
			maxBytesPerRecord:
				options.maxDraftBytesPerRecord ?? DEFAULT_FILE_SAVE_DRAFT_LIMITS.maxBytesPerRecord,
			maxTotalBytes:
				options.maxDraftTotalBytes ?? DEFAULT_FILE_SAVE_DRAFT_LIMITS.maxTotalBytes,
		}
		this.handleBeforeUnload = this.handleBeforeUnload.bind(this)
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	getRevision = (): number => this.revision

	getStatus(fileId?: string): FileSaveStatus {
		if (!fileId) return FILE_SAVE_STATUS.Idle
		return this.entries.get(fileId)?.status ?? FILE_SAVE_STATUS.Idle
	}

	getSnapshot(fileId: string): FileSaveSnapshot | undefined {
		const entry = this.entries.get(fileId)
		if (!entry) return undefined
		const pending = entry.queued ?? entry.inflight
		return {
			fileId,
			status: entry.status,
			pendingContent: pending?.content,
			lastSyncedContent: entry.lastSyncedContent,
			baselineVersion: pending?.baselineVersion ?? entry.baselineVersion,
			failReason: entry.failReason,
			attempt: entry.attempt,
		}
	}

	hasPending(fileId: string): boolean {
		const status = this.getStatus(fileId)
		return (
			status === FILE_SAVE_STATUS.Saving ||
			status === FILE_SAVE_STATUS.Retrying ||
			status === FILE_SAVE_STATUS.Failed
		)
	}

	hasUnsynced(): boolean {
		for (const entry of this.entries.values()) {
			if (entry.status !== FILE_SAVE_STATUS.Idle) return true
		}
		return false
	}

	matchesLocal(fileId: string, content: string): boolean {
		const entry = this.entries.get(fileId)
		if (!entry) return false
		const pending = entry.queued ?? entry.inflight
		if (pending && stringifySaveContent(pending.content) === content) return true
		return entry.lastSyncedContent === content
	}

	peekUnsyncedDraft(fileId: string): unknown | undefined {
		const entry = this.entries.get(fileId)
		const pending = entry?.queued ?? entry?.inflight
		// Preview and recovery consumers need editor text, while persistence keeps
		// the original encoded payload and flag for the save API.
		if (
			pending?.enableShadow &&
			typeof pending.content === "string" &&
			isShadowed(pending.content)
		) {
			return unshadow(pending.content)
		}
		return pending?.content
	}

	registerRestoreHandler(fileId: string, handler: () => void | Promise<void>): () => void {
		this.restoreHandlers.set(fileId, handler)
		return () => {
			if (this.restoreHandlers.get(fileId) === handler) this.restoreHandlers.delete(fileId)
		}
	}

	registerDraftApplyHandler(fileId: string, handler: DraftApplyHandler): () => void {
		this.draftApplyHandlers.set(fileId, handler)
		if (this.hasPending(fileId)) this.notifyDraftApply(fileId)
		return () => {
			if (this.draftApplyHandlers.get(fileId) === handler) {
				this.draftApplyHandlers.delete(fileId)
			}
		}
	}

	/** Recovered drafts keep a dummy persist until the editor rebinds a real one. */
	rebindPersist(fileId: string, persist: FileSaveJob["persist"]): void {
		const entry = this.entries.get(fileId)
		if (!entry) return
		if (entry.queued) entry.queued = { ...entry.queued, persist }
		if (entry.inflight) entry.inflight = { ...entry.inflight, persist }
	}

	/** Ask the failure UI to show its actions again after the user dismissed them. */
	revealFailure(fileId: string): void {
		this.failureRevealTokens.set(fileId, (this.failureRevealTokens.get(fileId) ?? 0) + 1)
		this.bump()
	}

	getFailureRevealToken(fileId: string): number {
		return this.failureRevealTokens.get(fileId) ?? 0
	}

	getFailedFileIds(): string[] {
		return [...this.entries.values()]
			.filter((entry) => entry.status === FILE_SAVE_STATUS.Failed)
			.map((entry) => entry.fileId)
	}

	enqueue(job: FileSaveJob): void {
		const entry = this.ensureEntry(job.fileId)
		entry.queued = job
		entry.baselineVersion = job.baselineVersion
		entry.failReason = undefined
		entry.status = FILE_SAVE_STATUS.Saving
		this.bump()
		void this.persistDraft(job)
		void this.run(job.fileId)
	}

	async flush(fileId: string): Promise<boolean> {
		const entry = this.entries.get(fileId)
		if (!entry || (entry.status === FILE_SAVE_STATUS.Idle && !entry.queued && !entry.running)) {
			return true
		}
		if (entry.status === FILE_SAVE_STATUS.Failed && !entry.running) {
			return false
		}
		return await new Promise<boolean>((resolve) => {
			const waiters = this.flushWaiters.get(fileId) ?? []
			waiters.push(resolve)
			this.flushWaiters.set(fileId, waiters)
		})
	}

	async flushAll(): Promise<boolean> {
		const fileIds = [...this.entries.keys()]
		const results = await Promise.all(fileIds.map((id) => this.flush(id)))
		return results.every(Boolean)
	}

	retry(
		fileId: string,
		options?: { overwrite?: boolean; persist?: FileSaveJob["persist"] },
	): void {
		const entry = this.entries.get(fileId)
		const job = entry?.queued ?? entry?.inflight
		if (!job) return
		this.enqueue({
			...job,
			persist: options?.persist ?? job.persist,
			forceOverwrite: options?.overwrite === true || job.forceOverwrite,
		})
	}

	async restoreRemote(fileId: string): Promise<void> {
		this.entries.delete(fileId)
		this.resolveFlush(fileId, true)
		this.bump()
		await this.removeDraft(fileId, "Failed to drop unsynced file save")
		const handler = this.restoreHandlers.get(fileId)
		await handler?.()
	}

	async recover(): Promise<
		Array<{ fileId: string; content: unknown; baselineVersion?: string }>
	> {
		if (this.recovered) {
			return [...this.entries.values()]
				.filter((entry) => entry.status === FILE_SAVE_STATUS.Failed && entry.queued)
				.map((entry) => ({
					fileId: entry.fileId,
					content: entry.queued?.content,
					baselineVersion: entry.baselineVersion,
				}))
		}
		this.recovered = true
		try {
			await this.prunePersistedDrafts()
		} catch (error) {
			console.error("Failed to prune unsynced file saves", error)
		}
		let records: StoredFileSaveRecord[] = []
		try {
			records = await this.persistence.getAll()
		} catch (error) {
			console.error("Failed to recover unsynced file saves", error)
			return []
		}
		// A live entry already holds newer in-memory content than the stored draft.
		const recoverable = records.filter((record) => !this.entries.has(record.fileId))
		for (const record of recoverable) {
			const entry = this.ensureEntry(record.fileId)
			entry.queued = {
				fileId: record.fileId,
				content: record.content,
				enableShadow: record.enableShadow,
				baselineVersion: record.baselineVersion,
				persist: async () => {
					throw new FileSavePermanentError("Recovered draft has no persist callback")
				},
			}
			entry.baselineVersion = record.baselineVersion
			entry.status = FILE_SAVE_STATUS.Failed
			entry.failReason = FILE_SAVE_FAIL_REASON.Network
			entry.attempt = 0
			this.notifyDraftApply(record.fileId)
		}
		if (recoverable.length > 0) this.bump()
		return recoverable.map((record) => ({
			fileId: record.fileId,
			content: record.content,
			baselineVersion: record.baselineVersion,
		}))
	}

	private ensureEntry(fileId: string): FileSaveEntry {
		const existing = this.entries.get(fileId)
		if (existing) return existing
		const created: FileSaveEntry = {
			fileId,
			status: FILE_SAVE_STATUS.Idle,
			attempt: 0,
			running: false,
		}
		this.entries.set(fileId, created)
		return created
	}

	private async run(fileId: string): Promise<void> {
		const entry = this.entries.get(fileId)
		if (!entry || entry.running) return
		entry.running = true
		try {
			while (entry.queued) {
				const job = entry.queued
				entry.queued = undefined
				entry.inflight = job
				entry.attempt = 0
				entry.status = FILE_SAVE_STATUS.Saving
				this.bump()
				const ok = await this.persistWithRetry(entry, job)
				if (entry.queued) continue
				if (ok) {
					entry.status = FILE_SAVE_STATUS.Idle
					entry.lastSyncedContent = stringifySaveContent(job.content)
					entry.failReason = undefined
					entry.inflight = undefined
					this.entries.set(fileId, entry)
					this.bump()
					await this.removeDraft(fileId, "Failed to clear synced file save")
					try {
						await job.onSuccess?.(job)
					} catch (error) {
						console.error("File save success callback failed", error)
					}
					// A save queued during cleanup keeps waiters pending until it settles.
					if (!entry.queued) {
						this.resolveFlush(fileId, true)
						this.entries.delete(fileId)
					}
				} else {
					// Keep the draft queued for Retry, but stop auto-persist.
					entry.queued = job
					entry.inflight = undefined
					entry.status = FILE_SAVE_STATUS.Failed
					this.bump()
					this.resolveFlush(fileId, false)
					break
				}
			}
		} finally {
			entry.running = false
			if (entry.queued && entry.status !== FILE_SAVE_STATUS.Failed) {
				void this.run(fileId)
			}
		}
	}

	private async persistWithRetry(entry: FileSaveEntry, job: FileSaveJob): Promise<boolean> {
		while (entry.attempt < this.maxAttempts) {
			if (entry.queued) return true
			try {
				const result = await job.persist({
					fileId: job.fileId,
					content: job.content,
					enableShadow: job.enableShadow,
					baselineVersion: pickBaselineVersion(job.baselineVersion, entry.syncedVersion),
					forceOverwrite: job.forceOverwrite,
				})
				if (result?.version) entry.syncedVersion = result.version
				return true
			} catch (error) {
				entry.failReason = failReasonFromError(error)
				if (!isRetryableSaveError(error) || entry.attempt >= this.maxAttempts - 1) {
					console.error("File save persist failed", error)
					return false
				}
				entry.attempt += 1
				entry.status = FILE_SAVE_STATUS.Retrying
				this.bump()
				const wait = this.backoffMs[entry.attempt - 1] ?? this.backoffMs.at(-1) ?? 1000
				await this.delay(wait)
			}
		}
		return false
	}

	private async persistDraft(job: FileSaveJob): Promise<void> {
		const record: StoredFileSaveRecord = {
			fileId: job.fileId,
			content: job.content,
			enableShadow: job.enableShadow,
			baselineVersion: job.baselineVersion,
			updatedAt: this.now(),
		}
		if (estimateSaveRecordBytes(record) > this.draftLimits.maxBytesPerRecord) {
			// Keep the in-memory job; skip IndexedDB so one huge HTML cannot fill the store.
			return
		}
		await this.chainDraftWrite(job.fileId, async () => {
			try {
				await this.persistence.put(record)
				await this.prunePersistedDrafts()
			} catch (error) {
				console.error("Failed to mirror unsynced file save", error)
			}
		})
	}

	private async removeDraft(fileId: string, errorMessage: string): Promise<void> {
		await this.chainDraftWrite(fileId, async () => {
			try {
				await this.persistence.remove(fileId)
			} catch (error) {
				console.error(errorMessage, error)
			}
		})
	}

	/** Same-file IndexedDB writes run in call order so a late put cannot outlive a remove. */
	private chainDraftWrite(fileId: string, task: () => Promise<void>): Promise<void> {
		const previous = this.draftWrites.get(fileId)
		const next = previous ? previous.then(task) : task()
		this.draftWrites.set(fileId, next)
		void next.then(() => {
			if (this.draftWrites.get(fileId) === next) this.draftWrites.delete(fileId)
		})
		return next
	}

	private async prunePersistedDrafts(): Promise<void> {
		const records = await this.persistence.getAll()
		const dropIds = listDraftFileIdsToDrop(records, this.now(), this.draftLimits)
		await Promise.all(dropIds.map((fileId) => this.persistence.remove(fileId)))
	}

	private notifyDraftApply(fileId: string): void {
		const handler = this.draftApplyHandlers.get(fileId)
		const content = this.peekUnsyncedDraft(fileId)
		if (!handler || content === undefined) return
		void Promise.resolve(handler(content)).catch((error) => {
			console.error("Failed to apply recovered file save draft", error)
		})
	}

	private resolveFlush(fileId: string, ok: boolean): void {
		const waiters = this.flushWaiters.get(fileId)
		if (!waiters?.length) return
		this.flushWaiters.delete(fileId)
		waiters.forEach((resolve) => resolve(ok))
	}

	private bump(): void {
		this.revision += 1
		this.syncBeforeUnload()
		this.listeners.forEach((listener) => listener())
	}

	private syncBeforeUnload(): void {
		if (typeof window === "undefined") return
		const shouldBlock = this.hasUnsynced()
		if (shouldBlock && !this.beforeUnloadAttached) {
			window.addEventListener("beforeunload", this.handleBeforeUnload)
			this.beforeUnloadAttached = true
			return
		}
		if (!shouldBlock && this.beforeUnloadAttached) {
			window.removeEventListener("beforeunload", this.handleBeforeUnload)
			this.beforeUnloadAttached = false
		}
	}

	private handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (!this.hasUnsynced()) return
		event.preventDefault()
		event.returnValue = ""
	}
}

let sharedQueue: FileSaveQueue | null = null

export function getFileSaveQueue(): FileSaveQueue {
	if (!sharedQueue) sharedQueue = new FileSaveQueue()
	return sharedQueue
}

export function resetFileSaveQueueForTests(queue?: FileSaveQueue): void {
	sharedQueue = queue ?? null
}

export function peekUnsyncedDraft(fileId: string, queue = getFileSaveQueue()): unknown | undefined {
	return queue.peekUnsyncedDraft(fileId)
}

export async function enqueueOptimisticSave(
	job: FileSaveJob,
	options?: { awaitPersist?: boolean },
	queue = getFileSaveQueue(),
): Promise<boolean> {
	queue.enqueue(job)
	if (options?.awaitPersist) return queue.flush(job.fileId)
	return true
}

export async function flushFileSaves(fileIds?: string[]): Promise<boolean> {
	const queue = getFileSaveQueue()
	if (!fileIds?.length) {
		if (!queue.hasUnsynced()) return true
		return queue.flushAll()
	}
	const results = await Promise.all(
		fileIds.map((fileId) =>
			queue.hasPending(fileId) ? queue.flush(fileId) : Promise.resolve(true),
		),
	)
	return results.every(Boolean)
}
