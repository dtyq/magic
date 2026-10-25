import type { TelemetryConfig } from "../config/telemetry"

export type ProviderType = "Volcengine" | "Aliyun" | "DataFlux"
export interface ApmConnection {
	type: ProviderType
	appId: string | number
	token: string
	enabled?: boolean
	env?: string
	endpoint?: string
	release?: string
	service?: string
}
/** A replacement snapshot of identifiers, never a store or full user object. */
export interface ApmContext {
	userId?: string
	/** Application session correlation; distinct from a distributed trace ID. */
	sessionId?: string
	attributes?: Readonly<Record<string, string>>
}
export interface BrowserApmConfig {
	provider: ApmConnection
	telemetry?: TelemetryConfig
	autoStart?: boolean
}
/** Internal adapter input. Legacy SDK options are decoded only within this package. */
export interface IProviderConfig extends ApmConnection {
	telemetry?: TelemetryConfig
	context?: ApmContext
	extra?: Record<string, any>
}
export interface ApmProvider {
	init(config: IProviderConfig): Promise<void>
	start(): void
	stop(): void
	updateContext(context: ApmContext): void
	dispose(): void
}
/** Passive monitoring: no business log/report/error API. */
export interface BrowserApm {
	initialize(config: BrowserApmConfig): Promise<void>
	start(): void
	stop(): void
	updateContext(context: ApmContext): void
	dispose(): void
}
