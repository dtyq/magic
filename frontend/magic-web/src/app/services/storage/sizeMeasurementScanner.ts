import {
	measureValueBytes,
	StorageSizeMeasurementError,
	StorageTop10Collector,
	type StorageMeasurementCoverage,
	type StorageMeasurementStage,
	type StorageSizeMeasurement,
} from "./sizeMeasurementCore"
import { KNOWN_EXCLUDED_INDEXED_DB_NAME } from "./storageExclusions"

const OPAQUE_RESPONSE_SIZE_BYTES = 7 * 1024 ** 2

export interface StorageSizeScannerOptions {
	batchEntries?: number
	batchDurationMs?: number
	now?: () => number
	yieldControl?: () => Promise<void>
}

export type StorageSizeSliceResult =
	| {
			status: "slice"
			stage: Exclude<StorageMeasurementStage, "worker">
			coverage: StorageMeasurementCoverage
	  }
	| {
			status: "complete"
			measurement: StorageSizeMeasurement
			coverage: StorageMeasurementCoverage
	  }

class SliceBudgetExceeded extends Error {
	constructor() {
		super("timeout")
		this.name = "SliceBudgetExceeded"
	}
}

interface SliceContext {
	batchEntries: number
	batchDurationMs: number
	now: () => number
	yieldControl: () => Promise<void>
	ensureBudget: () => void
}

interface StoreBatch {
	done: boolean
	lastKey?: IDBValidKey
	sizeBytes: number
	itemSizes: number[]
}

type ScannerStage = "indexedDB" | "cacheStorage" | "complete"

interface ScannerState {
	stage: ScannerStage
	startedAt: number
	indexedDBStageStartedAt: number
	indexedDBSizeDurationMs?: number
	cacheStorageStageStartedAt?: number
	cacheStorageSizeDurationMs?: number
	databaseInfos?: IDBDatabaseInfo[]
	databaseIndex: number
	database?: IDBDatabase
	storeNames?: string[]
	storeIndex: number
	lastKey?: IDBValidKey
	cacheNames?: string[]
	cacheIndex: number
	cache?: Cache
	cacheRequests?: readonly Request[]
	cacheRequestIndex: number
	indexedDBContentBytes: number
	cacheStorageContentBytes: number
	top10: StorageTop10Collector
	coverage: StorageMeasurementCoverage
}

/** Keep scan position and aggregate data in the Worker between 5-second slices. */
export class StorageSizeScanner {
	private readonly now: () => number
	private readonly batchEntries: number
	private readonly batchDurationMs: number
	private readonly yieldControl: () => Promise<void>
	private readonly state: ScannerState

	constructor(options: StorageSizeScannerOptions = {}) {
		this.now = options.now ?? (() => performance.now())
		this.batchEntries = options.batchEntries ?? 100
		this.batchDurationMs = options.batchDurationMs ?? 8
		this.yieldControl =
			options.yieldControl ?? (() => new Promise((resolve) => setTimeout(resolve, 0)))
		const startedAt = this.now()
		this.state = {
			stage: "indexedDB",
			startedAt,
			indexedDBStageStartedAt: startedAt,
			databaseIndex: 0,
			storeIndex: 0,
			cacheIndex: 0,
			cacheRequestIndex: 0,
			indexedDBContentBytes: 0,
			cacheStorageContentBytes: 0,
			top10: new StorageTop10Collector(),
			coverage: {
				indexedDBRecordsRead: 0,
				indexedDBStoresRead: 0,
				cacheStorageEntriesRead: 0,
				cacheStorageOpaqueEntries: 0,
			},
		}
	}

	get stage(): Exclude<StorageMeasurementStage, "worker"> {
		return this.state.stage === "complete" ? "cacheStorage" : this.state.stage
	}

	get elapsedMs(): number {
		return Math.round(this.now() - this.state.startedAt)
	}

	get coverage(): StorageMeasurementCoverage {
		return { ...this.state.coverage }
	}

