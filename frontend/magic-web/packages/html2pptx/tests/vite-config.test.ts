import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import { describe, expect, it, vi } from "vitest"
import type { StreamingPackagingWorkerRequest } from "../src/packaging/streaming-types"
import { getBaseViteConfig } from "../vite.config"

const packageRoot = (() => {
	try {
		return fileURLToPath(new URL("..", import.meta.url))
	} catch {
		return resolve(process.cwd(), "packages/html2pptx")
	}
})()

describe("package build configuration", () => {
	it("emits a relative ESM worker asset and keeps the CJS workerUrl override runnable", async () => {
		const baseConfig = getBaseViteConfig({ mode: "production" })
		expect(baseConfig.base).toBe("./")
		expect(baseConfig.define).toBeUndefined()
		const outDir = await mkdtemp(resolve(packageRoot, "node_modules/.html2pptx-worker-build-"))

		try {
			await build({
				...baseConfig,
				configFile: false,
				logLevel: "silent",
				build: {
					...baseConfig.build,
					outDir,
					emptyOutDir: true,
					minify: false,
					sourcemap: false,
				},
			})

			const [esmSource, assetNames] = await Promise.all([
				readFile(resolve(outDir, "index.js"), "utf8"),
				readdir(resolve(outDir, "assets")),
			])
			expect(assetNames).toContainEqual(expect.stringMatching(/^packaging-worker-[^.]+\.js$/))
			expect(esmSource).toMatch(/["']assets\/packaging-worker-[^"']+\.js["']/)
			expect(esmSource).not.toMatch(/["']\/assets\/packaging-worker-/)

			await expectCjsWorkerUrlOverride(resolve(outDir, "index.cjs"))
		} finally {
			await rm(outDir, { recursive: true, force: true })
		}
	}, 30_000)
})

async function expectCjsWorkerUrlOverride(cjsEntry: string): Promise<void> {
	const workerUrl = new URL("https://cdn.example.test/html2pptx/packaging-worker.js")
	const workerConstructor = vi.fn(function () {
		return new ProtocolWorker()
	})
	vi.stubGlobal("Worker", workerConstructor)

	try {
		const html2pptx = createRequire(import.meta.url)(cjsEntry) as {
			createPptxStreamingExporter: typeof import("../src").createPptxStreamingExporter
		}
		const close = vi.fn()
		const exporter = html2pptx.createPptxStreamingExporter({
			createSandbox: () => ({
				iframe: {} as HTMLIFrameElement,
				window: {} as Window,
				document: {} as Document,
				render: vi.fn(),
				destroy: vi.fn(),
			}),
			pipeline: {
				prepareSlideNodes: async () => ({
					pptNodes: [],
					totalWidth: 1280,
					totalHeight: 720,
					bodyBackground: null,
				}),
			},
		})
		const handle = exporter(["page"], {
			workerUrl,
			destination: {
				kind: "sink-proxy",
				sink: { write: vi.fn(), close, abort: vi.fn() },
			},
		})

		await expect(handle.promise).resolves.toMatchObject({ pageCount: 1 })
		expect(workerConstructor).toHaveBeenCalledWith(workerUrl, { type: "module" })
		expect(close).toHaveBeenCalledOnce()
	} finally {
		vi.unstubAllGlobals()
	}
}

class ProtocolWorker {
	private messageListener?: (event: MessageEvent) => void

	postMessage(message: unknown): void {
		const request = message as StreamingPackagingWorkerRequest
		if (request.type === "start") {
			this.emit({ type: "ready" })
			return
		}
		if (request.type === "commit-slide") {
			this.emit({
				type: "slide-committed",
				requestId: request.requestId,
				summary: { bytesWritten: 0 },
			})
			return
		}
		if (request.type === "finalize") {
			this.emit({
				type: "completed",
				requestId: request.requestId,
				summary: { slideCount: 1, mediaPartCount: 0, bytesWritten: 0 },
			})
			return
		}
		if (request.type === "abort") {
			this.emit({ type: "aborted", requestId: request.requestId })
		}
	}

	addEventListener(type: string, listener: (event: MessageEvent) => void): void {
		if (type === "message") this.messageListener = listener
	}

	removeEventListener(): void {
		this.messageListener = undefined
	}

	terminate(): void {}

	private emit(data: unknown): void {
		queueMicrotask(() => this.messageListener?.({ data } as MessageEvent))
	}
}
