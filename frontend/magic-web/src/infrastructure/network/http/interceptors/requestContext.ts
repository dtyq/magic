import type { RequestConfig, RequestContextProvider } from "../clients/types"

/** Per-client request metadata, keyed by Headers identity and never sent over HTTP. */
export class RequestContext<Scope extends object = object> {
	private readonly snapshots = new WeakMap<Headers, Scope>()

	constructor(private readonly provider: RequestContextProvider<Scope>) {}

	capture(request: RequestConfig<Headers>): RequestConfig<Headers> {
		// A retry must keep the original snapshot; it cannot borrow a newer identity.
		const snapshot =
			request.authRetryAttempt === 1 ? this.getSnapshot(request) : this.provider.resolve()
		this.validate(snapshot)
		this.snapshots.set(request.headers!, snapshot)
		return request
	}

	getSnapshot(request: RequestConfig<Headers>): Scope {
		const snapshot = request.headers && this.snapshots.get(request.headers)
		if (!snapshot) throw new DOMException("Missing HTTP request context", "AbortError")
		return snapshot
	}

	assertCurrent(request: RequestConfig<Headers>): void {
		this.validate(this.getSnapshot(request))
	}

	copy(source: Headers, target: Headers): void {
		// Core preparation and caller header callbacks may create a new Headers object.
		const snapshot = this.snapshots.get(source)
		if (snapshot) this.snapshots.set(target, snapshot)
	}

	getKey(request: RequestConfig<Headers>): string | undefined {
		return this.provider.getKey?.(this.getSnapshot(request))
	}

	private validate(snapshot: Scope): void {
		if (!this.provider.isCurrent(snapshot))
			throw new DOMException("Stale HTTP scope", "AbortError")
	}
}
