export interface MemoryPeak {
	baselineHeapBytes: number
	baselineRssBytes: number
	peakHeapBytes: number
	peakRssBytes: number
	peakHeapDeltaBytes: number
	peakRssDeltaBytes: number
}

export interface MemorySampler {
	observe(): void
	stop(): MemoryPeak
}

export function startMemorySampler(intervalMs = 5): MemorySampler {
	const baseline = process.memoryUsage()
	let peakHeapBytes = baseline.heapUsed
	let peakRssBytes = baseline.rss

	const observe = () => {
		const current = process.memoryUsage()
		peakHeapBytes = Math.max(peakHeapBytes, current.heapUsed)
		peakRssBytes = Math.max(peakRssBytes, current.rss)
	}

	const timer = setInterval(observe, intervalMs)
	timer.unref()

	return {
		observe,
		stop() {
			clearInterval(timer)
			observe()
			return {
				baselineHeapBytes: baseline.heapUsed,
				baselineRssBytes: baseline.rss,
				peakHeapBytes,
				peakRssBytes,
				peakHeapDeltaBytes: Math.max(0, peakHeapBytes - baseline.heapUsed),
				peakRssDeltaBytes: Math.max(0, peakRssBytes - baseline.rss),
			}
		},
	}
}
