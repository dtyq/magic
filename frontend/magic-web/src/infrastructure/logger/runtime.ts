import { LoggerRuntime, createLoggerFacade, validatePlugins } from "./logger"
import type { LoggerEnableConfig, ManagedLoggerRuntime, RuntimeConfig } from "./types"
export type {
	RuntimeConfig,
	ManagedLoggerRuntime,
	LoggerPlugin,
	LoggerPluginContext,
	LoggerStats,
} from "./types"

// Construction is inert. Only this owner may install page-wide browser plugins.
let runtime = new LoggerRuntime(true)
export const defaultLogger = createLoggerFacade(() => runtime)

function handle(owned: LoggerRuntime, config: RuntimeConfig): ManagedLoggerRuntime {
	// Release plugin factories and injected dependencies once startup consumes the configuration.
	let pending: RuntimeConfig | undefined = owned.stats().state === "idle" ? config : undefined
	return {
		logger: owned.logger,
		start: () => {
			if (owned.stats().state === "running") return true
			if (!pending || owned.stats().state === "closed") return false
			const started = owned.start(pending)
			if (started) pending = undefined
			return started
		},
		configure: (flags) => {
			if (pending) pending = { ...pending, ...flags }
			owned.configure(flags)
		},
		flush: (options) => owned.flush(options),
		flushHidden: () => owned.hidden(),
		shutdown: (options) => {
			pending = undefined
			return owned.shutdown(options)
		},
		getStats: () => owned.stats(),
	}
}

/** Explicit opt-in to a separate queue, dedup window, context and plugin lifecycle. */
export function createLoggerRuntime(config: RuntimeConfig): ManagedLoggerRuntime {
	const snapshot = { ...config, plugins: [...(config.plugins ?? [])] }
	validatePlugins(snapshot.plugins, false)
	return handle(new LoggerRuntime(), snapshot)
}

export function startLogger(config: RuntimeConfig): boolean {
	if (runtime.stats().state === "closed") runtime = new LoggerRuntime(true)
	return runtime.start(config)
}

/** Owns this exact instance, so late shutdown cannot close a replacement application runtime. */
export function startLoggerRuntime(config: RuntimeConfig): ManagedLoggerRuntime | undefined {
	if (!startLogger(config)) return undefined
	return handle(runtime, config)
}

export const configureLogger = (config: LoggerEnableConfig) => runtime.configure(config)
export const flush = (options?: { timeoutMs?: number }) => runtime.flush(options)
export const shutdown = (options?: { timeoutMs?: number }) => runtime.shutdown(options)
export const getLoggerStats = () => runtime.stats()
export const registerLoggerCleanup = (cleanup: () => void) => runtime.addCleanup(cleanup)
export const flushHidden = () => runtime.hidden()