	/** Run one bounded slice; timeout returns a resumable state instead of losing progress. */
	async runSlice(budgetMs: number): Promise<StorageSizeSliceResult> {
		const deadline = this.now() + budgetMs
		const context: SliceContext = {
			batchEntries: this.batchEntries,
			batchDurationMs: this.batchDurationMs,
			now: this.now,
			yieldControl: this.yieldControl,
			ensureBudget: () => {
				if (this.now() >= deadline) throw new SliceBudgetExceeded()
			},
		}
		try {
			while (this.state.stage !== "complete") {
				context.ensureBudget()
				if (this.state.stage === "indexedDB") await this.scanIndexedDB(context)
				else await this.scanCaches(context)
			}
			return {
				status: "complete",
				measurement: this.createMeasurement(),
				coverage: this.coverage,
			}
		} catch (error) {
			if (error instanceof SliceBudgetExceeded) {
				this.releaseOpenDatabase()
				return { status: "slice", stage: this.stage, coverage: this.coverage }
			}
			throw error
		}
	}

	/** Advance database/store checkpoints until the current slice budget is exhausted. */
	private async scanIndexedDB(context: SliceContext): Promise<void> {
		if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
			throw new StorageSizeMeasurementError("unsupported")
		}
		if (!this.state.databaseInfos) {
			try {
				this.state.databaseInfos = await indexedDB.databases()
			} catch {
				throw new StorageSizeMeasurementError("read_failed")
			}
		}
		while (this.state.databaseIndex < this.state.databaseInfos.length) {
			context.ensureBudget()
			const databaseInfo = this.state.databaseInfos[this.state.databaseIndex]
			// Skip the known stream-record database before opening it or counting its bytes.
			if (databaseInfo.name === KNOWN_EXCLUDED_INDEXED_DB_NAME) {
				this.state.databaseIndex += 1
				continue
			}
			if (!this.state.database) {
				const info = databaseInfo
				if (info.name === undefined) {
					this.state.databaseIndex += 1
					continue
				}
				this.state.database = await openExistingDatabase(info.name)
				if (!this.state.storeNames) {
					this.state.storeNames = Array.from(this.state.database.objectStoreNames)
					this.state.storeIndex = 0
					this.state.lastKey = undefined
				}
			}
			if (this.state.storeIndex >= (this.state.storeNames?.length ?? 0)) {
				this.state.database.close()
				this.state.database = undefined
				this.state.storeNames = undefined
				this.state.databaseIndex += 1
				continue
			}
			const storeNames = this.state.storeNames
			if (!storeNames) throw new StorageSizeMeasurementError("read_failed")
			const storeName = storeNames[this.state.storeIndex]
			const batch = await readStoreBatch(
				this.state.database,
				storeName,
				this.state.lastKey,
				context,
			)
			this.state.indexedDBContentBytes += batch.sizeBytes
			this.state.coverage.indexedDBRecordsRead += batch.itemSizes.length
			for (const sizeBytes of batch.itemSizes) {
				this.state.top10.add({
					storageType: "indexedDB",
					container: `${this.state.databaseInfos[this.state.databaseIndex].name}/${storeName}`,
					sizeBytes,
				})
			}
			if (batch.done) {
				this.state.storeIndex += 1
				this.state.lastKey = undefined
				this.state.coverage.indexedDBStoresRead += 1
			} else {
				this.state.lastKey = batch.lastKey
			}
			context.ensureBudget()
			await context.yieldControl()
		}
		this.state.databaseInfos = undefined
		this.state.indexedDBSizeDurationMs = Math.round(
			this.now() - this.state.indexedDBStageStartedAt,
		)
		this.state.stage = "cacheStorage"
		this.state.cacheStorageStageStartedAt = this.now()
	}

	/** Advance cache/request checkpoints while keeping response bodies out of retained state. */
	private async scanCaches(context: SliceContext): Promise<void> {
		if (typeof caches === "undefined") throw new StorageSizeMeasurementError("unsupported")
		if (!this.state.cacheNames) {
			try {
				this.state.cacheNames = await caches.keys()
			} catch {
				throw new StorageSizeMeasurementError("read_failed")
			}
		}
		let batchStartedAt = this.now()
		let batchCount = 0
		while (this.state.cacheIndex < this.state.cacheNames.length) {
			context.ensureBudget()
			if (!this.state.cache) {
				try {
					this.state.cache = await caches.open(
						this.state.cacheNames[this.state.cacheIndex],
					)
					this.state.cacheRequests = await this.state.cache.keys()
					this.state.cacheRequestIndex = 0
				} catch {
					throw new StorageSizeMeasurementError("read_failed")
				}
			}
			if (this.state.cacheRequestIndex >= (this.state.cacheRequests?.length ?? 0)) {
				this.state.cache = undefined
				this.state.cacheRequests = undefined
				this.state.cacheIndex += 1
				continue
			}
			const cacheRequests = this.state.cacheRequests
			if (!cacheRequests) throw new StorageSizeMeasurementError("read_failed")
			const request = cacheRequests[this.state.cacheRequestIndex]
			let response: Response | undefined
			try {
				response = await this.state.cache.match(request)
				if (!response) throw new StorageSizeMeasurementError("read_failed")
				const result = await measureResponseBodyBytes(response, context)
				this.state.cacheStorageContentBytes += result.sizeBytes
				this.state.coverage.cacheStorageEntriesRead += 1
				if (result.opaque) this.state.coverage.cacheStorageOpaqueEntries += 1
				this.state.top10.add({
					storageType: "cacheStorage",
					container: this.state.cacheNames[this.state.cacheIndex],
					sizeBytes: result.sizeBytes,
				})
				this.state.cacheRequestIndex += 1
			} catch (error) {
				if (
					error instanceof StorageSizeMeasurementError ||
					error instanceof SliceBudgetExceeded
				)
					throw error
				throw new StorageSizeMeasurementError("read_failed")
			}
			batchCount += 1
			if (
				batchCount >= context.batchEntries ||
				this.now() - batchStartedAt >= context.batchDurationMs
			) {
				context.ensureBudget()
				await context.yieldControl()
				batchCount = 0
				batchStartedAt = this.now()
			}
		}
		const cacheStorageStageStartedAt = this.state.cacheStorageStageStartedAt
		if (cacheStorageStageStartedAt === undefined) {
			throw new StorageSizeMeasurementError("read_failed")
		}
		this.state.cacheStorageSizeDurationMs = Math.round(this.now() - cacheStorageStageStartedAt)
		this.state.stage = "complete"
	}

	/** Build the complete measurement only after both storage stages reach their ends. */
	private createMeasurement(): StorageSizeMeasurement {
		return {
			indexedDBContentBytes: this.state.indexedDBContentBytes,
			cacheStorageContentBytes: this.state.cacheStorageContentBytes,
			top10: this.state.top10.values(),
			indexedDBSizeDurationMs: this.state.indexedDBSizeDurationMs ?? 0,
			cacheStorageSizeDurationMs: this.state.cacheStorageSizeDurationMs ?? 0,
			sizeMeasurementDurationMs: this.elapsedMs,
		}
	}

	/** Release IDB connections between slices so schema upgrades are not held by diagnostics. */
	private releaseOpenDatabase(): void {
		this.state.database?.close()
		this.state.database = undefined
	}
}

