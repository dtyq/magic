/**
 * ConsoleProxy
 * Intercepts console.log/info/warn/error and global error events,
 * collects entries in a ring buffer, and notifies listeners.
 */

export type ConsoleLevel = "log" | "info" | "warn" | "error"

export interface ConsoleEntry {
	id: string
	level: ConsoleLevel
	args: string[]
	timestamp: number
	stack?: string
	/** "console" | "magicApi" | "uncaughtError" | "unhandledRejection" */
	source: string
}

type ConsoleEntryListener = (entry: ConsoleEntry) => void

const CONSOLE_METHODS: ConsoleLevel[] = ["log", "info", "warn", "error"]
const MAX_ENTRIES = 500
/** Max pre-enable error buffer size to avoid unbounded growth */
const MAX_PRE_BUFFER = 100

export class ConsoleProxy {
	private enabled = false
	private entries: ConsoleEntry[] = []
	/** Errors captured before enable() is called */
	private preBuffer: ConsoleEntry[] = []
	private listener: ConsoleEntryListener | null = null

	// Original console methods saved for restore
	private originals: Record<ConsoleLevel, (...args: unknown[]) => void> = {} as never
	private errorHandler: ((event: ErrorEvent) => void) | null = null
	private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null

	constructor() {
		// Pre-register global error listeners immediately so errors that occur
		// before devtools is opened are still captured in preBuffer.
		this.errorHandler = (event: ErrorEvent) => {
			const entry = this.buildEntry(
				"error",
				[event.message],
				"uncaughtError",
				event.error?.stack ?? `at ${event.filename}:${event.lineno}:${event.colno}`,
			)
			if (this.enabled) {
				this.pushEntry(entry)
			} else {
				this.preBuffer.push(entry)
				if (this.preBuffer.length > MAX_PRE_BUFFER) {
					this.preBuffer = this.preBuffer.slice(-MAX_PRE_BUFFER)
				}
			}
		}
		window.addEventListener("error", this.errorHandler)

		this.rejectionHandler = (event: PromiseRejectionEvent) => {
			const reason = event.reason
			const message = reason instanceof Error ? reason.message : String(reason)
			const stack = reason instanceof Error ? reason.stack : undefined
			const entry = this.buildEntry("error", [message], "unhandledRejection", stack)
			if (this.enabled) {
				this.pushEntry(entry)
			} else {
				this.preBuffer.push(entry)
				if (this.preBuffer.length > MAX_PRE_BUFFER) {
					this.preBuffer = this.preBuffer.slice(-MAX_PRE_BUFFER)
				}
			}
		}
		window.addEventListener("unhandledrejection", this.rejectionHandler)
	}

	enable(): void {
		if (this.enabled) return
		this.enabled = true

		// Merge pre-buffered errors (happened before devtools was opened)
		for (const entry of this.preBuffer) {
			this.pushEntry(entry)
		}
		this.preBuffer = []

		// Save and patch console methods
		for (const method of CONSOLE_METHODS) {
			this.originals[method] = console[method].bind(console)
			console[method] = (...args: unknown[]) => {
				// Always call the original
				this.originals[method](...args)
				this.addEntry(method, args, this.detectSource(args))
			}
		}
		// Note: errorHandler / rejectionHandler are already registered in constructor
	}

	disable(): void {
		if (!this.enabled) return
		this.enabled = false

		// Restore original console methods
		for (const method of CONSOLE_METHODS) {
			if (this.originals[method]) {
				console[method] = this.originals[method]
			}
		}

		// Note: errorHandler / rejectionHandler stay registered so pre-buffer
		// continues to collect errors even after disable, ready for next enable().
	}

	destroy(): void {
		this.disable()
		if (this.errorHandler) {
			window.removeEventListener("error", this.errorHandler)
			this.errorHandler = null
		}
		if (this.rejectionHandler) {
			window.removeEventListener("unhandledrejection", this.rejectionHandler)
			this.rejectionHandler = null
		}
		this.entries = []
		this.preBuffer = []
	}

	onEntry(listener: ConsoleEntryListener): void {
		this.listener = listener
	}

	getEntries(): ConsoleEntry[] {
		return [...this.entries]
	}

	clear(): void {
		this.entries = []
	}

	private addEntry(level: ConsoleLevel, args: unknown[], source: string, stack?: string): void {
		const entry = this.buildEntry(level, args, source, stack)
		this.pushEntry(entry)
	}

	private buildEntry(
		level: ConsoleLevel,
		args: unknown[],
		source: string,
		stack?: string,
	): ConsoleEntry {
		return {
			id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			level,
			args: args.map((a) => this.serialize(a)),
			timestamp: Date.now(),
			source,
			stack: stack ?? (level === "error" ? new Error().stack : undefined),
		}
	}

	private pushEntry(entry: ConsoleEntry): void {
		this.entries.push(entry)
		// Ring buffer
		if (this.entries.length > MAX_ENTRIES) {
			this.entries = this.entries.slice(-MAX_ENTRIES)
		}
		this.listener?.(entry)
	}

	private detectSource(_args: unknown[]): string {
		return "console"
	}

	private serialize(value: unknown): string {
		if (value === undefined) return "undefined"
		if (value === null) return "null"
		if (typeof value === "string") return value
		if (typeof value === "number" || typeof value === "boolean") return String(value)
		if (value instanceof Error) {
			return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`
		}
		try {
			return JSON.stringify(value, null, 2)
		} catch {
			return String(value)
		}
	}
}
