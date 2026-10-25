import Dexie, { type Table } from "dexie"
import type { DesignData } from "../types"

export const DESIGN_DRAFT_SCHEMA_VERSION = 1
const DB_NAME = "MAGIC:supermagic-design:drafts"
const LOCAL_STORAGE_KEY_PREFIX = "MAGIC:supermagic-design:draft:"
const DRAFT_WRITE_DEBOUNCE_MS = 300
const MAX_DRAFTS_PER_PROJECT = 20

export type DesignDraftReason = "local-edit" | "pagehide" | "manual-refresh"
export type DesignDraftWriteTarget = "indexeddb" | "localStorage" | "memory" | "none"

export interface DesignDraftWriteResult {
	target: DesignDraftWriteTarget
	durable: boolean
}

export interface DesignDraftIdentity {
	projectId?: string
	designProjectId?: string
	magicProjectJsFileId?: string | null
}

export interface DesignDraftEntry extends DesignDraftIdentity {
	key: string
	schemaVersion: typeof DESIGN_DRAFT_SCHEMA_VERSION
	designProjectBasePath?: string
	baseRemoteFingerprint: string
	localFingerprint: string
	localUpdatedAt: number
	reason: DesignDraftReason
	designData: DesignData
	baseRemoteData?: DesignData
}

class DesignDraftDatabase extends Dexie {
	entries!: Table<DesignDraftEntry, string>

	constructor() {
		super(DB_NAME)
		this.version(1).stores({
			entries:
				"key, projectId, designProjectId, magicProjectJsFileId, localUpdatedAt, baseRemoteVersion",
		})
	}
}

let dbPromise: Promise<DesignDraftDatabase> | null = null
const pendingWrites = new Set<Promise<unknown>>()
const memoryDrafts = new Map<string, DesignDraftEntry>()
const draftWriteGenerations = new Map<string, number>()

export function getDesignDraftWriteDebounceMs(): number {
	return DRAFT_WRITE_DEBOUNCE_MS
}

function canUseIndexedDb(): boolean {
	return typeof indexedDB !== "undefined"
}

async function getDatabase(): Promise<DesignDraftDatabase> {
	if (!canUseIndexedDb()) {
		throw new Error("IndexedDB is unavailable")
	}
	if (dbPromise) return dbPromise
	dbPromise = (async () => {
		const db = new DesignDraftDatabase()
		await db.open()
		return db
	})().catch((error) => {
		dbPromise = null
		throw error
	})
	return dbPromise
}

function trackWrite<T>(promise: Promise<T>): Promise<T> {
	pendingWrites.add(promise)
	promise.then(
		() => pendingWrites.delete(promise),
		() => pendingWrites.delete(promise),
	)
	return promise
}

function advanceDraftWriteGeneration(key: string): number {
	const nextGeneration = (draftWriteGenerations.get(key) ?? 0) + 1
	draftWriteGenerations.set(key, nextGeneration)
	return nextGeneration
}

function isCurrentDraftWriteGeneration(key: string, generation: number): boolean {
	return draftWriteGenerations.get(key) === generation
}

function normalizeIdentityPart(value: string | null | undefined): string {
	return value?.trim() || "_"
}

export function buildDesignDraftKey(identity: DesignDraftIdentity): string {
	return [
		"v1",
		normalizeIdentityPart(identity.projectId),
		normalizeIdentityPart(identity.designProjectId),
		normalizeIdentityPart(identity.magicProjectJsFileId),
	].join(":")
}

function cloneDesignData(data: DesignData): DesignData {
	return JSON.parse(JSON.stringify(data)) as DesignData
}

function cloneDraftEntry(entry: DesignDraftEntry): DesignDraftEntry {
	return {
		...entry,
		designData: cloneDesignData(entry.designData),
		baseRemoteData: entry.baseRemoteData ? cloneDesignData(entry.baseRemoteData) : undefined,
	}
}

function tryBuildDraftEntry(
	entry: Omit<DesignDraftEntry, "key" | "schemaVersion" | "designData" | "baseRemoteData"> & {
		designData: DesignData
		baseRemoteData?: DesignData
	},
): DesignDraftEntry | null {
	try {
		return {
			...entry,
			key: buildDesignDraftKey(entry),
			schemaVersion: DESIGN_DRAFT_SCHEMA_VERSION,
			designData: cloneDesignData(entry.designData),
			baseRemoteData: entry.baseRemoteData
				? cloneDesignData(entry.baseRemoteData)
				: undefined,
		}
	} catch {
		return null
	}
}

