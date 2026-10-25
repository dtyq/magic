import type { InterceptorContext } from "./types"

/** HTTP status code enum (RFC 7231, RFC 7233, and RFC 7540) */
export enum HttpStatusCode {
	/** 200 OK - Request succeeded */
	Ok = 200,
	/** 302 Found - Resource temporarily redirected */
	Found = 302,
	/** 400 Bad Request - Invalid request syntax */
	BadRequest = 400,
	/** 401 Unauthorized - Authentication required */
	Unauthorized = 401,
	/** 403 Forbidden - Access denied */
	Forbidden = 403,
	/** 404 Not Found - Resource does not exist */
	NotFound = 404,
	/** 409 Conflict - Request conflicts with the current resource state */
	Conflict = 409,
	/** 429 Too Many Requests - Request rate limit exceeded */
	TooManyRequests = 429,
	/** 500 Internal Server Error - Internal server error */
	InternalServerError = 500,
}

export enum BusinessResponseCode {
	/** Successful response */
	Success = 1000,
	/** Invalid organization */
	InvalidOrganization = 40101,
	/** No API platform permission */
	PlatformUnauthorized = 70007,
}

function getErrorMessage(data: unknown, fallback: string): string {
	if (!data || typeof data !== "object") return fallback
	const record = data as Record<string, unknown>
	return (
		(typeof record.message === "string" && record.message) ||
		(typeof record.error === "string" && record.error) ||
		fallback
	)
}

function createRequestError(message: string, data?: unknown): Error {
	const error = new Error(message)
	if (data !== undefined) {
		;(error as Error & { response?: unknown }).response = data
	}
	return error
}

export async function iframeBusinessErrorInterceptor({
	request,
	response,
	http,
}: InterceptorContext): Promise<InterceptorContext> {
	if (response.status < 200 || response.status >= 300) {
		throw createRequestError(
			getErrorMessage(response.data, response.statusText || `HTTP ${response.status}`),
			response.data,
		)
	}

	const data = response.data
	if (data && typeof data === "object" && "code" in data) {
		const code = (data as Record<string, unknown>).code
		if (code !== BusinessResponseCode.Success) {
			throw createRequestError(
				getErrorMessage(data, `Request failed with code ${String(code)}`),
				data,
			)
		}
	}

	return { request, response, http }
}
