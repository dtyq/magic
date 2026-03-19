/**
 * Leading + RAF 节流配置
 */
export interface LeadingRafThrottleConfig {
	/** 是否启用节流，默认 true。为 false 时每次事件立即执行 */
	enabled?: boolean
	/** 是否使用 leading 模式（首次事件立即执行），默认 true */
	leading?: boolean
}

const defaultConfig: Required<LeadingRafThrottleConfig> = {
	enabled: true,
	leading: true,
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
 * - RAF: 同帧内后续事件合并为一次 apply
 */
export function createLeadingRafThrottle<T>(
	apply: (value: T) => void,
	config: LeadingRafThrottleConfig = {},
): LeadingRafThrottle<T> {
	const { enabled, leading } = { ...defaultConfig, ...config }

	let pending: T | null = null
	let leadingAllowed = true
	let leadingRafId: number | null = null
	let scheduleRafId: number | null = null

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
		if (leading && leadingAllowed && scheduleRafId === null) {
			leadingAllowed = false
			doApply(value)
		} else {
			scheduleApply()
		}
	}

	function scheduleApply(): void {
		if (scheduleRafId !== null) return
		scheduleRafId = requestAnimationFrame(() => {
			scheduleRafId = null
			const value = pending
			if (value !== null) {
				doApply(value)
			}
		})
	}

	function flush(): void {
		if (scheduleRafId !== null) {
			cancelAnimationFrame(scheduleRafId)
			scheduleRafId = null
		}
		const value = pending
		if (value !== null) {
			doApply(value)
		}
	}

	function cancel(): void {
		if (scheduleRafId !== null) {
			cancelAnimationFrame(scheduleRafId)
			scheduleRafId = null
		}
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
