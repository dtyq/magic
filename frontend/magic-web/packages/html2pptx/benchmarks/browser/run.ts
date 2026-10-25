import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import puppeteer, {
	type Browser,
	type BrowserContext,
	type CDPSession,
	type Page,
} from "puppeteer"
import { createServer, type ViteDevServer } from "vite"
import {
	assertKnownArgs,
	parseArgs,
	readPositiveInteger,
	readPositiveNumber,
	readProfile,
	readScenarios,
	readTarget,
} from "../shared/cli"
import { readEnvironment } from "../shared/environment"
import { emitJson } from "../shared/output"
import { summarize } from "../shared/stats"
import { hashTargetTree } from "../shared/tree-hash"
import { BENCHMARK_SCHEMA_VERSION, type ScenarioName, type ScenarioShape } from "../shared/types"
import type { BrowserRunSample } from "./app"
import { resolveChromeExecutable } from "./executable"
import { BROWSER_PROFILES } from "./scenarios"
import { createBenchmarkViteConfig } from "./vite.config"

const PACKAGE_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const HEAP_SAMPLE_INTERVAL_MS = 20
const P95_MINIMUM_SAMPLE_COUNT = 20

type BrowserIterationPhase =
	| "context-create"
	| "page-create"
	| "cdp-create"
	| "cpu-throttle"
	| "garbage-collection"
	| "navigation"
	| "harness-ready"
	| "export"
	| "context-close"

interface BrowserRunErrorSample {
	status: "error"
	iteration: number
	durationMs: number
	error: {
		kind: "timeout" | "out-of-memory" | "page-crash" | "execution"
		phase: BrowserIterationPhase
		name: string
		message: string
		stack?: string
	}
}

type BrowserScenarioSample = BrowserRunSample | BrowserRunErrorSample

