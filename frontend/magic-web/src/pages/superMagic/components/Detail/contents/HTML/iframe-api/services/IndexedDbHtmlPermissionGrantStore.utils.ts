import type { HtmlPermissionScope } from "../types"
import { isSupportedHtmlPermissionScope } from "./htmlPermissionPolicy"
import type { HtmlPermissionGrant, HtmlPermissionGrantIdentity } from "./HtmlPermissionGrantStore"

export const HTML_PERMISSION_DB_NAME = "magic-html-permission-grants"
export const HTML_PERMISSION_DB_VERSION = 1
export const GRANTS_STORE_NAME = "grants"
export const META_STORE_NAME = "meta"
export const EPOCH_META_KEY = "epoch"
export const REVISION_META_KEY = "revision"
export const REVOCATION_META_PREFIX = "revoked:"
const HTML_PERMISSION_DB_OPEN_TIMEOUT_MS = 3000

export interface StoredHtmlPermissionGrant {
	key: string
	appKey: string
	scope: HtmlPermissionScope
	grantedAt: number
	expiresAt: number | null
	/** Optional: grants written before code-change tracking have none. */
	codeFingerprint?: string
	reuseAcrossCodeChanges?: boolean
	epoch: number
}

export interface StoredHtmlPermissionEpoch {
	key: typeof EPOCH_META_KEY
	value: number
}

export interface StoredHtmlPermissionRevision {
	key: typeof REVISION_META_KEY
	value: number
}

export interface StoredHtmlPermissionRevocation {
	key: string
	value: { epoch: number; revision: number }
}

export interface HtmlPermissionGrantState {
	epoch: number
	revision: number
}

export interface HtmlPermissionGrantChange {
	type: "changed"
	epoch: number
	revision: number
	cleared?: boolean
}

export function toHtmlPermissionGrant(
	identity: HtmlPermissionGrantIdentity,
	record: StoredHtmlPermissionGrant,
): HtmlPermissionGrant {
	return {
		...identity,
		scope: record.scope,
		grantedAt: record.grantedAt,
		expiresAt: record.expiresAt,
		...(record.codeFingerprint ? { codeFingerprint: record.codeFingerprint } : {}),
		...(record.reuseAcrossCodeChanges === true ? { reuseAcrossCodeChanges: true } : {}),
	}
}

export function grantRecordKey(appKey: string, scope: HtmlPermissionScope): string {
	return `${appKey}:${scope}`
}

export function compareHtmlPermissionGrantEvictionPriority(
	a: Pick<StoredHtmlPermissionGrant, "expiresAt" | "grantedAt">,
	b: Pick<StoredHtmlPermissionGrant, "expiresAt" | "grantedAt">,
): number {
	if (a.expiresAt === null && b.expiresAt !== null) return 1
	if (a.expiresAt !== null && b.expiresAt === null) return -1
	return (
		(a.expiresAt ?? Number.POSITIVE_INFINITY) - (b.expiresAt ?? Number.POSITIVE_INFINITY) ||
		a.grantedAt - b.grantedAt
	)
}

export function isValidStoredGrant(value: unknown): value is StoredHtmlPermissionGrant {
	if (!value || typeof value !== "object") return false
	const grant = value as Partial<StoredHtmlPermissionGrant>
	return (
		typeof grant.key === "string" &&
		typeof grant.appKey === "string" &&
		typeof grant.scope === "string" &&
		isSupportedHtmlPermissionScope(grant.scope) &&
		grant.key === grantRecordKey(grant.appKey, grant.scope) &&
		typeof grant.grantedAt === "number" &&
		Number.isFinite(grant.grantedAt) &&
		(grant.expiresAt === null ||
			(typeof grant.expiresAt === "number" && Number.isFinite(grant.expiresAt))) &&
		(grant.codeFingerprint === undefined || typeof grant.codeFingerprint === "string") &&
		(grant.reuseAcrossCodeChanges === undefined ||
			typeof grant.reuseAcrossCodeChanges === "boolean") &&
		typeof grant.epoch === "number" &&
		Number.isInteger(grant.epoch) &&
		grant.epoch >= 0
	)
}

export function getRequestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error("IndexedDB request failed"))
	})
}

export function getTransactionError(transaction: IDBTransaction): Error {
	return transaction.error || new Error("IndexedDB transaction failed")
}

export function getStoredEpoch(value: unknown): number {
	if (!value || typeof value !== "object") return 0
	const epoch = (value as Partial<StoredHtmlPermissionEpoch>).value
	return typeof epoch === "number" && Number.isInteger(epoch) && epoch >= 0 ? epoch : 0
}

export function getStoredRevision(value: unknown): number {
	if (!value || typeof value !== "object") return 0
	const revision = (value as Partial<StoredHtmlPermissionRevision>).value
	return typeof revision === "number" && Number.isInteger(revision) && revision >= 0
		? revision
		: 0
}

