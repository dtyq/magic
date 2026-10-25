/// <reference lib="webworker" />

import { StorageSizeMeasurementError, type StorageSizeFailureReason } from "./sizeMeasurementCore"
import { StorageSizeScanner } from "./sizeMeasurementScanner"

interface StartMessage {
	type: "start"
	sliceBudgetMs: number
	overallBudgetMs: number
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope
const SLICE_GAP_MS = 50

let started = false

/** Run resumable five-second slices in one Worker and emit only one terminal result. */
workerScope.onmessage = (event: MessageEvent<StartMessage>) => {
	if (event.data?.type !== "start" || started) return
	started = true
	void runMeasurement(event.data).finally(() => {
		started = false
	})
}

/** Continue slices until complete or the overall diagnostic budget expires. */
async function runMeasurement(message: StartMessage): Promise<void> {
	const scanner = new StorageSizeScanner()
	const startedAt = performance.now()
	let sliceCount = 0
	try {
		for (let iteration = 0; iteration < Number.MAX_SAFE_INTEGER; iteration += 1) {
			const elapsedMs = performance.now() - startedAt
			const remainingMs = message.overallBudgetMs - elapsedMs
			if (remainingMs <= 0) {
				workerScope.postMessage({
					type: "incomplete",
					reason: "timeout" satisfies StorageSizeFailureReason,
					stage: scanner.stage,
					coverage: scanner.coverage,
					sliceCount,
					elapsedMs: Math.round(elapsedMs),
				})
				return
			}
			sliceCount += 1
			const result = await scanner.runSlice(Math.min(message.sliceBudgetMs, remainingMs))
			if (result.status === "complete") {
				workerScope.postMessage({
					type: "complete",
					measurement: result.measurement,
					coverage: result.coverage,
					sliceCount,
					elapsedMs: Math.round(performance.now() - startedAt),
				})
				return
			}
			// Leave a small gap between slices so ordinary storage work can make progress.
			await new Promise((resolve) => setTimeout(resolve, SLICE_GAP_MS))
		}
	} catch (error: unknown) {
		workerScope.postMessage({
			type: "incomplete",
			reason: error instanceof StorageSizeMeasurementError ? error.reason : "read_failed",
			stage: scanner.stage,
			coverage: scanner.coverage,
			sliceCount,
			elapsedMs: Math.round(performance.now() - startedAt),
		})
	}
}

export {}
