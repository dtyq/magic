import { logger } from "@/utils/log"
import type { ExternalLogger } from "../../../../packages/html2pptx/src/logger"

const pptLogger = logger.createLogger("html2pptx")

/**
 * 将项目 Logger 适配为 html2pptx ExternalLogger 接口。
 *
 * 传入 exportPPTX 后，包内部所有日志会经过此适配器：
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
		pptLogger.error({ data: ["[html2pptx]", ...args] })
	},
}

/**
 * 在 catch 块中上报导出失败的错误。
 * 统一提取 error 的 message 和 stack，附带业务上下文。
 */
export function reportPptxExportError(error: unknown, context?: Record<string, unknown>) {
	if (import.meta.env.DEV) {
		console.error("[html2pptx] Export editable PPT failed:", error, context)
	}
	pptLogger.error({
		data: [
			"[html2pptx] Export editable PPT failed",
			{
				tag: "html2pptx",
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				...context,
			},
		],
	})
}
