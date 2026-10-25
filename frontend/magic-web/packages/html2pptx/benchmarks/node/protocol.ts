import type { ScenarioName, ScenarioShape } from "../shared/types"

export const NODE_WORKER_RESULT_PREFIX = "__HTML2PPTX_NODE_BENCHMARK_RESULT__="
export const NODE_MEMORY_SAMPLE_INTERVAL_MS = 5

export interface NodeWorkerInput {
	scenario: ScenarioName
	shape: ScenarioShape
	iteration: number
	includeHash: boolean
}

export interface PackagingSuccessSample {
	status: "success"
	iteration: number
	durationMs: number
	outputBytes: number
	artifactSha256: string
	sampledBaselineHeapBytes: number
	sampledBaselineRssBytes: number
	sampledPeakHeapBytes: number
	sampledPeakRssBytes: number
	sampledPeakHeapDeltaBytes: number
	sampledPeakRssDeltaBytes: number
}

export type NodeWorkerPhase = "fixture" | "package"

export interface NodeWorkerFailure {
	phase: NodeWorkerPhase
	name: string
	message: string
	stack?: string
}

export type NodeWorkerResult =
	| {
			status: "success"
			sample: PackagingSuccessSample
	  }
	| {
			status: "failed"
			failure: NodeWorkerFailure
	  }

export interface PackagingFailureSample {
	status: "failed"
	iteration: number
	wallDurationMs: number
	failure: NodeIterationFailure
}

export interface NodeIterationFailure {
	kind: "benchmark" | "process-exit" | "process-error" | "protocol" | "timeout"
	phase?: NodeWorkerPhase
	name: string
	message: string
	stack?: string
	exitCode?: number | null
	signal?: NodeJS.Signals | null
	stderr?: string
}

export type PackagingSample = PackagingSuccessSample | PackagingFailureSample
