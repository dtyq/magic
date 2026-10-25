export type HtmlPermissionAuthorizationTask = (signal: AbortSignal) => Promise<boolean>

interface QueueEntry {
	task: HtmlPermissionAuthorizationTask
	controller: AbortController
	resolve: (allowed: boolean) => void
	reject: (error: unknown) => void
}

/**
 * Serializes permission decisions for one HTML preview controller.
 *
 * The queue is intentionally page-local. Grant storage remains responsible for
 * persistence and cross-tab synchronization; this module only coordinates the
 * modal presenter and deduplicates requests waiting on the same decision.
 */
export class HtmlPermissionAuthorizationQueue {
	private readonly entries: QueueEntry[] = []
	private readonly pendingByKey = new Map<string | object, Promise<boolean>>()
	private processing = false
	private disposed = false
	private currentEntry: QueueEntry | null = null

	get isDisposed() {
		return this.disposed
	}

	enqueue(key: string | object, task: HtmlPermissionAuthorizationTask): Promise<boolean> {
		if (this.disposed) return Promise.resolve(false)

		const pending = this.pendingByKey.get(key)
		if (pending) return pending

		const result = new Promise<boolean>((resolve, reject) => {
			this.entries.push({
				task,
				controller: new AbortController(),
				resolve,
				reject,
			})
		})
		this.pendingByKey.set(key, result)
		// Start asynchronously so the caller always receives the shared promise
		// before a synchronous task can settle and clear its deduplication entry.
		void this.process()

		void result.then(
			() => this.clearPending(key, result),
			() => this.clearPending(key, result),
		)
		return result
	}

	dispose() {
		if (this.disposed) return
		this.disposed = true

		this.currentEntry?.controller.abort()
		this.currentEntry?.resolve(false)
		while (this.entries.length > 0) {
			this.entries.shift()?.resolve(false)
		}
	}

	private async process() {
		if (this.processing) return
		this.processing = true

		try {
			while (this.entries.length > 0) {
				const entry = this.entries.shift()
				if (!entry) continue
				if (this.disposed) {
					entry.resolve(false)
					continue
				}

				this.currentEntry = entry
				try {
					const allowed = await entry.task(entry.controller.signal)
					// A controller may be disposed while the modal is open. Do not let
					// that stale decision authorize a new application instance.
					entry.resolve(this.disposed ? false : allowed)
				} catch (error) {
					if (this.disposed) entry.resolve(false)
					else entry.reject(error)
				} finally {
					this.currentEntry = null
				}
			}
		} finally {
			this.processing = false
		}
	}

	private clearPending(key: string | object, result: Promise<boolean>) {
		if (this.pendingByKey.get(key) === result) this.pendingByKey.delete(key)
	}
}