function chooseLatestDraft(
	entries: Array<DesignDraftEntry | null | undefined>,
): DesignDraftEntry | null {
	return (
		entries
			.filter((entry): entry is DesignDraftEntry => !!entry)
			.sort((a, b) => b.localUpdatedAt - a.localUpdatedAt)[0] ?? null
	)
}

async function pruneProjectDrafts(db: DesignDraftDatabase, projectId?: string): Promise<void> {
	if (!projectId) return
	const entries = await db.entries.where("projectId").equals(projectId).toArray()
	if (entries.length <= MAX_DRAFTS_PER_PROJECT) return
	const staleKeys = entries
		.sort((a, b) => b.localUpdatedAt - a.localUpdatedAt)
		.slice(MAX_DRAFTS_PER_PROJECT)
		.map((entry) => entry.key)
	if (staleKeys.length) {
		await db.entries.bulkDelete(staleKeys)
	}
}

async function writeIndexedDbDraft(entry: DesignDraftEntry, generation: number): Promise<void> {
	if (!isCurrentDraftWriteGeneration(entry.key, generation)) return
	const db = await getDatabase()
	if (!isCurrentDraftWriteGeneration(entry.key, generation)) return
	await db.entries.put(entry)
	if (!isCurrentDraftWriteGeneration(entry.key, generation)) return
	await pruneProjectDrafts(db, entry.projectId)
}

async function readIndexedDbDrafts(identity: DesignDraftIdentity): Promise<DesignDraftEntry[]> {
	const db = await getDatabase()
	const exactKey = buildDesignDraftKey(identity)
	const exact = await db.entries.get(exactKey)
	if (exact) return [exact]

	if (!identity.magicProjectJsFileId || !identity.projectId || !identity.designProjectId) {
		return []
	}

	const candidates = await db.entries
		.where("magicProjectJsFileId")
		.equals(identity.magicProjectJsFileId)
		.toArray()
	return candidates.filter(
		(entry) =>
			entry.projectId === identity.projectId &&
			entry.designProjectId === identity.designProjectId,
	)
}

function getLocalStorage(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null
		return localStorage
	} catch {
		return null
	}
}

function buildLocalStorageKey(key: string): string {
	return `${LOCAL_STORAGE_KEY_PREFIX}${key}`
}

function parseStoredDraft(value: string | null): DesignDraftEntry | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as Partial<DesignDraftEntry>
		if (
			parsed.schemaVersion !== DESIGN_DRAFT_SCHEMA_VERSION ||
			!parsed.key ||
			!parsed.designData
		) {
			return null
		}
		return parsed as DesignDraftEntry
	} catch {
		return null
	}
}

function readLocalStorageDrafts(identity: DesignDraftIdentity): DesignDraftEntry[] {
	const storage = getLocalStorage()
	if (!storage) return []

	const exactKey = buildDesignDraftKey(identity)
	const exact = parseStoredDraft(storage.getItem(buildLocalStorageKey(exactKey)))
	if (exact) return [exact]

	if (!identity.magicProjectJsFileId || !identity.projectId || !identity.designProjectId) {
		return []
	}

	const candidates: DesignDraftEntry[] = []
	try {
		for (let index = 0; index < storage.length; index += 1) {
			const storageKey = storage.key(index)
			if (!storageKey?.startsWith(LOCAL_STORAGE_KEY_PREFIX)) continue
			const draft = parseStoredDraft(storage.getItem(storageKey))
			if (
				draft &&
				draft.magicProjectJsFileId === identity.magicProjectJsFileId &&
				draft.projectId === identity.projectId &&
				draft.designProjectId === identity.designProjectId
			) {
				candidates.push(draft)
			}
		}
	} catch {
		return []
	}
	return candidates
}

function pruneLocalStorageDrafts(projectId?: string): void {
	const storage = getLocalStorage()
	if (!storage || !projectId) return
	const drafts: DesignDraftEntry[] = []
	try {
		for (let index = 0; index < storage.length; index += 1) {
			const storageKey = storage.key(index)
			if (!storageKey?.startsWith(LOCAL_STORAGE_KEY_PREFIX)) continue
			const draft = parseStoredDraft(storage.getItem(storageKey))
			if (draft?.projectId === projectId) drafts.push(draft)
		}
		drafts
			.sort((a, b) => b.localUpdatedAt - a.localUpdatedAt)
			.slice(MAX_DRAFTS_PER_PROJECT)
			.forEach((draft) => storage.removeItem(buildLocalStorageKey(draft.key)))
	} catch {
		// ignore
	}
}

