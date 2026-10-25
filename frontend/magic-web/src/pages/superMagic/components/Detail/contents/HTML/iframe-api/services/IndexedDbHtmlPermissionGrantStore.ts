import { htmlMicroAppPreviewLogger } from "../../utils/htmlMicroAppPreviewLogger"
import type { HtmlPermissionScope } from "../types"
import {
	createHtmlPermissionAppKey,
	isHtmlPermissionGrantActive,
	MAX_HTML_PERMISSION_GRANTS,
	type HtmlPermissionGrant,
	type HtmlPermissionGrantIdentity,
	type HtmlPermissionGrantStore,
} from "./HtmlPermissionGrantStore"
import {
	EPOCH_META_KEY,
	GRANTS_STORE_NAME,
	META_STORE_NAME,
	REVOCATION_META_PREFIX,
	compareHtmlPermissionGrantEvictionPriority,
	getRequestResult,
	getStoredRevocation,
	grantRecordKey,
	isValidStoredGrant,
	openHtmlPermissionGrantDatabase,
	putHtmlPermissionGrantRevision,
	readHtmlPermissionAppRecords,
	readHtmlPermissionGrantState,
	readHtmlPermissionGrantStateInTransaction,
	revocationMetaKey,
	runHtmlPermissionGrantWriteTransaction,
	toHtmlPermissionGrant,
	type HtmlPermissionGrantState,
	type HtmlPermissionGrantChange,
	type StoredHtmlPermissionEpoch,
	type StoredHtmlPermissionGrant,
	type StoredHtmlPermissionRevocation,
} from "./IndexedDbHtmlPermissionGrantStore.utils"
import {
	clearLegacyHtmlPermissionGrantStorage,
	LocalStorageHtmlPermissionGrantStore,
} from "./LocalStorageHtmlPermissionGrantStore"
import {
	notifyPermissionGrantChange,
	registerHtmlPermissionGrantChangeListener,
} from "./HtmlPermissionGrantNotifications"
import {
	HtmlPermissionFallbackRecoveryError,
	recoverHtmlPermissionFallback,
} from "./HtmlPermissionGrantFallbackRecovery"

let defaultPermissionGrantStore: IndexedDbHtmlPermissionGrantStore | null = null

export class IndexedDbHtmlPermissionGrantStore implements HtmlPermissionGrantStore {
	private readonly dbPromise: Promise<IDBDatabase | null>
	private readonly fallbackStore: LocalStorageHtmlPermissionGrantStore
	private fallbackActive = false
	private sessionEpochPromise: Promise<number> = Promise.resolve(0)
	private sessionRevisionPromise: Promise<number> = Promise.resolve(0)

	constructor(private readonly getNow: () => number = () => Date.now()) {
		// Remove the previous localStorage cache so old grants cannot survive the storage migration.
		clearLegacyHtmlPermissionGrantStorage()
		this.fallbackStore = new LocalStorageHtmlPermissionGrantStore(getNow)
		this.dbPromise = openHtmlPermissionGrantDatabase((message, error) =>
			this.logStorageError(message, error),
		).then((db) => {
			if (!db) {
				this.fallbackActive = true
				return null
			}
			return db
		})
		const statePromise = this.dbPromise.then(async (db) => {
			if (!db) return { epoch: 0, revision: 0 }
			try {
				return await this.withIndexedDbAuthority(db, () => readHtmlPermissionGrantState(db))
			} catch (error) {
				this.activateFallbackForError(
					error,
					"Failed to read permission grant IndexedDB state",
					db,
				)
				return { epoch: 0, revision: 0 }
			}
		})
		this.sessionEpochPromise = statePromise.then((state) => state.epoch)
		this.sessionRevisionPromise = statePromise.then((state) => state.revision)
		registerHtmlPermissionGrantChangeListener((change) => this.handleExternalChange(change))
	}

	async isPersistentAvailable(): Promise<boolean> {
		await this.sessionEpochPromise
		const db = await this.dbPromise
		if (db && !this.fallbackActive) {
			try {
				return await this.withIndexedDbAuthority(db, async () => true)
			} catch (error) {
				this.activateFallbackForError(
					error,
					"Failed to verify permission grant IndexedDB availability",
					db,
				)
			}
		}
		return this.fallbackStore.isPersistentAvailable()
	}

	async getGrant(
		identity: HtmlPermissionGrantIdentity,
		scope: HtmlPermissionScope,
	): Promise<HtmlPermissionGrant | undefined> {
		const grants = await this.getAppGrants(identity)
		return grants.find((grant) => grant.scope === scope)
	}

