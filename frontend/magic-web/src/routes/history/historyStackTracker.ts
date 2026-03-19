/**
 * @fileoverview History Stack Tracker
 * @description 用于跟踪和查看 history 堆栈的工具
 */
import { baseHistory } from "./baseHistory"
import type { Location, Action } from "history"

interface HistoryStackEntry {
	index: number
	pathname: string
	search: string
	hash: string
	state: any
	action: Action
	timestamp: number
}

class HistoryStackTracker {
	private stack: HistoryStackEntry[] = []
	private currentIndex: number = 0
	private listener: (() => void) | null = null

	constructor() {
		this.initialize()
	}

	private initialize() {
		// 添加初始条目
		this.addEntry(baseHistory.location, baseHistory.action)

		// 监听 history 变化
		this.listener = baseHistory.listen(({ location, action }) => {
			if (action === "PUSH") {
				this.currentIndex++
				// 如果当前不在栈顶，删除后面的条目（用户进行了新的导航）
				if (this.currentIndex < this.stack.length) {
					this.stack = this.stack.slice(0, this.currentIndex)
				}
				this.addEntry(location, action)
			} else if (action === "REPLACE") {
				// REPLACE 操作替换当前条目
				if (this.stack.length > 0) {
					this.stack[this.currentIndex] = this.createEntry(
						location,
						action,
						this.currentIndex,
					)
				}
			} else if (action === "POP") {
				// POP 操作（前进/后退）
				const delta = (window.history as any).state?.idx
					? (window.history as any).state.idx - this.currentIndex
					: 0
				this.currentIndex = Math.max(
					0,
					Math.min(this.currentIndex + delta, this.stack.length - 1),
				)
			}
		})
	}

	private createEntry(location: Location, action: Action, index: number): HistoryStackEntry {
		return {
			index,
			pathname: location.pathname,
			search: location.search,
			hash: location.hash,
			state: location.state,
			action,
			timestamp: Date.now(),
		}
	}

	private addEntry(location: Location, action: Action) {
		const entry = this.createEntry(location, action, this.currentIndex)
		this.stack.push(entry)
	}

	/**
	 * 获取完整的 history 堆栈
	 */
	getStack(): HistoryStackEntry[] {
		return [...this.stack]
	}

	/**
	 * 获取当前条目
	 */
	getCurrent(): HistoryStackEntry | null {
		return this.stack[this.currentIndex] || null
	}

	/**
	 * 获取当前索引
	 */
	getCurrentIndex(): number {
		return this.currentIndex
	}

	/**
	 * 获取堆栈长度
	 */
	getLength(): number {
		return this.stack.length
	}

	/**
	 * 打印堆栈信息到控制台
	 */
	printStack(): void {
		console.group("📚 History Stack")
		console.log(`当前索引: ${this.currentIndex} / ${this.stack.length - 1}`)
		console.log(`堆栈长度: ${this.stack.length}`)
		console.log("---")
		this.stack.forEach((entry, index) => {
			const isCurrent = index === this.currentIndex
			const marker = isCurrent ? "👉" : "  "
			console.log(`${marker} [${entry.index}] ${entry.pathname}${entry.search}${entry.hash}`)
			console.log(`    Action: ${entry.action}`)
			console.log(`    Time: ${new Date(entry.timestamp).toLocaleTimeString()}`)
			if (entry.state) {
				console.log(`    State:`, entry.state)
			}
		})
		console.groupEnd()
	}

	/**
	 * 清理资源
	 */
	cleanup(): void {
		if (this.listener) {
			this.listener()
			this.listener = null
		}
	}
}

// 创建单例实例
let trackerInstance: HistoryStackTracker | null = null

/**
 * 获取 history 堆栈跟踪器实例
 */
export function getHistoryStackTracker(): HistoryStackTracker {
	if (!trackerInstance) {
		trackerInstance = new HistoryStackTracker()
	}
	return trackerInstance
}

/**
 * 在开发环境下将 tracker 挂载到 window 对象，方便在控制台调试
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
	;(window as any).__historyStackTracker = getHistoryStackTracker()
	console.log(
		"💡 History Stack Tracker 已加载，使用 window.__historyStackTracker.printStack() 查看堆栈",
	)
}
