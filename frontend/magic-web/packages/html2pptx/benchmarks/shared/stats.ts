import type { DistributionSummary } from "./types"

export function summarize(values: number[]): DistributionSummary {
	if (values.length === 0) {
		return { min: 0, max: 0, mean: 0, p50: 0, p95: 0 }
	}

	const sorted = [...values].sort((left, right) => left - right)
	const sum = sorted.reduce((total, value) => total + value, 0)
	return {
		min: sorted[0],
		max: sorted[sorted.length - 1],
		mean: sum / sorted.length,
		p50: percentile(sorted, 0.5),
		p95: percentile(sorted, 0.95),
	}
}

function percentile(sorted: number[], quantile: number): number {
	if (sorted.length === 1) return sorted[0]
	const position = (sorted.length - 1) * quantile
	const lowerIndex = Math.floor(position)
	const upperIndex = Math.ceil(position)
	if (lowerIndex === upperIndex) return sorted[lowerIndex]
	const fraction = position - lowerIndex
	return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction
}
