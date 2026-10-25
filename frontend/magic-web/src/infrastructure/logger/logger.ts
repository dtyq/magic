import { normalLimits } from "./limits"
import type {
	ContextSnapshot,
	LogData,
	LoggerEnableConfig,
	LogLevel,
	LogRecord,
	Logger,
	LoggerOptions,
	NamespaceLogger,
	RuntimeConfig,
	LoggerPlugin,
	LoggerStats,
} from "./types"
import { createRecord, recordId } from "./record"
import { byteLength } from "./snapshot"
import { Deduplicator } from "./deduplicate"
import { DeliveryQueue } from "./delivery/queue"
import { FetchTransport } from "./delivery/transport"
import { writeConsole } from "./delivery/console"

/** Validate before allocating resources or installing any plugin. */
export function validatePlugins(plugins: readonly LoggerPlugin[], allowPagePlugins: boolean) {
	const names = new Set<string>()
	for (const plugin of plugins) {
		if (!plugin.name.trim() || names.has(plugin.name))
			throw new Error("Duplicate or empty logger plugin name")
		if (plugin.scope === "page" && !allowPagePlugins)
			throw new Error("Page logger plugins require the default application runtime")
		names.add(plugin.name)
	}
}

export class LoggerRuntime {
	private state: "idle" | "running" | "closed" = "idle"
	private config: Partial<RuntimeConfig> = {}
	private sessionId = ""
	private name = "logger"
	private early: { record: LogRecord; options: LoggerEnableConfig }[] = []
	private queue?: DeliveryQueue
	private dedup = new Deduplicator(
		(record) => {
			if (this.config.enabled !== false && this.config.remote) this.queue?.add(record)
		},
		(reason, amount) => this.count(reason, amount),
	)
	private closing?: Promise<void>
	readonly logger = createLoggerFacade(() => this)
	constructor(private readonly allowPagePlugins = false) {}
	private timer?: ReturnType<typeof setInterval>
	private cleanup: (() => void)[] = []
	private counters: Record<string, number> = {}
	private faultWarnings = 0
	readonly count = (reason: string, amount = 1) => {
		this.counters[reason] = (this.counters[reason] ?? 0) + amount
		// Never re-enter the logger or print the raw value that failed privacy processing.
		if (reason.endsWith("_failed") && this.config.console && this.faultWarnings < 3) {
			this.faultWarnings++
			try {
				globalThis.console?.warn?.(`[Logger internal] ${reason}`)
			} catch {
				/* Counters remain usable without a console. */
			}
		}
	}
	start(config: RuntimeConfig): boolean {
		if (this.state !== "idle") return false
		const plugins = [...(config.plugins ?? [])]
		validatePlugins(plugins, this.allowPagePlugins)
		this.config = { enabled: true, console: false, remote: true, ...config, plugins: undefined }
		this.name = config.name || "logger"
		this.sessionId = config.sessionId || this.sessionId || recordId()
		this.queue = new DeliveryQueue(
			new FetchTransport(config.fetcher, config.endpoint),
			this.count,
		)
		this.state = "running"
		this.timer = setInterval(() => this.dedup.expire(), 1000)
		const early = this.early
		this.early = []
		early.forEach(({ record, options }) => this.output(record, { ...this.config, ...options }))
		plugins.forEach((plugin) => this.installPlugin(plugin))
		return true
	}
	configure(config: LoggerEnableConfig) {
		this.config = { ...this.config, ...config }
		if (this.state !== "running") return
		if (this.config.enabled === false || this.config.remote === false) {
			this.queue?.destroy("disabled")
			this.queue = undefined
			this.dedup.clear()
		}
		if (this.config.enabled !== false && !this.queue && this.config.fetcher) {
			// Namespace/call options may override the remote default; enabled=false is the kill switch.
			this.queue = new DeliveryQueue(
				new FetchTransport(this.config.fetcher, this.config.endpoint),
				this.count,
			)
		}
	}
	addCleanup(cleanup: () => void) {
		this.cleanup.push(cleanup)
	}
	write(
		level: LogLevel,
		arg: LogData,
		options: LoggerEnableConfig = {},
		captureSource?: string,
	): void {
		try {
			if (this.state === "closed") {
				this.count("after_shutdown")
				return
			}
			const flags = { ...this.config, ...options }
			if (this.config.enabled === false || flags.enabled === false || flags[level] === false)
				return
			if (this.state === "idle" && level !== "error" && level !== "report") return
			let context: ContextSnapshot = {}
			try {
				context = this.config.getContext?.() ?? {}
			} catch {
				this.count("context_failed")
			}
			this.sessionId ||= recordId()
			const record = createRecord(
				level,
				arg,
				context,
				this.sessionId,
				this.config.release ?? "",
				captureSource,
			)
			if (this.state === "idle") {
				this.early.push({ record, options: { ...options } })
				while (
					this.early.length > normalLimits.earlyCount ||
					this.early.reduce(
						(size, item) => size + byteLength(JSON.stringify(item.record)),
						0,
					) > normalLimits.earlyBytes
				) {
					this.early.shift()
					this.count("early_capacity")
				}
				return
			}
			this.output(record, flags)
		} catch {
			this.count("processing_failed")
		}
	}
	private output(record: LogRecord, flags: LoggerEnableConfig) {
		if (flags.enabled === false || flags[record.level] === false) return
		if (flags.console) {
			try {
				writeConsole(record)
			} catch {
				this.count("console_failed")
			}
		}
		if (!flags.remote || (record.level !== "error" && record.level !== "report")) return
		if (record.level === "error" && !this.dedup.accept(record)) return
		this.queue?.add(record)
	}
	private installPlugin(plugin: LoggerPlugin) {
		const controller = new AbortController()
		const cleanups: (() => void)[] = []
		let active = true
		let disposing = false
		// A failed plugin cannot continue writing through a retained logger reference.
		const logger = createLoggerFacade(() => (active ? this : undefined))
		const runCleanup = (cleanup: () => void) => {
			try {
				const result: unknown = cleanup()
				if (result && typeof (result as PromiseLike<unknown>).then === "function") {
					// Disposers are synchronous. Contain accidental async rejections without
					// allowing an arbitrary plugin promise to hold shutdown open indefinitely.
					void Promise.resolve(result).catch(() => undefined)
					this.count("plugin_cleanup_failed")
				}
			} catch {
				this.count("plugin_cleanup_failed")
			}
		}
		const dispose = () => {
			if (!active || disposing) return
			disposing = true
			controller.abort()
			// Final synchronous summaries (e.g. page dwell) are accepted before closing the gate.
			cleanups.splice(0).reverse().forEach(runCleanup)
			active = false
		}
		try {
			const result: unknown = plugin.setup({
				logger,
				createLogger: logger.createLogger,
				signal: controller.signal,
				onDispose: (cleanup) => {
					if (disposing || !active) runCleanup(cleanup)
					else cleanups.push(cleanup)
				},
				flushHidden: () => {
					if (active) this.hidden()
				},
				reportFault: () => {
					if (active) this.count("plugin_operation_failed")
				},
			})
			// TS permits async functions in void callbacks. Reject them explicitly so late
			// failures cannot leak resources or become unhandled rejections.
			if (result && typeof (result as PromiseLike<unknown>).then === "function") {
				void Promise.resolve(result).catch(() => undefined)
				throw new Error("Logger plugin setup must be synchronous")
			}
			this.addCleanup(dispose)
		} catch {
			dispose()
			this.count("plugin_setup_failed")
		}
	}