/** Open an existing database without creating a replacement if it disappeared mid-scan. */
function openExistingDatabase(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		let settled = false
		let request: IDBOpenDBRequest
		try {
			request = indexedDB.open(name)
		} catch {
			reject(new StorageSizeMeasurementError("read_failed"))
			return
		}
		request.onerror = request.onblocked = () => {
			if (!settled) reject(new StorageSizeMeasurementError("read_failed"))
			settled = true
		}
		request.onupgradeneeded = () => {
			settled = true
			try {
				request.transaction?.abort()
			} catch {
				// The rejected measurement already prevents reporting a partial database.
			}
			reject(new StorageSizeMeasurementError("read_failed"))
		}
		request.onsuccess = () => {
			if (settled) {
				request.result.close()
				return
			}
			settled = true
			resolve(request.result)
		}
	})
}

/** Read one bounded cursor batch; a slice timeout leaves the previous key checkpoint intact. */
function readStoreBatch(
	database: IDBDatabase,
	storeName: string,
	lowerKey: IDBValidKey | undefined,
	context: SliceContext,
): Promise<StoreBatch> {
	return new Promise((resolve, reject) => {
		let result: StoreBatch | undefined
		try {
			const transaction = database.transaction(storeName, "readonly")
			const request = transaction
				.objectStore(storeName)
				.openCursor(
					lowerKey === undefined ? undefined : IDBKeyRange.lowerBound(lowerKey, true),
				)
			const itemSizes: number[] = []
			let sizeBytes = 0
			let count = 0
			let lastKey: IDBValidKey | undefined
			const batchStartedAt = context.now()
			request.onerror = () => reject(new StorageSizeMeasurementError("read_failed"))
			request.onsuccess = () => {
				try {
					context.ensureBudget()
					const cursor = request.result
					if (!cursor) {
						result = { done: true, lastKey, sizeBytes, itemSizes }
						return
					}
					if (
						count > 0 &&
						(count >= context.batchEntries ||
							context.now() - batchStartedAt >= context.batchDurationMs)
					) {
						result = { done: false, lastKey, sizeBytes, itemSizes }
						return
					}
					const measured = measureValueBytes(cursor.value)
					if (measured === undefined) {
						reject(new StorageSizeMeasurementError("read_failed"))
						return
					}
					itemSizes.push(measured)
					sizeBytes += measured
					count += 1
					lastKey = cursor.key
					cursor.continue()
				} catch (error) {
					reject(error)
				}
			}
			transaction.oncomplete = () =>
				resolve(result ?? { done: true, lastKey, sizeBytes, itemSizes })
			transaction.onerror = transaction.onabort = () =>
				reject(new StorageSizeMeasurementError("read_failed"))
		} catch {
			reject(new StorageSizeMeasurementError("read_failed"))
		}
	})
}