interface BrowserScenarioResult {
	name: ScenarioName
	fixture: {
		slides: number
		textNodesPerSlide: number
		shapeNodesPerSlide: number
		imagesPerSlide: number
		imageWidthPx: number
		imageHeightPx: number
	}
	warmupErrors: BrowserRunErrorSample[]
	samples: BrowserScenarioSample[]
	summary: {
		attempted: number
		succeeded: number
		failed: number
		successRate: number
		p95Interpretation: "descriptive-only" | "distribution-estimate"
		durationMs: ReturnType<typeof summarize> | null
		outputBytes: ReturnType<typeof summarize> | null
		sampledExportPeakJsHeapBytes: ReturnType<typeof summarize> | null
		sampledPeakJsHeapBytes: ReturnType<typeof summarize> | null
		longTaskCount: ReturnType<typeof summarize> | null
		longTaskTotalMs: ReturnType<typeof summarize> | null
		longTaskMaxMs: ReturnType<typeof summarize> | null
		hashDurationMs: ReturnType<typeof summarize> | null
		artifactSha256: string[]
	}
	cleanupErrors: BrowserRunErrorSample["error"][]
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	assertKnownArgs(args, {
		values: [
			"profile",
			"target",
			"scenario",
			"iterations",
			"warmup",
			"cpu-throttle",
			"timeout-ms",
			"slides",
			"images-per-slide",
			"image-width",
			"image-height",
			"chrome-path",
			"output",
		],
		flags: ["headful"],
	})
	const profile = readProfile(args)
	const target = readTarget(args)
	const scenarios = readScenarios(args)
	const defaults = BROWSER_PROFILES[profile]
	const iterations = readPositiveInteger(args, "iterations", defaults.iterations)
	const warmup = readPositiveInteger(args, "warmup", defaults.warmup, { allowZero: true })
	const cpuThrottle = readPositiveNumber(args, "cpu-throttle", profile === "baseline" ? 4 : 1)
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
	const targetPath = resolve(PACKAGE_ROOT, target === "dist" ? "dist/index.js" : "src/index.ts")
	const targetRoot = resolve(PACKAGE_ROOT, target === "dist" ? "dist" : "src")
	const targetTree = hashTargetTree(
		targetRoot,
		target === "dist" ? () => true : (relativePath) => relativePath.endsWith(".ts"),
	)
	const browserLaunchArgs = ["--enable-precise-memory-info"]
	const headful = args.flags.has("headful")
	const chromeExecutable = resolveChromeExecutable(args.values.get("chrome-path"), headful)
	let viteServer: ViteDevServer | null = null
	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
	try {
		viteServer = await createServer(createBenchmarkViteConfig(target))
		await viteServer.listen()
		const address = viteServer.httpServer?.address() as AddressInfo | null
		if (!address) throw new Error("Vite benchmark server did not expose an address")
		const benchmarkUrl = `http://127.0.0.1:${address.port}`

		try {
			browser = await puppeteer.launch({
				headless: !headful,
				executablePath: chromeExecutable,
				protocolTimeout: timeoutMs + 60_000,
				args: browserLaunchArgs,
			})
		} catch (error) {
			throw new Error(
				`Failed to launch benchmark Chrome at ${chromeExecutable}: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			)
		}
		const browserVersion = await browser.version()
		const results: BrowserScenarioResult[] = []

		for (const scenario of scenarios) {
			results.push(
				await runScenario({
					browser,
					benchmarkUrl,
					scenario,
					iterations,
					warmup,
					shape,
					cpuThrottle,
					timeoutMs,
				}),
			)
		}

		emitJson(
			{
				schemaVersion: BENCHMARK_SCHEMA_VERSION,
				benchmark: "html2pptx-browser-e2e",
				generatedAt: new Date().toISOString(),
				environment: {
					...readEnvironment(PACKAGE_ROOT),
					browserVersion,
				},
				target,
				targetModuleSha256: createHash("sha256")
					.update(readFileSync(targetPath))
					.digest("hex"),
				targetTreeSha256: targetTree.sha256,
				targetTreeFileCount: targetTree.fileCount,
				targetTreeBytes: targetTree.totalBytes,
				profile,
				cpuThrottle,
				browserLaunchArgs,
				chromeExecutable,
				iterations,
				warmup,
				memoryMeasurement: {
					source: "performance.memory.usedJSHeapSize",
					method: "sampled-peak",
					sampleIntervalMs: HEAP_SAMPLE_INTERVAL_MS,
					note: "Renderer JS heap only; excludes Worker, native, and Blob backing memory.",
				},
				cacheSemantics: {
					contextIsolation: "one-browser-context-per-scenario",
					measuredState:
						warmup > 0
							? "warm-after-excluded-warmup"
							: iterations === 1
								? "cold"
								: "first-measurement-cold-remaining-measurements-warm",
					assetServerCache: "bounded-lru-32MiB-128-entries",
				},
				percentilePolicy: {
					p95MinimumSampleCount: P95_MINIMUM_SAMPLE_COUNT,
					belowMinimum: "P95 is emitted as a descriptive value only.",
				},
				results,
			},
			args.values.get("output"),
		)
	} finally {
		const cleanupResults = await Promise.allSettled([
			browser?.close() ?? Promise.resolve(),
			viteServer?.close() ?? Promise.resolve(),
		])
		for (const result of cleanupResults) {
			if (result.status === "rejected") {
				process.stderr.write(
					`[html2pptx benchmark] cleanup failed: ${formatErrorMessage(result.reason)}\n`,
				)
			}
		}
	}
}

async function runScenario({
	browser,
	benchmarkUrl,
	scenario,
	iterations,
	warmup,
	shape,
	cpuThrottle,
	timeoutMs,
}: {
	browser: Browser
	benchmarkUrl: string
	scenario: ScenarioName
	iterations: number
	warmup: number
	shape: ScenarioShape
	cpuThrottle: number
	timeoutMs: number
}): Promise<BrowserScenarioResult> {
	let context: BrowserContext | null = null
	const warmupErrors: BrowserRunErrorSample[] = []
	const samples: BrowserScenarioSample[] = []
	const cleanupErrors: BrowserRunErrorSample["error"][] = []

	try {
		try {
			context = await browser.createBrowserContext()
		} catch (error) {
			const contextError = createErrorSample(0, 0, "context-create", error)
			for (let index = 0; index < warmup; index++) {
				warmupErrors.push({ ...contextError, iteration: index })
			}
			for (let index = 0; index < iterations; index++) {
				samples.push({ ...contextError, iteration: index })
			}
		}

		if (context) {
			for (let index = 0; index < warmup; index++) {
				process.stderr.write(
					`[html2pptx benchmark] browser ${scenario} warmup ${index + 1}/${warmup}\n`,
				)
				const sample = await captureBrowserIteration({
					context,
					benchmarkUrl,
					scenario,
					iteration: index,
					shape,
					cpuThrottle,
					timeoutMs,
				})
				if (sample.status === "error") warmupErrors.push(sample)
			}

			for (let index = 0; index < iterations; index++) {
				process.stderr.write(
					`[html2pptx benchmark] browser ${scenario} iteration ${index + 1}/${iterations}\n`,
				)
				samples.push(
					await captureBrowserIteration({
						context,
						benchmarkUrl,
						scenario,
						iteration: index,
						shape,
						cpuThrottle,
						timeoutMs,
					}),
				)
			}
		}
	} finally {
		if (context) {
			try {
				await context.close()
			} catch (error) {
				cleanupErrors.push(serializeError("context-close", error))
			}
		}
	}

	const successfulSamples = samples.filter(
		(sample): sample is BrowserRunSample => sample.status === "ok",
	)
	const sampledExportHeapValues = successfulSamples.flatMap((sample) =>
		sample.sampledExportPeakJsHeapBytes === null
			? []
			: [sample.sampledExportPeakJsHeapBytes],
	)
	const sampledPeakHeapValues = successfulSamples.flatMap((sample) =>
		sample.sampledPeakJsHeapBytes === null ? [] : [sample.sampledPeakJsHeapBytes],
	)
	const succeeded = successfulSamples.length
	const failed = samples.length - succeeded

	return {
		name: scenario,
		fixture: describeFixture(scenario, shape),
		warmupErrors,
		samples,
		summary: {
			attempted: samples.length,
			succeeded,
			failed,
			successRate: samples.length > 0 ? succeeded / samples.length : 0,
			p95Interpretation:
				succeeded < P95_MINIMUM_SAMPLE_COUNT
					? "descriptive-only"
					: "distribution-estimate",
			durationMs: summarizeOrNull(successfulSamples.map((sample) => sample.durationMs)),
			outputBytes: summarizeOrNull(successfulSamples.map((sample) => sample.outputBytes)),
			sampledExportPeakJsHeapBytes: summarizeOrNull(sampledExportHeapValues),
			sampledPeakJsHeapBytes: summarizeOrNull(sampledPeakHeapValues),
			longTaskCount: summarizeOrNull(
				successfulSamples.map((sample) => sample.longTaskCount),
			),
			longTaskTotalMs: summarizeOrNull(
				successfulSamples.map((sample) => sample.longTaskTotalMs),
			),
			longTaskMaxMs: summarizeOrNull(
				successfulSamples.map((sample) => sample.longTaskMaxMs),
			),
			hashDurationMs: summarizeOrNull(
				successfulSamples.map((sample) => sample.hashDurationMs),
			),
			artifactSha256: Array.from(
				new Set(successfulSamples.map((sample) => sample.artifactSha256)),
			),
		},
		cleanupErrors,
	}
}

function describeFixture(scenario: ScenarioName, shape: ScenarioShape): ScenarioShape {
	return {
		...shape,
		textNodesPerSlide:
			scenario === "text" || scenario === "mixed" ? shape.textNodesPerSlide : 0,
		shapeNodesPerSlide: scenario === "mixed" ? shape.shapeNodesPerSlide : 0,
		imagesPerSlide: scenario === "text" ? 0 : shape.imagesPerSlide,
	}
}

async function captureBrowserIteration(input: {
	context: BrowserContext
	benchmarkUrl: string
	scenario: ScenarioName
	iteration: number
	shape: ScenarioShape
	cpuThrottle: number
	timeoutMs: number
}): Promise<BrowserScenarioSample> {
	const startedAt = performance.now()
	try {
		return await runBrowserIteration(input)
	} catch (error) {
		if (error instanceof BrowserIterationError) {
			return createErrorSample(
				input.iteration,
				performance.now() - startedAt,
				error.phase,
				error.cause,
			)
		}
		return createErrorSample(
			input.iteration,
			performance.now() - startedAt,
			"export",
			error,
		)
	}
}

async function runBrowserIteration({
	context,
	benchmarkUrl,
	scenario,
	iteration,
	shape,
	cpuThrottle,
	timeoutMs,
}: {
	context: BrowserContext
	benchmarkUrl: string
	scenario: ScenarioName
	iteration: number
	shape: ScenarioShape
	cpuThrottle: number
	timeoutMs: number
}): Promise<BrowserRunSample> {
	let phase: BrowserIterationPhase = "page-create"
	let page: Page | null = null
	let cdp: CDPSession | null = null
	let pageCrash: Error | null = null
	try {
		page = await context.newPage()
		page.setDefaultTimeout(timeoutMs)
		page.setDefaultNavigationTimeout(timeoutMs)
		page.on("error", (error) => {
			pageCrash = error
		})
		phase = "cdp-create"
		cdp = await page.createCDPSession()
		phase = "cpu-throttle"
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle })
		phase = "garbage-collection"
		await cdp.send("HeapProfiler.collectGarbage")
		phase = "navigation"
		await page.goto(benchmarkUrl, { waitUntil: "domcontentloaded" })
		phase = "harness-ready"
		await page.waitForFunction(() => document.querySelector("#status")?.textContent === "ready")
		phase = "export"
		return await withTimeout(
			page.evaluate(
				async (input) => {
					const harness = (
						window as unknown as {
							__HTML2PPTX_BENCHMARK__?: {
								run(payload: typeof input): Promise<BrowserRunSample>
							}
						}
					).__HTML2PPTX_BENCHMARK__
					if (!harness) throw new Error("html2pptx benchmark harness is unavailable")
					return harness.run(input)
				},
				{ scenario, shape, iteration },
			),
			timeoutMs,
		)
	} catch (error) {
		throw new BrowserIterationError(phase, pageCrash ?? error)
	} finally {
		await Promise.allSettled([
			cdp?.detach() ?? Promise.resolve(),
			page?.close() ?? Promise.resolve(),
		])
	}
}

class BrowserIterationError extends Error {
	constructor(
		readonly phase: BrowserIterationPhase,
		readonly cause: unknown,
	) {
		super(formatErrorMessage(cause), { cause })
		this.name = "BrowserIterationError"
	}
}

class BrowserIterationTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`Browser benchmark iteration exceeded ${timeoutMs} ms`)
		this.name = "BrowserIterationTimeoutError"
	}
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new BrowserIterationTimeoutError(timeoutMs)), timeoutMs)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

function createErrorSample(
	iteration: number,
	durationMs: number,
	phase: BrowserIterationPhase,
	error: unknown,
): BrowserRunErrorSample {
	return {
		status: "error",
		iteration,
		durationMs,
		error: serializeError(phase, error),
	}
}

function serializeError(
	phase: BrowserIterationPhase,
	error: unknown,
): BrowserRunErrorSample["error"] {
	const normalized = error instanceof Error ? error : new Error(String(error))
	const message = normalized.message
	const kind =
		normalized instanceof BrowserIterationTimeoutError
			? "timeout"
			: /out of memory|\boom\b|allocation failed/i.test(message)
				? "out-of-memory"
				: /page crashed|renderer process.*crash|target closed/i.test(message)
					? "page-crash"
					: "execution"
	return {
		kind,
		phase,
		name: normalized.name,
		message,
		...(normalized.stack ? { stack: normalized.stack } : {}),
	}
}

function summarizeOrNull(values: number[]): ReturnType<typeof summarize> | null {
	return values.length > 0 ? summarize(values) : null
}

function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
	process.exitCode = 1
})
