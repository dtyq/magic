export interface HtmlNavigationRuntimeRequest {
	requestId: string
	content: string
	locationSearch: string
	locationAnchor: string
	/** Optional runtime bundle owned by the current host deployment. */
	runtimeUrl?: string
}

export type HtmlNavigationRuntimeSendResult = "sent" | "queued" | "duplicate"

export interface HtmlNavigationRuntimeTransport {
	send: (request: HtmlNavigationRuntimeRequest) => void
}

/**
 * Coordinates the shell-ready state and the latest setContent request.
 *
 * The service deliberately knows nothing about React or iframe DOM objects. It
 * only guarantees that an old request cannot be sent after a newer request and
 * that one request is sent at most once per shell lifecycle.
 */
export class HtmlNavigationRuntimeService {
	private shellReady = false

	private pendingRequest: HtmlNavigationRuntimeRequest | null = null

	private sentRequestId = ""

	private readonly transport: HtmlNavigationRuntimeTransport

	constructor(transport: HtmlNavigationRuntimeTransport) {
		this.transport = transport
	}

	resetShell(): void {
		this.shellReady = false
		this.pendingRequest = null
		this.sentRequestId = ""
	}

	markShellReady(): HtmlNavigationRuntimeSendResult | null {
		this.shellReady = true
		return this.flush()
	}

	submit(request: HtmlNavigationRuntimeRequest): HtmlNavigationRuntimeSendResult {
		if (this.pendingRequest?.requestId === request.requestId) {
			return this.sentRequestId === request.requestId ? "duplicate" : "queued"
		}

		this.pendingRequest = request
		return this.flush() || "queued"
	}

	getCurrentRequestId(): string {
		return this.pendingRequest?.requestId || ""
	}

	getCurrentRequest(): HtmlNavigationRuntimeRequest | null {
		return this.pendingRequest
	}

	acceptsMessage(requestId?: string): boolean {
		return !requestId || !this.getCurrentRequestId() || requestId === this.getCurrentRequestId()
	}

	private flush(): HtmlNavigationRuntimeSendResult | null {
		if (!this.shellReady || !this.pendingRequest) return null
		if (this.sentRequestId === this.pendingRequest.requestId) return "duplicate"

		this.transport.send(this.pendingRequest)
		this.sentRequestId = this.pendingRequest.requestId
		return "sent"
	}
}