	async getAppGrants(identity: HtmlPermissionGrantIdentity): Promise<HtmlPermissionGrant[]> {
		const db = await this.dbPromise
		if (!db || this.fallbackActive) return this.fallbackStore.getAppGrants(identity)
		await this.sessionEpochPromise
		if (this.fallbackActive) return this.fallbackStore.getAppGrants(identity)
		try {
			return await this.withIndexedDbAuthority(db, async () => {
				const appKey = createHtmlPermissionAppKey(identity)
				const { epoch, records } = await readHtmlPermissionAppRecords(db, appKey)
				return records
					.filter(
						(record) =>
							isValidStoredGrant(record) &&
							record.epoch === epoch &&
							isHtmlPermissionGrantActive(
								toHtmlPermissionGrant(identity, record),
								this.getNow(),
							),
					)
					.map((record) => toHtmlPermissionGrant(identity, record))
			})
		} catch (error) {
			this.activateFallbackForError(
				error,
				"Failed to read permission grants from IndexedDB",
				db,
			)
			return this.fallbackStore.getAppGrants(identity)
		}
	}

	async save(grant: HtmlPermissionGrant): Promise<boolean> {
		const db = await this.dbPromise
		if (!db || this.fallbackActive) return this.fallbackStore.save(grant)
		try {
			return await this.withIndexedDbAuthority(db, async () => {
				const expectedEpoch = await this.sessionEpochPromise
				const expectedRevision = await this.sessionRevisionPromise
				let nextRevision: number | undefined
				await runHtmlPermissionGrantWriteTransaction(db, async (transaction) => {
					const grantsStore = transaction.objectStore(GRANTS_STORE_NAME)
					const metaStore = transaction.objectStore(META_STORE_NAME)
					const state = await readHtmlPermissionGrantStateInTransaction(transaction)
					if (state.epoch !== expectedEpoch) return
					const currentEpoch = state.epoch

					const appKey = createHtmlPermissionAppKey(grant)
					const key = grantRecordKey(appKey, grant.scope)
					if (state.revision !== expectedRevision) {
						const revocation = getStoredRevocation(
							await getRequestResult(metaStore.get(revocationMetaKey(key))),
						)
						if (
							revocation?.value.epoch === currentEpoch &&
							revocation.value.revision > expectedRevision
						) {
							return
						}
					}
					const record: StoredHtmlPermissionGrant = {
						key,
						appKey,
						scope: grant.scope,
						grantedAt: grant.grantedAt,
						expiresAt: grant.expiresAt,
						...(grant.codeFingerprint
							? { codeFingerprint: grant.codeFingerprint }
							: {}),
						...(grant.reuseAcrossCodeChanges === true
							? { reuseAcrossCodeChanges: true }
							: {}),
						epoch: currentEpoch,
					}
					await getRequestResult(grantsStore.put(record))

					const currentRecords = (await getRequestResult(
						grantsStore.index("epoch").getAll(currentEpoch),
					)) as unknown[]
					const validCurrentRecords = currentRecords.filter(isValidStoredGrant)
					const allRecords = validCurrentRecords.filter((item) => item.key !== record.key)
					allRecords.push(record)
					if (allRecords.length > MAX_HTML_PERMISSION_GRANTS) {
						const overflow = allRecords
							.sort(compareHtmlPermissionGrantEvictionPriority)
							.slice(0, allRecords.length - MAX_HTML_PERMISSION_GRANTS)
						for (const item of overflow)
							await getRequestResult(grantsStore.delete(item.key))
						htmlMicroAppPreviewLogger.warn("Permission grant limit exceeded", {
							limit: MAX_HTML_PERMISSION_GRANTS,
							evictedCount: overflow.length,
						})
					}
					nextRevision = state.revision + 1
					await putHtmlPermissionGrantRevision(metaStore, nextRevision)
					await getRequestResult(metaStore.delete(revocationMetaKey(key)))
				})
				if (nextRevision !== undefined) {
					this.sessionRevisionPromise = Promise.resolve(nextRevision)
					notifyPermissionGrantChange({ epoch: expectedEpoch, revision: nextRevision })
					return true
				}
				return false
			})
		} catch (error) {
			this.activateFallbackForError(error, "Failed to save permission grant to IndexedDB", db)
			return this.fallbackStore.save(grant)
		}
	}

