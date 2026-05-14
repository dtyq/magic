/**
 * Leading + RAF 节流配置
 */
export interface LeadingRafThrottleConfig {
	/** 是否启用节流，默认 true。为 false 时每次事件立即执行 */
	enabled?: boolean
	/** 是否使用 leading 模式（首次事件立即执行），默认 true */
	leading?: boolean
	/**
	 * 限制 apply 的最高频率（次/秒），用于压低平移/缩放时的更新成本。
	 * 不设置或 ≤0 时：尾随合并仅按 requestAnimationFrame，与显示器刷新对齐，不限额外帧率。
	 */
	maxFps?: number
}

const defaultConfig: Required<Omit<LeadingRafThrottleConfig, "maxFps">> & {
	maxFps: number | undefined
} = {
	enabled: true,
	leading: true,
	maxFps: undefined,
}

export interface LeadingRafThrottle<T> {
	processEvent: (value: T) => void
	flush: () => void
	cancel: () => void
	destroy: () => void
	getPending: () => T | null
}

/**
 * 创建 Leading + RAF 节流器
 * - leading: 首次事件立即 apply
 * - 尾随：同帧 RAF 合并；若配置 maxFps，则在两次 apply 之间至少间隔 1000/maxFps ms
 */
export function createLeadingRafThrottle<T>(
	apply: (value: T) => void,
	config: LeadingRafThrottleConfig = {},
): LeadingRafThrottle<T> {
	const merged = { ...defaultConfig, ...config }
	const { enabled, leading, maxFps } = merged
	const minIntervalMs = maxFps !== undefined && maxFps > 0 ? 1000 / maxFps : 0

	let pending: T | null = null
	let leadingAllowed = true
	let leadingRafId: number | null = null
	let scheduleRafId: number | null = null
	let scheduleTimeoutId: ReturnType<typeof setTimeout> | null | number = null
	let lastApplyAt = 0

	function clearTrailingSchedule(): void {
		if (scheduleRafId !== null) {
			cancelAnimationFrame(scheduleRafId)
			scheduleRafId = null
		}
		if (scheduleTimeoutId !== null) {
			clearTimeout(scheduleTimeoutId)
			scheduleTimeoutId = null
		}
	}

	function scheduleLeadingAllowed(): void {
		if (leadingRafId !== null) {
			cancelAnimationFrame(leadingRafId)
		}
		leadingRafId = requestAnimationFrame(() => {
			leadingAllowed = true
			leadingRafId = null
		})
	}

	function doApply(value: T): void {
		lastApplyAt = performance.now()
		pending = null
		apply(value)
		scheduleLeadingAllowed()
	}

	function processEvent(value: T): void {
		pending = value
		if (!enabled) {
			doApply(value)
			return
		}
		if (leading && leadingAllowed && scheduleRafId === null && scheduleTimeoutId === null) {
			leadingAllowed = false
			doApply(value)
		} else {
			scheduleApply()
		}
	}

	function scheduleApply(): void {
		if (scheduleRafId !== null || scheduleTimeoutId !== null) return

		if (minIntervalMs <= 0) {
			scheduleRafId = requestAnimationFrame(() => {
				scheduleRafId = null
				const value = pending
				if (value !== null) {
					doApply(value)
				}
			})
			return
		}

		const wait = Math.max(0, minIntervalMs - (performance.now() - lastApplyAt))
		scheduleTimeoutId = window.setTimeout(() => {
			scheduleTimeoutId = null
			const value = pending
			if (value !== null) {
				doApply(value)
			}
		}, wait)
	}

	function flush(): void {
		clearTrailingSchedule()
		const value = pending
		if (value !== null) {
			doApply(value)
		}
	}

	function cancel(): void {
		clearTrailingSchedule()
		if (leadingRafId !== null) {
			cancelAnimationFrame(leadingRafId)
			leadingRafId = null
		}
		pending = null
		leadingAllowed = true
	}

	function destroy(): void {
		cancel()
	}

	function getPending(): T | null {
		return pending
	}

	return {
		processEvent,
		flush,
		cancel,
		destroy,
		getPending,
	}
}
