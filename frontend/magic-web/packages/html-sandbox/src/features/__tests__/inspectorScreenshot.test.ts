import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	encodeCanvasToScreenshotBlob,
	encodeCanvasToPngBlob,
	findVideosInCaptureClip,
	IMAGE_ENCODE_TIMEOUT_MS,
	buildCaptureClip,
	freezeIframeMotion,
	toSnapdomPageClip,
	resolveCaptureRoot,
	SCREENSHOT_WEBP_MIME_TYPE,
	SCREENSHOT_WEBP_QUALITY,
	SYNC_PNG_ENCODE_MAX_PIXELS,
	ScreenshotCancelledError,
	VIDEO_DATA_WAIT_TIMEOUT_MS,
	waitForCaptureVideosInClip,
} from "../inspectorScreenshot"

describe("encodeCanvasToPngBlob", () => {
	const previousOffscreenCanvas = globalThis.OffscreenCanvas

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
		if (previousOffscreenCanvas) {
			globalThis.OffscreenCanvas = previousOffscreenCanvas
		} else {
			Reflect.deleteProperty(globalThis, "OffscreenCanvas")
		}
	})

	beforeEach(() => {
		Reflect.deleteProperty(globalThis, "OffscreenCanvas")
	})

	it("encodes with async toBlob instead of toDataURL", async () => {
		const canvas = document.createElement("canvas")
		canvas.width = 80
		canvas.height = 60
		const blob = new Blob(["png"], { type: "image/png" })
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback) => {
				callback(blob)
			})
		const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")

		await expect(encodeCanvasToPngBlob(canvas)).resolves.toBe(blob)
		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png")
		expect(toDataURL).not.toHaveBeenCalled()
	})

	it("retries a smaller canvas when toBlob stalls on a large screenshot", async () => {
		vi.useFakeTimers()
		const canvas = document.createElement("canvas")
		canvas.width = 1024
		canvas.height = 1024
		expect(canvas.width * canvas.height).toBeGreaterThan(SYNC_PNG_ENCODE_MAX_PIXELS)

		const retriedBlob = new Blob(["retry"], { type: "image/png" })
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as never)
		const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
			this: HTMLCanvasElement,
			callback,
		) {
			if (this.width < 1024) {
				callback(retriedBlob)
				return
			}
		})
		const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")

		const pending = encodeCanvasToPngBlob(canvas)
		await vi.advanceTimersByTimeAsync(IMAGE_ENCODE_TIMEOUT_MS)
		await expect(pending).resolves.toBe(retriedBlob)
		expect(toBlob.mock.calls.length).toBeGreaterThan(1)
		expect(toDataURL).not.toHaveBeenCalled()
	})

	it("does not start encoding when already cancelled", async () => {
		const canvas = document.createElement("canvas")
		canvas.width = 80
		canvas.height = 60
		const blob = new Blob(["png"], { type: "image/png" })
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback) => {
				callback(blob)
			})
		const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")

		await expect(encodeCanvasToPngBlob(canvas, () => true)).rejects.toBeInstanceOf(
			ScreenshotCancelledError,
		)
		expect(toBlob).not.toHaveBeenCalled()
		expect(toDataURL).not.toHaveBeenCalled()
	})

	it("does not fall back after cancel once the first toBlob times out", async () => {
		vi.useFakeTimers()
		const canvas = document.createElement("canvas")
		canvas.width = 1024
		canvas.height = 1024
		const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => {})
		const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as never)
		const OffscreenCtor = vi.fn()
		globalThis.OffscreenCanvas = OffscreenCtor as never

		let aborted = false
		const pending = encodeCanvasToPngBlob(canvas, () => aborted)
		const cancelled = expect(pending).rejects.toBeInstanceOf(ScreenshotCancelledError)
		aborted = true
		await vi.advanceTimersByTimeAsync(IMAGE_ENCODE_TIMEOUT_MS)
		await cancelled
		expect(toBlob).toHaveBeenCalledTimes(1)
		expect(OffscreenCtor).not.toHaveBeenCalled()
		expect(toDataURL).not.toHaveBeenCalled()
	})

	it("does not scale and retry after cancel once Offscreen encoding finishes", async () => {
		vi.useFakeTimers()
		const canvas = document.createElement("canvas")
		canvas.width = 1024
		canvas.height = 1024
		const retriedBlob = new Blob(["retry"], { type: "image/png" })
		const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
			this: HTMLCanvasElement,
			callback,
		) {
			if (this.width < 1024) {
				callback(retriedBlob)
				return
			}
		})
		const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as never)
		class FakeOffscreen {
			constructor(
				public width: number,
				public height: number,
			) {}
			getContext() {
				return { drawImage: vi.fn() }
			}
			convertToBlob() {
				return new Promise<Blob>(() => {})
			}
		}
		globalThis.OffscreenCanvas = FakeOffscreen as never

		let aborted = false
		const pending = encodeCanvasToPngBlob(canvas, () => aborted)
		const cancelled = expect(pending).rejects.toBeInstanceOf(ScreenshotCancelledError)
		await vi.advanceTimersByTimeAsync(IMAGE_ENCODE_TIMEOUT_MS)
		aborted = true
		await vi.advanceTimersByTimeAsync(IMAGE_ENCODE_TIMEOUT_MS)
		await cancelled
		expect(toBlob).toHaveBeenCalledTimes(1)
		expect(toDataURL).not.toHaveBeenCalled()
	})
})

