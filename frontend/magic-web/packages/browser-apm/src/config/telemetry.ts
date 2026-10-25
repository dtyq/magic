/** Application monitoring policy uses ratios (0..1) and milliseconds, never SDK option names. */
export interface TelemetryConfig {
	sampling?: {
		unit: "event" | "session"
		rate?: number
		events?: Partial<Record<"http" | "resource" | "error" | "resourceError", number>>
	}
	/** Whether SDK remote configuration may override local policy. */
	remoteConfig?: boolean
	capture?: {
		http?: boolean
		resources?: boolean
		/** JavaScript exceptions; resource failures are a separate event category. */
		errors?: boolean
		performance?: boolean
	}
	http?: {
		slowThresholdMs?: number
		ignoreUrls?: (string | RegExp)[]
	}
	errors?: { dedupeWindowMs?: number }
}

export function validateTelemetry(config: TelemetryConfig = {}): void {
	const sampling = config.sampling
	if (sampling) {
		if (sampling.unit !== "event" && sampling.unit !== "session") {
			throw new Error("browser-apm sampling.unit must be event or session")
		}
		for (const value of [sampling.rate, ...Object.values(sampling.events ?? {})]) {
			if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
				throw new Error("browser-apm sampling ratios must be between 0 and 1")
			}
		}
		if (sampling.unit === "session" && sampling.events) {
			throw new Error("browser-apm event rates require event sampling")
		}
	}
	for (const value of [config.http?.slowThresholdMs, config.errors?.dedupeWindowMs]) {
		if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
			throw new Error("browser-apm time thresholds must be finite non-negative milliseconds")
		}
	}
}

/** Fail before SDK initialization instead of silently changing policy semantics. */
export function unsupported(provider: string, option: string): never {
	throw new Error(`${provider} does not support browser-apm ${option}`)
}
