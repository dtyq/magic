import type { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { parseExpiresAt } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"

/** Session-scoped persistence for exchanged thumbnail signed URLs. */
export const SHARED_MEDIA_THUMBNAIL_URL_SESSION_PREFIX = "magic:shared-media-url:thumb:"
/** Soft cap so long browsing sessions cannot grow sessionStorage without bound. */
export const SHARED_MEDIA_THUMBNAIL_SESSION_MAX_ENTRIES = 2048
const THUMBNAIL_SESSION_EXPIRY_SAFETY_WINDOW_MS = 30_000
const THUMBNAIL_SESSION_FALLBACK_TTL_MS = 15 * 60 * 1000

export interface SharedMediaThumbnailSessionIdentity {
	scope: string
	fileId: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	downloadMode?: DownloadImageMode | null
}

/**
 * Slim identity key stored for hash-collision checks.
 * Omits fixed thumbnail fields (imageProcess / source / isDownload / cache)
 * and scope (already part of the sessionStorage key prefix).
 */
export interface SlimThumbnailSessionRequestKey {
	fileId: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
	downloadMode?: DownloadImageMode | null
}

export interface PersistedSharedMediaThumbnailUrlRecord {
	requestKey: string
	fileId: string
	url: string
	expiresAt?: string
	cachedAt: number
}

function getSessionStorage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage
	} catch {
		return null
	}
}

function stableSerialize(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return "undefined"
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
		return `{${entries
			.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
			.join(",")}}`
	}
	return JSON.stringify(value) ?? "null"
}

export function buildSlimThumbnailSessionRequestKey(
	identity: SharedMediaThumbnailSessionIdentity,
): string {
	const slim: SlimThumbnailSessionRequestKey = {
		fileId: identity.fileId,
	}
	if (identity.fileVersion !== undefined) slim.fileVersion = identity.fileVersion
	if (identity.updatedAt) slim.updatedAt = identity.updatedAt
	if (identity.resourceVersion) slim.resourceVersion = identity.resourceVersion
	if (identity.downloadMode !== undefined && identity.downloadMode !== null) {
		slim.downloadMode = identity.downloadMode
	}
	return stableSerialize(slim)
}

function hashRequestKey(requestKey: string): string {
	let hash = 2166136261
	for (let index = 0; index < requestKey.length; index += 1) {
		hash ^= requestKey.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(36)
}

function buildStorageKey(scope: string, slimRequestKey: string): string {
	return `${SHARED_MEDIA_THUMBNAIL_URL_SESSION_PREFIX}${scope}::${hashRequestKey(slimRequestKey)}`
}

function parseRecord(raw: string | null): PersistedSharedMediaThumbnailUrlRecord | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as PersistedSharedMediaThumbnailUrlRecord
		if (!parsed.requestKey || !parsed.fileId) return null
		if (!parsed.url || typeof parsed.cachedAt !== "number") return null
		return parsed
	} catch {
		return null
	}
}

function isPersistedThumbnailRecordValid(
	record: PersistedSharedMediaThumbnailUrlRecord,
	now = Date.now(),
): boolean {
	const expiresAt = parseExpiresAt(record.expiresAt)
	if (expiresAt !== null) {
		return expiresAt - now > THUMBNAIL_SESSION_EXPIRY_SAFETY_WINDOW_MS
	}
	return now - record.cachedAt < THUMBNAIL_SESSION_FALLBACK_TTL_MS
}

function listPersistedThumbnailEntries(): Array<{
	key: string
	record: PersistedSharedMediaThumbnailUrlRecord
}> {
	const storage = getSessionStorage()
	if (!storage) return []

	const entries: Array<{ key: string; record: PersistedSharedMediaThumbnailUrlRecord }> = []
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index)
		if (!key?.startsWith(SHARED_MEDIA_THUMBNAIL_URL_SESSION_PREFIX)) continue
		const record = parseRecord(storage.getItem(key))
		if (!record) {
			try {
				storage.removeItem(key)
			} catch {
				// Ignore storage failures while cleaning corrupt entries.
			}
			continue
		}
		entries.push({ key, record })
	}
	return entries
}

