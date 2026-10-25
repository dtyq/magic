export type StorageSizeFailureReason =
	"unsupported" | "timeout" | "read_failed" | "aborted" | "worker_error"

export type StorageMeasurementStage = "indexedDB" | "cacheStorage" | "worker"

export interface StorageTopItem {
	storageType: "indexedDB" | "cacheStorage"
	container: string
	sizeBytes: number
}

export interface StorageSizeMeasurement {
	indexedDBContentBytes: number
	cacheStorageContentBytes: number
	top10: StorageTopItem[]
	indexedDBSizeDurationMs: number
	cacheStorageSizeDurationMs: number
	sizeMeasurementDurationMs: number
}

/** Counts let logs explain incomplete scans without exposing keys, URLs or values. */
export interface StorageMeasurementCoverage {
	indexedDBRecordsRead: number
	indexedDBStoresRead: number
	cacheStorageEntriesRead: number
	cacheStorageOpaqueEntries: number
}

/** Terminal result returned by the Worker adapter and consumed by storageQuota. */
export type StorageSizeMeasurementResult =
	| {
			status: "complete"
			measurement: StorageSizeMeasurement
			coverage: StorageMeasurementCoverage
			sliceCount: number
			elapsedMs: number
	  }
	| {
			status: "incomplete"
			reason: StorageSizeFailureReason
			stage: StorageMeasurementStage
			coverage: StorageMeasurementCoverage
			sliceCount: number
			elapsedMs: number
	  }

/** Fixed-reason error keeps worker failures free of storage keys, URLs and values. */
export class StorageSizeMeasurementError extends Error {
	constructor(readonly reason: StorageSizeFailureReason) {
		super(reason)
		this.name = "StorageSizeMeasurementError"
	}
}

const encoder = new TextEncoder()
const OMIT_JSON_MEMBER = Symbol("omit-json-member")

type JsonValueContext = "root" | "array" | "object"
type MeasuredValue = number | undefined | typeof OMIT_JSON_MEMBER

/** Read a built-in type tag so values cloned across realms keep their logical byte treatment. */
function getTypeTag(value: object): string {
	return Object.prototype.toString.call(value)
}

/** Estimate logical content bytes without materializing Blob or binary payload copies. */
export function measureValueBytes(
	value: unknown,
	active = new WeakSet<object>(),
): number | undefined {
	const measured = measureValueBytesInternal(value, active, "root")
	return measured === OMIT_JSON_MEMBER ? undefined : measured
}

/** Count a JSON string's UTF-8 bytes without allocating its escaped representation. */
function measureJsonStringBytes(value: string): number {
	let bytes = 2
	for (let index = 0; index < value.length; index += 1) {
		const codeUnit = value.charCodeAt(index)
		if (codeUnit === 0x22 || codeUnit === 0x5c) {
			bytes += 2
			continue
		}
		if (codeUnit <= 0x1f) {
			bytes +=
				codeUnit === 0x08 ||
				codeUnit === 0x09 ||
				codeUnit === 0x0a ||
				codeUnit === 0x0c ||
				codeUnit === 0x0d
					? 2
					: 6
			continue
		}
		if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) {
			const next = value.charCodeAt(index + 1)
			if (codeUnit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4
				index += 1
			} else {
				// JSON.stringify escapes lone surrogates to keep the result valid UTF-8.
				bytes += 6
			}
			continue
		}
		bytes += codeUnit <= 0x7f ? 1 : codeUnit <= 0x7ff ? 2 : 3
	}
	return bytes
}

