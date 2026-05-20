export const MAGIC_API_CONSOLE_PREFIX = "[MagicAPI]"
export const EDITOR_RUNTIME_CONSOLE_PREFIX = "[IframeRuntime]"
export const MAGIC_API_CONSOLE_SOURCE = "magicApi"

type MagicApiLogLevel = "info" | "warn" | "error"

type MagicApiLogCallback = (
	level: MagicApiLogLevel,
	api: string,
	event: string,
	details?: Record<string, unknown>,
) => void

interface MagicApiLogPayload {
	api: string
	event: string
	details?: Record<string, unknown>
}

function log(level: MagicApiLogLevel, payload: MagicApiLogPayload): void {
	const { api, event, details } = payload

	// Notify external listener (ApiCallProxy) — this is the primary output
	// channel. API calls are no longer dumped to console; they appear in the
	// dedicated API tab instead.
	if (MagicApiLogger.onLog) {
		try {
			MagicApiLogger.onLog(level, api, event, details)
		} catch {
			// ignore listener errors
		}
	}
}

export const MagicApiLogger = {
	/** External callback for ApiCallProxy to intercept logs */
	onLog: null as MagicApiLogCallback | null,
	info(api: string, event: string, details?: Record<string, unknown>) {
		log("info", { api, event, details })
	},
	warn(api: string, event: string, details?: Record<string, unknown>) {
		log("warn", { api, event, details })
	},
	error(api: string, event: string, details?: Record<string, unknown>) {
		log("error", { api, event, details })
	},
	summarizeText(text: string): Record<string, unknown> {
		return { length: text.length }
	},
	summarizePaths(paths: string[]): Record<string, unknown> {
		return {
			count: paths.length,
			paths: paths.slice(0, 5),
			truncated: paths.length > 5,
		}
	},
	summarizeOptions(options?: Record<string, unknown>): Record<string, unknown> {
		return {
			hasOptions: Boolean(options),
			optionKeys: Object.keys(options ?? {}),
		}
	},
}
