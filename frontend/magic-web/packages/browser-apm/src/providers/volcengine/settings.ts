import type { BrowserInitConfig } from "@apmplus/web"
import type { IVolcengineConfig } from "../legacy-config"
import type { HttpMonitorOptions } from "./http-monitor"
import { validateTelemetry } from "../../config/telemetry"

function rate(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
		? value
		: fallback
}

export function createVolcengineSettings(config: IVolcengineConfig) {
	const options = { ...config.extra, ...config }
	const policy = config.telemetry ?? {}
	validateTelemetry(policy)
	const plugins = { ...options.plugins }
	if (policy.capture?.http !== undefined) {
		plugins.fetch = policy.capture.http ? plugins.fetch || true : false
		plugins.ajax = policy.capture.http ? plugins.ajax || true : false
	}
	if (policy.capture?.resources !== undefined)
		plugins.resource = policy.capture.resources ? plugins.resource || true : false
	else if (policy.capture?.performance === undefined && options.enablePerformance === false)
		plugins.resource = false
	const fetch = plugins.fetch
	const http: HttpMonitorOptions = {
		enabled: fetch !== false,
		slowApiThreshold: policy.http?.slowThresholdMs ?? 1000,
		excludeUrls: policy.http?.ignoreUrls ?? (typeof fetch === "object" ? fetch.ignoreUrls : []),
	}
	const sdk: Partial<BrowserInitConfig> = {
		// Make local per-event rates deterministic. Opt into console configuration explicitly
		// when remote conditional rules / allowlists are desired; they can change effective rates.
		useLocalConfig:
			policy.remoteConfig !== undefined
				? !policy.remoteConfig
				: (options.useLocalConfig ?? true),
		...(config.endpoint || options.domain ? { domain: config.endpoint || options.domain } : {}),
		plugins,
		sample: {
			include_users: [],
			...(policy.sampling ? {} : options.sample),
			sample_granularity:
				policy.sampling?.unit ?? options.sample?.sample_granularity ?? "event",
			sample_rate: policy.sampling
				? (policy.sampling.rate ?? 1)
				: rate(options.sample?.sample_rate ?? options.sampleRate, 1),
			rules: {
				...(policy.sampling?.unit === "session"
					? {}
					: {
							http: { enable: true, sample_rate: 0.5, conditional_sample_rules: [] },
							resource: {
								enable: true,
								sample_rate: 0.1,
								conditional_sample_rules: [],
							},
							js_error: {
								enable: true,
								sample_rate: 1,
								conditional_sample_rules: [],
							},
							resource_error: {
								enable: true,
								sample_rate: 1,
								conditional_sample_rules: [],
							},
							...(policy.sampling ? {} : options.sample?.rules),
						}),
				...Object.fromEntries(
					Object.entries(policy.sampling?.events ?? {}).map(([key, value]) => [
						key === "error"
							? "js_error"
							: key === "resourceError"
								? "resource_error"
								: key,
						{ enable: true, sample_rate: value, conditional_sample_rules: [] },
					]),
				),
			},
		},
	}
	return {
		sdk,
		http,
		enablePerformance: policy.capture?.performance ?? options.enablePerformance !== false,
		enableError:
			policy.capture?.errors ?? (options.enableError !== false && plugins.jsError !== false),
		errorWindowMs:
			policy.errors?.dedupeWindowMs ??
			(typeof options.errorDedupeWindowMs === "number" &&
			Number.isFinite(options.errorDedupeWindowMs) &&
			options.errorDedupeWindowMs >= 0
				? options.errorDedupeWindowMs
				: 10000),
	}
}
