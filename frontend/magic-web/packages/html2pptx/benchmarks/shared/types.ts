export const BENCHMARK_SCHEMA_VERSION = 2

export const SCENARIO_NAMES = ["text", "image-reuse", "image-unique", "mixed"] as const

export type ScenarioName = (typeof SCENARIO_NAMES)[number]
export type BenchmarkProfile = "quick" | "baseline"
export type BenchmarkTarget = "dist" | "source"

export interface DistributionSummary {
	min: number
	max: number
	mean: number
	p50: number
	p95: number
}

export interface BenchmarkEnvironment {
	gitCommit: string
	gitDirty: boolean
	gitWorkingTreeSha256: string
	benchmarkTreeSha256: string
	benchmarkTreeFileCount: number
	benchmarkTreeBytes: number
	lockfileSha256: string
	pptxGenJsVersion: string
	pptxGenJsEntrySha256: string
	pptxGenJsTreeSha256: string
	pptxGenJsTreeFileCount: number
	pptxGenJsTreeBytes: number
	puppeteerVersion: string
	nodeVersion: string
	platform: NodeJS.Platform
	arch: string
	cpuModel: string
	logicalCpuCount: number
	totalMemoryBytes: number
}

export interface ScenarioShape {
	slides: number
	textNodesPerSlide: number
	shapeNodesPerSlide: number
	imagesPerSlide: number
	imageWidthPx: number
	imageHeightPx: number
}
