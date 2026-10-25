export class HttpNotInitializedError extends Error {
	constructor(name: string) {
		super(`HTTP client ${name} is not initialized`)
		this.name = "HttpNotInitializedError"
	}
}

export class HttpDisposedError extends Error {
	constructor() {
		super("HTTP client has been disposed")
		this.name = "HttpDisposedError"
	}
}

/**
 * Raised when an HTTP response was received but its body could not be parsed.
 * Keeping the original response makes this distinguishable from a fetch-level
 * network error while still allowing the existing error-interceptor path to
 * handle it consistently.
 */
export class ResponseParseError extends Error {
	readonly response: Response
	readonly contentType: string
	readonly rawText?: string

	constructor(
		message: string,
		response: Response,
		contentType: string,
		rawText?: string,
		cause?: unknown,
	) {
		super(message)
		this.name = "ResponseParseError"
		this.response = response
		this.contentType = contentType
		this.rawText = rawText
		if (cause !== undefined) {
			;(this as Error & { cause?: unknown }).cause = cause
		}
	}
}
