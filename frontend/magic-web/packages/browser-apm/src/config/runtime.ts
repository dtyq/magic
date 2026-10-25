import type { BrowserApmConfig, IProviderConfig } from "../core/types"
import type { TelemetryConfig } from "./telemetry"

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

/** Decode old deployment JSON here, so application adapters never inspect SDK fields. */
export function resolveBrowserApmConfig(runtime: unknown): BrowserApmConfig {
	const value = record(typeof runtime === "string" ? JSON.parse(runtime || "{}") : runtime)
	const modern = value.provider !== undefined
	const options = record(modern ? value.provider : value.options)
	const telemetry = record(value.telemetry) as TelemetryConfig
	const { extra, appId, token, ...legacyOptions } = options
	const provider = {
		...options,
		type: modern ? options.type : value.strategy,
		enabled: options.enabled ?? Boolean(modern ? options.type : value.strategy),
		appId,
		token,
		// Preserve existing customers' options, but keep all interpretation in the Provider.
		...(!modern ? { extra: { ...record(extra), ...legacyOptions } } : {}),
	} as IProviderConfig
	return {
		...(modern ? (value as unknown as BrowserApmConfig) : {}),
		provider,
		telemetry,
	}
}