function writeLocalStorageDraft(entry: DesignDraftEntry, options?: { prune?: boolean }): boolean {
	const storage = getLocalStorage()
	if (!storage) return false
	try {
		storage.setItem(buildLocalStorageKey(entry.key), JSON.stringify(entry))
		if (options?.prune !== false) pruneLocalStorageDrafts(entry.projectId)
		return true
	} catch {
		return false
	}
}

function withoutDraftBaseRemoteData(entry: DesignDraftEntry): DesignDraftEntry {
	const draft = { ...entry }
	delete draft.baseRemoteData
	return draft
}

function writeLocalStorageDraftWithFallback(
	entry: DesignDraftEntry,
	options?: { prune?: boolean },
): boolean {
	if (writeLocalStorageDraft(entry, options)) return true
	if (!entry.baseRemoteData) return false
	return writeLocalStorageDraft(withoutDraftBaseRemoteData(entry), options)
}

function deleteLocalStorageDrafts(keys: Set<string>): void {
	const storage = getLocalStorage()
	if (!storage) return
	try {
		keys.forEach((key) => storage.removeItem(buildLocalStorageKey(key)))
	} catch {
		// ignore
	}
}

function writeMemoryDraft(entry: DesignDraftEntry): boolean {
	try {
		memoryDrafts.set(entry.key, cloneDraftEntry(entry))
		if (entry.projectId) {
			Array.from(memoryDrafts.values())
				.filter((draft) => draft.projectId === entry.projectId)
				.sort((a, b) => b.localUpdatedAt - a.localUpdatedAt)
				.slice(MAX_DRAFTS_PER_PROJECT)
				.forEach((draft) => memoryDrafts.delete(draft.key))
		}
		return true
	} catch {
		return false
	}
}

function readMemoryDrafts(identity: DesignDraftIdentity): DesignDraftEntry[] {
	const exactKey = buildDesignDraftKey(identity)
	const exact = memoryDrafts.get(exactKey)
	if (exact) return [cloneDraftEntry(exact)]

	if (!identity.magicProjectJsFileId || !identity.projectId || !identity.designProjectId) {
		return []
	}

	return Array.from(memoryDrafts.values())
		.filter(
			(entry) =>
				entry.magicProjectJsFileId === identity.magicProjectJsFileId &&
				entry.projectId === identity.projectId &&
				entry.designProjectId === identity.designProjectId,
		)
		.map(cloneDraftEntry)
}

function deleteMemoryDrafts(keys: Set<string>): void {
	keys.forEach((key) => memoryDrafts.delete(key))
}

function deleteMemoryDraftCoveredBy(entry: DesignDraftEntry): void {
	const retained = memoryDrafts.get(entry.key)
	if (!retained) return
	// Overlapping writes for one document may settle out of order. An older durable write must not
	// remove a newer emergency fallback that still exists only in memory.
	if (
		retained.localUpdatedAt < entry.localUpdatedAt ||
		(retained.localUpdatedAt === entry.localUpdatedAt &&
			retained.localFingerprint === entry.localFingerprint)
	) {
		memoryDrafts.delete(entry.key)
	}
}

export function writeDesignDraft(
	entry: Omit<DesignDraftEntry, "key" | "schemaVersion" | "designData" | "baseRemoteData"> & {
		designData: DesignData
		baseRemoteData?: DesignData
	},
	options: { emergency?: boolean } = {},
): Promise<DesignDraftWriteResult> {
	const draft = tryBuildDraftEntry(entry)
	if (!draft) {
		return Promise.resolve({ target: "none", durable: false })
	}
	const generation = advanceDraftWriteGeneration(draft.key)
	const memoryResult = (): DesignDraftWriteResult =>
		writeMemoryDraft(draft)
			? { target: "memory", durable: false }
			: { target: "none", durable: false }

	if (options.emergency) {
		const localStorageOk = writeLocalStorageDraftWithFallback(draft, { prune: false })
		// A durable synchronous copy already covers pagehide. Keep a heap copy only when that write
		// failed, then discard it as soon as IndexedDB confirms the same draft.
		const memoryOk = localStorageOk ? false : writeMemoryDraft(draft)
		if (localStorageOk) {
			deleteMemoryDraftCoveredBy(draft)
		}
		const fallbackResult: DesignDraftWriteResult = localStorageOk
			? { target: "localStorage", durable: true }
			: memoryOk
				? { target: "memory", durable: false }
				: { target: "none", durable: false }

		return trackWrite(
			writeIndexedDbDraft(draft, generation)
				.then<DesignDraftWriteResult>(() => {
					deleteMemoryDraftCoveredBy(draft)
					return { target: "indexeddb", durable: true }
				})
				.catch(() => fallbackResult),
		)
	}

	return trackWrite(
		(async (): Promise<DesignDraftWriteResult> => {
			try {
				await writeIndexedDbDraft(draft, generation)
				deleteMemoryDraftCoveredBy(draft)
				return { target: "indexeddb", durable: true }
			} catch {
				if (writeLocalStorageDraftWithFallback(draft)) {
					deleteMemoryDraftCoveredBy(draft)
					return { target: "localStorage", durable: true }
				}
				return memoryResult()
			}
		})(),
	)
}

