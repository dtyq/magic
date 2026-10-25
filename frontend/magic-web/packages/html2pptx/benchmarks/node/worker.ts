import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { performance } from "node:perf_hooks"
import { Writable } from "node:stream"
import { drawByRegistry } from "../../src/registry/drawer-registry"
import type { SerializablePPTNode } from "../../src/ir/serialize"
import type { Pptx } from "../../src/ir/node"
import { startMemorySampler } from "../shared/memory"
import {
	NODE_MEMORY_SAMPLE_INTERVAL_MS,
	NODE_WORKER_RESULT_PREFIX,
	type NodeWorkerInput,
	type NodeWorkerPhase,
	type NodeWorkerResult,
	type PackagingSuccessSample,
} from "./protocol"
import { createScenarioSlides } from "./scenarios"

const require = createRequire(import.meta.url)
const PptxGenJS = require("pptxgenjs") as new () => Pptx
type StreamingPptx = Pptx & {
	writeTo(options: {
		destination: NodeJS.WritableStream
	}): Promise<{ bytesWritten: bigint; entryCount: bigint }>
}
const SLIDE_CONFIG = {
	htmlWidth: 1920,
	htmlHeight: 1080,
	slideWidth: 20,
	slideHeight: 11.25,
}

async function main(): Promise<void> {
	const input = readWorkerInput()
	let phase: NodeWorkerPhase = "fixture"
	try {
		const slides = createScenarioSlides(input.scenario, input.shape)
		collectGarbage()
		phase = "package"
		const sample = await runPackagingIteration(slides, input.iteration, input.includeHash)
		emitWorkerResult({ status: "success", sample })
	} catch (error) {
		emitWorkerResult({
			status: "failed",
			failure: {
				phase,
				name: error instanceof Error ? error.name : "UnknownError",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
		})
	}
}

async function runPackagingIteration(
	slides: SerializablePPTNode[][],
	iteration: number,
	includeHash: boolean,
): Promise<PackagingSuccessSample> {
	const memory = startMemorySampler(NODE_MEMORY_SAMPLE_INTERVAL_MS)
	const startedAt = performance.now()
	try {
		const presentation = createBenchPresentation()

		for (const nodes of slides) {
			const slide = presentation.addSlide()
			for (const node of nodes) await drawByRegistry(slide, node)
			memory.observe()
		}

		const hash = includeHash ? createHash("sha256") : undefined
		let streamedBytes = 0
		const destination = new Writable({
			write(chunk: Buffer | string, _encoding, callback) {
				const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk
				streamedBytes += bytes.byteLength
				hash?.update(bytes)
				callback()
			},
		})
		const result = await (presentation as StreamingPptx).writeTo({ destination })
		if (result.bytesWritten !== BigInt(streamedBytes)) {
			throw new Error(
				`Streaming byte count mismatch: sink=${streamedBytes}, writer=${result.bytesWritten}`,
			)
		}
		const durationMs = performance.now() - startedAt
		memory.observe()
		const memoryPeak = memory.stop()
		const artifactSha256 = hash?.digest("hex") ?? "warmup-not-hashed"

		return {
			status: "success",
			iteration,
			durationMs,
			outputBytes: streamedBytes,
			artifactSha256,
			sampledBaselineHeapBytes: memoryPeak.baselineHeapBytes,
			sampledBaselineRssBytes: memoryPeak.baselineRssBytes,
			sampledPeakHeapBytes: memoryPeak.peakHeapBytes,
			sampledPeakRssBytes: memoryPeak.peakRssBytes,
			sampledPeakHeapDeltaBytes: memoryPeak.peakHeapDeltaBytes,
			sampledPeakRssDeltaBytes: memoryPeak.peakRssDeltaBytes,
		}
	} catch (error) {
		memory.stop()
		throw error
	}
}

function readWorkerInput(): NodeWorkerInput {
	const raw = process.env.HTML2PPTX_NODE_BENCHMARK_WORKER_INPUT
	if (!raw) throw new Error("Missing HTML2PPTX_NODE_BENCHMARK_WORKER_INPUT")
	return JSON.parse(raw) as NodeWorkerInput
}

function emitWorkerResult(result: NodeWorkerResult): void {
	process.stdout.write(`${NODE_WORKER_RESULT_PREFIX}${JSON.stringify(result)}\n`)
}

function createBenchPresentation(): Pptx {
	const presentation = new PptxGenJS()
	presentation.defineLayout({
		name: "HTML2PPTX_BENCHMARK",
		width: SLIDE_CONFIG.slideWidth,
		height: SLIDE_CONFIG.slideHeight,
	})
	presentation.layout = "HTML2PPTX_BENCHMARK"
	return presentation
}

function collectGarbage(): void {
	const gc = (globalThis as { gc?: () => void }).gc
	gc?.()
}

main().catch((error) => {
	emitWorkerResult({
		status: "failed",
		failure: {
			phase: "fixture",
			name: error instanceof Error ? error.name : "UnknownError",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		},
	})
})
