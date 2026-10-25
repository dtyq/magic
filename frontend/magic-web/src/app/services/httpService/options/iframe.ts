import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { env } from "@/utils/env"
import { getCurrentLang } from "@/utils/locale"
import { StringUtils } from "@/infrastructure/network/http/requestId"
import { createBusinessHeadersInterceptor } from "@/app/services/httpService/interceptors/request/businessHeaders"
import type { RequestContextProvider } from "@/infrastructure/network/http/clients/types"
import type { AppHttpClientBindings, HttpRequestSnapshot } from "@/app/services/httpService/types"
import { awaitAppInitForOutgoingRequest } from "@/app/services/httpService/interceptors/request/waitForAppInit"

/** Default Iframe application policy. Each factory call owns its context state. */
export function createIframeClientOptions(): AppHttpClientBindings {
	const getBaseURL = (code: string) => env("MAGIC_SERVICE_BASE_URL", false, code)
	let epoch = 0
	let previous: string | undefined
	const read = () => {
		const authorization = userStore.user.authorization?.trim()
		const organizationCode = userStore.user.organizationCode?.trim()
		const language = getCurrentLang(configStore.i18n.displayLanguage)
		// Compare privately; credentials never become a request key or diagnostic field.
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
			scopeId: "global:iframe",
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
		// Iframe protocol errors are handled by its infrastructure factory; no global UI effects.
		requestInterceptors: [
			createBusinessHeadersInterceptor({
				createRequestId: () => StringUtils.createRequestId(),
				respectAuthorizationFlag: false,
			}),
		],
		responseInterceptors: [],
	}
}
