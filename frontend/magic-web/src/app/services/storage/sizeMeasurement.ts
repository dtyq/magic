import StorageSizeWorker from "./sizeMeasurement.worker?worker"
import type {
	StorageMeasurementCoverage,
	StorageMeasurementStage,
	StorageSizeFailureReason,
	StorageSizeMeasurement,
	StorageSizeMeasurementResult,
} from "./sizeMeasurementCore"

export type {
	StorageMeasurementCoverage,
	StorageMeasurementStage,
	StorageSizeFailureReason,
	StorageSizeMeasurement,
	StorageSizeMeasurementResult,
	StorageTopItem,
} from "./sizeMeasurementCore"

export const DEFAULT_SIZE_SLICE_BUDGET_MS = 5 * 1000
export const DEFAULT_SIZE_OVERALL_BUDGET_MS = 30 * 1000

interface WorkerLike {
	postMessage(message: unknown): void
	terminate(): void
	onmessage: ((event: MessageEvent<unknown>) => void) | null
	onerror: ((event: ErrorEvent) => void) | null
}

interface CompleteMessage {
	type: "complete"
	measurement: StorageSizeMeasurement
	coverage: StorageMeasurementCoverage
	sliceCount: number
	elapsedMs: number
}

interface IncompleteMessage {
	type: "incomplete"
	reason: StorageSizeFailureReason
	stage: StorageMeasurementStage
	coverage: StorageMeasurementCoverage
	sliceCount: number
	elapsedMs: number
}

const EMPTY_COVERAGE: StorageMeasurementCoverage = {
	indexedDBRecordsRead: 0,
	indexedDBStoresRead: 0,
	cacheStorageEntriesRead: 0,
	cacheStorageOpaqueEntries: 0,
}

/** Validate numeric coverage before it enters the diagnostic payload. */
function isCoverage(value: unknown): value is StorageMeasurementCoverage {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<StorageMeasurementCoverage>
	return [
		candidate.indexedDBRecordsRead,
		candidate.indexedDBStoresRead,
		candidate.cacheStorageEntriesRead,
		candidate.cacheStorageOpaqueEntries,
	].every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0)
}

/** Validate worker output before any numeric field enters the logger payload. */
function isMeasurement(value: unknown): value is StorageSizeMeasurement {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<StorageSizeMeasurement>
	const numbers = [
		candidate.indexedDBContentBytes,
		candidate.cacheStorageContentBytes,
		candidate.indexedDBSizeDurationMs,
		candidate.cacheStorageSizeDurationMs,
		candidate.sizeMeasurementDurationMs,
	]
	return (
		numbers.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0) &&
		Array.isArray(candidate.top10) &&
		candidate.top10.length <= 10 &&
		candidate.top10.every(
			(item) =>
				item !== null &&
				typeof item === "object" &&
				(item.storageType === "indexedDB" || item.storageType === "cacheStorage") &&
				typeof item.container === "string" &&
				typeof item.sizeBytes === "number" &&
				Number.isFinite(item.sizeBytes) &&
				item.sizeBytes >= 0,
		)
	)
}

/** Validate the finite stage vocabulary used by log queries. */
function isStage(value: unknown): value is StorageMeasurementStage {
	return value === "indexedDB" || value === "cacheStorage" || value === "worker"
}

/** Validate the finite failure vocabulary used by log queries. */
function isReason(value: unknown): value is StorageSizeFailureReason {
	return (
		value === "unsupported" ||
		value === "timeout" ||
		value === "read_failed" ||
		value === "aborted" ||
		value === "worker_error"
	)
}

/** Create a sanitized terminal failure result when the Worker cannot provide one. */
function incompleteResult(
	reason: StorageSizeFailureReason,
	stage: StorageMeasurementStage = "worker",
	coverage: StorageMeasurementCoverage = EMPTY_COVERAGE,
	sliceCount = 0,
	elapsedMs = 0,
): StorageSizeMeasurementResult {
	return {
		status: "incomplete",
		reason,
		stage,
		coverage: { ...coverage },
		sliceCount: Number.isFinite(sliceCount) ? Math.max(0, Math.floor(sliceCount)) : 0,
		elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0,
	}
}

/** Run resumable Worker slices and return one structured terminal result for log analysis. */
export function measureStorageSizes(
	signal: AbortSignal,
	options: {
		sliceBudgetMs?: number
		overallBudgetMs?: number
		createWorker?: () => WorkerLike
	} = {},
): Promise<StorageSizeMeasurementResult> {
	const sliceBudgetMs = Math.max(1, options.sliceBudgetMs ?? DEFAULT_SIZE_SLICE_BUDGET_MS)
	const overallBudgetMs = Math.max(
		sliceBudgetMs,
		options.overallBudgetMs ?? DEFAULT_SIZE_OVERALL_BUDGET_MS,
	)
	if (signal.aborted) return Promise.resolve(incompleteResult("aborted"))
	return new Promise((resolve) => {
		const startedAt = performance.now()
		const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt))
		let settled = false
		let worker: WorkerLike | undefined
		let timer: ReturnType<typeof setTimeout> | undefined
		const finish = (result: StorageSizeMeasurementResult) => {
			if (settled) return
			settled = true
			if (timer) clearTimeout(timer)
			signal.removeEventListener("abort", onAbort)
			worker?.terminate()
			resolve(result)
		}
		const onAbort = () =>
			finish(incompleteResult("aborted", "worker", EMPTY_COVERAGE, 0, elapsed()))
		try {
			worker = options.createWorker?.() ?? new StorageSizeWorker()
			worker.onmessage = (event: MessageEvent<unknown>) => {
				const message = event.data as CompleteMessage | IncompleteMessage
				if (
					message?.type === "complete" &&
					isMeasurement(message.measurement) &&
					isCoverage(message.coverage) &&
					Number.isInteger(message.sliceCount) &&
					message.sliceCount >= 1 &&
					Number.isFinite(message.elapsedMs) &&
					message.elapsedMs >= 0
				) {
					finish({
						status: "complete",
						measurement: message.measurement,
						coverage: message.coverage,
						sliceCount: message.sliceCount,
						elapsedMs: Math.round(message.elapsedMs),
					})
					return
				}
				if (
					message?.type === "incomplete" &&
					isReason(message.reason) &&
					isStage(message.stage) &&
					isCoverage(message.coverage)
				) {
					finish(
						incompleteResult(
							message.reason,
							message.stage,
							message.coverage,
							message.sliceCount,
							message.elapsedMs,
						),
					)
					return
				}
				finish(incompleteResult("worker_error", "worker", EMPTY_COVERAGE, 0, elapsed()))
			}
			worker.onerror = () =>
				finish(incompleteResult("worker_error", "worker", EMPTY_COVERAGE, 0, elapsed()))
			signal.addEventListener("abort", onAbort, { once: true })
			// Allow the Worker a small cleanup margin after the overall slice budget expires.
			timer = setTimeout(
				() => finish(incompleteResult("timeout", "worker", EMPTY_COVERAGE, 0, elapsed())),
				overallBudgetMs + 250,
			)
			worker.postMessage({
				type: "start",
				sliceBudgetMs,
				overallBudgetMs,
			})
		} catch {
			finish(incompleteResult("worker_error", "worker", EMPTY_COVERAGE, 0, elapsed()))
		}
	})
}
