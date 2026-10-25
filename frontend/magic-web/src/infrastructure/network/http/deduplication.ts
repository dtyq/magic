/** Each executor owns its pending work; keys are supplied by the service adapter. */
export class PendingRequests {
	private readonly entries = new Map<string, Promise<unknown>>()
	run<T>(key: string | undefined, execute: () => Promise<T>): Promise<T> {
		if (!key) return execute()
		const existing = this.entries.get(key)
		if (existing) return existing as Promise<T>
		const pending = execute().finally(() => {
			// A late completion must not remove a replacement request after reset.
			if (this.entries.get(key) === pending) this.entries.delete(key)
		})
		this.entries.set(key, pending)
		return pending
	}
	clear() {
		this.entries.clear()
	}
}
