import type { LogContext, LoggerPlugin } from "../types"
import { LogType } from "../types"
import { isDev } from "@/utils/env"

const AGENT_DEBUG_LOG_ENDPOINT = "/__agent_debug_log__"
const AGENT_DEBUG_LOG_SESSION_ENDPOINT = "/__agent_debug_log__/session"
const FLUSH_INTERVAL_MS = 2000
const MAX_QUEUE_SIZE = 50
const SESSION_POLL_INTERVAL_MS = 5000

const DEFAULT_FILE_NAME = "debug-session.ndjson"

/**
 * 将问题名转换为合法的 ndjson 文件名。
 * 一个问题对应一个文件，该问题调试期间所有日志全部写入该文件。
 * 例： createAgentDebugLogPlugin('登录失败') → '登录失败-1715247600000.ndjson'
 */
export function makeDebugSessionFileName(issueName: string): string {
	const slug = issueName
		.trim()
		.toLowerCase()
		.replace(/[^\w\u4e00-\u9fa5]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
	return (slug || "debug") + "-" + Date.now() + ".ndjson"
}

/**
 * Agent 调试日志插件
 * 默认关闭；仅在 agent 发起调试时调用 enable() 开启，调试结束后调用 disable() 关闭。
 * 仅在开发环境下生效，将日志结构化地写入本地 .tmp/agent-debug/*.ndjson
 * 通过 Vite 插件 vite-plugin-agent-debug-log 提供的端点进行收集
 */
export class AgentDebugLogPlugin implements LoggerPlugin {
	readonly name = "agent-debug-log"
	readonly version = "1.0.0"
	readonly priority = 95

	/** 默认关闭；调用 enable() 后在 dev 环境下生效 */
	public enabled: boolean = false

	private queue: object[] = []
	private flushTimer: ReturnType<typeof setTimeout> | null = null
	private pollTimer: ReturnType<typeof setInterval> | null = null
	private fileName: string

	constructor(fileName: string = DEFAULT_FILE_NAME) {
		this.fileName = fileName
	}

	/**
	 * 开启插件（仅 dev 环境实际生效）。
	 * @param issueNameOrFile 可选，覆盖当前会话文件名。
	 */
	enable(issueNameOrFile?: string): void {
		if (!isDev) return
		if (issueNameOrFile) {
			this.fileName = issueNameOrFile.endsWith(".ndjson")
				? issueNameOrFile
				: makeDebugSessionFileName(issueNameOrFile)
		}
		this.enabled = true
		this.startSessionPolling()
	}

	/** 关闭插件：停止轮询并立即刷新剩余队列。 */
	disable(): void {
		this.enabled = false
		this.stopSessionPolling()
		this.flush()
	}

	/** 轮询 Vite 插件的 /session 端点，动态跟随活跃会话文件 */
	private startSessionPolling(): void {
		if (this.pollTimer !== null) return
		// 立即同步一次
		this.syncSession()
		this.pollTimer = setInterval(() => this.syncSession(), SESSION_POLL_INTERVAL_MS)
	}

	private stopSessionPolling(): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	private syncSession(): void {
		fetch(AGENT_DEBUG_LOG_SESSION_ENDPOINT)
			.then((res) => res.json())
			.then((data: { activeFile?: string }) => {
				if (data.activeFile && data.activeFile !== this.fileName) {
					this.fileName = data.activeFile
				}
			})
			.catch(() => {
				// dev 服务不可用时静默跳过
			})
	}

	shouldHandle(context: LogContext): boolean {
		if (!this.enabled || !isDev) {
			return false
		}
		// 排除调试端点自身产生的请求记录，防止反馈循环
		const dataUrl =
			typeof context.data === "object" && context.data !== null
				? (context.data as Record<string, unknown>).url
				: undefined
		if (typeof dataUrl === "string" && dataUrl.includes("/__agent_debug_log__")) {
			return false
		}
		return true
	}

	process(context: LogContext): LogContext {
		const entry = {
			timestamp: new Date().toISOString(),
			level: context.logType ?? LogType.INFO,
			namespace: context.namespace ?? "app",
			traceId: context.traceId,
			url: context.url ?? window.location.pathname,
			data: context.data,
		}

		this.queue.push(entry)

		if (this.queue.length >= MAX_QUEUE_SIZE) {
			this.flush()
		} else {
			this.scheduleFlush()
		}

		return context
	}

	private scheduleFlush(): void {
		if (this.flushTimer !== null) {
			return
		}

		this.flushTimer = setTimeout(() => {
			this.flushTimer = null
			this.flush()
		}, FLUSH_INTERVAL_MS)
	}

	private flush(): void {
		if (this.flushTimer !== null) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		const batch = this.queue.splice(0)
		if (batch.length === 0) {
			return
		}

		fetch(AGENT_DEBUG_LOG_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fileName: this.fileName, entries: batch }),
			// fire-and-forget: 不阻塞主流程
		}).catch(() => {
			// 调试 sink 不可用时静默失败，不干扰正常日志流程
		})
	}
}

/**
 * 创建调试日志插件。
 * @param issueNameOrFile 问题名称（自动加时间戳）或完整文件名（以 .ndjson 结尾）。
 *   不传时使用 debug-session.ndjson（临时用，不分问题）。
 *   例： createAgentDebugLogPlugin('登录失败') → '登录失败-1715247600000.ndjson'
 *   例： createAgentDebugLogPlugin('auth-bug.ndjson') → 'auth-bug.ndjson'
 */
export function createAgentDebugLogPlugin(issueNameOrFile?: string): AgentDebugLogPlugin {
	let fileName: string | undefined
	if (issueNameOrFile) {
		fileName = issueNameOrFile.endsWith(".ndjson")
			? issueNameOrFile
			: makeDebugSessionFileName(issueNameOrFile)
	}
	return new AgentDebugLogPlugin(fileName)
}
