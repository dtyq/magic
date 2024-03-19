/**
 * html2pptx 统一日志
 *
 * 使用方式：
 *   1. 入口处调用 configureLogger(options) 配置一次
 *   2. 任意文件直接 import { log } from "./logger" 使用
 *   3. 需要子模块前缀时用 createScopedLog("sandbox")
 */

// ─── 内部级别（仅包内使用，对外不暴露）────────────────────────
export const LogLevel = {
	L1: 10,
	L2: 20,
	L3: 30,
	L4: 40,
} as const

export type LogLevelValue = typeof LogLevel[keyof typeof LogLevel]

export type LogFn = (
	level: LogLevelValue,
	message: string,
	context?: Record<string, unknown>,
) => void

// ─── 对外接口（与 console 完全兼容）────────────────────────────
export interface ExternalLogger {
	debug?(...args: unknown[]): void
	info?(...args: unknown[]): void
	warn?(...args: unknown[]): void
	error?(...args: unknown[]): void
}

export type LogLevelLabel = "debug" | "info" | "warn" | "error"

// ─── 内部级别 → 标准方法名（一张映射表搞定）────────────────────
const LevelToMethod: Record<LogLevelValue, LogLevelLabel> = {
	10: "debug",
	20: "info",
	30: "warn",
	40: "error",
}

const LabelToValue: Record<LogLevelLabel, LogLevelValue> = {
	debug: 10,
	info:  20,
	warn:  30,
	error: 40,
}

// ─── 全局配置 ──────────────────────────────────────────────────
export interface LoggerOptions {
	minLevel?: LogLevelLabel
	logger?: ExternalLogger
}

const PREFIX = "[html2pptx]"

let _minLevel: LogLevelValue = LogLevel.L2
let _logger: ExternalLogger | null = null

export function configureLogger(options: LoggerOptions = {}): void {
	_minLevel = options.minLevel ? LabelToValue[options.minLevel] : LogLevel.L2
	_logger = options.logger ?? null
}

export function resetLogger(): void {
	_minLevel = LogLevel.L2
	_logger = null
}

function emit(prefix: string, level: LogLevelValue, message: string, context?: Record<string, unknown>): void {
	if (level < _minLevel) return

	const method = LevelToMethod[level]
	const target = _logger ?? console
	const fn = target[method]
	if (typeof fn !== "function") return

	const text = `${prefix} ${message}`
	context && Object.keys(context).length > 0
		? fn.call(target, text, context)
		: fn.call(target, text)
}

export const log: LogFn = (level, message, context) => emit(PREFIX, level, message, context)

export function createScopedLog(scope: string): LogFn {
	const prefix = `${PREFIX}:${scope}`
	return (level, message, context) => emit(prefix, level, message, context)
}
