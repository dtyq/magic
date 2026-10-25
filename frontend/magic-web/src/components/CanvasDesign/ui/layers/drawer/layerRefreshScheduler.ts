import type { CanvasEvent } from "../../../runtime/core/EventEmitter"

type ScheduleFrame = (callback: () => void) => () => void

const scheduleBrowserFrame: ScheduleFrame = (callback) => {
	if (typeof requestAnimationFrame === "function") {
		const rafId = requestAnimationFrame(callback)
		return () => cancelAnimationFrame(rafId)
	}

	const timeoutId = globalThis.setTimeout(callback, 0)
	return () => globalThis.clearTimeout(timeoutId)
}

/**
 * 图层名称相关媒体事件可能在同一帧连续到达，只需要重算一次图层树。
 * 文档 element:change 保持原有同步刷新语义，避免改变选择、重命名等交互时序。
 */
export function createLayerRefreshScheduler(scheduleFrame: ScheduleFrame = scheduleBrowserFrame) {
	let cancelPendingFrame: (() => void) | null = null
	let pendingUpdate: (() => void) | null = null

	return {
		schedule(update: () => void, event: CanvasEvent): void {
			if (event.type === "element:change") {
				cancelPendingFrame?.()
				cancelPendingFrame = null
				pendingUpdate = null
				update()
				return
			}

			pendingUpdate = update
			if (cancelPendingFrame) return
			cancelPendingFrame = scheduleFrame(() => {
				cancelPendingFrame = null
				const nextUpdate = pendingUpdate
				pendingUpdate = null
				nextUpdate?.()
			})
		},
		dispose(): void {
			cancelPendingFrame?.()
			cancelPendingFrame = null
			pendingUpdate = null
		},
	}
}
