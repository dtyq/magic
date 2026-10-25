import { cloneDeep, isEqual } from "lodash-es"
import type { VirtualIndexedDBDatabaseSnapshot, VirtualStorageSnapshot } from "./virtual-storage"

interface StagedTransaction {
	dbName: string
	mode: "readonly" | "readwrite"
	stores: string[]
	baseline: VirtualIndexedDBDatabaseSnapshot | undefined
	state: VirtualStorageSnapshot
	expiresAt: number
}

export function transactionError(name: string, message: string): Error {
	const error = new Error(message)
	error.name = name
	return error
}

/** Optimistic transactions: stage requests, then compare and commit under the namespace queue. */
export class VirtualStorageTransactions {
	private active = new Map<string, StagedTransaction>()
	private finished = new Map<string, number>()
	private readonly lifetime = 30 * 60 * 1000

	begin(
		key: string,
		dbName: string,
		mode: unknown,
		stores: unknown,
		state: VirtualStorageSnapshot,
	): StagedTransaction {
		this.prune()
		if (this.finished.has(key))
			throw transactionError("AbortError", "Transaction is no longer active")
		const existing = this.active.get(key)
		if (existing) {
			if (
				existing.dbName !== dbName ||
				existing.mode !== mode ||
				!isEqual(existing.stores, stores)
			) {
				throw transactionError("InvalidStateError", "Transaction scope changed")
			}
			existing.expiresAt = Date.now() + this.lifetime
			return existing
		}
		if (
			(mode !== "readonly" && mode !== "readwrite") ||
			!Array.isArray(stores) ||
			stores.some((name) => typeof name !== "string")
		) {
			throw transactionError("InvalidStateError", "Invalid transaction mode or scope")
		}
		const transaction: StagedTransaction = {
			dbName,
			mode,
			stores,
			baseline: cloneDeep(state.indexedDB[dbName]),
			state: {
				localStorage: {},
				sessionStorage: {},
				cookies: {},
				indexedDB: { [dbName]: cloneDeep(state.indexedDB[dbName]) },
			},
			expiresAt: Date.now() + this.lifetime,
		}
		this.active.set(key, transaction)
		return transaction
	}

	assertOperation(transaction: StagedTransaction, action: string, storeName: unknown): void {
		if (!transaction.stores.includes(String(storeName)))
			throw transactionError("NotFoundError", "Object store is outside the transaction scope")
		const mutations = ["put", "add", "delete", "clear"]
		if (transaction.mode === "readonly" && mutations.includes(action))
			throw transactionError("ReadOnlyError", "Transaction is readonly")
		if (
			![
				...mutations,
				"get",
				"getAll",
				"count",
				"openCursor",
				"indexGet",
				"indexGetAll",
			].includes(action)
		) {
			throw transactionError(
				"InvalidStateError",
				"Schema changes require an upgrade transaction",
			)
		}
	}

	/** Mutates only this database after checking its baseline; unrelated storage survives. */
	commit(key: string, current: VirtualStorageSnapshot): boolean {
		this.prune()
		if (this.finished.has(key))
			throw transactionError("AbortError", "Transaction is no longer active")
		const transaction = this.active.get(key)
		this.abort(key)
		if (!transaction || transaction.mode === "readonly") return false
		if (!isEqual(current.indexedDB[transaction.dbName], transaction.baseline)) {
			throw transactionError(
				"AbortError",
				"Concurrent database update; retry the transaction",
			)
		}
		current.indexedDB[transaction.dbName] = cloneDeep(
			transaction.state.indexedDB[transaction.dbName],
		)
		return true
	}

	abort(key: string): void {
		this.active.delete(key)
		// Retain a tombstone so an already queued request cannot recreate an aborted tx.
		this.finished.set(key, Date.now() + this.lifetime)
	}

	reset(): void {
		this.active.clear()
		this.finished.clear()
	}

	private prune(): void {
		const now = Date.now()
		for (const [key, transaction] of this.active) {
			if (transaction.expiresAt <= now) this.abort(key)
		}
		for (const [key, expiresAt] of this.finished) {
			if (expiresAt <= now) this.finished.delete(key)
		}
	}
}
