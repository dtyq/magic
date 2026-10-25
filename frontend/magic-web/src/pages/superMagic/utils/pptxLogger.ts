import { logger } from "@/infrastructure/logger"
import { getPptxExportDiagnostic, type ExportIssue, type ExternalLogger } from "@magic/html2pptx"

const pptLogger = logger.createLogger("html2pptx")

/**
 * 将项目 Logger 适配为 html2pptx ExternalLogger 接口。
 *
 * 传入 destination-first streaming 导出后，包内部所有日志会经过此适配器：
 * - warn / error 进入项目日志管道 → APM 上报
 * - info 进入日志管道（INFO 级别，不触发 APM error 上报）
 * - debug 仅在开发环境打到 console
 */
export const pptxExternalLogger: ExternalLogger = {
	debug(...args: unknown[]) {
		if (import.meta.env.DEV) {
			console.debug("[html2pptx]", ...args)
		}
	},
	info(...args: unknown[]) {
		pptLogger.log({ data: ["[html2pptx]", ...args] })
	},
	warn(...args: unknown[]) {
		if (import.meta.env.DEV) {
			console.warn("[html2pptx]", ...args)
		}
		pptLogger.warn({ data: ["[html2pptx]", ...args] })
	},
	error(...args: unknown[]) {
		if (import.meta.env.DEV) {
			console.error("[html2pptx]", ...args)
		}
		const originalError = args.find((value) => value instanceof Error)
		// 第三方回调参数可能包含文档内容，只保留原始 Error 和参数数量用于诊断。
		pptLogger.error({
			eventKey: "html2pptx_external_failed",
			errorKind: "render",
			error: originalError ?? args[0],
			message: "html2pptx external error",
			context: { args },
		})
	},
}

/**
 * 在 catch 块中上报导出失败的错误。
 * 统一提取 error 的 message 和 stack，附带业务上下文。
 */
export function reportPptxExportError(error: unknown, context?: Record<string, unknown>) {
	const diagnostic = getPptxExportDiagnostic(error)
	const strategyDecision =
		error && typeof error === "object" && "decision" in error
			? (error as { decision?: unknown }).decision
			: undefined
	if (import.meta.env.DEV) {
		console.error("[html2pptx] Export editable PPT failed:", error, context)
	}
	pptLogger.error({
		eventKey: "editable_ppt_export_failed",
		errorKind: "render",
		error,
		message: "Export editable PPT failed",
		context: {
			tag: "html2pptx",
			failurePhase: diagnostic?.phase,
			errorCode: diagnostic?.code,
			cancelled: diagnostic?.cancelled,
			pageIndex: diagnostic?.pageIndex,
			pageCount: diagnostic?.pageCount,
			// BigInt is used internally so ZIP64 counters stay exact; logs cross a JSON boundary.
			bytesWritten: diagnostic?.bytesWritten?.toString(),
			outputPolicy: diagnostic?.outputPolicy,
			mediaPolicyMode: diagnostic?.mediaPolicyMode,
			zipMode: diagnostic?.zipMode,
			strategyDecision,
			...context,
		},
	})
}

/**
 * Report a page-level issue even when the PPTX was successfully produced.
 * Page failures are intentionally recoverable, so they never reach the outer
 * export catch where the legacy failure event was emitted.
 */
export function reportPptxExportIssue(issue: ExportIssue, context?: Record<string, unknown>): void {
	const details = issue.details ?? {}
	pptLogger.error({
		eventKey: "editable_ppt_export_issue",
		errorKind: issue.code,
		error: {
			name: "PptxExportIssue",
			message: issue.message,
			...(typeof details.stack === "string" ? { stack: details.stack.slice(0, 4000) } : {}),
		},
		message: "Exported PPT contains a recoverable page issue",
		context: {
			tag: "html2pptx",
			severity: issue.severity,
			pageIndex: issue.pageIndex,
			pageKey: issue.pageKey,
			pageName: issue.pageName,
			pagePath: issue.pagePath,
			pageFileId: issue.pageFileId,
			issueDetails: details,
			...context,
		},
	})
}

// ─── PPTX Debug ─────────────────────────────────────────────
// 在调用方（外部）按需开启完整日志采集，输出含耗时偏移的汇总。
// 通过 localStorage 切换；window.__pptxDebug 提供控制台快捷入口。

type PptxLogLevel = "debug" | "info" | "warn" | "error"

interface PptxLogEntry {
	level: PptxLogLevel
	source: "html2pptx" | "pptFont" | "console"
	message: string
	context?: unknown
	timestamp: number
}

export interface PptxDebugSession {
	logger: ExternalLogger
	logLevel: "debug"
	entries: () => PptxLogEntry[]
	stop: () => PptxLogEntry[]
}

interface InternalSession {
	collected: PptxLogEntry[]
	startTime: number
	stopped: boolean
}

class PptxDebugger {
	private sessions = new Set<InternalSession>()
	private originalWarn: typeof console.warn | null = null
	private originalError: typeof console.error | null = null
	private originalFetch: typeof window.fetch | null = null
	private patched = false
	private _enabled = false

	get enabled(): boolean {
		return this._enabled
	}

	enable(): void {
		this._enabled = true
		// keep-console
		console.info(
			"[pptx-debug] 已开启 PPTX 导出调试模式，下次导出时将输出完整日志（刷新页面即关闭）。",
		)
	}

	disable(): void {
		this._enabled = false
		// keep-console
		console.info("[pptx-debug] 已关闭 PPTX 导出调试模式。")
	}

