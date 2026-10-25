import type { LoggerPlugin } from "@/infrastructure/logger/types"
import { isQuotaExceeded } from "./quota"
import {
	collectStorageSnapshot,
	type CacheBucketCount,
	type IndexedDBDatabaseCount,
	type StorageQuotaSnapshot,
} from "./snapshot"
import {
	STORAGE_QUOTA_EXCEEDED_ERROR_KIND,
	STORAGE_QUOTA_EXCEEDED_EVENT_KEY,
	claimStorageQuotaReport,
} from "./storageFailure"
import {
	measureStorageSizes,
	DEFAULT_SIZE_OVERALL_BUDGET_MS,
	DEFAULT_SIZE_SLICE_BUDGET_MS,
	type StorageMeasurementStage,
	type StorageSizeFailureReason,
	type StorageSizeMeasurementResult,
	type StorageTopItem,
} from "./sizeMeasurement"

/** Usage ratio that, together with the 1 GiB floor, marks a high-fill origin. */
const QUOTA_RATIO_THRESHOLD = 0.7
/** Minimum absolute usage required before a high ratio can trigger a report. */
const QUOTA_RATIO_MIN_USAGE_BYTES = 1 * 1024 ** 3
/** Absolute origin usage that reports even when the fill ratio is still low. */
const QUOTA_ABSOLUTE_USAGE_BYTES = 2 * 1024 ** 3
/** Wait this long after a refresh before taking the one-shot snapshot. */
const SNAPSHOT_DELAY_MS = 30 * 1000
/** Counts, bytes, and timings below this are noise and are omitted from cloud logs. */
const MIN_REPORTABLE_NUMBER = 50

/** Flattened IndexedDB row used in cloud logs after dropping tiny stores. */
export interface IndexedDBReportCount {
	dbName: string
	storeName: string
	count: number
}

/** Cloud payload for a high-quota snapshot; optional fields are omitted when empty or tiny. */
export interface StorageQuotaHighReportData {
	eventKey: "storage_quota_high"
	usage: string
	quota: string
	ratio: string
	localStorageBytes?: string
	sessionStorageBytes?: string
	caches?: CacheBucketCount[]
	indexedDB?: IndexedDBReportCount[]
	cacheCountDurationMs?: number
	indexedDBCountDurationMs?: number
	indexedDBContentBytes?: number
	cacheStorageContentBytes?: number
	storageTop10?: StorageTopItem[]
	indexedDBSizeDurationMs?: number
	cacheStorageSizeDurationMs?: number
	sizeMeasurementDurationMs?: number
	sizeMeasurementStatus?: "complete" | "incomplete"
	sizeMeasurementVersion?: number
	sizeMeasurementFailureReason?: StorageSizeFailureReason
	sizeMeasurementFailureStage?: StorageMeasurementStage
	sizeMeasurementSliceCount?: number
	sizeMeasurementElapsedMs?: number
	sizeMeasurementSliceBudgetMs?: number
	sizeMeasurementOverallBudgetMs?: number
	indexedDBRecordsRead?: number
	indexedDBStoresRead?: number
	cacheStorageEntriesRead?: number
	cacheStorageOpaqueEntries?: number
}

