export const FILE_SAVE_STATUS = {
	Idle: "idle",
	Saving: "saving",
	Retrying: "retrying",
	Failed: "failed",
} as const

export type FileSaveStatus = (typeof FILE_SAVE_STATUS)[keyof typeof FILE_SAVE_STATUS]

export const FILE_SAVE_FAIL_REASON = {
	Network: "network",
	Conflict: "conflict",
	Permanent: "permanent",
} as const

export type FileSaveFailReason = (typeof FILE_SAVE_FAIL_REASON)[keyof typeof FILE_SAVE_FAIL_REASON]

export interface FileSavePersistRequest {
	fileId: string
	content: unknown
	enableShadow: boolean
	baselineVersion?: string
	/** Skip the remote-version check after a user chooses overwrite. */
	forceOverwrite?: boolean
}

export interface FileSavePersistResult {
	/** Remote version after this save, used to rebase queued follow-up saves. */
	version?: string
}

export interface FileSaveJob {
	fileId: string
	content: unknown
	enableShadow: boolean
	baselineVersion?: string
	forceOverwrite?: boolean
	silent?: boolean
	persist: (request: FileSavePersistRequest) => Promise<void | FileSavePersistResult>
	onSuccess?: (job: FileSaveJob) => void | Promise<void>
}

export interface FileSaveSnapshot {
	fileId: string
	status: FileSaveStatus
	pendingContent?: unknown
	lastSyncedContent?: string
	baselineVersion?: string
	failReason?: FileSaveFailReason
	attempt: number
}

export interface StoredFileSaveRecord {
	fileId: string
	content: unknown
	enableShadow: boolean
	baselineVersion?: string
	updatedAt: number
}

export interface FileSavePersistence {
	put(record: StoredFileSaveRecord): Promise<void>
	get(fileId: string): Promise<StoredFileSaveRecord | undefined>
	getAll(): Promise<StoredFileSaveRecord[]>
	remove(fileId: string): Promise<void>
}

export interface FileSaveQueueOptions {
	persistence?: FileSavePersistence
	delay?: (ms: number) => Promise<void>
	now?: () => number
	maxAttempts?: number
	backoffMs?: number[]
	draftTtlMs?: number
	maxDraftRecords?: number
	maxDraftBytesPerRecord?: number
	maxDraftTotalBytes?: number
}

export class FileSaveConflictError extends Error {
	override name = "FileSaveConflictError"

	constructor(message = "Remote file changed before persist") {
		super(message)
	}
}

export class FileSavePermanentError extends Error {
	override name = "FileSavePermanentError"

	constructor(message = "File save is not retryable") {
		super(message)
	}
}

export class FileSaveRetryableError extends Error {
	override name = "FileSaveRetryableError"

	constructor(message = "File save failed and can be retried") {
		super(message)
	}
}