	status(): void {
		// keep-console
		console.info(`[pptx-debug] 当前状态：${this.enabled ? "✅ 已开启" : "❌ 已关闭"}`)
	}

	createSession(): PptxDebugSession {
		const session: InternalSession = {
			collected: [],
			startTime: Date.now(),
			stopped: false,
		}

		this.installPatch()
		this.sessions.add(session)

		const logger: ExternalLogger = {
			debug: (...args) => {
				this.captureHtml2pptx(session, "debug", args)
				// keep-console
				console.debug("[pptx-debug]", ...args)
			},
			info: (...args) => {
				this.captureHtml2pptx(session, "info", args)
				// keep-console
				console.info("[pptx-debug]", ...args)
			},
			warn: (...args) => {
				this.captureHtml2pptx(session, "warn", args)
				// keep-console
				console.warn("[pptx-debug]", ...args)
			},
			error: (...args) => {
				this.captureHtml2pptx(session, "error", args)
				// keep-console
				console.error("[pptx-debug]", ...args)
			},
		}

		const stop = (): PptxLogEntry[] => {
			if (session.stopped) return [...session.collected]
			session.stopped = true
			this.sessions.delete(session)
			if (this.sessions.size === 0) this.restorePatch()
			const entries = [...session.collected]
			// keep-console
			console.groupCollapsed(
				`[pptx-debug] Session ended — ${entries.length} entries collected (${Date.now() - session.startTime}ms)`,
			)
			entries.forEach((e) => {
				const fn = console[e.level] || console.log
				fn.call(console, `  [${e.timestamp}ms] [${e.source}] ${e.message}`, e.context ?? "")
			})
			// keep-console
			console.groupEnd()
			return entries
		}

		return { logger, logLevel: "debug", entries: () => [...session.collected], stop }
	}

	private installPatch(): void {
		if (this.patched) return

		this.originalWarn = console.warn
		this.originalError = console.error
		this.originalFetch = window.fetch

		console.warn = (...args: unknown[]) => {
			this.captureConsole("warn", args)
			this.originalWarn!.apply(console, args)
		}

		console.error = (...args: unknown[]) => {
			this.captureConsole("error", args)
			this.originalError!.apply(console, args)
		}

		window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = this.getRequestUrl(input)
			if (!this.isFontRequest(url)) return this.originalFetch!.call(window, input, init)

			const startedAt = Date.now()
			try {
				const response = await this.originalFetch!.call(window, input, init)
				this.captureForAll({
					level: response.ok ? "info" : "error",
					source: "pptFont",
					message: `[pptFont] Font fetch ${response.ok ? "✅" : "❌"} ${response.status} ${url}`,
					context: { url, status: response.status, ok: response.ok },
					startedAt,
				})
				return response
			} catch (err) {
				this.captureForAll({
					level: "error",
					source: "pptFont",
					message: `[pptFont] Font fetch ❌ network error: ${url} (${String(err)})`,
					context: { url, error: String(err) },
					startedAt,
				})
				throw err
			}
		}

		this.patched = true
	}

	private restorePatch(): void {
		if (!this.patched) return
		if (this.originalWarn) console.warn = this.originalWarn
		if (this.originalError) console.error = this.originalError
		if (this.originalFetch) window.fetch = this.originalFetch
		this.originalWarn = null
		this.originalError = null
		this.originalFetch = null
		this.patched = false
	}

	private captureHtml2pptx(session: InternalSession, level: PptxLogLevel, args: unknown[]): void {
		const [message, context] = args
		session.collected.push({
			level,
			source: "html2pptx",
			message: typeof message === "string" ? message : String(message),
			context,
			timestamp: Date.now() - session.startTime,
		})
	}

	private captureConsole(level: "warn" | "error", args: unknown[]): void {
		const message = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")
		if (!this.isPptxRelated(message)) return
		this.captureForAll({
			level,
			source: message.includes("[pptFont]") ? "pptFont" : "console",
			message,
		})
	}

	private captureForAll(input: {
		level: PptxLogLevel
		source: PptxLogEntry["source"]
		message: string
		context?: unknown
		startedAt?: number
	}): void {
		this.sessions.forEach((session) => {
			session.collected.push({
				level: input.level,
				source: input.source,
				message: input.message,
				context: input.context,
				timestamp: (input.startedAt ?? Date.now()) - session.startTime,
			})
		})
	}

	private isPptxRelated(msg: string): boolean {
		return (
			msg.includes("[pptx") ||
			msg.includes("[html2pptx") ||
			msg.includes("[pptFont") ||
			msg.includes("font") ||
			msg.includes("exportPPTXStreaming")
		)
	}

	private isFontRequest(url: string): boolean {
		return (
			url.includes("/font") ||
			url.includes(".ttf") ||
			url.includes(".otf") ||
			url.includes(".woff")
		)
	}

	private getRequestUrl(input: RequestInfo | URL): string {
		if (typeof input === "string") return input
		if (input instanceof URL) return input.href
		return input.url || ""
	}
}

const pptxDebuggerInstance = new PptxDebugger()

if (typeof window !== "undefined") {
	;(window as unknown as { __pptxDebug?: PptxDebugger }).__pptxDebug = pptxDebuggerInstance
}

export function isPptxDebugMode(): boolean {
	return pptxDebuggerInstance.enabled
}

export function startPptxDebugSession(): PptxDebugSession {
	return pptxDebuggerInstance.createSession()
}