/** Trim one-decimal numbers so 2.0G is written as 2G. */
function trimDecimal(value: number): string {
	const rounded = Math.round(value * 10) / 10
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Format byte counts for cloud logs using B/K/M/G instead of raw integers. */
export function formatByteSize(bytes: number): string {
	const size = Math.max(0, Number(bytes) || 0)
	if (size >= 1024 ** 3) return `${trimDecimal(size / 1024 ** 3)}G`
	if (size >= 1024 ** 2) return `${trimDecimal(size / 1024 ** 2)}M`
	if (size >= 1024) return `${trimDecimal(size / 1024)}K`
	return `${Math.round(size)}B`
}

/** Format a 0-1 ratio as a percent string, e.g. 0.8 → 80%. */
export function formatRatioPercent(ratio: number): string {
	const percent = Math.round((Number(ratio) || 0) * 1000) / 10
	return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}

/** Placeholder used before an idle callback exists. */
function noop(): void {
	return undefined
}

/**
 * Report when the origin is either very large, or already quite full at a meaningful size:
 * (ratio >= 70% and usage >= 1 GiB) OR usage >= 2 GiB.
 */
function isHighQuota(usage: number, quota: number): boolean {
	if (usage >= QUOTA_ABSOLUTE_USAGE_BYTES) return true
	if (quota <= 0) return false
	return usage / quota >= QUOTA_RATIO_THRESHOLD && usage >= QUOTA_RATIO_MIN_USAGE_BYTES
}

/** Schedule work on an idle slice, falling back to a zero-delay timeout when IdleCallback is missing. */
function scheduleIdle(run: () => void): () => void {
	if (typeof requestIdleCallback === "function") {
		const idleId = requestIdleCallback(() => run())
		return () => cancelIdleCallback(idleId)
	}
	const timer = setTimeout(run, 0)
	return () => clearTimeout(timer)
}

/** Keep a numeric log field only when it is large enough to be diagnostically useful. */
function isReportableNumber(value: number): boolean {
	return value >= MIN_REPORTABLE_NUMBER
}

/** Drop cache buckets whose entry count is too small to explain origin usage. */
function pickReportableCaches(caches: CacheBucketCount[]): CacheBucketCount[] {
	return caches.filter((bucket) => isReportableNumber(bucket.count))
}

/** Flatten IndexedDB counts and drop stores whose row count is too small to matter. */
function pickReportableIndexedDB(databases: IndexedDBDatabaseCount[]): IndexedDBReportCount[] {
	const rows: IndexedDBReportCount[] = []
	for (const database of databases) {
		for (const store of database.stores) {
			if (!isReportableNumber(store.count)) continue
			rows.push({
				dbName: database.dbName,
				storeName: store.storeName,
				count: store.count,
			})
		}
	}
	return rows
}

/**
 * Convert a raw snapshot into a compact cloud payload:
 * readable units, no counts/bytes/timings below 50, and no empty arrays.
 */
export function toReadableHighQuotaData(
	snapshot: StorageQuotaSnapshot,
	sizeMeasurement?: StorageSizeMeasurementResult,
): StorageQuotaHighReportData {
	const data: StorageQuotaHighReportData = {
		eventKey: "storage_quota_high",
		usage: formatByteSize(snapshot.usage),
		quota: formatByteSize(snapshot.quota),
		ratio: formatRatioPercent(snapshot.ratio),
	}
	if (isReportableNumber(snapshot.localStorageBytes)) {
		data.localStorageBytes = formatByteSize(snapshot.localStorageBytes)
	}
	if (isReportableNumber(snapshot.sessionStorageBytes)) {
		data.sessionStorageBytes = formatByteSize(snapshot.sessionStorageBytes)
	}
	const caches = pickReportableCaches(snapshot.caches)
	if (caches.length) data.caches = caches
	const indexedDB = pickReportableIndexedDB(snapshot.indexedDB)
	if (indexedDB.length) data.indexedDB = indexedDB
	if (isReportableNumber(snapshot.cacheCountDurationMs)) {
		data.cacheCountDurationMs = snapshot.cacheCountDurationMs
	}
	if (isReportableNumber(snapshot.indexedDBCountDurationMs)) {
		data.indexedDBCountDurationMs = snapshot.indexedDBCountDurationMs
	}
	if (sizeMeasurement) {
		data.sizeMeasurementStatus = sizeMeasurement.status
		data.sizeMeasurementVersion = 1
		data.sizeMeasurementSliceCount = sizeMeasurement.sliceCount
		data.sizeMeasurementElapsedMs = sizeMeasurement.elapsedMs
		data.sizeMeasurementSliceBudgetMs = DEFAULT_SIZE_SLICE_BUDGET_MS
		data.sizeMeasurementOverallBudgetMs = DEFAULT_SIZE_OVERALL_BUDGET_MS
		data.indexedDBRecordsRead = sizeMeasurement.coverage.indexedDBRecordsRead
		data.indexedDBStoresRead = sizeMeasurement.coverage.indexedDBStoresRead
		data.cacheStorageEntriesRead = sizeMeasurement.coverage.cacheStorageEntriesRead
		data.cacheStorageOpaqueEntries = sizeMeasurement.coverage.cacheStorageOpaqueEntries
		if (sizeMeasurement.status === "complete") {
			data.indexedDBContentBytes = sizeMeasurement.measurement.indexedDBContentBytes
			data.cacheStorageContentBytes = sizeMeasurement.measurement.cacheStorageContentBytes
			data.indexedDBSizeDurationMs = sizeMeasurement.measurement.indexedDBSizeDurationMs
			data.cacheStorageSizeDurationMs = sizeMeasurement.measurement.cacheStorageSizeDurationMs
			data.sizeMeasurementDurationMs = sizeMeasurement.measurement.sizeMeasurementDurationMs
			if (sizeMeasurement.measurement.top10.length) {
				data.storageTop10 = sizeMeasurement.measurement.top10
			}
		} else {
			data.sizeMeasurementFailureReason = sizeMeasurement.reason
			data.sizeMeasurementFailureStage = sizeMeasurement.stage
		}
	}
	return data
}

/** Listen for uncaught quota errors and take one delayed idle snapshot per page lifetime. */
export function createStorageQuotaPlugin(): LoggerPlugin {
	return {
		name: "storageQuota",
		scope: "page",
		setup({ logger, onDispose, signal, reportFault }) {
			const reportedThisPage = new Set<string>()
			let faultReported = false
			let cancelIdle = noop
			const noteFault = () => {
				if (faultReported) return
				faultReported = true
				reportFault()
			}
			const reportQuotaError = (error: unknown) => {
				if (!isQuotaExceeded(error)) return
				if (!claimStorageQuotaReport(STORAGE_QUOTA_EXCEEDED_EVENT_KEY, reportedThisPage))
					return
				logger.report({
					namespace: "storageQuota",
					data: {
						eventKey: STORAGE_QUOTA_EXCEEDED_EVENT_KEY,
						errorKind: STORAGE_QUOTA_EXCEEDED_ERROR_KIND,
					},
				})
			}
			const onWindowError = (event: ErrorEvent) => reportQuotaError(event.error)
			const onUnhandledRejection = (event: PromiseRejectionEvent) =>
				reportQuotaError(event.reason)
			const runSnapshot = async () => {
				if (signal.aborted) return
				const snapshot = await collectStorageSnapshot(noteFault)
				if (signal.aborted || !snapshot || !isHighQuota(snapshot.usage, snapshot.quota))
					return
				if (!claimStorageQuotaReport("storage_quota_high", reportedThisPage)) return
				const sizeMeasurement = await measureStorageSizes(signal)
				if (signal.aborted) return
				if (sizeMeasurement.status === "incomplete") noteFault()
				logger.report({
					namespace: "storageQuota",
					data: toReadableHighQuotaData(snapshot, sizeMeasurement),
				})
			}
			const delayTimer = setTimeout(() => {
				if (signal.aborted) return
				cancelIdle = scheduleIdle(() => {
					void runSnapshot()
				})
			}, SNAPSHOT_DELAY_MS)
			onDispose(() => {
				clearTimeout(delayTimer)
				cancelIdle()
				window.removeEventListener("error", onWindowError)
				window.removeEventListener("unhandledrejection", onUnhandledRejection)
			})
			window.addEventListener("error", onWindowError)
			window.addEventListener("unhandledrejection", onUnhandledRejection)
		},
	}
}
