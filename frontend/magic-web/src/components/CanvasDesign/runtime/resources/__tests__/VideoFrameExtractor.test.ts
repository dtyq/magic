import { afterEach, describe, expect, it, vi } from "vitest"
import { extractVideoTailFrame } from "../video/VideoFrameExtractor"

describe("extractVideoTailFrame", () => {
	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("seeks near the end and exports an original-size JPEG", async () => {
		const listeners = new Map<string, Set<EventListener>>()
		let currentTime = 0
		const emit = (type: string) => {
			listeners.get(type)?.forEach((listener) => listener(new Event(type)))
		}
		const video = {
			duration: 12,
			videoWidth: 1920,
			videoHeight: 1080,
			readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
			seeking: false,
			crossOrigin: "",
			preload: "",
			playsInline: false,
			muted: false,
			src: "",
			addEventListener: vi.fn((type: string, listener: EventListener) => {
				const current = listeners.get(type) ?? new Set<EventListener>()
				current.add(listener)
				listeners.set(type, current)
			}),
			removeEventListener: vi.fn((type: string, listener: EventListener) => {
				listeners.get(type)?.delete(listener)
			}),
			load: vi.fn(() => queueMicrotask(() => emit("loadedmetadata"))),
			pause: vi.fn(),
			removeAttribute: vi.fn(),
			requestVideoFrameCallback: vi.fn((callback: VideoFrameRequestCallback) => {
				queueMicrotask(() => callback(0, {} as VideoFrameCallbackMetadata))
				return 1
			}),
			cancelVideoFrameCallback: vi.fn(),
		}
		Object.defineProperty(video, "currentTime", {
			get: () => currentTime,
			set: (value: number) => {
				currentTime = value
				queueMicrotask(() => emit("seeked"))
			},
		})

		const drawImage = vi.fn()
		const jpeg = new Blob(["tail"], { type: "image/jpeg" })
		const canvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage })),
			toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
				expect(type).toBe("image/jpeg")
				expect(quality).toBe(0.92)
				callback(jpeg)
			}),
		}
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName === "video") return video as unknown as HTMLVideoElement
			if (tagName === "canvas") return canvas as unknown as HTMLCanvasElement
			return document.createElement(tagName)
		})

		const result = await extractVideoTailFrame("https://example.test/video.mp4")

		expect(currentTime).toBeCloseTo(11.95)
		expect(result).toEqual({ blob: jpeg, width: 1920, height: 1080 })
		expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080)
	})

	it("falls back when requestVideoFrameCallback never fires", async () => {
		vi.useFakeTimers()
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		vi.stubGlobal("cancelAnimationFrame", vi.fn())

		const listeners = new Map<string, Set<EventListener>>()
		let currentTime = 0
		const emit = (type: string) => {
			listeners.get(type)?.forEach((listener) => listener(new Event(type)))
		}
		const video = {
			duration: 8,
			videoWidth: 1280,
			videoHeight: 720,
			readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
			seeking: false,
			crossOrigin: "",
			preload: "",
			playsInline: false,
			muted: false,
			src: "",
			addEventListener: vi.fn((type: string, listener: EventListener) => {
				const current = listeners.get(type) ?? new Set<EventListener>()
				current.add(listener)
				listeners.set(type, current)
			}),
			removeEventListener: vi.fn((type: string, listener: EventListener) => {
				listeners.get(type)?.delete(listener)
			}),
			load: vi.fn(() => queueMicrotask(() => emit("loadedmetadata"))),
			pause: vi.fn(),
			removeAttribute: vi.fn(),
			requestVideoFrameCallback: vi.fn(() => 1),
			cancelVideoFrameCallback: vi.fn(),
		}
		Object.defineProperty(video, "currentTime", {
			get: () => currentTime,
			set: (value: number) => {
				currentTime = value
				queueMicrotask(() => emit("seeked"))
			},
		})

		const drawImage = vi.fn()
		const jpeg = new Blob(["tail"], { type: "image/jpeg" })
		const canvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage })),
			toBlob: vi.fn((callback: BlobCallback) => callback(jpeg)),
		}
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName === "video") return video as unknown as HTMLVideoElement
			if (tagName === "canvas") return canvas as unknown as HTMLCanvasElement
			return document.createElement(tagName)
		})

		const resultPromise = extractVideoTailFrame("https://example.test/video.mp4")
		await vi.runAllTicks()
		await vi.advanceTimersByTimeAsync(250)

		await expect(resultPromise).resolves.toEqual({
			blob: jpeg,
			width: 1280,
			height: 720,
		})
		expect(video.requestVideoFrameCallback).toHaveBeenCalledOnce()
		expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720)
	})

	it("returns null without loading when already aborted", async () => {
		const controller = new AbortController()
		controller.abort()

		await expect(
			extractVideoTailFrame("https://example.test/video.mp4", {
				signal: controller.signal,
			}),
		).resolves.toBeNull()
	})
})
