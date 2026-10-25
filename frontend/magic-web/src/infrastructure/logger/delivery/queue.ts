import { normalLimits } from "../limits"
import type { LogRecord } from "../types"
import { byteLength } from "../snapshot"
import { encodeBatch, FetchTransport, type DeliveryResult, type EncodedBatch } from "./transport"

interface Entry {
	sequence: number
	json: string
	bytes: number
	level: string
	created: number
}
interface Batch {
	entries: Entry[]
	encoded?: EncodedBatch
	attempts: number
	readyAt: number
}
const rank: Record<string, number> = { info: 0, warn: 1, report: 2, error: 3 }

/** One owner for queued and retrying entries; acknowledgements settle flush snapshots. */
export class DeliveryQueue {
	private entries: Entry[] = []
	private batch?: Batch
	private pending = new Set<number>()
	private sequence = 0
	private busy = false
	private closed = false
	private timer: ReturnType<typeof setTimeout> | undefined
	private waiters = new Set<() => void>()
	private prepared?: { entries: Entry[]; encoded: EncodedBatch }
	private preparing = false
	constructor(
		private transport: FetchTransport,
		private count: (reason: string, amount?: number) => void,
		private maxRetries: number = normalLimits.maxRetries,
	) {}
	add(record: LogRecord) {
		if (this.closed) return
		const json = JSON.stringify(record)
		const bytes = byteLength(json)
		// Reject an unsendable record here so it cannot block all later queue entries.
		if (bytes + 2 > normalLimits.batchBytes) {
			this.count("record_capacity")
			return
		}
		const entry = {
			sequence: ++this.sequence,
			json,
			bytes,
			level: record.level,
			created: Date.now(),
		}
		this.entries.push(entry)
		this.pending.add(entry.sequence)
		this.count("admitted")
		let all = [...(this.batch?.entries ?? []), ...this.entries]
		let total = all.reduce((sum, item) => sum + item.bytes, 0)
		while (all.length > normalLimits.queueCount || total > normalLimits.queueBytes) {
			// Already encoded/in-flight entries are immutable; evict the lowest queued severity first.
			const victim = [...this.entries].sort(
				(a, b) => rank[a.level] - rank[b.level] || a.sequence - b.sequence,
			)[0]
			if (!victim) break
			this.entries.splice(this.entries.indexOf(victim), 1)
			this.settle([victim], "queue_capacity")
			total -= victim.bytes
			all = all.filter((item) => item !== victim)
		}
		this.schedule(
			this.entries.length >= normalLimits.batchCount ||
				this.entries.reduce((sum, item) => sum + item.bytes, 0) >= normalLimits.batchBytes
				? 0
				: normalLimits.intervalMs,
		)
		void this.prepareHidden()
	}
	private async prepareHidden() {
		if (this.preparing || this.closed || this.busy) return
		this.preparing = true
		try {
			let bytes = 2
			const entries: Entry[] = []
			for (const entry of this.entries) {
				if (
					entries.length >= normalLimits.batchCount ||
					bytes + entry.bytes + 1 > normalLimits.keepaliveBytes
				)
					break
				entries.push(entry)
				bytes += entry.bytes + 1
			}
			if (!entries.length) return
			const encoded = await encodeBatch(
				`[${entries.map((entry) => entry.json).join(",")}]`,
				this.count,
			)
			if (!this.closed && entries.every((entry) => this.entries.includes(entry)))
				this.prepared = { entries, encoded }
		} catch {
			this.count("encoding_failed")
		} finally {
			this.preparing = false
		}
	}
	private settle(entries: Entry[], reason: string) {
		entries.forEach((entry) => this.pending.delete(entry.sequence))
		this.count(reason, entries.length)
		this.waiters.forEach((notify) => notify())
	}
	private schedule(delay: number) {
		if (this.closed || (this.timer && delay > 0)) return
		if (this.timer) clearTimeout(this.timer)
		this.timer = setTimeout(() => {
			this.timer = undefined
			void this.pump()
		}, delay)
	}
	private async pump() {
		if (this.busy || this.closed) return
		this.expireBatch()
		if (this.batch && this.batch.readyAt > Date.now()) {
			this.schedule(this.batch.readyAt - Date.now())
			return
		}
		if (!this.batch) {
			const expired = this.entries.filter(
				(entry) => Date.now() - entry.created >= normalLimits.ttlMs,
			)
			this.entries = this.entries.filter(
				(entry) => Date.now() - entry.created < normalLimits.ttlMs,
			)
			this.settle(expired, "expired")
			const entries: Entry[] = []
			let bytes = 2
			while (this.entries.length && entries.length < normalLimits.batchCount) {
				const separator = entries.length ? 1 : 0
				if (bytes + this.entries[0].bytes + separator > normalLimits.batchBytes) break
				const entry = this.entries.shift()!
				entries.push(entry)
				bytes += entry.bytes + separator
			}
			if (!entries.length) return
			this.batch = { entries, attempts: 0, readyAt: 0 }
		}
		this.busy = true
		const batch = this.batch
		try {
			batch.encoded ??= await encodeBatch(
				`[${batch.entries.map((entry) => entry.json).join(",")}]`,
				this.count,
			)
			if (this.closed) return
			const result = await this.transport.send(batch.encoded, batch.entries.length)
			if (this.closed) return
			this.handleResult(batch, result)
		} catch {
			this.settle(batch.entries, "encoding_failed")
			this.batch = undefined
		} finally {
			this.busy = false
			if (this.batch || this.entries.length)
				this.schedule(this.batch ? Math.max(0, this.batch.readyAt - Date.now()) : 0)
		}
	}
	private handleResult(batch: Batch, result: DeliveryResult) {
		const remaining = normalLimits.ttlMs - (Date.now() - batch.entries[0].created)
		const delay = Math.max(
			result.retryAfterMs || 0,
			1000 * 2 ** batch.attempts * (1 + Math.random() * 0.25),
		)
		if (
			!result.ok &&
			result.retryable &&
			batch.attempts < this.maxRetries &&
			delay < remaining
		) {
			batch.attempts++
			batch.readyAt = Date.now() + delay
			this.count("retry")
		} else {
			this.settle(
				batch.entries,
				result.ok ? "accepted" : (result.reason ?? "delivery_failed"),
			)
			this.batch = undefined
		}
	}
	private expireBatch() {
		if (this.batch && Date.now() - this.batch.entries[0].created >= normalLimits.ttlMs) {
			this.settle(this.batch.entries, "expired")
			this.batch = undefined
		}
	}
	/** Only already prepared batches can use the browser's small shared keepalive budget. */
	async hidden() {
		if (this.busy || this.closed) return
		if (
			!this.batch &&
			this.prepared &&
			this.prepared.entries.every((entry) => this.entries.includes(entry))
		) {
			this.batch = { ...this.prepared, attempts: 0, readyAt: 0 }
			this.entries = this.entries.filter((entry) => !this.prepared!.entries.includes(entry))
			this.prepared = undefined
		}
		if (!this.batch?.encoded || this.batch.readyAt > Date.now()) return
		this.expireBatch()
		if (!this.batch) return
		const batch = this.batch
		this.busy = true
		try {
			const result = await this.transport.send(batch.encoded!, batch.entries.length, {
				keepalive: true,
			})
			if (!this.closed && result.reason !== "keepalive_budget")
				this.handleResult(batch, result)
		} finally {
			this.busy = false
			if (this.batch || this.entries.length) this.schedule(0)
		}
	}
	flush({ timeoutMs = normalLimits.timeoutMs }: { timeoutMs?: number } = {}): Promise<boolean> {
		const cutoff = this.sequence
		return new Promise((resolve) => {
			const finish = (done: boolean) => {
				clearTimeout(timer)
				this.waiters.delete(check)
				resolve(done)
			}
			const check = () => {
				if (![...this.pending].some((id) => id <= cutoff)) finish(true)
			}
			const timer = setTimeout(() => finish(false), timeoutMs)
			this.waiters.add(check)
			check()
			this.schedule(0)
		})
	}
	destroy(reason = "shutdown") {
		this.closed = true
		clearTimeout(this.timer)
		this.transport.destroy()
		this.settle([...(this.batch?.entries ?? []), ...this.entries], reason)
		this.entries = []
		this.batch = undefined
		this.prepared = undefined
	}
}