/** Drop expired thumbnail URLs, then evict oldest records past the soft cap. */
export function prunePersistedSharedMediaThumbnailUrls(
	maxEntries = SHARED_MEDIA_THUMBNAIL_SESSION_MAX_ENTRIES,
): void {
	const storage = getSessionStorage()
	if (!storage) return

	const now = Date.now()
	const alive: Array<{ key: string; record: PersistedSharedMediaThumbnailUrlRecord }> = []
	for (const entry of listPersistedThumbnailEntries()) {
		if (isPersistedThumbnailRecordValid(entry.record, now)) {
			alive.push(entry)
			continue
		}
		try {
			storage.removeItem(entry.key)
		} catch {
			// Ignore storage failures while evicting expired URLs.
		}
	}

	if (alive.length <= maxEntries) return

	alive.sort((left, right) => left.record.cachedAt - right.record.cachedAt)
	const overflow = alive.length - maxEntries
	for (let index = 0; index < overflow; index += 1) {
		try {
			storage.removeItem(alive[index].key)
		} catch {
			// Ignore storage failures while enforcing the soft cap.
		}
	}
}

function forEachMatchingKey(
	match: (key: string, record: PersistedSharedMediaThumbnailUrlRecord) => boolean,
) {
	const storage = getSessionStorage()
	if (!storage) return

	for (let index = storage.length - 1; index >= 0; index -= 1) {
		const key = storage.key(index)
		if (!key?.startsWith(SHARED_MEDIA_THUMBNAIL_URL_SESSION_PREFIX)) continue
		const record = parseRecord(storage.getItem(key))
		if (!record) {
			try {
				storage.removeItem(key)
			} catch {
				// Ignore storage failures while cleaning corrupt entries.
			}
			continue
		}
		if (!match(key, record)) continue
		try {
			storage.removeItem(key)
		} catch {
			// Ignore storage failures while evicting persisted URLs.
		}
	}
}

export function readPersistedSharedMediaThumbnailUrl(
	identity: SharedMediaThumbnailSessionIdentity,
): PersistedSharedMediaThumbnailUrlRecord | null {
	const storage = getSessionStorage()
	if (!storage) return null

	const slimRequestKey = buildSlimThumbnailSessionRequestKey(identity)
	const storageKey = buildStorageKey(identity.scope, slimRequestKey)
	const record = parseRecord(storage.getItem(storageKey))
	if (!record) return null
	if (record.requestKey !== slimRequestKey) return null
	if (!isPersistedThumbnailRecordValid(record)) {
		try {
			storage.removeItem(storageKey)
		} catch {
			// Ignore storage failures while dropping expired URLs.
		}
		return null
	}
	return record
}

export function writePersistedSharedMediaThumbnailUrl(params: {
	identity: SharedMediaThumbnailSessionIdentity
	url: string
	expiresAt?: string
	cachedAt: number
}): void {
	const storage = getSessionStorage()
	if (!storage) return

	const slimRequestKey = buildSlimThumbnailSessionRequestKey(params.identity)
	const record: PersistedSharedMediaThumbnailUrlRecord = {
		requestKey: slimRequestKey,
		fileId: params.identity.fileId,
		url: params.url,
		cachedAt: params.cachedAt,
	}
	if (params.expiresAt) record.expiresAt = params.expiresAt

	const storageKey = buildStorageKey(params.identity.scope, slimRequestKey)
	const write = () => {
		storage.setItem(storageKey, JSON.stringify(record))
		prunePersistedSharedMediaThumbnailUrls()
	}

	try {
		write()
	} catch {
		// Quota pressure: evict then retry once before falling back to memory-only.
		try {
			prunePersistedSharedMediaThumbnailUrls(
				Math.max(1, Math.floor(SHARED_MEDIA_THUMBNAIL_SESSION_MAX_ENTRIES / 2)),
			)
			write()
		} catch {
			// Quota / private mode: keep the in-memory cache only.
		}
	}
}

export function removePersistedSharedMediaThumbnailUrl(
	identity: SharedMediaThumbnailSessionIdentity,
): void {
	const storage = getSessionStorage()
	if (!storage) return

	try {
		const slimRequestKey = buildSlimThumbnailSessionRequestKey(identity)
		storage.removeItem(buildStorageKey(identity.scope, slimRequestKey))
	} catch {
		// Ignore storage failures while invalidating a single URL.
	}
}

export function removePersistedSharedMediaThumbnailUrlsByFileId(fileId: string): void {
	if (!fileId) return
	forEachMatchingKey((_key, record) => record.fileId === fileId)
}

export function removePersistedSharedMediaThumbnailUrlsByScope(scope: string): void {
	if (!scope) return
	const prefix = `${SHARED_MEDIA_THUMBNAIL_URL_SESSION_PREFIX}${scope}::`
	forEachMatchingKey((key) => key.startsWith(prefix))
}

export function clearPersistedSharedMediaThumbnailUrls(): void {
	forEachMatchingKey(() => true)
}
