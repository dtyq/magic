import { normalLimits } from "./limits"
import type { ContextSnapshot, LogData, LogLevel, LogRecord } from "./types"
import { byteLength, safeSnapshot } from "./snapshot"

let sequence = 0
export function recordId(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`
	)
}

export function createRecord(
	level: LogLevel,
	arg: LogData,
	snapshot: ContextSnapshot,
	sessionId: string,
	release: string,
	captureSource = "manual",
): LogRecord {
	const base: LogRecord = {
		schemaVersion: 2,
		eventId: recordId(),
		timestamp: Date.now(),
		namespace: String(arg.namespace || "global").slice(0, 128),
		level,
		logType: level,
		traceId: sessionId.slice(0, 128),
		release: release.slice(0, 256),
	}
	const args = Array.isArray(arg.data) ? arg.data : [arg.data]
	const input = args.length === 1 && args[0] && typeof args[0] === "object" ? args[0] : undefined
	let payload: Record<string, unknown> = { data: arg.data, context: arg.context }
	if (level === "error" && input && ("eventKey" in input || "errorKind" in input)) {
		if (
			typeof input.eventKey !== "string" ||
			!input.eventKey.trim() ||
			typeof input.errorKind !== "string" ||
			!input.errorKind.trim()
		)
			throw new Error("invalid_structured_error")
		const original = input.error
		const syntheticError = !(original instanceof Error)
		const error = syntheticError
			? {
					name: "MagicLoggerSyntheticError",
					message:
						input.message ??
						(typeof original === "string" ? original : "Unknown error"),
				}
			: original
		// Identity/summary precede optional context, so budget exhaustion keeps searchable fields.
		payload = {
			eventKey: input.eventKey,
			errorKind: input.errorKind,
			error,
			message: input.message,
			syntheticError,
			captureSource,
			...(syntheticError ? { errorValue: original } : {}),
			context: { ...arg.context, ...input.context },
		}
	}
	const safe = safeSnapshot(payload, { bytes: normalLimits.payloadBytes - 2048 }) as Record<
		string,
		unknown
	>
	// Reserve identity separately: a very large errorValue must not merge different users' dedup state.
	const identity = safeSnapshot(
		{ info: snapshot.info, url: snapshot.url },
		{ bytes: 2048 },
	) as Record<string, unknown>
	// The traversal reports truncation separately without changing established wire field paths.
	const record = {
		...("truncation" in safe ? (safe.value as object) : safe),
		...("truncation" in identity ? (identity.value as object) : identity),
		...base,
		...("truncation" in safe || "truncation" in identity
			? { truncation: safe.truncation ?? identity.truncation }
			: {}),
	} as LogRecord
	if (record.eventKey && record.message === undefined)
		record.message = (record.error as { message?: string })?.message ?? "Unknown error"
	if (byteLength(JSON.stringify(record)) > normalLimits.recordBytes)
		return {
			...base,
			message: "Log exceeded serialization budget",
			truncation: { reason: "record_budget" },
		}
	return record
}