export async function readDesignDraft(
	identity: DesignDraftIdentity,
): Promise<DesignDraftEntry | null> {
	const candidates: DesignDraftEntry[] = []
	try {
		candidates.push(...(await readIndexedDbDrafts(identity)))
	} catch {
		// ignore
	}
	candidates.push(...readLocalStorageDrafts(identity), ...readMemoryDrafts(identity))
	return chooseLatestDraft(candidates)
}

function getDraftStorageKeys(identity: DesignDraftIdentity): Set<string> {
	const keys = new Set<string>([buildDesignDraftKey(identity)])
	if (identity.magicProjectJsFileId) {
		keys.add(
			buildDesignDraftKey({
				...identity,
				magicProjectJsFileId: null,
			}),
		)
	}
	return keys
}

/**
 * Clear only the draft that was covered by a confirmed remote save.
 * A newer write advances the generation while this operation is awaiting storage, so an older
 * save response cannot delete a newer recovery draft.
 */
export function deleteDesignDraftIfMatches(
	identity: DesignDraftIdentity,
	expectedLocalFingerprint: string,
): Promise<void> {
	const keys = getDraftStorageKeys(identity)
	const clearGenerations = new Map(
		Array.from(keys, (key) => [key, draftWriteGenerations.get(key) ?? 0] as const),
	)
	const writesToAwait = Array.from(pendingWrites)

	return trackWrite(
		(async () => {
			await Promise.allSettled(writesToAwait)
			if (
				Array.from(clearGenerations).some(
					([key, generation]) => !isCurrentDraftWriteGeneration(key, generation),
				)
			) {
				return
			}

			const draft = await readDesignDraft(identity)
			if (!draft || draft.localFingerprint !== expectedLocalFingerprint) return
			if (
				Array.from(clearGenerations).some(
					([key, generation]) => !isCurrentDraftWriteGeneration(key, generation),
				)
			) {
				return
			}

			const db = await getDatabase().catch(() => null)
			if (
				Array.from(clearGenerations).some(
					([key, generation]) => !isCurrentDraftWriteGeneration(key, generation),
				)
			) {
				return
			}

			deleteLocalStorageDrafts(keys)
			deleteMemoryDrafts(keys)
			if (db) await db.entries.bulkDelete(Array.from(keys))
		})(),
	).catch(() => undefined)
}

export function deleteDesignDraft(
	identity: DesignDraftIdentity,
	expectedLocalFingerprint?: string,
): Promise<void> {
	if (expectedLocalFingerprint) {
		return deleteDesignDraftIfMatches(identity, expectedLocalFingerprint)
	}

	const keys = getDraftStorageKeys(identity)
	const deleteGenerations = new Map(
		Array.from(keys, (key) => [key, advanceDraftWriteGeneration(key)] as const),
	)
	const writesToAwait = Array.from(pendingWrites)
	return trackWrite(
		(async () => {
			await Promise.allSettled(writesToAwait)
			if (
				Array.from(deleteGenerations).some(
					([key, generation]) => !isCurrentDraftWriteGeneration(key, generation),
				)
			) {
				return
			}

			const db = await getDatabase().catch(() => null)
			if (
				Array.from(deleteGenerations).some(
					([key, generation]) => !isCurrentDraftWriteGeneration(key, generation),
				)
			) {
				return
			}

			deleteLocalStorageDrafts(keys)
			deleteMemoryDrafts(keys)
			if (db) await db.entries.bulkDelete(Array.from(keys))
		})(),
	).catch(() => undefined)
}

export async function flushDesignDraftWrites(): Promise<void> {
	const writes: Promise<unknown>[] = []
	pendingWrites.forEach((write) => writes.push(write))
	await Promise.allSettled(writes)
}
