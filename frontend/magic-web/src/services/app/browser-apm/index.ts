import { v4 } from "uuid"
import { createBrowserApm, resolveBrowserApmConfig } from "@dtyq/browser-apm"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { env } from "@/utils/env"
import { BrowserApmService } from "./BrowserApmService"

const apm = createBrowserApm()
let sessionId: string | undefined
const service = new BrowserApmService({
	apm,
	readConfig: () => {
		const config = resolveBrowserApmConfig(window.CONFIG?.MAGIC_APM)
		return {
			...config,
			provider: {
				...config.provider,
				release: env("MAGIC_APP_VERSION") || env("MAGIC_APP_SHA") || "",
			},
			telemetry: {
				...config.telemetry,
				http: {
					...config.telemetry?.http,
					// The app owns its reporting endpoint. The standalone APM package does not know it.
					ignoreUrls: [
						/\/log-report(?:[/?#]|$)/,
						...(config.telemetry?.http?.ignoreUrls ?? []),
					],
				},
			},
		}
	},
	readContext: () => {
		const userId = userStore.user.userInfo?.magic_id ?? ""
		return {
			userId,
			sessionId,
			attributes: {
				organization_id: userId ? userStore.user.organizationCode : "",
				secondary_organization_id: userId ? userStore.user.teamshareOrganizationCode : "",
				cluster_id: configStore.cluster.clusterCode ?? "",
			},
		}
	},
})

/** Shared by open-source and enterprise app startup; never called by user hooks/components. */
export function initializeBrowserApm(): string {
	if (!sessionId) {
		sessionId = sessionStorage.getItem("traceId") || v4()
		sessionStorage.setItem("traceId", sessionId)
	}
	service.initialize()
	return sessionId
}

export function disposeBrowserApm(): void {
	service.dispose()
}
if (import.meta.hot) import.meta.hot.dispose(disposeBrowserApm)
