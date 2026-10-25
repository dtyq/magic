import { exportPPTXStreaming } from "@html2pptx-benchmark-target"
import { createBrowserScenarioSlides } from "./scenarios"
import { IncrementalSha256, sha256Blob } from "./streaming-smoke-support"
import type { ScenarioName, ScenarioShape } from "../shared/types"

interface BrowserRunInput {
	scenario: ScenarioName
	shape: ScenarioShape
	iteration: number
}

interface BrowserBenchmarkSink {
	write(chunk: Uint8Array): void | Promise<void>
	close(): void | Promise<void>
	abort?(reason?: unknown): void | Promise<void>
}

interface BrowserBenchmarkDestination {
	destination: BrowserBenchmarkSink
	bytesWritten(): number
	readSha256(): Promise<string>
	cleanup(): Promise<void>
}

export interface BrowserRunSample {
	status: "ok"
	iteration: number
	durationMs: number
	outputBytes: number
	artifactSha256: string
	hashDurationMs: number
	sampledBaselineJsHeapBytes: number | null
	sampledExportPeakJsHeapBytes: number | null
	sampledPeakJsHeapBytes: number | null
	heapSampleIntervalMs: number
	longTaskCount: number
	longTaskTotalMs: number
	longTaskMaxMs: number
	slideProgressEvents: number
}

declare global {
	interface Window {
		__HTML2PPTX_BENCHMARK__?: {
			run(input: BrowserRunInput): Promise<BrowserRunSample>
		}
	}

	interface Performance {
		memory?: {
			usedJSHeapSize: number
			totalJSHeapSize: number
			jsHeapSizeLimit: number
		}
	}
}

window.__HTML2PPTX_BENCHMARK__ = { run: runBenchmark }
document.querySelector("#status")!.textContent = "ready"

async function runBenchmark(input: BrowserRunInput): Promise<BrowserRunSample> {
	const htmlSlides = createBrowserScenarioSlides(input.scenario, input.shape, location.origin)
	const heap = startHeapSampler()
	const longTasks = startLongTaskObserver()
	try {
		let slideProgressEvents = 0
		const startedAt = performance.now()
		const output = await createBrowserBenchmarkDestination()
		try {
			const summary = await exportPPTXStreaming(htmlSlides, {
				fileName: `html2pptx-${input.scenario}.pptx`,
				logLevel: "error",
				destination: output.destination,
				onProgress: (progress) => {
					if (progress.phase === "prepare-page") slideProgressEvents += 1
				},
			}).promise
			const durationMs = performance.now() - startedAt
			const sampledExportPeakJsHeapBytes = heap.currentPeak()
			const longTaskSummary = longTasks.stop()
			const hashStartedAt = performance.now()
			const artifactSha256 = await output.readSha256()
			const hashDurationMs = performance.now() - hashStartedAt
			const heapSummary = heap.stop()

			return {
				status: "ok",
				iteration: input.iteration,
				durationMs,
				outputBytes: output.bytesWritten(),
				artifactSha256,
				hashDurationMs,
				sampledBaselineJsHeapBytes: heapSummary.baseline,
				sampledExportPeakJsHeapBytes,
				sampledPeakJsHeapBytes: heapSummary.peak,
				heapSampleIntervalMs: heapSummary.sampleIntervalMs,
				longTaskCount: longTaskSummary.count,
				longTaskTotalMs: longTaskSummary.totalMs,
				longTaskMaxMs: longTaskSummary.maxMs,
				slideProgressEvents,
			}
		} finally {
			await output.cleanup()
		}
	} finally {
		heap.stop()
		longTasks.stop()
	}
}

async function createBrowserBenchmarkDestination(): Promise<BrowserBenchmarkDestination> {
	const storage = navigator.storage as StorageManager & {
		getDirectory?: () => Promise<FileSystemDirectoryHandle>
	}
	if (typeof storage.getDirectory === "function") {
		try {
			const root = await storage.getDirectory()
			const fileName = `html2pptx-browser-${crypto.randomUUID()}.pptx`
			const fileHandle = await root.getFileHandle(fileName, { create: true })
			const writable = await fileHandle.createWritable({ keepExistingData: false })
			let bytes = 0
			return {
				destination: {
					write: async (chunk) => {
						await writable.write(chunk)
						bytes += chunk.byteLength
					},
					close: () => writable.close(),
					abort: (reason) => writable.abort(reason),
				},
				bytesWritten: () => bytes,
				readSha256: async () => {
					const file = await fileHandle.getFile()
					return (await sha256Blob(file)).sha256
				},
				cleanup: () => root.removeEntry(fileName).catch(() => undefined),
			}
		} catch {
			// Fall through to the bounded counting/hash sink when OPFS setup is
			// unavailable (for example, private browsing or exhausted quota).
		}
	}

	const hash = new IncrementalSha256()
	let bytes = 0
	let aborted = false
	return {
		destination: {
			write(chunk) {
				if (aborted) throw new Error("Benchmark destination was aborted")
				bytes += chunk.byteLength
				hash.update(chunk)
			},
			close() {},
			abort() {
				aborted = true
			},
		},
		bytesWritten: () => bytes,
		readSha256: async () => hash.digestHex(),
		cleanup: async () => undefined,
	}
}

function startHeapSampler(): {
	currentPeak(): number | null
	stop(): { baseline: number | null; peak: number | null; sampleIntervalMs: number }
} {
	const sampleIntervalMs = 20
	const read = () => performance.memory?.usedJSHeapSize ?? null
	const baseline = read()
	let peak = baseline
	let stopped = false
	const observe = () => {
		const current = read()
		if (current !== null) peak = peak === null ? current : Math.max(peak, current)
	}
	const timer = window.setInterval(observe, sampleIntervalMs)
	return {
		currentPeak() {
			observe()
			return peak
		},
		stop() {
			if (!stopped) {
				stopped = true
				window.clearInterval(timer)
				observe()
			}
			return { baseline, peak, sampleIntervalMs }
		},
	}
}

function startLongTaskObserver(): {
	stop(): { count: number; totalMs: number; maxMs: number }
} {
	const durations: number[] = []
	let observer: PerformanceObserver | null = null
	let stopped = false
	if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
		observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) durations.push(entry.duration)
		})
		observer.observe({ entryTypes: ["longtask"] })
	}
	return {
		stop() {
			if (!stopped) {
				stopped = true
				observer?.takeRecords().forEach((entry) => durations.push(entry.duration))
				observer?.disconnect()
			}
			return {
				count: durations.length,
				totalMs: durations.reduce((sum, value) => sum + value, 0),
				maxMs: durations.length > 0 ? Math.max(...durations) : 0,
			}
		},
	}
}