	async remove(
		identity: HtmlPermissionGrantIdentity,
		scope?: HtmlPermissionScope,
	): Promise<void> {
		const db = await this.dbPromise
		if (!db || this.fallbackActive) return this.fallbackStore.remove(identity, scope)
		try {
			await this.withIndexedDbAuthority(db, async () => {
				const expectedEpoch = await this.sessionEpochPromise
				let nextRevision: number | undefined
				await runHtmlPermissionGrantWriteTransaction(db, async (transaction) => {
					const grantsStore = transaction.objectStore(GRANTS_STORE_NAME)
					const metaStore = transaction.objectStore(META_STORE_NAME)
					const state = await readHtmlPermissionGrantStateInTransaction(transaction)
					if (state.epoch !== expectedEpoch) return

					const appKey = createHtmlPermissionAppKey(identity)
					const removedKeys: string[] = []
					if (scope) {
						const key = grantRecordKey(appKey, scope)
						const existing = await getRequestResult(grantsStore.get(key))
						if (!existing) return
						removedKeys.push(key)
						await getRequestResult(grantsStore.delete(key))
					} else {
						const records = (await getRequestResult(
							grantsStore.index("appKey").getAll(appKey),
						)) as StoredHtmlPermissionGrant[]
						if (records.length === 0) return
						for (const record of records) {
							removedKeys.push(record.key)
							await getRequestResult(grantsStore.delete(record.key))
						}
					}
					nextRevision = state.revision + 1
					await putHtmlPermissionGrantRevision(metaStore, nextRevision)
					for (const key of removedKeys) {
						await getRequestResult(
							metaStore.put({
								key: revocationMetaKey(key),
								value: { epoch: state.epoch, revision: nextRevision },
							} satisfies StoredHtmlPermissionRevocation),
						)
					}
				})
				if (nextRevision !== undefined) {
					this.sessionRevisionPromise = Promise.resolve(nextRevision)
					notifyPermissionGrantChange({ epoch: expectedEpoch, revision: nextRevision })
				}
			})
		} catch (error) {
			this.activateFallbackForError(
				error,
				"Failed to remove permission grant from IndexedDB",
				db,
			)
			throw error
		}
	}

	async prune(now: number): Promise<void> {
		const db = await this.dbPromise
		if (!db || this.fallbackActive) return this.fallbackStore.prune(now)
		await this.sessionEpochPromise
		if (this.fallbackActive) return this.fallbackStore.prune(now)
		try {
			await this.withIndexedDbAuthority(db, async () => {
				let nextRevision: number | undefined
				let currentEpoch = 0
				await runHtmlPermissionGrantWriteTransaction(db, async (transaction) => {
					const grantsStore = transaction.objectStore(GRANTS_STORE_NAME)
					const metaStore = transaction.objectStore(META_STORE_NAME)
					const state = await readHtmlPermissionGrantStateInTransaction(transaction)
					const epoch = state.epoch
					currentEpoch = epoch
					const records = (await getRequestResult(
						grantsStore.index("epoch").getAll(epoch),
					)) as unknown[]
					let changed = false
					for (const record of records) {
						if (
							!isValidStoredGrant(record) ||
							(record.expiresAt !== null && record.expiresAt <= now)
						) {
							await getRequestResult(grantsStore.delete(record.key))
							changed = true
						}
					}
					if (changed) {
						nextRevision = state.revision + 1
						await putHtmlPermissionGrantRevision(metaStore, nextRevision)
					}
				})
				if (nextRevision !== undefined) {
					this.sessionRevisionPromise = Promise.resolve(nextRevision)
					notifyPermissionGrantChange({ epoch: currentEpoch, revision: nextRevision })
				}
			})
		} catch (error) {
			this.activateFallbackForError(
				error,
				"Failed to prune permission grants from IndexedDB",
				db,
			)
			await this.fallbackStore.prune(now)
		}
	}

	async clear(): Promise<void> {
		const db = await this.dbPromise
		if (!db || this.fallbackActive) return this.fallbackStore.clear()
		await this.sessionEpochPromise
		if (this.fallbackActive) return this.fallbackStore.clear()

		const result = await this.fallbackStore.withAuthorityLock(() =>
			this.clearWithRecoveryMarker(db),
		)
		if (result.acquired) return
		await this.clearWithRecoveryMarker(db)
	}

	private async clearWithRecoveryMarker(db: IDBDatabase): Promise<void> {
		const fallbackClearPersisted = this.fallbackStore.clearForRecoveryUnlocked()
		let state: HtmlPermissionGrantState
		try {
			state = await this.clearIndexedDb(db)
		} catch (error) {
			this.activateFallback("Failed to clear permission grants from IndexedDB", error, db)
			notifyPermissionGrantChange()
			if (!fallbackClearPersisted) {
				throw new Error("HTML permission fallback clear could not be persisted")
			}
			return
		}

		this.updateSessionState(state)
		try {
			this.fallbackStore.discardRecoverySnapshotUnlocked()
		} catch (error) {
			this.logStorageError("Failed to remove recovered HTML permission fallback", error)
		}
		notifyPermissionGrantChange({ ...state, cleared: true })
	}

