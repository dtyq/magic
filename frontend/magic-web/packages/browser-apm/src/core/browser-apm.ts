import type { ApmContext, ApmProvider, BrowserApm, BrowserApmConfig } from "./types"
import { validateTelemetry } from "../config/telemetry"
class BrowserApmRuntime implements BrowserApm {
	private provider: ApmProvider | null = null
	private initialization: Promise<void> | null = null
	private context: ApmContext = {}
	private disposed = false
	private desiredStarted: boolean | undefined
	initialize(config: BrowserApmConfig): Promise<void> {
		if (this.disposed) return Promise.reject(new Error("Browser APM has been disposed"))
		// Share initialization, including failures: SDKs cannot safely be initialized twice
		// after a partial failure. Reconfiguration requires a new page lifecycle.
		if (this.initialization) return this.initialization
		this.desiredStarted ??= config.autoStart !== false
		this.initialization = this.initializeProvider(config)
		return this.initialization
	}
	private async initializeProvider(config: BrowserApmConfig): Promise<void> {
		if (config.provider.enabled === false) return
		validateTelemetry(config.telemetry)
		const ProviderClass = await this.loadProvider(config.provider.type)
		if (this.disposed) return
		const provider = new ProviderClass()
		try {
			await provider.init({
				...config.provider,
				telemetry: config.telemetry,
				context: this.context,
			})
			if (this.disposed) {
				provider.dispose()
				return
			}
			// Apply updates received while loading before starting collection.
			provider.updateContext(this.context)
			this.provider = provider
			if (this.desiredStarted) provider.start()
		} catch (error) {
			provider.dispose()
			throw error
		}
	}
	start(): void {
		if (this.disposed) return
		this.desiredStarted = true
		this.provider?.start()
	}
	stop(): void {
		this.desiredStarted = false
		this.provider?.stop()
	}
	updateContext(context: ApmContext): void {
		if (this.disposed) return
		this.context = { ...context, attributes: { ...context.attributes } }
		this.provider?.updateContext(this.context)
	}
	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.provider?.dispose()
		this.provider = null
		this.context = {}
	}
	private async loadProvider(
		type: BrowserApmConfig["provider"]["type"],
	): Promise<new () => ApmProvider> {
		switch (type) {
			case "Volcengine":
				return (await import("../providers/volcengine")).VolcengineProvider
			case "Aliyun":
				return (await import("../providers/aliyun")).AliyunProvider
			case "DataFlux":
				return (await import("../providers/dataflux")).DataFluxProvider
			default:
				throw new Error("Unsupported browser APM provider")
		}
	}
}
/** The application creates and shares one runtime per page. Imports have no side effects. */
export function createBrowserApm(): BrowserApm {
	return new BrowserApmRuntime()
}
