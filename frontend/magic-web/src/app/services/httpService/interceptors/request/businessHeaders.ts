import type { ScopedRequestInterceptor } from "@/infrastructure/network/http/clients/types"
import type { HttpRequestSnapshot } from "@/app/services/httpService/types"

interface BusinessHeadersOptions {
	createRequestId: () => string
	/** Magic/Iframe historically ignore the opt-out; enterprise clients honor it. */
	respectAuthorizationFlag: boolean
	/** Popup credentials belong only to the selected service origin. */
	restrictContextOrigin?: boolean
}

/** Receives the owning client's snapshot; never reads global credentials itself. */
export function createBusinessHeadersInterceptor(
	options: BusinessHeadersOptions,
): ScopedRequestInterceptor<HttpRequestSnapshot> {
	return (config, snapshot) => {
		const headers = config.headers!
		const destination = config.url ?? ""
		const baseURL = snapshot.baseURL || config.baseURL || ""
		if (
			options.restrictContextOrigin &&
			(/^https?:\/\//i.test(destination) || destination.startsWith("//")) &&
			snapshot.authorization
		) {
			const base = new URL(baseURL)
			if (
				new URL(destination, base).origin !== base.origin &&
				!headers.has("authorization")
			) {
				throw new Error("HTTP context cannot authorize another service origin")
			}
		}
		// Keep destination and identity from the same captured scope, also on auth retry.
		if (snapshot.baseURL) config.baseURL = snapshot.baseURL
		if (!(config.body instanceof FormData)) headers.set("Content-Type", "application/json")
		headers.set("language", snapshot.language)
		if (
			!headers.has("authorization") &&
			(!options.respectAuthorizationFlag || config.enableAuthorization !== false)
		) {
			if (snapshot.authorization) headers.set("authorization", snapshot.authorization)
		}
		if (!headers.has("organization-code") && snapshot.organizationCode)
			headers.set("organization-code", snapshot.organizationCode)
		// One operation keeps its idempotency ID across retries, regardless of its source.
		if (!headers.has("request-id")) headers.set("request-id", options.createRequestId())
		return config
	}
}
