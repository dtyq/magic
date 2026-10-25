import { htmlMicroAppPreviewLogger } from "../../utils/htmlMicroAppPreviewLogger"
import { SUPPORTED_HTML_PERMISSION_SCOPES } from "./htmlPermissionPolicy"
import { MAX_HTML_PERMISSION_GRANTS } from "./HtmlPermissionGrantStore"
import {
	EPOCH_META_KEY,
	GRANTS_STORE_NAME,
	META_STORE_NAME,
	REVISION_META_KEY,
	REVOCATION_META_PREFIX,
	compareHtmlPermissionGrantEvictionPriority,
	getRequestResult,
	getStoredEpoch,
	getStoredRevocation,
	getStoredRevision,
	getTransactionError,
	grantRecordKey,
	isValidStoredGrant,
	revocationMetaKey,
	type HtmlPermissionGrantState,
	type StoredHtmlPermissionEpoch,
	type StoredHtmlPermissionGrant,
	type StoredHtmlPermissionRevision,
	type StoredHtmlPermissionRevocation,
} from "./IndexedDbHtmlPermissionGrantStore.utils"
import {
	isFallbackGrantEffective,
	type HtmlPermissionGrantFallbackSnapshot,
	type StoredFallbackGrant,
} from "./LocalStorageHtmlPermissionGrantStore"

export class HtmlPermissionFallbackRecoveryError extends Error {
	constructor(
		readonly logMessage: string,
		readonly originalError: unknown,
	) {
		super(originalError instanceof Error ? originalError.message : String(originalError))
	}
}

export function recoverHtmlPermissionFallback(
	db: IDBDatabase,
	snapshot: HtmlPermissionGrantFallbackSnapshot,
	now: number,
): Promise<HtmlPermissionGrantState> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([GRANTS_STORE_NAME, META_STORE_NAME], "readwrite")
		let recoveredState: HtmlPermissionGrantState | undefined
		let operationError: unknown

		applyFallbackSnapshot(transaction, snapshot, now)
			.then((state) => {
				recoveredState = state
			})
			.catch((error) => {
				operationError = error
				try {
					transaction.abort()
				} catch {
					// The transaction may already be completing.
				}
			})

		transaction.oncomplete = () =>
			resolve(recoveredState || { epoch: snapshot.epoch, revision: snapshot.revision })
		transaction.onerror = () => reject(operationError || getTransactionError(transaction))
		transaction.onabort = () => reject(operationError || getTransactionError(transaction))
	})
}

async function applyFallbackSnapshot(
	transaction: IDBTransaction,
	snapshot: HtmlPermissionGrantFallbackSnapshot,
	now: number,
): Promise<HtmlPermissionGrantState> {
	const grantsStore = transaction.objectStore(GRANTS_STORE_NAME)
	const metaStore = transaction.objectStore(META_STORE_NAME)
	const [epochRecord, revisionRecord] = await Promise.all([
		getRequestResult(metaStore.get(EPOCH_META_KEY)),
		getRequestResult(metaStore.get(REVISION_META_KEY)),
	])
	const currentState = {
		epoch: getStoredEpoch(epochRecord),
		revision: getStoredRevision(revisionRecord),
	}
	let targetEpoch = currentState.epoch
	const recoveryRevision = currentState.revision + 1

	if (snapshot.clearedAtRevision !== null) {
		targetEpoch += 1
		await getRequestResult(grantsStore.clear())
		const metaKeys = (await getRequestResult(metaStore.getAllKeys())) as IDBValidKey[]
		for (const key of metaKeys) {
			if (typeof key === "string" && key.startsWith(REVOCATION_META_PREFIX)) {
				await getRequestResult(metaStore.delete(key))
			}
		}
		await getRequestResult(
			metaStore.put({
				key: EPOCH_META_KEY,
				value: targetEpoch,
			} satisfies StoredHtmlPermissionEpoch),
		)
	}

	for (const [appKey] of Object.entries(snapshot.appRevocations)) {
		const records = (await getRequestResult(
			grantsStore.index("appKey").getAll(appKey),
		)) as StoredHtmlPermissionGrant[]
		for (const record of records) await getRequestResult(grantsStore.delete(record.key))
		for (const scope of SUPPORTED_HTML_PERMISSION_SCOPES) {
			await putRevocation(
				metaStore,
				grantRecordKey(appKey, scope),
				targetEpoch,
				recoveryRevision,
			)
		}
	}

	for (const key of Object.keys(snapshot.scopeRevocations)) {
		await getRequestResult(grantsStore.delete(key))
		await putRevocation(metaStore, key, targetEpoch, recoveryRevision)
	}

	for (const grant of Object.values(snapshot.grants)) {
		if (!isFallbackGrantEffective(snapshot, grant) || !isGrantActive(grant, now)) continue
		// Fallback v1 and IndexedDB revisions are independent. Preserve a current-epoch revoke
		// instead of deleting its marker because recovery cannot prove which mutation is newer.
		const revocation = getStoredRevocation(
			await getRequestResult(metaStore.get(revocationMetaKey(grant.key))),
		)
		if (revocation?.value.epoch === targetEpoch) continue
		await getRequestResult(
			grantsStore.put({
				key: grant.key,
				appKey: grant.appKey,
				scope: grant.scope,
				grantedAt: grant.grantedAt,
				expiresAt: grant.expiresAt,
				...(grant.codeFingerprint ? { codeFingerprint: grant.codeFingerprint } : {}),
				...(grant.reuseAcrossCodeChanges === true ? { reuseAcrossCodeChanges: true } : {}),
				epoch: targetEpoch,
			} satisfies StoredHtmlPermissionGrant),
		)
		await getRequestResult(metaStore.delete(revocationMetaKey(grant.key)))
	}

	await enforceGrantLimit(grantsStore, targetEpoch)
	await getRequestResult(
		metaStore.put({
			key: REVISION_META_KEY,
			value: recoveryRevision,
		} satisfies StoredHtmlPermissionRevision),
	)
	return { epoch: targetEpoch, revision: recoveryRevision }
}

async function putRevocation(
	metaStore: IDBObjectStore,
	recordKey: string,
	epoch: number,
	revision: number,
): Promise<void> {
	await getRequestResult(
		metaStore.put({
			key: revocationMetaKey(recordKey),
			value: { epoch, revision },
		} satisfies StoredHtmlPermissionRevocation),
	)
}

async function enforceGrantLimit(grantsStore: IDBObjectStore, epoch: number): Promise<void> {
	const records = (await getRequestResult(grantsStore.index("epoch").getAll(epoch))) as unknown[]
	const validRecords = records.filter(isValidStoredGrant)
	if (validRecords.length <= MAX_HTML_PERMISSION_GRANTS) return

	const overflow = validRecords
		.sort(compareHtmlPermissionGrantEvictionPriority)
		.slice(0, validRecords.length - MAX_HTML_PERMISSION_GRANTS)
	for (const record of overflow) await getRequestResult(grantsStore.delete(record.key))
	htmlMicroAppPreviewLogger.warn("Permission grant limit exceeded during fallback recovery", {
		limit: MAX_HTML_PERMISSION_GRANTS,
		evictedCount: overflow.length,
	})
}

function isGrantActive(grant: StoredFallbackGrant, now: number): boolean {
	return grant.expiresAt === null || grant.expiresAt > now
}
