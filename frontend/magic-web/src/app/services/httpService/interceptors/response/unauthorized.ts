import type { InterceptorContext, RequestConfig } from "@/infrastructure/network/http/clients/types"
import { UrlUtils } from "@/infrastructure/network/http/serialization"
import { HttpStatusCode } from "@/infrastructure/network/http/clients/magicResponse"
import { getAuthFailureReason, isAuthInvalidCode } from "@/services/auth/AuthFailureClassifier"

interface UnauthorizedDependencies {
	getAccount: (authorization: string) => { magic_id: string; deployCode: string } | undefined
	invalidate: (
		accountId: string | undefined,
		reason: "token-expired" | "account-unauthorized",
	) => Promise<unknown>
	getBaseURL: (code: string) => string
	/** Default application clients may only clean up the identity they own. */
	canInvalidate?: (authorization: string | undefined | null) => boolean
	/** Application owner updates future requests before retry, independent of its business result. */
	onRouteResolved?: (request: RequestConfig<Headers>, baseURL: string) => void
}

/** Invalid login */
export function generateUnauthorizedResInterceptor({
	getAccount,
	invalidate,
	getBaseURL,
	canInvalidate = () => true,
	onRouteResolved,
}: UnauthorizedDependencies) {
	/** Classify the response and hand session cleanup/navigation to the auth coordinators. */
	async function handleUnauthorized(
		authorization: string | undefined | null,
		reason: "token-expired" | "account-unauthorized",
	) {
		if (!canInvalidate(authorization)) return
		const user = getAccount(authorization || "")
		await invalidate(user?.magic_id, reason)
	}

	return async function unAuthorized({ request, response, http }: InterceptorContext) {
		const { enableAuthorizationVerification = true } = request

		if (
			(enableAuthorizationVerification && response.status === HttpStatusCode.Unauthorized) ||
			isAuthInvalidCode(response?.data?.code)
		) {
			const authorization = request.headers?.get("authorization")
			const user = getAccount(authorization || "")
			/** Correct the request domain and retry only when the cluster-code mapping is invalid. */
			if (user && request.authRetryAttempt !== 1) {
				const baseUrl = getBaseURL(user.deployCode)
				if (baseUrl) {
					// Preserve the legacy origin-only correction: the prepared URL already
					// contains the full path and query; destination path prefixes are ignored.
					const destination = new URL(baseUrl)
					const retryURL = new URL(request.url ?? "", baseUrl)
					retryURL.protocol = destination.protocol
					retryURL.hostname = destination.hostname
					// Assign even an empty port so the previous origin's port cannot survive.
					retryURL.port = destination.port
					// Only authentication failures reach this branch. Publish synchronously so
					// later requests use the full base path even if this retry fails.
					// Only the current retry preserves its already prepared path.
					http.validateRequest(request)
					onRouteResolved?.(request, baseUrl)
					// Return the retried API request.
					const res = await http.retry({
						...request,
						authRetryAttempt: 1,
						baseURL: baseUrl,
						url: retryURL.toString(),
					})

					// Parse JSON data (only needs to be executed once)
					const jsonData = (
						await UrlUtils.responseParse(res.clone(), {
							parseJsonLargeIntAsString: request.parseJsonLargeIntAsString,
						})
					).data

					// Recovery must not invalidate or navigate a session that changed while awaiting transport.
					http.validateRequest(request)

					if (
						(enableAuthorizationVerification &&
							res.status === HttpStatusCode.Unauthorized) ||
						isAuthInvalidCode(jsonData?.code)
					) {
						const reason = getAuthFailureReason(jsonData?.code)
						await handleUnauthorized(
							authorization,
							reason === "account-unauthorized" ? reason : "token-expired",
						)
						throw new Error("Unauthorized")
					}

					return {
						http,
						request,
						response: {
							status: res.status,
							statusText: res.statusText,
							headers: res.headers,
							data: jsonData,
						},
					}
				}
			}
			const reason = getAuthFailureReason(response?.data?.code)
			await handleUnauthorized(
				authorization,
				reason === "account-unauthorized" ? reason : "token-expired",
			)
			throw new Error("Unauthorized")
		}
		return { http, request, response }
	}
}
