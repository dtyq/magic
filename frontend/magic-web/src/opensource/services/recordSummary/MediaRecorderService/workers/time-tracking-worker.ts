/**
 * Web Worker for time tracking in background
 * 用于后台时间追踪的 Web Worker
 *
 * This worker provides reliable time checking even when the main thread
 * or browser tab is in the background. Worker timers are not throttled
 * by the browser like main thread timers.
 * 此 Worker 即使在主线程或浏览器标签页处于后台时也能提供可靠的时间检查。
 * Worker 定时器不会像主线程定时器那样被浏览器降频。
 */

// Worker message types
// Worker 消息类型
interface TimeCheckCommand {
	type: "start" | "stop"
	interval?: number // Check interval in milliseconds
}

interface TimeCheckMessage {
	type: "timeCheck"
	timestamp: number
}

// Worker global context
// Worker 全局上下文
const ctx: Worker = self as any

let checkInterval: NodeJS.Timeout | null = null

ctx.onmessage = (event: MessageEvent<TimeCheckCommand>) => {
	const { type, interval = 1000 } = event.data

	if (type === "start") {
		// Start periodic checking
		// 启动定期检查
		if (checkInterval) {
			clearInterval(checkInterval)
		}

		checkInterval = setInterval(() => {
			const message: TimeCheckMessage = {
				type: "timeCheck",
				timestamp: Date.now(),
			}
			ctx.postMessage(message)
		}, interval)
	} else if (type === "stop") {
		// Stop periodic checking
		// 停止定期检查
		if (checkInterval) {
			clearInterval(checkInterval)
			checkInterval = null
		}
	}
}

// Export empty object to make TypeScript happy
export {}