interface ResponseBodySize {
	sizeBytes: number
	opaque: boolean
}

/** Stream readable bodies and apply the fixed estimate for opaque responses. */
async function measureResponseBodyBytes(
	response: Response,
	context: SliceContext,
): Promise<ResponseBodySize> {
	if (response.type === "opaque") return { sizeBytes: OPAQUE_RESPONSE_SIZE_BYTES, opaque: true }
	if (!response.body) {
		context.ensureBudget()
		const sizeBytes = (await response.arrayBuffer()).byteLength
		context.ensureBudget()
		return { sizeBytes, opaque: false }
	}
	const reader = response.body.getReader()
	let total = 0
	let done = false
	let chunkStartedAt = context.now()
	try {
		while (!done) {
			context.ensureBudget()
			const chunk = await reader.read()
			done = chunk.done
			if (done) break
			total += chunk.value?.byteLength ?? 0
			if (context.now() - chunkStartedAt >= context.batchDurationMs) {
				context.ensureBudget()
				await context.yieldControl()
				chunkStartedAt = context.now()
			}
		}
		return { sizeBytes: total, opaque: false }
	} catch (error) {
		try {
			await reader.cancel()
		} catch {
			// Preserve the original read or slice-budget failure.
		}
		throw error
	} finally {
		reader.releaseLock()
	}
}

/** Preserve the original single-call test utility while production uses resumable slices. */
export async function measureStorageSizesInContext(
	options: StorageSizeScannerOptions & { budgetMs: number },
): Promise<StorageSizeMeasurement> {
	const scanner = new StorageSizeScanner(options)
	const result = await scanner.runSlice(options.budgetMs)
	if (result.status === "complete") return result.measurement
	throw new StorageSizeMeasurementError("timeout")
}
