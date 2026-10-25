/**
 * Redact credentials from upload and token error text before it reaches logs
 * or crosses the service boundary. The logger remains responsible for its own
 * payload masking, but upload errors also become public Error messages.
 */
export const redactUploadErrorMessage = (message: string): string =>
	message
		.replace(/https?:\/\/[^\s]+/gi, "[url]")
		.replace(/\bBearer\s+[^\s,}"')]+/gi, "Bearer [REDACTED]")
		.replace(
			/((?:"|')?(?:authorization|access[_-]?token|refresh[_-]?token|token|signature|credential|policy)(?:"|')?\s*[:=]\s*)(?:Bearer\s+)?("[^"]*"|'[^']*'|[^,\s}&#]+)/gi,
			(_, prefix: string) => `${prefix}[REDACTED]`,
		)
