import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("dragLogger")

/**
 * 格式化时间戳为可读时间
 */
function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	const seconds = String(date.getSeconds()).padStart(2, "0")
	const ms = String(date.getMilliseconds()).padStart(3, "0")
	return `${hours}:${minutes}:${seconds}.${ms}`
}

/**
 * 拖拽日志记录器 - 用于调试拖拽@功能
 *
 * 使用方法：
 * 1. 在控制台运行 `window.enableDragLogger()` 开启日志
 * 2. 进行拖拽操作
 * 3. 在控制台运行 `window.getDragLogs()` 查看完整日志
 * 4. 运行 `window.clearDragLogs()` 清空日志
 * 5. 运行 `window.disableDragLogger()` 关闭日志
 *
 * 日志级别：
 * - 本地调试：只记录到内存和控制台
 * - 线上上报：通过 logger.error 上报到日志系统（仅关键错误）
 */
class DragLogger {
	private enabled = false
	private reportToServer = false // 是否上报到线上日志系统
	private logs: Array<{
		timestamp: number
		time: string // 格式化的时间
		stage: string
		data: Record<string, unknown>
		error?: unknown
	}> = []
	private sessionId: string | null = null
	private startTime = 0

	constructor() {
		// 从 localStorage 读取配置
		const savedState = localStorage.getItem("dragLoggerEnabled")
		if (savedState === "true") {
			this.enabled = true
			console.log("📋 拖拽日志记录器已启用（从上次会话恢复）")
		}

		// 读取是否上报到线上
		const savedReportState = localStorage.getItem("dragLoggerReportToServer")
		if (savedReportState === "true") {
			this.reportToServer = true
			console.log("📤 拖拽日志将上报到线上日志系统")
		}
	}

	/**
	 * 开启日志记录
	 */
	enable() {
		this.enabled = true
		localStorage.setItem("dragLoggerEnabled", "true")
		console.log("📋 拖拽日志记录器已启用")
	}

	/**
	 * 关闭日志记录
	 */
	disable() {
		this.enabled = false
		localStorage.removeItem("dragLoggerEnabled")
		console.log("📋 拖拽日志记录器已关闭")
	}

	/**
	 * 开启线上日志上报（仅关键错误）
	 */
	enableServerReport() {
		this.reportToServer = true
		localStorage.setItem("dragLoggerReportToServer", "true")
		console.log("📤 已开启拖拽日志线上上报（仅关键错误）")
	}

	/**
	 * 关闭线上日志上报
	 */
	disableServerReport() {
		this.reportToServer = false
		localStorage.removeItem("dragLoggerReportToServer")
		console.log("📴 已关闭拖拽日志线上上报")
	}

	/**
	 * 检查是否启用
	 */
	isEnabled() {
		return this.enabled
	}

	/**
	 * 检查是否启用线上上报
	 */
	isServerReportEnabled() {
		return this.reportToServer
	}

