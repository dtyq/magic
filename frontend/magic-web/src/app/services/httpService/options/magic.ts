import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { env } from "@/utils/env"
import { getCurrentLang } from "@/utils/locale"
import { StringUtils } from "@/infrastructure/network/http/requestId"
import { createBusinessHeadersInterceptor } from "@/app/services/httpService/interceptors/request/businessHeaders"
import type { RequestContextProvider } from "@/infrastructure/network/http/clients/types"
import type { AppHttpClientBindings, HttpRequestSnapshot } from "@/app/services/httpService/types"
import { awaitAppInitForOutgoingRequest } from "@/app/services/httpService/interceptors/request/waitForAppInit"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import magicToast from "@/components/base/MagicToaster/utils"
import { authSessionCoordinator } from "@/services/auth/AuthSessionCoordinator"
import { createAppSwCacheInterceptor } from "@/app/services/httpService/interceptors/request/swCache"
import { generateUnauthorizedResInterceptor } from "@/app/services/httpService/interceptors/response/unauthorized"
import { generateInvalidOrgResInterceptor } from "@/app/services/httpService/interceptors/response/invalidOrganization"
import { generateSuccessResInterceptor } from "@/app/services/httpService/interceptors/response/businessResponse"
import { generatePlatformUnauthorizedResInterceptor } from "@/app/services/httpService/interceptors/response/platformUnauthorized"

/** Default Magic application policy. Each factory call owns its context state. */
export function createMagicClientOptions(
	getDefaultBaseURL?: () => string,
	onRouteResolved?: (baseURL: string) => void,
): AppHttpClientBindings {
	const getBaseURL = (code: string) => env("MAGIC_SERVICE_BASE_URL", false, code)
	const ownsAuthorization = (authorization: string | undefined | null) =>
		Boolean(authorization && authorization === userStore.user.authorization?.trim())
	let epoch = 0
	let previous: string | undefined
	const read = () => {
		const authorization = userStore.user.authorization?.trim()
		const organizationCode = userStore.user.organizationCode?.trim()
		const language = getCurrentLang(configStore.i18n.displayLanguage)
		// Compare privately; credentials never become a request key or diagnostic field.
		// Address changes are intentionally excluded: in-flight responses remain valid.
		const identity = JSON.stringify([
			authorization,
			organizationCode,
			configStore.cluster.clusterCode,
		])
		if (identity !== previous) {
			previous = identity
			epoch++
		}
		return {
			baseURL: getDefaultBaseURL?.(),
			scopeId: "global:magic",
			sessionEpoch: epoch,
			authorization,
			organizationCode,
			language,
		}
	}
	const context: RequestContextProvider<HttpRequestSnapshot> = {
		resolve: read,
		isCurrent: (snapshot) => read().sessionEpoch === snapshot.sessionEpoch,
		// Locale partitions equivalent requests without invalidating in-flight responses.
		getKey: ({ scopeId, sessionEpoch, language }) =>
			JSON.stringify([scopeId, sessionEpoch, language]),
	}
	return {
		baseURL: env("MAGIC_SERVICE_BASE_URL"),
		getBaseURL,
		context,
		// The infrastructure installs the gate once; do not add a second waiting interceptor.
		readiness: { wait: () => awaitAppInitForOutgoingRequest() },
		onError: (error) => console.error("Request failed:", error),
		requestInterceptors: [
			createAppSwCacheInterceptor(),
			createBusinessHeadersInterceptor({
				createRequestId: () => StringUtils.createRequestId(),
				respectAuthorizationFlag: false,
			}),
		],
		responseInterceptors: [
			generateUnauthorizedResInterceptor({
				getAccount: (token) => userStore.account.getAccountByAccessToken(token),
				getBaseURL,
				canInvalidate: (authorization) =>
					ownsAuthorization(authorization) ||
					// Preserve the default client's missing-login flow when neither side has credentials.
					(!authorization && !userStore.user.authorization?.trim()),
				onRouteResolved: (request, baseURL) => {
					// Authentication recovery resolves the current account's cluster even if
					// the global cluster code lags behind. Explicit foreign credentials stay local.
					if (ownsAuthorization(request.headers?.get("authorization")))
						onRouteResolved?.(baseURL)
				},
				invalidate: (accountId, reason) =>
					authSessionCoordinator.invalidate({
						service,
						accountId,
						reason,
						source: "http",
						returnTo: window.location.href,
					}),
			}),
			generateInvalidOrgResInterceptor(() => {
				service
					.get<UserService>("userService")
					.setMagicOrganizationCode(userStore.user.organizations?.[0]?.organization_code)
				window.location.reload()
			}),
			generatePlatformUnauthorizedResInterceptor((message) => magicToast.error(message)),
			// Generic envelope validation runs after the dedicated business handlers.
			generateSuccessResInterceptor((message) => magicToast.error(message)),
		],
	}
}
