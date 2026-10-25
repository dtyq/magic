import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../core/Canvas"
import { SubmitImageWorkerManager } from "../upload/SubmitImageWorkerManager"

describe("SubmitImageWorkerManager", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("does not recreate its worker when OSS resolution finishes after destroy", async () => {
		let resolveOssSrc: ((value: string) => void) | undefined
		const ensureFreshOssSrc = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveOssSrc = resolve
				}),
		)
		const workerConstructor = vi.fn(function WorkerMock() {
			throw new Error("Worker must not be recreated after destroy")
		})
		vi.stubGlobal("Worker", workerConstructor)
		const manager = new SubmitImageWorkerManager({
			canvas: { imageResourceManager: { ensureFreshOssSrc } } as unknown as Canvas,
		})

		const resultPromise = manager.createExtendImagesInWorker({
			src: "./images/source.png",
			elementSize: { width: 100, height: 100 },
			frame: { x: 0, y: 0, width: 100, height: 100 },
			imageRect: { x: 0, y: 0, width: 100, height: 100 },
		})
		manager.destroy()
		resolveOssSrc?.("https://example.com/source.png")

		await expect(resultPromise).resolves.toBeNull()
		expect(workerConstructor).not.toHaveBeenCalled()
	})
})
