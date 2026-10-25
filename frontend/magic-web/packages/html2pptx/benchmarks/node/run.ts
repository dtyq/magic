import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { performance } from "node:perf_hooks"
import {
	assertKnownArgs,
	parseArgs,
	readPositiveInteger,
	readProfile,
	readScenarios,
} from "../shared/cli"
import { readEnvironment } from "../shared/environment"
import { emitJson } from "../shared/output"
import { summarize } from "../shared/stats"
import {
	BENCHMARK_SCHEMA_VERSION,
	type BenchmarkProfile,
	type ScenarioName,
	type ScenarioShape,
} from "../shared/types"
import {
	NODE_MEMORY_SAMPLE_INTERVAL_MS,
	NODE_WORKER_RESULT_PREFIX,
	type NodeIterationFailure,
	type NodeWorkerInput,
	type NodeWorkerResult,
	type PackagingFailureSample,
	type PackagingSample,
	type PackagingSuccessSample,
} from "./protocol"
import { NODE_PROFILES } from "./scenarios"

const PACKAGE_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const WORKER_PATH = fileURLToPath(new URL("./worker.ts", import.meta.url))
const require = createRequire(import.meta.url)
const TSX_IMPORT_SPECIFIER = pathToFileURL(require.resolve("tsx")).href
const MAX_CAPTURED_OUTPUT_BYTES = 64 * 1024
const P95_MINIMUM_SAMPLE_COUNT = 20