/** Estimate supported IndexedDB values with JSON punctuation and UTF-8 string semantics. */
function measureValueBytesInternal(
	value: unknown,
	active: WeakSet<object>,
	context: JsonValueContext,
): MeasuredValue {
	if (value === null) return encoder.encode("null").byteLength
	if (typeof value === "string") return measureJsonStringBytes(value)
	if (typeof value === "number") {
		return Number.isFinite(value) ? encoder.encode(String(value)).byteLength : 4
	}
	if (typeof value === "boolean") return value ? 4 : 5
	if (typeof value === "bigint") {
		// IndexedDB supports BigInt even though JSON.stringify does not; retain a deterministic scalar estimate.
		return encoder.encode(String(value)).byteLength
	}
	if (typeof value === "undefined") {
		if (context === "object") return OMIT_JSON_MEMBER
		return context === "array" ? 4 : 0
	}
	if (typeof value === "function" || typeof value === "symbol") {
		if (context === "object") return OMIT_JSON_MEMBER
		return context === "array" ? 4 : undefined
	}
	if (typeof value !== "object") return undefined
	const typeTag = getTypeTag(value)
	if (typeTag === "[object Blob]") return (value as Blob).size
	if (typeTag === "[object ArrayBuffer]" || typeTag === "[object SharedArrayBuffer]") {
		return (value as ArrayBuffer).byteLength
	}
	if (ArrayBuffer.isView(value)) return value.byteLength
	if (typeTag === "[object Date]") {
		return measureJsonStringBytes((value as Date).toISOString())
	}
	if (typeTag === "[object RegExp]") {
		const pattern = value as RegExp
		return measureJsonStringBytes(`${pattern.source}/${pattern.flags}`)
	}
	if (active.has(value)) return undefined
	active.add(value)
	try {
		let total = 0
		if (Array.isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				const bytes = measureValueBytesInternal(value[index], active, "array")
				if (bytes === undefined || bytes === OMIT_JSON_MEMBER) return undefined
				if (index > 0) total += 1
				total += bytes
			}
			return total + 2
		}
		if (typeTag === "[object Map]") {
			let entryCount = 0
			for (const [key, item] of value as Map<unknown, unknown>) {
				const keyBytes = measureValueBytesInternal(key, active, "array")
				const itemBytes = measureValueBytesInternal(item, active, "array")
				if (
					keyBytes === undefined ||
					keyBytes === OMIT_JSON_MEMBER ||
					itemBytes === undefined ||
					itemBytes === OMIT_JSON_MEMBER
				)
					return undefined
				if (entryCount > 0) total += 1
				total += keyBytes + itemBytes
				entryCount += 1
			}
			return total + 2
		}
		if (typeTag === "[object Set]") {
			let entryCount = 0
			for (const item of value as Set<unknown>) {
				const bytes = measureValueBytesInternal(item, active, "array")
				if (bytes === undefined || bytes === OMIT_JSON_MEMBER) return undefined
				if (entryCount > 0) total += 1
				total += bytes
				entryCount += 1
			}
			return total + 2
		}
		if (typeTag !== "[object Object]") return undefined
		const prototype = Object.getPrototypeOf(value)
		// IndexedDB values can come from another realm, so compare prototype shape instead of identity.
		if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return undefined
		let memberCount = 0
		for (const key of Object.keys(value)) {
			const bytes = measureValueBytesInternal(
				(value as Record<string, unknown>)[key],
				active,
				"object",
			)
			if (bytes === OMIT_JSON_MEMBER) continue
			if (bytes === undefined) return undefined
			if (memberCount > 0) total += 1
			total += measureJsonStringBytes(key) + 1 + bytes
			memberCount += 1
		}
		return total + 2
	} catch {
		return undefined
	} finally {
		active.delete(value)
	}
}

/** Keep only the largest ten candidates; storage stays bounded regardless of entry count. */
export class StorageTop10Collector {
	private readonly items: StorageTopItem[] = []

	/** Insert one candidate while keeping the retained collection capped at ten items. */
	add(item: StorageTopItem): void {
		if (!Number.isFinite(item.sizeBytes) || item.sizeBytes < 0) return
		this.items.push(item)
		this.items.sort(compareTopItems)
		if (this.items.length > 10) this.items.length = 10
	}

	/** Return detached items so callers cannot mutate the collector's internal ordering. */
	values(): StorageTopItem[] {
		return this.items.map((item) => ({ ...item }))
	}
}

/** Larger entries win; stable metadata ordering makes ties deterministic in tests and logs. */
function compareTopItems(left: StorageTopItem, right: StorageTopItem): number {
	return (
		right.sizeBytes - left.sizeBytes ||
		left.storageType.localeCompare(right.storageType) ||
		left.container.localeCompare(right.container)
	)
}