export function getStoredRevocation(value: unknown): StoredHtmlPermissionRevocation | undefined {
	if (!value || typeof value !== "object") return undefined
	const revocation = value as Partial<StoredHtmlPermissionRevocation>
	if (typeof revocation.key !== "string" || !revocation.key.startsWith(REVOCATION_META_PREFIX)) {
		return undefined
	}
	const state = revocation.value
	if (
		!state ||
		typeof state !== "object" ||
		typeof state.epoch !== "number" ||
		!Number.isInteger(state.epoch) ||
		state.epoch < 0 ||
		typeof state.revision !== "number" ||
		!Number.isInteger(state.revision) ||
		state.revision < 0
	) {
		return undefined
	}
	return revocation as StoredHtmlPermissionRevocation
}

export function revocationMetaKey(recordKey: string): string {
	return `${REVOCATION_META_PREFIX}${recordKey}`
}

export function openHtmlPermissionGrantDatabase(
	logError: (message: string, error: unknown) => void,
): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve(null)
	return new Promise((resolve) => {
		let request: IDBOpenDBRequest
		let settled = false
		const finish = (db: IDBDatabase | null) => {
			if (settled) {
				db?.close()
				return
			}
			settled = true
			globalThis.clearTimeout(timeoutId)
			resolve(db)
		}
		const timeoutId = globalThis.setTimeout(() => {
			logError("Permission grant IndexedDB open timed out", new Error("IndexedDB timeout"))
			finish(null)
		}, HTML_PERMISSION_DB_OPEN_TIMEOUT_MS)

		try {
			request = indexedDB.open(HTML_PERMISSION_DB_NAME, HTML_PERMISSION_DB_VERSION)
		} catch (error) {
			logError("Failed to open permission grant IndexedDB", error)
			finish(null)
			return
		}
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(GRANTS_STORE_NAME)) {
				const grantsStore = db.createObjectStore(GRANTS_STORE_NAME, { keyPath: "key" })
				grantsStore.createIndex("appKey", "appKey", { unique: false })
				grantsStore.createIndex("epoch", "epoch", { unique: false })
			}
			if (!db.objectStoreNames.contains(META_STORE_NAME)) {
				db.createObjectStore(META_STORE_NAME, { keyPath: "key" })
			}
		}
		request.onsuccess = () => {
			const db = request.result
			db.onversionchange = () => db.close()
			finish(db)
		}
		request.onerror = () => {
			logError("Failed to open permission grant IndexedDB", request.error)
			finish(null)
		}
		request.onblocked = () => {
			logError(
				"Permission grant IndexedDB open was blocked",
				new Error("IndexedDB open blocked"),
			)
			finish(null)
		}
	})
}

export async function readHtmlPermissionGrantState(
	db: IDBDatabase,
): Promise<HtmlPermissionGrantState> {
	return readHtmlPermissionGrantStateInTransaction(db.transaction(META_STORE_NAME, "readonly"))
}

export async function readHtmlPermissionGrantStateInTransaction(
	transaction: IDBTransaction,
): Promise<HtmlPermissionGrantState> {
	const metaStore = transaction.objectStore(META_STORE_NAME)
	const [epochRecord, revisionRecord] = await Promise.all([
		getRequestResult(metaStore.get(EPOCH_META_KEY)),
		getRequestResult(metaStore.get(REVISION_META_KEY)),
	])
	return {
		epoch: getStoredEpoch(epochRecord),
		revision: getStoredRevision(revisionRecord),
	}
}

export function putHtmlPermissionGrantRevision(
	metaStore: IDBObjectStore,
	revision: number,
): Promise<unknown> {
	return getRequestResult(
		metaStore.put({
			key: REVISION_META_KEY,
			value: revision,
		} satisfies StoredHtmlPermissionRevision),
	)
}

export function readHtmlPermissionAppRecords(
	db: IDBDatabase,
	appKey: string,
): Promise<{ epoch: number; records: StoredHtmlPermissionGrant[] }> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([GRANTS_STORE_NAME, META_STORE_NAME], "readonly")
		const grantsRequest = transaction
			.objectStore(GRANTS_STORE_NAME)
			.index("appKey")
			.getAll(appKey)
		const epochRequest = transaction.objectStore(META_STORE_NAME).get(EPOCH_META_KEY)
		let records: StoredHtmlPermissionGrant[] | undefined
		let epoch: number | undefined
		grantsRequest.onsuccess = () => {
			records = grantsRequest.result as StoredHtmlPermissionGrant[]
		}
		epochRequest.onsuccess = () => {
			epoch = getStoredEpoch(epochRequest.result)
		}
		transaction.oncomplete = () => resolve({ epoch: epoch ?? 0, records: records ?? [] })
		transaction.onerror = () => reject(getTransactionError(transaction))
		transaction.onabort = () => reject(getTransactionError(transaction))
	})
}

export function runHtmlPermissionGrantWriteTransaction(
	db: IDBDatabase,
	operation: (transaction: IDBTransaction) => Promise<void>,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([GRANTS_STORE_NAME, META_STORE_NAME], "readwrite")
		let operationError: unknown
		operation(transaction).catch((error) => {
			operationError = error
			try {
				transaction.abort()
			} catch {
				// The transaction may already be completing.
			}
		})
		transaction.oncomplete = () => {
			if (operationError) reject(operationError)
			else resolve()
		}
		transaction.onerror = () => reject(operationError || getTransactionError(transaction))
		transaction.onabort = () => reject(operationError || getTransactionError(transaction))
	})
}
