import type { IAliyunConfig } from "../legacy-config"
import { unsupported, validateTelemetry } from "../../config/telemetry"
import { matchesUrl } from "../../core/url-filter"

/** ARMS 0.0.x uses session ratios (0..1) and named collectors, not enableSPA/sendResource. */
export function createAliyunSettings(config: IAliyunConfig) {
	const options = { ...config.extra, ...config }
	const policy = config.telemetry ?? {}
	validateTelemetry(policy)
	if (policy.sampling?.unit === "event") unsupported("Aliyun", "event sampling")
	if (policy.http?.slowThresholdMs !== undefined) unsupported("Aliyun", "http.slowThresholdMs")
	if (policy.errors) unsupported("Aliyun", "errors.dedupeWindowMs")
	const collectors: Record<string, boolean> = { ...config.extra?.collectors }
	const capture = policy.capture ?? {}
	const mapping = {
		http: ["api"],
		resources: ["staticResource"],
		errors: ["jsError"],
		performance: ["perf", "webVitals", "longtask"],
	}
	for (const key of Object.keys(mapping) as (keyof typeof mapping)[]) {
		const enabled = capture[key]
		if (enabled !== undefined) for (const name of mapping[key]) collectors[name] = enabled
	}
	return {
		...config.extra,
		pid: options.pid || String(config.appId),
		endpoint: config.endpoint ?? options.endpoint ?? "https://arms-retcode.aliyuncs.com",
		app: { ...config.extra?.app, env: config.env ?? config.extra?.app?.env ?? "production" },
		version: config.release ?? options.version ?? "1.0.0",
		filters: {
			...config.extra?.filters,
			resource: [
				...(Array.isArray(config.extra?.filters?.resource)
					? config.extra.filters.resource
					: config.extra?.filters?.resource
						? [config.extra.filters.resource]
						: []),
				(url: string) => matchesUrl(url, policy.http?.ignoreUrls),
			],
		},
		collectors: { ...collectors, consoleError: false, action: false },
		whiteScreen: false,
		evaluateApi: undefined,
		...(policy.remoteConfig !== undefined ? { remoteConfig: policy.remoteConfig } : {}),
		...(policy.sampling
			? {
					sessionConfig: {
						...config.extra?.sessionConfig,
						sampleRate: policy.sampling.rate ?? 1,
					},
				}
			: {}),
	}
}
