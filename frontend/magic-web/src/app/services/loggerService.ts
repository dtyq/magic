import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { startLoggerRuntime } from "@/infrastructure/logger/runtime"
import {
	createDevicePlugin,
	createGlobalErrorPlugin,
	createFetchPlugin,
	createResourcePlugin,
	createPageDwellPlugin,
} from "@/infrastructure/logger/plugins"
import { createStorageQuotaPlugin } from "./storage/storageQuota"
import { recordId } from "@/infrastructure/logger/record"

type AppLogConfig = typeof window.CONFIG

/** Owns application identity, collection policy and lifecycle; business calls use the logger facade. */
export class AppLoggerService {
	private state: "idle" | "running" | "closed" = "idle"
	private closing?: Promise<void>
	private runtime?: ReturnType<typeof startLoggerRuntime>
	private faultReported = false

	start(): boolean {
		if (this.state !== "idle") return this.state === "running"
		try {
			const config = window.CONFIG as AppLogConfig
			const sessionId = this.getSessionId()
			const release = config?.MAGIC_APP_VERSION || config?.MAGIC_APP_SHA || ""
			const fetcher = window.fetch.bind(window)
			this.runtime = startLoggerRuntime({
				fetcher,
				sessionId,
				release,
				console: new URLSearchParams(location.search).get("debug") === "true",
				// Delivery defaults are identical with or without a Node-provided runtime config.
				remote: true,
				getContext: () => this.getContext(),
				plugins: [
					createGlobalErrorPlugin(),
					createFetchPlugin({
						shouldReadResponse: (url) => this.shouldReadResponse(url, config),
						isBusinessError: (body) =>
							!!body &&
							typeof body === "object" &&
							"code" in body &&
							Boolean(body.code) &&
							body.code !== 1000 &&
							body.code !== 0,
					}),
					createResourcePlugin(),
					createPageDwellPlugin(),
					createStorageQuotaPlugin(),
					createDevicePlugin({
						sha: config?.MAGIC_APP_SHA,
						version: config?.MAGIC_APP_VERSION,
					}),
				],
			})
			if (!this.runtime) return false
			this.state = "running"

			return true
		} catch {
			// Logging setup must not prevent appService.init(); release any acquired resources.
			this.reportFault()
			void this.shutdown({ timeoutMs: 0 })
			return false
		}
	}

	shutdown(options?: { timeoutMs?: number }): Promise<void> {
		if (this.closing) return this.closing
		const ownedRuntime = this.runtime
		this.runtime = undefined
		this.state = "closed"
		// The runtime owns plugin teardown before flushing its final records.
		this.closing = ownedRuntime
			? ownedRuntime.shutdown(options).catch(() => this.reportFault())
			: Promise.resolve()
		return this.closing
	}

	private getSessionId(): string {
		const fallback = recordId()
		try {
			const sessionId = sessionStorage.getItem("traceId") || fallback
			sessionStorage.setItem("traceId", sessionId)
			return sessionId
		} catch {
			// Restricted WebViews retain this fallback through the runtime's lifetime.
			return fallback
		}
	}

	private getContext() {
		// Read at record creation, so login/organization changes never rewrite queued identities.
		return {
			url: location.href,
			info: {
				uId: userStore.user?.userInfo?.magic_id,
				tOrgCode: userStore.user?.teamshareOrganizationCode ?? "",
				mOrgCode: userStore.user?.organizationCode ?? "",
				cluster: configStore.cluster.clusterCode,
			},
		}
	}

	private shouldReadResponse(url: URL, config: AppLogConfig): boolean {
		const services = configStore.cluster.cluster?.services ?? {}
		const bases = [
			config?.MAGIC_SERVICE_BASE_URL || import.meta.env.MAGIC_SERVICE_BASE_URL,
			config?.MAGIC_SERVICE_TEAMSHARE_BASE_URL ||
				import.meta.env.MAGIC_SERVICE_TEAMSHARE_BASE_URL,
			config?.MAGIC_SERVICE_KEEWOOD_BASE_URL ||
				import.meta.env.MAGIC_SERVICE_KEEWOOD_BASE_URL,
			...Object.entries(services)
				.filter(([key]) => /api$/i.test(key))
				.map(([, service]) => service.url),
		].filter((base): base is string => Boolean(base))
		return (
			(url.origin === location.origin && url.pathname.startsWith("/api/")) ||
			bases.some((base) => {
				try {
					const configured = new URL(base, location.href)
					return (
						configured.origin === url.origin &&
						(url.pathname === configured.pathname ||
							url.pathname.startsWith(`${configured.pathname.replace(/\/$/, "")}/`))
					)
				} catch {
					return false
				}
			})
		)
	}

	private reportFault() {
		if (this.faultReported) return
		this.faultReported = true
		try {
			console.warn("[AppLoggerService] Logger lifecycle operation failed")
		} catch {
			/* Never send logger lifecycle failures through the logger itself. */
		}
	}
}

// Construction is inert; OSS/Enterprise entries explicitly start the same service.
export const loggerService = new AppLoggerService()

if (import.meta.hot)
	import.meta.hot.dispose(() => {
		void loggerService.shutdown({ timeoutMs: 500 })
	})