	private async clearIndexedDb(db: IDBDatabase): Promise<HtmlPermissionGrantState> {
		let nextState: HtmlPermissionGrantState | undefined
		await runHtmlPermissionGrantWriteTransaction(db, async (transaction) => {
			const grantsStore = transaction.objectStore(GRANTS_STORE_NAME)
			const metaStore = transaction.objectStore(META_STORE_NAME)
			const state = await readHtmlPermissionGrantStateInTransaction(transaction)
			nextState = { epoch: state.epoch + 1, revision: state.revision + 1 }
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
					value: nextState.epoch,
				} satisfies StoredHtmlPermissionEpoch),
			)
			await putHtmlPermissionGrantRevision(metaStore, nextState.revision)
		})
		if (!nextState) throw new Error("HTML permission IndexedDB clear did not complete")
		return nextState
	}

	private async withIndexedDbAuthority<T>(
		db: IDBDatabase,
		operation: () => Promise<T>,
	): Promise<T> {
		const result = await this.fallbackStore.withAuthorityLock(async () => {
			await this.recoverPendingFallbackUnlocked(db)
			return operation()
		})
		if (result.acquired) return result.value

		// Fallback writes are disabled without Web Locks, so recovery cannot race a writer.
		await this.recoverPendingFallbackUnlocked(db)
		return operation()
	}

	private async recoverPendingFallbackUnlocked(db: IDBDatabase): Promise<void> {
		let snapshot
		try {
			snapshot = this.fallbackStore.readRecoverySnapshotUnlocked()
		} catch (error) {
			throw new HtmlPermissionFallbackRecoveryError(
				"Failed to read HTML permission fallback recovery snapshot",
				error,
			)
		}
		if (!snapshot) return

		let state: HtmlPermissionGrantState
		try {
			state = await recoverHtmlPermissionFallback(db, snapshot, this.getNow())
		} catch (error) {
			throw new HtmlPermissionFallbackRecoveryError(
				"Failed to apply HTML permission fallback recovery",
				error,
			)
		}
		try {
			this.fallbackStore.discardRecoverySnapshotUnlocked()
		} catch (error) {
			throw new HtmlPermissionFallbackRecoveryError(
				"Failed to remove recovered HTML permission fallback",
				error,
			)
		}
		this.updateSessionState(state)
		notifyPermissionGrantChange({
			...state,
			cleared: snapshot.clearedAtRevision !== null,
		})
	}

	private updateSessionState(state: HtmlPermissionGrantState): void {
		this.sessionEpochPromise = Promise.resolve(state.epoch)
		this.sessionRevisionPromise = Promise.resolve(state.revision)
	}

	private activateFallback(message: string, error: unknown, db: IDBDatabase): void {
		this.logStorageError(message, error)
		this.fallbackActive = true
		db.close()
	}

	private activateFallbackForError(
		error: unknown,
		defaultMessage: string,
		db: IDBDatabase,
	): void {
		if (error instanceof HtmlPermissionFallbackRecoveryError) {
			this.activateFallback(error.logMessage, error.originalError, db)
			return
		}
		this.activateFallback(defaultMessage, error, db)
	}

	private logStorageError(message: string, error: unknown) {
		htmlMicroAppPreviewLogger.warn(message, {
			error: error instanceof Error ? error.message : String(error),
		})
	}

	private handleExternalChange(change: unknown) {
		if (!change || typeof change !== "object") return
		const value = change as Partial<HtmlPermissionGrantChange>
		if (
			value.type !== "changed" ||
			typeof value.epoch !== "number" ||
			typeof value.revision !== "number"
		) {
			return
		}
		const externalEpoch = value.epoch
		const externalRevision = value.revision
		void this.sessionEpochPromise.then((epoch) => {
			if (value.cleared) {
				if (externalEpoch > epoch) {
					this.sessionEpochPromise = Promise.resolve(externalEpoch)
					this.sessionRevisionPromise = Promise.resolve(externalRevision)
				}
				return
			}
			if (epoch !== externalEpoch) return
			void this.sessionRevisionPromise.then((revision) => {
				if (externalRevision > revision) {
					this.sessionRevisionPromise = Promise.resolve(externalRevision)
				}
			})
		})
	}
}

export function getHtmlPermissionGrantStore(): IndexedDbHtmlPermissionGrantStore {
	defaultPermissionGrantStore ??= new IndexedDbHtmlPermissionGrantStore()
	return defaultPermissionGrantStore
}