function mockBoundingClientRect(
	element: Element,
	rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
) {
	vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
		x: rect.left,
		y: rect.top,
		left: rect.left,
		top: rect.top,
		right: rect.left + rect.width,
		bottom: rect.top + rect.height,
		width: rect.width,
		height: rect.height,
		toJSON: () => ({}),
	} as DOMRect)
}

describe("findVideosInCaptureClip", () => {
	it("returns only videos intersecting the capture clip", () => {
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 400, height: 400 })

		const inside = document.createElement("video")
		root.appendChild(inside)
		mockBoundingClientRect(inside, { left: 20, top: 20, width: 120, height: 80 })

		const outside = document.createElement("video")
		root.appendChild(outside)
		mockBoundingClientRect(outside, { left: 300, top: 300, width: 80, height: 60 })

		const videos = findVideosInCaptureClip(root, { x: 0, y: 0, width: 200, height: 200 })
		expect(videos).toEqual([inside])
		root.remove()
	})
})

describe("waitForCaptureVideosInClip", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it("waits for loadeddata before resolving", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_NOTHING,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(0)
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
		})
		video.dispatchEvent(new Event("loadeddata"))
		await vi.advanceTimersByTimeAsync(200)
		const restore = await pending
		restore()
		root.remove()
		vi.useRealTimers()
	})

	it("does not block forever when video loading fails", async () => {
		vi.useFakeTimers()
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_NOTHING,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(VIDEO_DATA_WAIT_TIMEOUT_MS + 200)
		const restore = await pending
		restore()
		root.remove()
		vi.useRealTimers()
	})

	it("does not leave a ready video muted after capture wait", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		video.muted = false
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(200)
		const restore = await pending
		restore()
		expect(video.muted).toBe(false)
		root.remove()
		vi.useRealTimers()
	})

	it("overlays the poster when the video has no decoded frame", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const poster =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		const video = document.createElement("video")
		video.poster = poster
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_NOTHING,
		})
		Object.defineProperty(video, "videoWidth", {
			configurable: true,
			get: () => 0,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(VIDEO_DATA_WAIT_TIMEOUT_MS + 200)
		const restore = await pending
		const overlay = root.querySelector<HTMLImageElement>("img[data-magic-video-poster-capture]")
		expect(overlay).toBeInstanceOf(HTMLImageElement)
		expect(overlay?.src).toBe(poster)
		expect(video.muted).toBe(false)
		expect(root.contains(video)).toBe(false)
		restore()
		expect(root.contains(video)).toBe(true)
		expect(root.querySelector("img[data-magic-video-poster-capture]")).toBeNull()
		root.remove()
		vi.useRealTimers()
	})

	it("inlines a remote poster so snapdom can paint it", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Blob(["poster-bytes"], { type: "image/png" }), {
				status: 200,
				headers: { "content-type": "image/png" },
			}),
		)
		vi.stubGlobal(
			"FileReader",
			class {
				result: string | null = null
				onload: ((event: ProgressEvent<FileReader>) => void) | null = null
				onerror: ((event: ProgressEvent<FileReader>) => void) | null = null
				readAsDataURL() {
					this.result = "data:image/png;base64,ZmFrZQ=="
					this.onload?.(null as never)
				}
			},
		)
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		video.poster = "https://cdn.example/cover.png"
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_NOTHING,
		})
		Object.defineProperty(video, "videoWidth", {
			configurable: true,
			get: () => 0,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(VIDEO_DATA_WAIT_TIMEOUT_MS + 200)
		const restore = await pending
		const overlay = root.querySelector<HTMLImageElement>("img[data-magic-video-poster-capture]")
		expect(overlay?.src).toBe("data:image/png;base64,ZmFrZQ==")
		expect(fetch).toHaveBeenCalledWith(
			"https://cdn.example/cover.png",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		)
		restore()
		root.remove()
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it("falls back to the poster URL when fetch hangs", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		vi.spyOn(globalThis, "fetch").mockImplementation(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("The operation was aborted.", "AbortError"))
					})
				}),
		)
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		video.muted = false
		video.poster = "https://cdn.example/cover.png"
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_NOTHING,
		})
		Object.defineProperty(video, "videoWidth", {
			configurable: true,
			get: () => 0,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(VIDEO_DATA_WAIT_TIMEOUT_MS * 2 + 400)
		const restore = await pending
		const overlay = root.querySelector<HTMLImageElement>("img[data-magic-video-poster-capture]")
		expect(overlay?.src).toBe("https://cdn.example/cover.png")
		expect(video.muted).toBe(false)
		restore()
		expect(root.contains(video)).toBe(true)
		root.remove()
	})

	it("does not overlay the poster when the video already has a frame", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		video.poster =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
		})
		Object.defineProperty(video, "videoWidth", {
			configurable: true,
			get: () => 640,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(200)
		const restore = await pending
		expect(root.querySelector("img[data-magic-video-poster-capture]")).toBeNull()
		restore()
		root.remove()
		vi.useRealTimers()
	})

	it("restores muted and currentTime after seeking a metadata-only video", async () => {
		vi.useFakeTimers()
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(0), 0) as unknown as number
		})
		const root = document.createElement("div")
		document.body.appendChild(root)
		mockBoundingClientRect(root, { left: 0, top: 0, width: 200, height: 200 })

		const video = document.createElement("video")
		video.muted = false
		video.currentTime = 12
		Object.defineProperty(video, "readyState", {
			configurable: true,
			get: () => HTMLMediaElement.HAVE_METADATA,
		})
		Object.defineProperty(video, "duration", {
			configurable: true,
			get: () => 30,
		})
		root.appendChild(video)
		mockBoundingClientRect(video, { left: 10, top: 10, width: 120, height: 80 })

		const pending = waitForCaptureVideosInClip(root, { x: 0, y: 0, width: 200, height: 200 })
		await vi.advanceTimersByTimeAsync(VIDEO_DATA_WAIT_TIMEOUT_MS * 2 + 400)
		const restore = await pending
		expect(video.muted).toBe(true)
		restore()
		expect(video.muted).toBe(false)
		expect(video.currentTime).toBe(12)
		root.remove()
		vi.useRealTimers()
	})
})