	stats(): LoggerStats {
		return { state: this.state, name: this.name, ...this.counters }
	}
	flush(options?: { timeoutMs?: number }) {
		return this.queue?.flush(options) ?? Promise.resolve(true)
	}
	hidden() {
		void this.queue?.hidden()
	}
	shutdown(options?: { timeoutMs?: number }): Promise<void> {
		// Publish ownership before cleanup: repeated/reentrant shutdowns share one operation.
		if (!this.closing) {
			let complete!: (operation: Promise<void>) => void
			this.closing = new Promise<void>((resolve) => {
				complete = resolve
			})
			complete(this.finishShutdown(options))
		}
		return this.closing
	}
	private async finishShutdown(options?: { timeoutMs?: number }) {
		clearInterval(this.timer)
		// Stop producers while final synchronous plugin summaries can still enter the queue.
		this.cleanup
			.splice(0)
			.reverse()
			.forEach((cleanup) => {
				try {
					cleanup()
				} catch {
					this.count("cleanup_failed")
				}
			})
		this.state = "closed"
		this.dedup.clear(true)
		try {
			await this.flush(options)
		} finally {
			this.queue?.destroy()
			this.queue = undefined
			this.early = []
			// Do not retain store providers, fetch adapters or business closures after disposal.
			this.config = {}
		}
	}
}

/** The default facade resolves its live owner; isolated facades always resolve their own instance. */
export function createLoggerFacade(resolve: () => LoggerRuntime | undefined): Logger {
	const logger: Logger = {
		log: (arg, options) => resolve()?.write("info", arg, options),
		warn: (arg, options) => resolve()?.write("warn", arg, options),
		error: (arg, options, dispatch) =>
			resolve()?.write("error", arg, options, dispatch?.captureSource),
		report: (arg, options) => resolve()?.write("report", arg, options),
		createLogger: createNamespace,
	}
	function createNamespace(namespace: string, options: LoggerOptions = {}): NamespaceLogger {
		const context = options.context ? Object.freeze({ ...options.context }) : undefined
		return {
			// Preserve existing namespace options: callers may update enableConfig between writes.
			log: (...data) => logger.log({ namespace, data, context }, options.enableConfig),
			warn: (...data) => logger.warn({ namespace, data, context }, options.enableConfig),
			error: (...data: unknown[]) =>
				logger.error({ namespace, data, context }, options.enableConfig),
			report: (...data) => logger.report({ namespace, data, context }, options.enableConfig),
			createLogger: (child, local = {}) =>
				createNamespace(`${namespace}.${child}`, {
					context: { ...context, ...local.context },
					enableConfig: { ...options.enableConfig, ...local.enableConfig },
				}),
		}
	}
	return logger
}