	/**
	 * 开始新的拖拽会话
	 */
	startSession() {
		if (!this.enabled) return

		this.sessionId = `drag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		this.startTime = Date.now()
		this.logs = []

		console.log(`🎬 开始拖拽会话: ${this.sessionId} at ${formatTimestamp(this.startTime)}`)
	}

	/**
	 * 记录拖拽开始
	 */
	logDragStart(data: {
		source: string // 拖拽源：'tab' | 'attachment' | 'file'
		itemType?: string
		itemId?: string
		itemName?: string
		dataTransferTypes?: string[]
		payload?: string
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dragStart",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: 0,
			},
		}

		this.logs.push(log)
		console.log(`🎯 [dragStart] ${log.time}`, log.data)
	}

	/**
	 * 记录拖拽进入编辑器区域
	 */
	logDragEnter(data: {
		targetElement?: string
		dataTransferTypes?: string[]
		enableFileDrop?: boolean
		dragCounter?: number
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dragEnter",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
		}

		this.logs.push(log)
		console.log(`🔵 [dragEnter] ${log.time} (+${log.data.elapsed}ms)`, log.data)
	}

	/**
	 * 记录拖拽悬停
	 */
	logDragOver(data: {
		targetElement?: string
		dataTransferTypes?: string[]
		dragCounter?: number
		isDragOver?: boolean
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dragOver",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
		}

		this.logs.push(log)
		// dragOver 事件频繁，只在控制台输出
		console.debug(`🟡 [dragOver] ${log.time} (+${log.data.elapsed}ms)`, log.data)
	}

	/**
	 * 记录拖拽离开
	 */
	logDragLeave(data: { targetElement?: string; dragCounter?: number; isDragOver?: boolean }) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dragLeave",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
		}

		this.logs.push(log)
		console.log(`🟠 [dragLeave] ${log.time} (+${log.data.elapsed}ms)`, log.data)
	}

	/**
	 * 记录拖拽放下
	 */
	logDrop(data: {
		targetElement?: string
		dataTransferTypes?: string[]
		hasFiles?: boolean
		filesCount?: number
		hasCustomData?: boolean
		customDataPreview?: string
		uploadEnabled?: boolean
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "drop",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
		}

		this.logs.push(log)
		console.log(`🟢 [drop] ${log.time} (+${log.data.elapsed}ms)`, log.data)
	}

	/**
	 * 记录数据解析
	 */
	logDataParsing(data: {
		success: boolean
		rawData?: string
		parsedData?: unknown
		dragType?: string
		error?: unknown
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dataParsing",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
			error: data.error,
		}

		this.logs.push(log)

		if (data.success) {
			console.log(
				`✅ [dataParsing] ${log.time} (+${log.data.elapsed}ms) 数据解析成功`,
				log.data,
			)
		} else {
			console.error(
				`❌ [dataParsing] ${log.time} (+${log.data.elapsed}ms) 数据解析失败`,
				log.data,
			)

			// 🔥 关键错误：数据解析失败可能是代码 bug，上报到线上
			if (this.reportToServer) {
				logger.error("[DragLogger] 拖拽数据解析失败", {
					sessionId: this.sessionId,
					time: log.time,
					rawData: data.rawData?.substring(0, 200),
					error: data.error,
				})
			}
		}
	}

	/**
	 * 记录编辑器状态检查
	 */
	logEditorCheck(data: {
		hasEditor: boolean
		isDestroyed?: boolean
		isFocused?: boolean
		canExecuteCommands?: boolean
		error?: unknown
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "editorCheck",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
			error: data.error,
		}

		this.logs.push(log)

		if (data.hasEditor && !data.isDestroyed) {
			console.log(
				`✅ [editorCheck] ${log.time} (+${log.data.elapsed}ms) 编辑器状态正常`,
				log.data,
			)
		} else {
			console.warn(
				`⚠️ [editorCheck] ${log.time} (+${log.data.elapsed}ms) 编辑器状态异常`,
				log.data,
			)

			// ⚠️ 编辑器未就绪通常是用户操作太快或页面未加载完成，不一定需要上报
			// 但如果启用了上报，也可以记录以便分析用户行为
			if (this.reportToServer && !data.hasEditor) {
				logger.error("[DragLogger] 拖拽时编辑器未就绪", {
					sessionId: this.sessionId,
					time: log.time,
					hasEditor: data.hasEditor,
					isDestroyed: data.isDestroyed,
				})
			}
		}
	}

	/**
	 * 记录 mention 插入
	 */
	logMentionInsert(data: {
		success: boolean
		mentionType?: string
		mentionData?: unknown
		itemsCount?: number
		error?: unknown
	}) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "mentionInsert",
			data: {
				...data,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
			error: data.error,
		}

		this.logs.push(log)

		if (data.success) {
			console.log(
				`✅ [mentionInsert] ${log.time} (+${log.data.elapsed}ms) Mention 插入成功`,
				log.data,
			)
		} else {
			console.error(
				`❌ [mentionInsert] ${log.time} (+${log.data.elapsed}ms) Mention 插入失败`,
				log.data,
			)

			// 🔥 关键错误：Mention 插入失败可能影响用户体验，应该上报
			if (this.reportToServer) {
				logger.error("[DragLogger] Mention 插入失败", {
					sessionId: this.sessionId,
					time: log.time,
					mentionType: data.mentionType,
					error: data.error,
				})
			}
		}
	}

	/**
	 * 记录拖拽结束
	 */
	logDragEnd(data?: { cancelled?: boolean; error?: unknown }) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: "dragEnd",
			data: {
				...data,
				sessionId: this.sessionId,
				totalElapsed: timestamp - this.startTime,
			},
			error: data?.error,
		}

		this.logs.push(log)
		console.log(
			`🏁 [dragEnd] ${log.time} 拖拽会话结束 (总耗时: ${log.data.totalElapsed}ms)`,
			log.data,
		)

		// 输出完整日志摘要
		this.printSummary()
	}

	/**
	 * 记录错误
	 */
	logError(stage: string, error: unknown, extraData?: Record<string, unknown>) {
		if (!this.enabled) return

		const timestamp = Date.now()
		const log = {
			timestamp,
			time: formatTimestamp(timestamp),
			stage: `${stage}_error`,
			data: {
				...extraData,
				sessionId: this.sessionId,
				elapsed: timestamp - this.startTime,
			},
			error,
		}

		this.logs.push(log)
		console.error(
			`❌ [${stage}] ${log.time} (+${log.data.elapsed}ms) 发生错误`,
			log.data,
			error,
		)

		// 🔥 所有通过 logError 记录的错误都是关键错误，应该上报
		if (this.reportToServer) {
			logger.error(`[DragLogger] ${stage} 发生错误`, {
				sessionId: this.sessionId,
				time: log.time,
				stage,
				...extraData,
				error,
			})
		}
	}

	/**
	 * 打印日志摘要
	 */
	private printSummary() {
		if (!this.enabled || this.logs.length === 0) return

		const stages = this.logs.map((log) => log.stage)
		const hasErrors = this.logs.some((log) => log.error)
		const totalTime = this.logs[this.logs.length - 1]?.timestamp - this.logs[0]?.timestamp

		console.log("📊 拖拽会话摘要", {
			sessionId: this.sessionId,
			totalStages: stages.length,
			stages: stages,
			hasErrors,
			totalTime: `${totalTime}ms`,
			logsCount: this.logs.length,
		})

		if (hasErrors) {
			console.warn("⚠️ 本次会话包含错误，请运行 window.getDragLogs() 查看详细信息")
		}
	}

	/**
	 * 获取所有日志
	 */
	getLogs() {
		return this.logs
	}

	/**
	 * 导出日志为 JSON
	 */
	exportLogs() {
		const exportData = {
			sessionId: this.sessionId,
			startTime: this.startTime,
			startTimeFormatted: formatTimestamp(this.startTime),
			totalTime: Date.now() - this.startTime,
			logsCount: this.logs.length,
			logs: this.logs.map((log) => ({
				...log,
				// 时间戳已经包含格式化的 time 字段
			})),
		}

		const json = JSON.stringify(exportData, null, 2)
		console.log("📋 拖拽日志导出：")
		console.log(json)

		// 复制到剪贴板
		if (navigator.clipboard) {
			navigator.clipboard
				.writeText(json)
				.then(() => {
					console.log("✅ 日志已复制到剪贴板")
				})
				.catch((err) => {
					console.error("❌ 复制到剪贴板失败", err)
				})
		}

		return exportData
	}

	/**
	 * 清空日志
	 */
	clearLogs() {
		this.logs = []
		this.sessionId = null
		this.startTime = 0
		console.log("🗑️ 拖拽日志已清空")
	}
}

// 创建全局单例
export const dragLogger = new DragLogger()

// 挂载到 window 对象，方便调试
declare global {
	interface Window {
		dragLogger: DragLogger
		enableDragLogger: () => void
		disableDragLogger: () => void
		enableDragLoggerServerReport: () => void
		disableDragLoggerServerReport: () => void
		getDragLogs: () => void
		exportDragLogs: () => void
		clearDragLogs: () => void
	}
}

if (typeof window !== "undefined") {
	window.dragLogger = dragLogger
	window.enableDragLogger = () => dragLogger.enable()
	window.disableDragLogger = () => dragLogger.disable()
	window.enableDragLoggerServerReport = () => dragLogger.enableServerReport()
	window.disableDragLoggerServerReport = () => dragLogger.disableServerReport()
	window.getDragLogs = () => {
		console.table(dragLogger.getLogs())
		return dragLogger.getLogs()
	}
	window.exportDragLogs = () => dragLogger.exportLogs()
	window.clearDragLogs = () => dragLogger.clearLogs()
}
