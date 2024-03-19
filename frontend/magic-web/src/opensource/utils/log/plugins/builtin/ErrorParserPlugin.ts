import type { LogContext, LoggerPlugin } from "../types"
import { deepProcessObject } from "../../utils"

class ErrorParser {
	/**
	 * @description 解析错误堆栈
	 * @param arg
	 * @returns
	 */
	static parse(arg: any) {
		if (arg instanceof Error) {
			const { stack, message, name } = arg

			// Parse the stack trace to get detailed information
			const stackInfo = ErrorParser.parseErrorStack(stack || "")

			// Add additional properties from the error object
			const errorProps: Record<string, any> = {}
			Object.getOwnPropertyNames(arg).forEach((prop) => {
				if (prop !== "stack" && prop !== "message" && prop !== "name") {
					try {
						errorProps[prop] = (arg as any)[prop]
					} catch (e) {
						// Ignore properties that can't be accessed
					}
				}
			})

			return {
				name,
				message,
				stack,
				parsedStack: stackInfo,
				additionalProps: errorProps,
				errorLine: stack ? stack.split("\n")[1] : undefined,
			}
		}
	}

	/**
	 * @description 解析错误堆栈
	 * @param stackTrace 错误堆栈
	 * @returns 解析后的错误堆栈
	 */
	private static parseErrorStack(stackTrace: string): Array<{
		function?: string
		filename?: string
		lineNumber?: number
		columnNumber?: number
		source?: string
	}> {
		if (!stackTrace) return []

		const stackLines = stackTrace.split("\n").slice(1) // Skip the first line which is the error message

		return stackLines.map((line) => {
			// Common Chrome/Firefox/Safari format: "    at FunctionName (filename:line:column)"
			// Or anonymous: "    at filename:line:column"
			const stackFrame: {
				function?: string
				filename?: string
				lineNumber?: number
				columnNumber?: number
				source?: string
			} = {
				source: line.trim(),
			}

			try {
				// Extract function name, file, line and column
				const atMatch = line.match(/^\s*at\s+(.+)$/)

				if (atMatch) {
					const frameInfo = atMatch[1]

					// Check if we have a function name
					const fnMatch = frameInfo.match(/^(.*)\s+\((.*):(\d+):(\d+)\)$/)

					if (fnMatch) {
						// Format: "FunctionName (filename:line:column)"
						stackFrame.function = fnMatch[1].trim()
						stackFrame.filename = fnMatch[2]
						stackFrame.lineNumber = parseInt(fnMatch[3], 10)
						stackFrame.columnNumber = parseInt(fnMatch[4], 10)

						// Create a more concise source representation
						const filename = ErrorParser.getShortFilename(stackFrame.filename)
						stackFrame.source = `(${filename}:${stackFrame.lineNumber})`
					} else {
						// Check for anonymous function format: "at filename:line:column"
						const anonMatch = frameInfo.match(/^(.*):(\d+):(\d+)$/)

						if (anonMatch) {
							stackFrame.filename = anonMatch[1]
							stackFrame.lineNumber = parseInt(anonMatch[2], 10)
							stackFrame.columnNumber = parseInt(anonMatch[3], 10)

							// Create a more concise source representation
							const filename = ErrorParser.getShortFilename(stackFrame.filename)
							stackFrame.source = `<anonymous> (${filename}:${stackFrame.lineNumber})`
						}
					}
				}
			} catch (e) {
				// If there's an error parsing, keep a simplified version of the source line
				stackFrame.source = line.trim().replace(/\s+at\s+/, "")
			}

			return stackFrame
		})
	}

	/**
	 * Extract a simplified filename from a potentially long path
	 * @param filepath The full file path
	 * @returns A shortened filename (last 2-3 segments of the path)
	 */
	private static getShortFilename(filepath: string | undefined): string {
		if (!filepath) return "unknown"

		// Remove query params and hash
		let cleanPath = filepath.split("?")[0].split("#")[0]

		// Handle webpack and other bundler paths that use loaders
		if (cleanPath.includes("!")) {
			cleanPath = cleanPath.split("!").pop() || cleanPath
		}

		// Get file components
		const parts = cleanPath.split(/[/\\]/)

		// Return just the filename if it's short
		if (parts.length <= 1) return parts[0]

		// For longer paths, return last 2-3 segments to provide context but stay concise
		if (parts.length <= 3) return parts.join("/")

		// For very long paths, return just enough context
		return "app/" + parts.slice(-2).join("/")
	}
}

/**
 * 错误解析插件配置
 */
export interface ErrorParserPluginOptions {
	/** 是否启用 */
	enabled?: boolean
	/** 是否解析所有参数中的错误对象 */
	parseAllErrors?: boolean
	/** 是否保留原始错误对象 */
	keepOriginalError?: boolean
}

/**
 * 错误解析插件
 * 解析错误对象，提取堆栈信息和错误详情
 */
export class ErrorParserPlugin implements LoggerPlugin {
	readonly name = "errorParser"
	readonly version = "1.0.0"
	readonly priority = 10 // 高优先级，在数据处理早期执行

	enabled = true
	private options: ErrorParserPluginOptions

	constructor(options: ErrorParserPluginOptions = {}) {
		this.options = {
			enabled: true,
			parseAllErrors: true,
			keepOriginalError: false,
			...options,
		}
		this.enabled = this.options.enabled ?? true
	}

	/**
	 * 检查是否应该处理此日志
	 */
	shouldHandle(_context: LogContext): boolean {
		// 检查参数中是否包含错误对象
		return true
		// return context.data.some((arg) => arg instanceof Error)
	}

	/**
	 * 处理日志上下文 - 解析错误对象
	 */
	process(context: LogContext): LogContext {
		// 处理每个参数
		return {
			...context,
			data: deepProcessObject(context.data, (arg: any) => {
				if (arg instanceof Error) {
					return ErrorParser.parse(arg)
				}
				return arg
			}),
		}
	}
}

/**
 * 错误解析插件工厂函数
 */
export function createErrorParserPlugin(options?: ErrorParserPluginOptions): ErrorParserPlugin {
	return new ErrorParserPlugin(options)
}
