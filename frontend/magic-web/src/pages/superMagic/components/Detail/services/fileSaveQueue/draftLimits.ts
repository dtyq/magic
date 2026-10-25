import type { StoredFileSaveRecord } from "./types"

/** Drop crash-recovery drafts older than this. */
export const FILE_SAVE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Keep only the newest N unsynced files in IndexedDB. */
export const FILE_SAVE_DRAFT_MAX_RECORDS = 30
/** Skip mirroring a single draft larger than this. */
export const FILE_SAVE_DRAFT_MAX_BYTES_PER_RECORD = 2 * 1024 * 1024
/** Bound total IndexedDB payload for unsynced drafts. */
export const FILE_SAVE_DRAFT_MAX_TOTAL_BYTES = 8 * 1024 * 1024

export interface FileSaveDraftLimits {
	ttlMs: number
	maxRecords: number
	maxBytesPerRecord: number
	maxTotalBytes: number
}

export const DEFAULT_FILE_SAVE_DRAFT_LIMITS: FileSaveDraftLimits = {
	ttlMs: FILE_SAVE_DRAFT_TTL_MS,
	maxRecords: FILE_SAVE_DRAFT_MAX_RECORDS,
	maxBytesPerRecord: FILE_SAVE_DRAFT_MAX_BYTES_PER_RECORD,
	maxTotalBytes: FILE_SAVE_DRAFT_MAX_TOTAL_BYTES,
}

export function stringifyDraftContent(content: unknown): string {
	return typeof content === "string" ? content : JSON.stringify(content)
}

export function estimateSaveRecordBytes(record: StoredFileSaveRecord): number {
	try {
		return new TextEncoder().encode(stringifyDraftContent(record.content)).length
	} catch {
		return stringifyDraftContent(record.content).length
	}
}

/** Prefer newer drafts; drop expired, excess count, and overflow bytes. */
export function listDraftFileIdsToDrop(
	records: StoredFileSaveRecord[],
	now: number,
	limits: Pick<FileSaveDraftLimits, "ttlMs" | "maxRecords" | "maxTotalBytes">,
): string[] {
	const drop = new Set<string>()
	const alive: StoredFileSaveRecord[] = []
	for (const record of records) {
		if (now - record.updatedAt > limits.ttlMs) {
			drop.add(record.fileId)
			continue
		}
		alive.push(record)
	}

	const newestFirst = [...alive].sort((left, right) => right.updatedAt - left.updatedAt)
	let totalBytes = 0
	let kept = 0
	for (const record of newestFirst) {
		const size = estimateSaveRecordBytes(record)
		if (kept >= limits.maxRecords || totalBytes + size > limits.maxTotalBytes) {
			drop.add(record.fileId)
			continue
		}
		kept += 1
		totalBytes += size
	}
	return [...drop]
}
