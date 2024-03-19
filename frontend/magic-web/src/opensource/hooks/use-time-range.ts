import { useState, useEffect, useMemo } from "react"

interface UseTimeRangeOptions {
	/** Start time, accepts Date, string, or timestamp */
	startTime: Date | string | number
	/** End time, accepts Date, string, or timestamp */
	endTime: Date | string | number
	/** Whether to include the end time boundary, default: true */
	includeEnd?: boolean
	/** Custom update interval in milliseconds, default: 60000 (1 minute) */
	updateInterval?: number
}

/**
 * Custom hook to check if current time is within a specified time range
 * Provides real-time updates with optimized performance
 *
 * @param options - Configuration options
 * @returns Boolean indicating if current time is within range
 *
 * @example
 * ```tsx
 * const isInRange = useTimeRange({
 *   startTime: '2025-09-24',
 *   endTime: '2025-10-08'
 * })
 *
 * return isInRange ? <Component /> : null
 * ```
 */
function useTimeRange({
	startTime,
	endTime,
	includeEnd = true,
	updateInterval = 60000,
}: UseTimeRangeOptions): boolean {
	// Memoize timestamps to avoid repeated conversions
	const { startTimestamp, endTimestamp, isValid } = useMemo(() => {
		const start = new Date(startTime).getTime()
		const end = new Date(endTime).getTime()

		if (isNaN(start) || isNaN(end) || start >= end) {
			return { startTimestamp: 0, endTimestamp: 0, isValid: false }
		}

		return { startTimestamp: start, endTimestamp: end, isValid: true }
	}, [startTime, endTime])

	// Simple function to check if current time is in range
	const checkInRange = () => {
		if (!isValid) return false

		const now = Date.now()
		const isAfterStart = now >= startTimestamp
		const isBeforeEnd = includeEnd ? now <= endTimestamp : now < endTimestamp

		return isAfterStart && isBeforeEnd
	}

	// State to track range status
	const [isInRange, setIsInRange] = useState(checkInRange)

	useEffect(() => {
		if (!isValid) {
			setIsInRange(false)
			return
		}

		// Update state immediately
		const currentState = checkInRange()
		setIsInRange(currentState)

		// Determine smart update strategy
		const now = Date.now()
		let timeoutId: NodeJS.Timeout | null = null
		let intervalId: NodeJS.Timeout | null = null

		// Set precise timeout for next critical time point
		let nextCriticalTime: number | null = null

		if (now < startTimestamp) {
			nextCriticalTime = startTimestamp
		} else if (now < endTimestamp || (includeEnd && now === endTimestamp)) {
			nextCriticalTime = includeEnd ? endTimestamp + 1 : endTimestamp
		}

		if (nextCriticalTime) {
			const delay = nextCriticalTime - now

			// Only set timeout for reasonable delays (max 7 days)
			if (delay > 0 && delay <= 7 * 24 * 60 * 60 * 1000) {
				timeoutId = setTimeout(() => {
					const newState = checkInRange()
					if (newState !== isInRange) {
						setIsInRange(newState)
					}
				}, delay)
			}
		}

		// Set up periodic check only if we're not too far from critical points
		const minDistance = Math.min(Math.abs(now - startTimestamp), Math.abs(now - endTimestamp))

		// Only use interval if we're within reasonable distance or timeout wasn't set
		if (minDistance <= updateInterval * 10 || !timeoutId) {
			intervalId = setInterval(() => {
				const newState = checkInRange()
				if (newState !== isInRange) {
					setIsInRange(newState)
				}
			}, updateInterval)
		}

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
			if (intervalId) clearInterval(intervalId)
		}
	}, [startTimestamp, endTimestamp, isValid, includeEnd, updateInterval])

	return isInRange
}

export default useTimeRange
