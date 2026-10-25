import type { UploadQueueHealth, UploadQueueStallReason } from "./ChunkUploader"

export const UPLOAD_QUEUE_WATCHDOG_INTERVAL_MS = 15_000
export const UPLOAD_QUEUE_FROZEN_TICKS = 3
const IMMEDIATE_RESUME_REASONS: UploadQueueStallReason[] = [
	"pending_not_queued",
	"stale_active_upload",
	"has_failed",
]

interface UploadQueueWatchdogOptions {
	intervalMs?: number
	inspect: () => Promise<UploadQueueHealth>
	resume: () => Promise<unknown>
	onRecovered?: (health: UploadQueueHealth) => void
	onError?: (error: unknown) => void
}

export class UploadQueueWatchdog {
	private timer: ReturnType<typeof setInterval> | null = null
	private inFlight = false
	private stopped = true
	private generation = 0
	private consecutiveStalls = 0
	private lastProgressSignature = ""
	private unchangedTicks = 0
	private readonly intervalMs: number
	private readonly inspect: UploadQueueWatchdogOptions["inspect"]
	private readonly resume: UploadQueueWatchdogOptions["resume"]
	private readonly onRecovered?: UploadQueueWatchdogOptions["onRecovered"]
	private readonly onError?: UploadQueueWatchdogOptions["onError"]

	constructor(options: UploadQueueWatchdogOptions) {
		this.intervalMs = options.intervalMs ?? UPLOAD_QUEUE_WATCHDOG_INTERVAL_MS
		this.inspect = options.inspect
		this.resume = options.resume
		this.onRecovered = options.onRecovered
		this.onError = options.onError
	}

	start() {
		this.stop()
		const runId = ++this.generation
		this.stopped = false
		this.timer = setInterval(() => {
			void this.tick(runId)
		}, this.intervalMs)
	}

	stop() {
		// Invalidate in-flight ticks so a later start() cannot resume them.
		this.generation += 1
		this.stopped = true
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
		this.inFlight = false
		this.consecutiveStalls = 0
		this.lastProgressSignature = ""
		this.unchangedTicks = 0
	}

	private isCurrentRun(runId: number) {
		return !this.stopped && this.generation === runId
	}

	private async tick(runId: number) {
		if (!this.isCurrentRun(runId) || this.inFlight) return
		this.inFlight = true

		try {
			const health = await this.inspect()
			if (!this.isCurrentRun(runId)) return

			const signature = `${health.completed}:${health.pending}:${health.failed}:${health.uploading}`
			this.unchangedTicks =
				signature === this.lastProgressSignature ? this.unchangedTicks + 1 : 1
			this.lastProgressSignature = signature

			if (!health.stalled) {
				this.consecutiveStalls = 0
				if (health.uploading > 0 && this.unchangedTicks >= UPLOAD_QUEUE_FROZEN_TICKS) {
					await this.resume()
					if (!this.isCurrentRun(runId)) return
					this.unchangedTicks = 0
					this.onRecovered?.(health)
				}
				return
			}

			this.consecutiveStalls += 1
			if (!this.shouldResume(health)) return

			await this.resume()
			if (!this.isCurrentRun(runId)) return
			this.consecutiveStalls = 0
			this.unchangedTicks = 0
			this.onRecovered?.(health)
		} catch (error) {
			if (this.isCurrentRun(runId)) this.onError?.(error)
		} finally {
			if (this.generation === runId) this.inFlight = false
		}
	}

	private shouldResume(health: UploadQueueHealth) {
		if (IMMEDIATE_RESUME_REASONS.includes(health.reason)) return true
		return this.consecutiveStalls >= 2
	}
}
