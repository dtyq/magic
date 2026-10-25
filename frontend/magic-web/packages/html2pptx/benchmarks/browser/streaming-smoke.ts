import type { AddressInfo } from "node:net"
import { performance } from "node:perf_hooks"
import puppeteer, { type Page } from "puppeteer"
import { createServer, type ViteDevServer } from "vite"
import {
	assertKnownArgs,
	parseArgs,
	readPositiveInteger,
	readPositiveNumber,
	readTarget,
} from "../shared/cli"
import { emitJson } from "../shared/output"
import type { BenchmarkTarget } from "../shared/types"
import type { StreamingSmokeResult } from "./streaming-smoke-app"
import { resolveChromeExecutable } from "./executable"
import { createBenchmarkViteConfig } from "./vite.config"

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	assertKnownArgs(args, {
		values: ["target", "slides", "cpu-throttle", "timeout-ms", "chrome-path", "output"],
		flags: ["headful", "media"],
	})
	const target = readTarget(args)
	const slides = readPositiveInteger(args, "slides", 300)
	const cpuThrottle = readPositiveNumber(args, "cpu-throttle", 4)
	const timeoutMs = readPositiveInteger(args, "timeout-ms", 900_000)
	const headful = args.flags.has("headful")
	const chromeExecutable = resolveChromeExecutable(args.values.get("chrome-path"), headful)
	let viteServer: ViteDevServer | null = null
	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

	try {
		viteServer = await createServer(createBenchmarkViteConfig(target))
		await viteServer.listen()
		const address = viteServer.httpServer?.address() as AddressInfo | null
		if (!address) throw new Error("Vite streaming smoke server did not expose an address")
		const smokeUrl = `http://127.0.0.1:${address.port}/streaming-smoke.html`
		browser = await puppeteer.launch({
			headless: !headful,
			executablePath: chromeExecutable,
			protocolTimeout: timeoutMs + 60_000,
			args: ["--enable-precise-memory-info"],
		})
		const context = await browser.createBrowserContext()
		try {
			const page = await context.newPage()
			const workerUrls: string[] = []
			page.on("workercreated", (worker) => workerUrls.push(worker.url()))
			page.setDefaultTimeout(timeoutMs)
			page.setDefaultNavigationTimeout(timeoutMs)
			const cdp = await page.createCDPSession()
			try {
				await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle })
				await cdp.send("HeapProfiler.collectGarbage")
				await page.goto(smokeUrl, { waitUntil: "domcontentloaded" })
				await page.waitForFunction(
					() => document.querySelector("#status")?.textContent === "ready",
				)
				const startedAt = performance.now()
				const result = await withTimeout(
					runSmoke(page, slides, args.flags.has("media")),
					timeoutMs,
				)
				const wallDurationMs = performance.now() - startedAt
				assertSmokeResult(result, slides, workerUrls, target)
				emitJson(
					{
						benchmark: "html2pptx-streaming-opfs-smoke",
						generatedAt: new Date().toISOString(),
						browserVersion: await browser.version(),
						chromeExecutable,
						target,
						slides,
						cpuThrottle,
						wallDurationMs,
						workerUrls,
						result,
					},
					args.values.get("output"),
				)
			} finally {
				await cdp.detach().catch(() => undefined)
				await page.close().catch(() => undefined)
			}
		} finally {
			await context.close().catch(() => undefined)
		}
	} finally {
		await Promise.allSettled([
			browser?.close() ?? Promise.resolve(),
			viteServer?.close() ?? Promise.resolve(),
		])
	}
}

function runSmoke(
	page: Page,
	slides: number,
	includeMedia: boolean,
): Promise<StreamingSmokeResult> {
	return page.evaluate(
		async ({ slideCount, useMedia }) => {
			const harness = window.__HTML2PPTX_STREAMING_SMOKE__
			if (!harness) throw new Error("html2pptx streaming smoke harness is unavailable")
			return harness.run({ slides: slideCount, includeMedia: useMedia })
		},
		{ slideCount: slides, useMedia: includeMedia },
	)
}

function assertSmokeResult(
	result: StreamingSmokeResult,
	expectedSlides: number,
	workerUrls: string[],
	target: BenchmarkTarget,
): void {
	const expectedWorkerUrl =
		target === "dist"
			? /(?:^|\/)assets\/packaging-worker-[^/?]+\.js(?:\?|$)/
			: /(?:^|\/)workers\/packaging-worker\.ts(?:\?|$)/
	if (workerUrls.length === 0 || !workerUrls.some((url) => expectedWorkerUrl.test(url))) {
		throw new Error(`No real html2pptx Packaging Worker was created: ${workerUrls.join(", ")}`)
	}
	if (!result.opfsAvailable) throw new Error("OPFS was not available")
	if (
		!/FileSystemWritableFileStream/.test(
			`${result.destinationConstructor} ${result.destinationTag}`,
		)
	) {
		throw new Error(
			`Destination was not a FileSystemWritableFileStream: ${result.destinationConstructor} ${result.destinationTag}`,
		)
	}
	if (result.summary.pageCount !== expectedSlides) {
		throw new Error(
			`Streaming summary reported ${result.summary.pageCount} slides; expected ${expectedSlides}`,
		)
	}
	if (result.slideXmlCount !== expectedSlides || result.missingSlideNumbers.length > 0) {
		throw new Error(
			`Archive contains ${result.slideXmlCount} slide XML parts; missing ${result.missingSlideNumbers.join(", ")}`,
		)
	}
	if (BigInt(result.summary.bytesWritten) !== BigInt(result.fileBytes)) {
		throw new Error(
			`Summary bytes (${result.summary.bytesWritten}) differ from OPFS file bytes (${result.fileBytes})`,
		)
	}
	if (result.totalChunkBytes !== result.fileBytes || result.hashBytesRead !== result.fileBytes) {
		throw new Error(
			`Bounded validation byte counts differ from OPFS file bytes: sink=${result.totalChunkBytes}, hash=${result.hashBytesRead}, file=${result.fileBytes}`,
		)
	}
	if (!/^[0-9a-f]{64}$/.test(result.artifactSha256)) {
		throw new Error(`Artifact SHA-256 is invalid: ${result.artifactSha256}`)
	}
	if (
		result.chunkCount <= 0 ||
		result.maxChunkBytes <= 0 ||
		result.maxInFlightBytes < result.maxChunkBytes ||
		result.maxInFlightChunks <= 0
	) {
		throw new Error("Streaming sink telemetry did not observe a valid output chunk")
	}
	if (
		result.writeWaitCount !== result.chunkCount ||
		result.ackWaitCount !== result.chunkCount ||
		result.sinkFailedWriteCount !== 0 ||
		result.sinkCloseCount !== 1 ||
		result.sinkAbortCount !== 0
	) {
		throw new Error(
			`Streaming sink terminal telemetry is invalid: chunks=${result.chunkCount}, writeWaits=${result.writeWaitCount}, ACKs=${result.ackWaitCount}, failures=${result.sinkFailedWriteCount}, closes=${result.sinkCloseCount}, aborts=${result.sinkAbortCount}`,
		)
	}
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`Streaming smoke exceeded ${timeoutMs} ms`)),
					timeoutMs,
				)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
	process.exitCode = 1
})