interface ScenarioResult {
	name: ScenarioName
	fixture: {
		slides: number
		nodes: number
		imageReferences: number
		uniqueImageSources: number
	}
	warmupSamples: PackagingSample[]
	samples: PackagingSample[]
	summary: {
		requestedIterations: number
		successfulIterations: number
		failedIterations: number
		successRate: number
		p95Interpretation: "descriptive-only" | "distribution-estimate"
		durationMs: ReturnType<typeof summarize> | null
		outputBytes: ReturnType<typeof summarize> | null
		sampledPeakHeapBytes: ReturnType<typeof summarize> | null
		sampledPeakRssBytes: ReturnType<typeof summarize> | null
		sampledPeakHeapDeltaBytes: ReturnType<typeof summarize> | null
		sampledPeakRssDeltaBytes: ReturnType<typeof summarize> | null
		artifactSha256: string[]
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	assertKnownArgs(args, {
		values: [
			"profile",
			"scenario",
			"iterations",
			"warmup",
			"timeout-ms",
			"slides",
			"images-per-slide",
			"image-width",
			"image-height",
			"output",
		],
	})
	const profile = readProfile(args)
	const scenarios = readScenarios(args)
	const defaults = NODE_PROFILES[profile]
	const iterations = readPositiveInteger(args, "iterations", defaults.iterations)
	const warmup = readPositiveInteger(args, "warmup", defaults.warmup, { allowZero: true })
	const timeoutMs = readPositiveInteger(
		args,
		"timeout-ms",
		profile === "baseline" ? 3_600_000 : 300_000,
	)
	const shape: ScenarioShape = {
		...defaults.shape,
		slides: readPositiveInteger(args, "slides", defaults.shape.slides),
		imagesPerSlide: readPositiveInteger(
			args,
			"images-per-slide",
			defaults.shape.imagesPerSlide,
		),
		imageWidthPx: readPositiveInteger(args, "image-width", defaults.shape.imageWidthPx),
		imageHeightPx: readPositiveInteger(args, "image-height", defaults.shape.imageHeightPx),
	}
	const results: ScenarioResult[] = []

	for (const scenario of scenarios) {
		process.stderr.write(`[html2pptx benchmark] preparing node scenario ${scenario}\n`)
		results.push(await runScenario({ scenario, shape, iterations, warmup, timeoutMs }))
	}

	emitJson(
		{
			schemaVersion: BENCHMARK_SCHEMA_VERSION,
			benchmark: "html2pptx-node-packaging",
			generatedAt: new Date().toISOString(),
			environment: readEnvironment(PACKAGE_ROOT),
			profile,
			iterations,
			warmup,
			timeoutMs,
			processIsolation: {
				mode: "one-child-process-per-iteration",
				includesWarmups: true,
				rssSemantics: "Each sample starts in a fresh Node.js process; RSS is not inherited from earlier samples.",
			},
			memoryMeasurement: {
				mode: "interval-sampled-process-memory",
				intervalMs: NODE_MEMORY_SAMPLE_INTERVAL_MS,
				fieldPrefix: "sampled",
				caveat: "Sampled peaks may miss short synchronous allocation spikes between observations.",
			},
			percentilePolicy: {
				p95MinimumSampleCount: P95_MINIMUM_SAMPLE_COUNT,
				belowMinimum: "P95 is emitted as a descriptive value only.",
			},
			results,
		},
		args.values.get("output"),
	)
}

async function runScenario({
	scenario,
	shape,
	iterations,
	warmup,
	timeoutMs,
}: {
	scenario: ScenarioName
	shape: ScenarioShape
	iterations: number
	warmup: number
	timeoutMs: number
}): Promise<ScenarioResult> {
	const warmupSamples: PackagingSample[] = []
	for (let index = 0; index < warmup; index++) {
		process.stderr.write(`[html2pptx benchmark] ${scenario} warmup ${index + 1}/${warmup}\n`)
		const sample = await runIsolatedIteration(
			{ scenario, shape, iteration: index, includeHash: false },
			timeoutMs,
		)
		warmupSamples.push(sample)
		if (sample.status === "failed") {
			process.stderr.write(
				`[html2pptx benchmark] ${scenario} warmup ${index + 1} failed: ${sample.failure.message}\n`,
			)
		}
	}

	const samples: PackagingSample[] = []
	for (let index = 0; index < iterations; index++) {
		process.stderr.write(`[html2pptx benchmark] ${scenario} iteration ${index + 1}/${iterations}\n`)
		const sample = await runIsolatedIteration(
			{ scenario, shape, iteration: index, includeHash: true },
			timeoutMs,
		)
		samples.push(sample)
		if (sample.status === "failed") {
			process.stderr.write(
				`[html2pptx benchmark] ${scenario} iteration ${index + 1} failed: ${sample.failure.message}\n`,
			)
		}
	}

	const successful = samples.filter(isSuccessfulSample)
	return {
		name: scenario,
		fixture: describeFixture(scenario, shape),
		warmupSamples,
		samples,
		summary: {
			requestedIterations: iterations,
			successfulIterations: successful.length,
			failedIterations: iterations - successful.length,
			successRate: successful.length / iterations,
			p95Interpretation:
				successful.length < P95_MINIMUM_SAMPLE_COUNT
					? "descriptive-only"
					: "distribution-estimate",
			durationMs: summarizeSuccessful(successful.map((sample) => sample.durationMs)),
			outputBytes: summarizeSuccessful(successful.map((sample) => sample.outputBytes)),
			sampledPeakHeapBytes: summarizeSuccessful(
				successful.map((sample) => sample.sampledPeakHeapBytes),
			),
			sampledPeakRssBytes: summarizeSuccessful(
				successful.map((sample) => sample.sampledPeakRssBytes),
			),
			sampledPeakHeapDeltaBytes: summarizeSuccessful(
				successful.map((sample) => sample.sampledPeakHeapDeltaBytes),
			),
			sampledPeakRssDeltaBytes: summarizeSuccessful(
				successful.map((sample) => sample.sampledPeakRssDeltaBytes),
			),
			artifactSha256: Array.from(new Set(successful.map((sample) => sample.artifactSha256))),
		},
	}
}

function runIsolatedIteration(
	input: NodeWorkerInput,
	timeoutMs: number,
): Promise<PackagingSample> {
	const startedAt = performance.now()
	return new Promise((resolveIteration) => {
		let stdout = ""
		let stderr = ""
		let timedOut = false
		let resolved = false
		const child = spawn(
			process.execPath,
			["--expose-gc", "--import", TSX_IMPORT_SPECIFIER, WORKER_PATH],
			{
				cwd: PACKAGE_ROOT,
				env: {
					...process.env,
					HTML2PPTX_NODE_BENCHMARK_WORKER_INPUT: JSON.stringify(input),
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		)

		const finish = (sample: PackagingSample) => {
			if (resolved) return
			resolved = true
			clearTimeout(timer)
			resolveIteration(sample)
		}

		child.stdout.on("data", (chunk: Buffer) => {
			stdout = appendCapturedOutput(stdout, chunk.toString("utf8"))
		})
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = appendCapturedOutput(stderr, chunk.toString("utf8"))
		})
		child.on("error", (error) => {
			finish(
				failureSample(input.iteration, startedAt, {
					kind: "process-error",
					name: error.name,
					message: error.message,
					stack: error.stack,
					stderr: stderr || undefined,
				}),
			)
		})
		child.on("close", (exitCode, signal) => {
			if (timedOut) {
				finish(
					failureSample(input.iteration, startedAt, {
						kind: "timeout",
						name: "IterationTimeoutError",
						message: `Worker exceeded ${timeoutMs} ms`,
						exitCode,
						signal,
						stderr: stderr || undefined,
					}),
				)
				return
			}
			if (exitCode !== 0) {
				finish(
					failureSample(input.iteration, startedAt, {
						kind: "process-exit",
						name: "WorkerProcessExitError",
						message: `Worker exited with code ${String(exitCode)}${signal ? ` and signal ${signal}` : ""}`,
						exitCode,
						signal,
						stderr: stderr || undefined,
					}),
				)
				return
			}

			const result = parseWorkerResult(stdout)
			if (result instanceof Error) {
				finish(
					failureSample(input.iteration, startedAt, {
						kind: "protocol",
						name: result.name,
						message: result.message,
						stack: result.stack,
						stderr: stderr || undefined,
					}),
				)
				return
			}
			if (result.status === "failed") {
				finish(
					failureSample(input.iteration, startedAt, {
						kind: "benchmark",
						phase: result.failure.phase,
						name: result.failure.name,
						message: result.failure.message,
						stack: result.failure.stack,
						stderr: stderr || undefined,
					}),
				)
				return
			}
			finish(result.sample)
		})

		const timer = setTimeout(() => {
			timedOut = true
			child.kill("SIGKILL")
		}, timeoutMs)
		timer.unref()
	})
}

function parseWorkerResult(stdout: string): NodeWorkerResult | Error {
	const markerIndex = stdout.lastIndexOf(NODE_WORKER_RESULT_PREFIX)
	if (markerIndex < 0) return new Error("Worker did not emit a benchmark result")
	const payload = stdout.slice(markerIndex + NODE_WORKER_RESULT_PREFIX.length).split(/\r?\n/, 1)[0]
	try {
		return JSON.parse(payload) as NodeWorkerResult
	} catch (error) {
		return new Error(
			`Worker emitted invalid benchmark JSON: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

function appendCapturedOutput(current: string, addition: string): string {
	const combined = current + addition
	return combined.length <= MAX_CAPTURED_OUTPUT_BYTES
		? combined
		: combined.slice(combined.length - MAX_CAPTURED_OUTPUT_BYTES)
}

function failureSample(
	iteration: number,
	startedAt: number,
	failure: NodeIterationFailure,
): PackagingFailureSample {
	return {
		status: "failed",
		iteration,
		wallDurationMs: performance.now() - startedAt,
		failure,
	}
}

function isSuccessfulSample(sample: PackagingSample): sample is PackagingSuccessSample {
	return sample.status === "success"
}

function summarizeSuccessful(values: number[]): ReturnType<typeof summarize> | null {
	return values.length > 0 ? summarize(values) : null
}

function describeFixture(
	scenario: ScenarioName,
	shape: ScenarioShape,
): ScenarioResult["fixture"] {
	const imageReferences = scenario === "text" ? 0 : shape.slides * shape.imagesPerSlide
	const nodesPerSlide =
		scenario === "text"
			? shape.textNodesPerSlide
			: scenario === "mixed"
				? shape.textNodesPerSlide + shape.shapeNodesPerSlide + shape.imagesPerSlide
				: shape.imagesPerSlide
	const uniqueImageSources =
		scenario === "text"
			? 0
			: scenario === "image-reuse"
				? imageReferences > 0
					? 1
					: 0
				: scenario === "image-unique"
					? imageReferences
					: imageReferences > 0
						? 1 + shape.slides * Math.max(0, shape.imagesPerSlide - 1)
						: 0
	return {
		slides: shape.slides,
		nodes: shape.slides * nodesPerSlide,
		imageReferences,
		uniqueImageSources,
	}
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
	process.exitCode = 1
})
