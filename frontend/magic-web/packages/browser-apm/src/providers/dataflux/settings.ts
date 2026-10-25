import type { IDataFluxConfig } from "../legacy-config"
import { unsupported, validateTelemetry } from "../../config/telemetry"
import { matchesUrl } from "../../core/url-filter"

/** Keep session sampling distinct from event sampling; DataFlux expects percentages. */
export function createDataFluxSettings(config: IDataFluxConfig) {
	const options = { ...config.extra, ...config }
	const policy = config.telemetry ?? {}
	validateTelemetry(policy)
	if (policy.sampling?.unit === "event") unsupported("DataFlux", "event sampling")
	if (policy.http?.slowThresholdMs !== undefined) unsupported("DataFlux", "http.slowThresholdMs")
	if (policy.errors) unsupported("DataFlux", "errors.dedupeWindowMs")
	// Only expose verified SDK switches; unknown settings must not masquerade as working controls.
	for (const key of ["http", "resources", "errors", "performance"] as const) {
		if (policy.capture?.[key] !== undefined) unsupported("DataFlux", `capture.${key}`)
	}
	const site = config.endpoint ?? options.site
	if (!site) throw new Error("DataFlux endpoint/site is required")
	const privacy: NonNullable<IDataFluxConfig["defaultPrivacyLevel"]> =
		options.defaultPrivacyLevel ?? "mask-user-input"
	return {
		applicationId: String(config.appId),
		clientToken: config.token,
		site,
		env: config.env ?? "production",
		service: config.service ?? "browser",
		version: config.release ?? options.version ?? "1.0.0",
		sessionSampleRate: options.sessionSampleRate ?? 100,
		trackResources: options.trackResources ?? true,
		trackLongTasks: options.trackLongTasks ?? true,
		defaultPrivacyLevel: privacy,
		...config.extra,
		// The new common policy takes precedence over legacy SDK overrides.
		...(config.endpoint ? { site: config.endpoint } : {}),
		...(config.release ? { version: config.release } : {}),
		...(policy.remoteConfig !== undefined ? { remoteConfiguration: policy.remoteConfig } : {}),
		...(policy.sampling ? { sessionSampleRate: (policy.sampling.rate ?? 1) * 100 } : {}),
		// Business interactions and replay are outside passive technical monitoring.
		trackUserInteractions: false,
		sessionReplaySampleRate: 0,
		sessionReplayOnErrorSampleRate: 0,
		sessionOnErrorSampleRate: 0,
		beforeSend: (event: {
			type?: string
			resource?: { url?: string }
			error?: { source?: string }
		}) =>
			event.type !== "action" &&
			// RUM also intercepts console.error internally; active logs belong to the business logger.
			!(
				event.type === "error" && ["console", "custom"].includes(event.error?.source ?? "")
			) &&
			!matchesUrl(event.resource?.url ?? "", policy.http?.ignoreUrls),
	}
}
