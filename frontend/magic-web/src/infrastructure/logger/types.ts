/** Application services can depend on this port without importing a browser runtime. */
export interface StructuredErrorInput {
	eventKey: string
	errorKind: string
	error?: unknown
	message?: string
	context?: Readonly<Record<string, unknown>>
}

export interface LoggerPort {
	log(...data: unknown[]): void
	warn(...data: unknown[]): void
	error(input: StructuredErrorInput): void
	/** @deprecated Prefer a StructuredErrorInput with a stable eventKey. */
	error(...data: unknown[]): void
	report(...data: unknown[]): void
}

export interface NamespaceLogger extends LoggerPort {
	/** Child namespaces inherit context/options and remain on the same runtime. */
	createLogger(namespace: string, options?: LoggerOptions): NamespaceLogger
}

/** Root facade preserves the historical { namespace, data } calling convention. */
export interface Logger {
	log(arg: LogData, options?: LoggerEnableConfig): void
	warn(arg: LogData, options?: LoggerEnableConfig): void
	error(arg: LogData, options?: LoggerEnableConfig, dispatch?: { captureSource?: string }): void
	report(arg: LogData, options?: LoggerEnableConfig): void
	createLogger(namespace: string, options?: LoggerOptions): NamespaceLogger
}

export interface LoggerPluginContext {
	/** Both entry styles write to the installing runtime, never the default singleton. */
	readonly logger: Logger
	readonly createLogger: Logger["createLogger"]
	readonly signal: AbortSignal
	/** Register immediately after acquiring a resource; setup failures also run these disposers. */
	onDispose(cleanup: () => void): void
	/** Runtime capability for browser lifecycle plugins; not a business logger method. */
	flushHidden(): void
	/** Bounded internal diagnostics, without logging raw exception or business data. */
	reportFault(): void
}

export interface LoggerPlugin {
	readonly name: string
	/** Page-wide observers/wrappers may only be installed on the default application runtime. */
	readonly scope?: "instance" | "page"
	/** Synchronous installation. Start asynchronous work inside setup and cancel it with signal. */
	setup(context: LoggerPluginContext): void
}

export interface RuntimeConfig extends LoggerEnableConfig {
	name?: string
	release?: string
	sessionId?: string
	getContext?: () => ContextSnapshot
	fetcher: typeof fetch
	endpoint?: string
	plugins?: readonly LoggerPlugin[]
}

export interface ManagedLoggerRuntime {
	readonly logger: Logger
	start(): boolean
	configure(config: LoggerEnableConfig): void
	flush(options?: { timeoutMs?: number }): Promise<boolean>
	flushHidden(): void
	shutdown(options?: { timeoutMs?: number }): Promise<void>
	getStats(): LoggerStats
}

export interface LoggerStats {
	state: "idle" | "running" | "closed"
	name: string
	[reason: string]: string | number
}

export interface LoggerEnableConfig {
	enabled?: boolean
	console?: boolean
	remote?: boolean
	info?: boolean
	warn?: boolean
	error?: boolean
	report?: boolean
	trace?: boolean
}

export interface LoggerOptions {
	enableConfig?: LoggerEnableConfig
	context?: Readonly<Record<string, unknown>>
}

export interface LogData {
	namespace?: string
	data?: unknown
	context?: Readonly<Record<string, unknown>>
	/** @deprecated Internal metadata is deliberately not uploaded. */
	metadata?: unknown
}

export type LogLevel = "info" | "warn" | "error" | "report"
export interface ContextSnapshot {
	info?: { uId?: string; tOrgCode?: string; mOrgCode?: string; cluster?: string }
	url?: string
}

export interface LogRecord extends Record<string, unknown> {
	schemaVersion: 2
	eventId: string
	timestamp: number
	namespace: string
	level: LogLevel
	logType: LogLevel
	traceId: string
	release: string
}