describe("encodeCanvasToScreenshotBlob", () => {
	afterEach(() => vi.restoreAllMocks())

	it("encodes tiny canvases with a synchronous PNG data URL", async () => {
		const canvas = document.createElement("canvas")
		canvas.width = 8
		canvas.height = 8
		const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
		const toDataURL = vi
			.spyOn(HTMLCanvasElement.prototype, "toDataURL")
			.mockReturnValue("data:image/png;base64,QQ==")

		const blob = await encodeCanvasToScreenshotBlob(canvas)
		expect(blob.type).toBe("image/png")
		expect(toDataURL).toHaveBeenCalledWith("image/png")
		expect(toBlob).not.toHaveBeenCalled()
	})

	it("prefers high-quality WebP when the browser supports it", async () => {
		const canvas = document.createElement("canvas")
		canvas.width = 300
		canvas.height = 300
		const webpBlob = new Blob(["webp"], { type: SCREENSHOT_WEBP_MIME_TYPE })
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback, type, quality) => {
				callback(webpBlob)
				expect(type).toBe(SCREENSHOT_WEBP_MIME_TYPE)
				expect(quality).toBe(SCREENSHOT_WEBP_QUALITY)
			})

		await expect(encodeCanvasToScreenshotBlob(canvas)).resolves.toBe(webpBlob)
		expect(toBlob).toHaveBeenCalledOnce()
	})

	it("falls back to PNG when WebP encoding is unavailable", async () => {
		const canvas = document.createElement("canvas")
		canvas.width = 300
		canvas.height = 300
		const pngBlob = new Blob(["png"], { type: "image/png" })
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, "toBlob")
			.mockImplementation((callback) => callback(pngBlob))

		await expect(encodeCanvasToScreenshotBlob(canvas)).resolves.toBe(pngBlob)
		expect(toBlob).toHaveBeenCalledTimes(2)
		expect(toBlob.mock.calls.map(([, type]) => type)).toEqual([
			SCREENSHOT_WEBP_MIME_TYPE,
			"image/png",
		])
	})
})

