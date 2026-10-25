/** Shared UTF-8 byte limits for all business logs. */
export const normalLimits = Object.freeze({
	/** Max UTF-8 bytes per log record. */
	recordBytes: 32 * 1024,
	/** Max UTF-8 bytes for serialized payload. */
	payloadBytes: 28 * 1024,
	/** Max UTF-8 bytes per string field when truncating. */
	stringBytes: 4 * 1024,
	/** Max nesting depth when serializing objects. */
	depth: 8,
	/** Max collection width (array/object keys) when serializing. */
	width: 100,
	/** Max record count during early bootstrap phase. */
	earlyCount: 100,
	/** Max total UTF-8 bytes during early bootstrap phase. */
	earlyBytes: 256 * 1024,
	/** Max queued record count before backpressure. */
	queueCount: 1000,
	/** Max queued UTF-8 bytes before backpressure. */
	queueBytes: 2 * 1024 * 1024,
	/** Max records per upload batch. */
	batchCount: 100,
	/** Max UTF-8 JSON request bytes, including brackets/commas; matches the Node receiver. */
	batchBytes: 2 * 1024 * 1024,
	/** Flush interval in milliseconds. */
	intervalMs: 5000,
	/** Upload request timeout in milliseconds. */
	timeoutMs: 5000,
	/** Max retry attempts per failed upload. */
	maxRetries: 2,
	/** Time-to-live for queued records in milliseconds. */
	ttlMs: 60000,
	/** Max UTF-8 bytes for keepalive/ping payloads. */
	keepaliveBytes: 48 * 1024,
	/** Dedup window duration in milliseconds. */
	dedupWindowMs: 10000,
	/** Max distinct keys tracked for deduplication. */
	dedupCount: 1000,
})
