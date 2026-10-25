import { BaseProvider } from "../../core/base-provider"
import type { IVolcengineConfig } from "../legacy-config"
import type { BrowserClient, BrowserReportEvent, BrowserSendEvent } from "@apmplus/web"
import { SensitiveMasker } from "../../privacy"
import type { ApmContext } from "../../core/types"
import { createVolcengineSettings } from "./settings"
import {
	annotateHttp,
	isIgnoredUrl,
	TELEMETRY_IGNORE_URLS,
	RESOURCE_IGNORE_TYPES,
} from "./http-monitor"

/** APMPlus owns event sampling and batching; each transport has exactly one HTTP collector. */
export class VolcengineProvider extends BaseProvider {
	private client: BrowserClient | null = null
	private readonly recentErrors = new Map<string, number>()
	private errorWindowMs = 10000
	private errorEnabled = true

	async init(config: IVolcengineConfig): Promise<void> {
		this.validateConfig(config)
		this.config = config
		const settings = createVolcengineSettings(config)
		this.errorWindowMs = settings.errorWindowMs
		this.errorEnabled = settings.enableError
		// Optional SDK imports remain deferred until after the application's first render.
		const [sdk, integrations, pageView, httpMonitor] = await Promise.all([
			import("@apmplus/web"),
			import("@apmplus/integrations"),
			import("./plugins/PageViewPlugin"),
			import("./plugins/HttpMonitor"),
		])
		this.client = sdk.createBrowserClient()
		const configuredPlugins = settings.sdk.plugins || {}
		const resource = configuredPlugins.resource
		const ajax = configuredPlugins.ajax
		this.client.init({
			...settings.sdk,
			aid: +config.appId,
			token: config.token,
			env: config.env || "production",
			release: config.release ?? "",
			userId: config.context?.userId ?? "",
			plugins: {
				pageview: pageView.plugin(),
				performance: {},
				fmp: false,
				...configuredPlugins,
				breadcrumb: { dom: false, maxBreadcrumbs: 20 },
				blankScreen: false,
				action: false,
				// The bounded time-window gate below replaces SDK consecutive-only deduplication.
				jsError: !settings.enableError
					? false
					: {
							...(typeof configuredPlugins.jsError === "object"
								? configuredPlugins.jsError
								: {}),
							onerror: true,
							onunhandledrejection: true,
							captureGlobalAsync: false,
							dedupe: false,
						},
				resource:
					resource === false
						? false
						: {
								...(typeof resource === "object" ? resource : {}),
								ignoreTypes: [
									...RESOURCE_IGNORE_TYPES,
									...(typeof resource === "object"
										? resource.ignoreTypes || []
										: []),
								],
								ignoreUrls: [
									...TELEMETRY_IGNORE_URLS,
									/\.css(?:[?#]|$)/i,
									...(typeof resource === "object"
										? resource.ignoreUrls || []
										: []),
								],
							},
				ajax:
					ajax === false
						? false
						: {
								...(typeof ajax === "object" ? ajax : {}),
								autoWrap: true,
								collectBodyOnError: false,
								ignoreUrls: [
									...TELEMETRY_IGNORE_URLS,
									...(typeof ajax === "object" ? ajax.ignoreUrls || [] : []),
								],
								extraExtractor: undefined,
							},
				// The integration reports standard http events, using only technical metadata. Keeping
				// SDK autoWrap enabled here would collect every Fetch request twice.
				fetch: false,
				...(!settings.enablePerformance
					? {
							performance: false,
							fmp: false,
							tti: false,
							blankScreen: false,
						}
					: {}),
			},
			integrations: [
				...(!settings.enablePerformance ? [] : [integrations.SPALoadPlugin()]),
				httpMonitor.plugin(settings.http),
			],
		})
		this.client.on("report", (event: BrowserReportEvent) => {
			if (!this.isStarted || event.ev_type === "custom") return false
			if (event.ev_type === "js_error" && !this.allowError(event.payload.error)) return false
			if (event.ev_type === "http") {
				if (isIgnoredUrl(event.payload.request.url, settings.http.excludeUrls)) return false
				annotateHttp(event.payload, settings.http.slowApiThreshold)
			}
			// The resource plugin can force slow-page entries to 100%; use the configured rule instead.
			if (event.ev_type === "resource" && event.extra) delete event.extra.sample_rate
			return event
		})
		// The SDK supplies a JSON event; masking replaces values while preserving its envelope.
		this.client.on("beforeSend", (event: BrowserSendEvent) =>
			this.isStarted ? (SensitiveMasker.sanitize(event) as BrowserSendEvent) : false,
		)
		this.isInitialized = true
	}

	start(): void {
		if (!this.isInitialized || !this.client) throw new Error("APMPlus client not initialized")
		this.isStarted = true
		this.client.start()
	}

	stop(): void {
		this.isStarted = false
		this.client?.getSender()?.clear()
	}

	updateContext(context: ApmContext): void {
		this.client?.config({
			userId: context.userId ?? "",
			...(context.sessionId ? { sessionId: context.sessionId } : {}),
		})
		this.client?.context?.clear()
		this.client?.context?.merge({
			...context.attributes,
			app_session_id: context.sessionId ?? "",
		})
	}
	dispose(): void {
		this.stop()
		this.client?.destroy()
		this.client = null
		this.recentErrors.clear()
	}
	/** All native uncaught exceptions pass through this gate before SDK sampling. */
	private allowError(error: { name?: string; message?: string; stack?: string }): boolean {
		if (!this.errorEnabled) return false
		const key = JSON.stringify([
			error.name,
			error.message?.slice(0, 500),
			error.stack?.slice(0, 1000),
		])
		const now = Date.now()
		const previous = this.recentErrors.get(key)
		if (previous !== undefined && now - previous < this.errorWindowMs) return false
		if (this.recentErrors.size >= 500) {
			const oldest = this.recentErrors.keys().next().value
			if (oldest !== undefined) this.recentErrors.delete(oldest)
		}
		this.recentErrors.set(key, now)
		return true
	}
}