describe("resolveCaptureRoot", () => {
	it("prefers the requested selector over document.body", () => {
		const root = document.createElement("section")
		root.id = "hero"
		document.body.append(root)
		try {
			expect(
				resolveCaptureRoot({ left: 0, top: 0, width: 10, height: 10 }, "section#hero"),
			).toBe(root)
		} finally {
			root.remove()
		}
	})
})

describe("buildCaptureClip", () => {
	it("captures the full root when the selector matched", () => {
		expect(
			buildCaptureClip(
				{ left: 40, top: 80, width: 200, height: 50 },
				{ left: 800, top: 400, width: 1308, height: 122 },
				true,
			),
		).toEqual({ x: 0, y: 0, width: 200, height: 50 })
	})

	it("keeps a 1px clip when a mismatched selection misses the root", () => {
		expect(
			buildCaptureClip(
				{ left: 40, top: 80, width: 200, height: 50 },
				{ left: 800, top: 400, width: 1308, height: 122 },
				false,
			),
		).toEqual({ x: 760, y: 320, width: 1, height: 1 })
	})
})

describe("toSnapdomPageClip", () => {
	it("maps a full-element local clip onto the element's page box", () => {
		expect(
			toSnapdomPageClip(
				{ left: 165.5, top: 229.73 },
				{ x: 0, y: 0, width: 688, height: 105 },
			),
		).toEqual({ x: 165.5, y: 229.73, width: 688, height: 105 })
	})
})

describe("freezeIframeMotion", () => {
	it("pauses animations instead of injecting a global stylesheet", () => {
		const animation = {
			currentTime: 80,
			playState: "running",
			pause: vi.fn(),
			play: vi.fn(),
			finish: vi.fn(),
		} as unknown as Animation
		const previousGetAnimations = document.getAnimations
		Object.defineProperty(document, "getAnimations", {
			configurable: true,
			value: () => [animation],
		})
		try {
			const restore = freezeIframeMotion()
			expect(animation.pause).toHaveBeenCalledOnce()
			expect(document.querySelector("[data-magic-inspector-screenshot]")).toBeNull()
			restore()
			expect(animation.play).toHaveBeenCalledOnce()
		} finally {
			Object.defineProperty(document, "getAnimations", {
				configurable: true,
				value: previousGetAnimations,
			})
		}
	})
})
