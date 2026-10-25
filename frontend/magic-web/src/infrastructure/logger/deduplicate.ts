import { normalLimits } from "./limits"
import { recordId } from "./record"
import { safeSnapshot } from "./snapshot"
import type { LogRecord } from "./types"

/** Per-runtime error window. Reports bypass this processor entirely. */
export class Deduplicator {
	private entries = new Map<string, { record: LogRecord; until: number; suppressed: number }>()
	constructor(
		private emit: (record: LogRecord) => void,
		private count: (reason: string, amount?: number) => void,
	) {}
	accept(record: LogRecord): boolean {
		this.expire()
		const error = record.error as
			{ name?: string; stack?: string; message?: string } | undefined
		const key = fingerprint([
			record.namespace,
			record.level,
			record.info,
			record.eventKey,
			record.errorKind,
			error?.name,
			error?.message,
			error?.stack?.split("\n").slice(1, 4),
			record.eventKey
				? undefined
				: safeSnapshot(record.data ?? error?.message, { bytes: 2048 }),
		])
		const previous = this.entries.get(key)
		if (previous) {
			previous.suppressed++
			this.count("suppressed")
			return false
		}
		if (this.entries.size >= normalLimits.dedupCount) {
			const first = this.entries.keys().next().value!
			this.emitSuppression(this.entries.get(first)!)
			this.entries.delete(first)
		}
		this.entries.set(key, {
			record,
			until: Date.now() + normalLimits.dedupWindowMs,
			suppressed: 0,
		})
		return true
	}
	private emitSuppression(entry: { record: LogRecord; suppressed: number }) {
		if (entry.suppressed)
			this.emit({
				...entry.record,
				eventId: recordId(),
				timestamp: Date.now(),
				suppressedCount: entry.suppressed,
			})
	}
	expire() {
		for (const [key, entry] of this.entries) {
			if (entry.until <= Date.now()) {
				this.emitSuppression(entry)
				this.entries.delete(key)
			}
		}
	}
	clear(emit = false) {
		if (emit) for (const entry of this.entries.values()) this.emitSuppression(entry)
		this.entries.clear()
	}
}

/** Stable, bounded FNV-1a fingerprint; timestamps and property insertion order are excluded. */
export function fingerprint(value: unknown): string {
	function stable(item: unknown): string {
		if (!item || typeof item !== "object") return JSON.stringify(item) ?? "null"
		if (Array.isArray(item)) return `[${item.map(stable).join(",")}]`
		return `{${Object.keys(item)
			.sort()
			.map(
				(key) => `${JSON.stringify(key)}:${stable((item as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`
	}
	let hash = 2166136261
	for (const char of stable(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
	return (hash >>> 0).toString(16)
}
