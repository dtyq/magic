import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("file-saver", () => {
	const saveAs = vi.fn()
	return { default: saveAs, saveAs }
})
vi.mock("html-to-image", () => ({
	toBlob: vi.fn(async () => new Blob(["fallback"], { type: "image/png" })),
}))
vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
			log: vi.fn(),
			warn: vi.fn(),
		}),
	},
}))
vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(async ({ file_ids }: { file_ids: string[] }) =>
		file_ids.map((fileId) => ({ file_id: fileId, url: `https://example.test/${fileId}.png` })),
	),
}))

const { lastZipRef, MockJSZip } = vi.hoisted(() => {
	const lastZipRef: { current: MockInst | null } = { current: null }
	type MockInst = { folders: Record<string, FakeFolder> }
	class FakeFolder {
		files: Record<string, Blob | string> = {}
		file(n: string, c: Blob | string) {
			this.files[n] = c
		}
	}
	class MockJSZip implements MockInst {
		folders: Record<string, FakeFolder> = {}
		constructor() {
			lastZipRef.current = this
		}
		folder(name: string) {
			const f = new FakeFolder()
			this.folders[name] = f
			return f
		}
		async generateAsync() {
			return new Blob(["zip"], { type: "application/zip" })
		}
	}
	return { lastZipRef, MockJSZip }
})

vi.mock("jszip", () => ({ default: MockJSZip }))

import { saveAs } from "file-saver"
import { useExportZip } from "../hooks/useExportZip"
import type { SelfMediaPost } from "../types"

describe("useExportZip", () => {
	const originalCreateElement = document.createElement.bind(document)
	const originalImage = globalThis.Image
	const drawnImageSrcs: string[] = []

	beforeEach(() => {
		lastZipRef.current = null
		drawnImageSrcs.length = 0
		vi.clearAllMocks()
	})

	afterEach(() => {
		document.createElement = originalCreateElement
		globalThis.Image = originalImage
		vi.restoreAllMocks()
	})

	it("captures cards via iframe self-screenshot and emits a zip", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [
			{ capture: captureMock, getIframeElement: () => null },
			{ capture: captureMock, getIframeElement: () => null },
		]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }, { path: "02.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				getCardRef: (_p, c) => cardRefs[c],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledTimes(2)
		expect(captureMock).toHaveBeenCalledWith(
			expect.objectContaining({ pixelRatio: 2, format: "png" }),
		)
		expect(saveAs).toHaveBeenCalledTimes(1)
		expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "test.zip")
		const folder = lastZipRef.current?.folders.First
		expect(folder?.files["01_01.png"]).toBeDefined()
		expect(folder?.files["02_02.png"]).toBeDefined()
	})

	it("names zip from post title when zipName omitted", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "My Article" },
				cards: [{ path: "cards/slide-a.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "My Article.zip")
		const folder = lastZipRef.current?.folders["My Article"]
		expect(folder?.files["01_slide-a.png"]).toBeDefined()
	})

	it("exports card files with the selected WebP extension", async () => {
		const captureMock = vi.fn(async () => "data:image/webp;base64,FFFF")
		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportZip({
				posts: [
					{
						meta: { id: "p1", title: "First" },
						cards: [{ path: "cards/slide-a.html" }],
					} as SelfMediaPost,
				],
				format: "webp",
				getCardRef: () => ({ capture: captureMock, getIframeElement: () => null }),
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ format: "webp" }))
		expect(lastZipRef.current?.folders.First?.files["01_slide-a.webp"]).toBeDefined()
	})

	it("forwards the requested pixel ratio to the capture call", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				pixelRatio: 4,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 4 }))
	})

	it("falls back to the default pixel ratio when input is invalid", async () => {
		const captureMock = vi.fn(async () => "data:image/png;base64,FFFF")
		const cardRefs = [{ capture: captureMock, getIframeElement: () => null }]
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				pixelRatio: 0,
				getCardRef: () => cardRefs[0],
			})
		})
		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2 }))
	})

	it("marks export as error when no card image can be captured", async () => {
		const { result } = renderHook(() => useExportZip())
		const posts = [
			{
				meta: { id: "p1", title: "First" },
				cards: [{ path: "01.html" }],
			},
		] as any

		await act(async () => {
			await result.current.exportZip({
				posts,
				zipName: "test",
				getCardRef: () => null,
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("error"))
		expect(saveAs).not.toHaveBeenCalled()
	})

	it("saves a partial zip and reports the pages that could not be captured", async () => {
		const captureMock = vi.fn(async () => "data:image/webp;base64,FFFF")
		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportZip({
				posts: [
					{
						meta: { id: "p1", title: "First" },
						cards: [{ path: "01.html" }, { path: "02.html" }],
					},
				] as SelfMediaPost[],
				format: "webp",
				pixelRatio: 2,
				getCardRef: (_postIdx, cardIdx) =>
					cardIdx === 0 ? { capture: captureMock, getIframeElement: () => null } : null,
				getCardPageNumber: (_postIdx, cardIdx) => [2, 5][cardIdx],
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(result.current.progress).toEqual(
			expect.objectContaining({
				exported: 1,
				failedPageNumbers: [5],
			}),
		)
		expect(saveAs).toHaveBeenCalledTimes(1)
	})

	it("retries a transient high-resolution WebP capture failure", async () => {
		const captureMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("capture timeout"))
			.mockResolvedValueOnce("data:image/webp;base64,FFFF")
		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportZip({
				posts: [
					{
						meta: { id: "p1", title: "First" },
						cards: [{ path: "01.html" }],
					},
				] as SelfMediaPost[],
				format: "webp",
				pixelRatio: 2,
				getCardRef: () => ({ capture: captureMock, getIframeElement: () => null }),
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledTimes(2)
		expect(captureMock).toHaveBeenCalledWith(
			expect.objectContaining({ format: "webp", pixelRatio: 2, timeoutMs: 45000 }),
		)
		expect(saveAs).toHaveBeenCalledTimes(1)
	})

	it("captures cards in order and stitches them into one long image", async () => {
		const outputBlob = new Blob(["long-image"], { type: "image/jpeg" })
		const mockContext = {
			drawImage: vi.fn((image: HTMLImageElement) => {
				drawnImageSrcs.push(image.src)
			}),
			fillRect: vi.fn(),
		}
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((callback: BlobCallback) => callback(outputBlob)),
		}
		document.createElement = vi.fn((tagName: string) => {
			if (tagName === "canvas") return mockCanvas as unknown as HTMLCanvasElement
			return originalCreateElement(tagName)
		}) as unknown as typeof document.createElement
		globalThis.Image = class {
			width = 1080
			height = 1440
			onload: (() => void) | null = null
			onerror: (() => void) | null = null
			private _src = ""
			get src() {
				return this._src
			}
			set src(value: string) {
				this._src = value
				this.onload?.()
			}
		} as unknown as typeof Image

		const dataUrls = [
			"data:image/png;base64,AAAA",
			"data:image/png;base64,BBBB",
			"data:image/png;base64,CCCC",
		]
		const captureMock = vi
			.fn()
			.mockResolvedValueOnce(dataUrls[0])
			.mockResolvedValueOnce(dataUrls[1])
			.mockResolvedValueOnce(dataUrls[2])
		const cardRefs = dataUrls.map(() => ({
			capture: captureMock,
			getIframeElement: () => null,
		}))
		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportLongImage({
				post: {
					meta: { id: "p1", title: "First" },
					cards: [{ path: "01.html" }, { path: "02.html" }, { path: "03.html" }],
				} as any,
				fileName: "first-long",
				pixelRatio: 2,
				format: "jpg",
				getCardRef: (cardIdx) => cardRefs[cardIdx],
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(captureMock).toHaveBeenCalledTimes(3)
		expect(drawnImageSrcs).toEqual(dataUrls)
		expect(mockCanvas.width).toBe(1080)
		expect(mockCanvas.height).toBe(4324)
		expect(mockContext.fillRect).toHaveBeenCalledTimes(3)
		expect(mockContext.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 1080, 4324)
		expect(mockContext.fillRect).toHaveBeenNthCalledWith(2, 0, 1440, 1080, 2)
		expect(mockContext.fillRect).toHaveBeenNthCalledWith(3, 0, 2882, 1080, 2)
		expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92)
		expect(saveAs).toHaveBeenCalledWith(outputBlob, "first-long.jpg")
	})

	it("does not save a partial long image when any card is missing", async () => {
		const outputBlob = new Blob(["long-image"], { type: "image/png" })
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => ({ drawImage: vi.fn() })),
			toBlob: vi.fn((callback: BlobCallback) => callback(outputBlob)),
		}
		document.createElement = vi.fn((tagName: string) => {
			if (tagName === "canvas") return mockCanvas as unknown as HTMLCanvasElement
			return originalCreateElement(tagName)
		}) as unknown as typeof document.createElement
		globalThis.Image = class {
			width = 1080
			height = 1440
			onload: (() => void) | null = null
			onerror: (() => void) | null = null
			private _src = ""
			get src() {
				return this._src
			}
			set src(value: string) {
				this._src = value
				this.onload?.()
			}
		} as unknown as typeof Image

		const captureMock = vi.fn(async () => "data:image/png;base64,AAAA")
		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportLongImage({
				post: {
					meta: { id: "p1", title: "First" },
					cards: [{ path: "01.html" }, { path: "02.html" }],
				} as any,
				fileName: "first-long",
				getCardRef: (cardIdx) =>
					cardIdx === 0 ? { capture: captureMock, getIframeElement: () => null } : null,
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("error"))
		expect(saveAs).not.toHaveBeenCalled()
	})

	it("exports a WeChat cover image by stitching square and horizontal covers", async () => {
		const outputBlob = new Blob(["wechat-cover"], { type: "image/png" })
		const mockContext = {
			drawImage: vi.fn(),
			fillStyle: "",
			fillRect: vi.fn(),
		}
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((callback: BlobCallback) => callback(outputBlob)),
		}
		document.createElement = vi.fn((tagName: string) => {
			if (tagName === "canvas") return mockCanvas as unknown as HTMLCanvasElement
			return originalCreateElement(tagName)
		}) as unknown as typeof document.createElement
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve({
					ok: true,
					blob: () => Promise.resolve(new Blob(["img"])),
				}),
			),
		)
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn((blob: Blob) => `blob:${blob.size}`),
			revokeObjectURL: vi.fn(),
		})
		globalThis.Image = class {
			width = 1600
			height = 900
			naturalWidth = 1600
			naturalHeight = 900
			onload: (() => void) | null = null
			onerror: (() => void) | null = null
			set src(_value: string) {
				this.onload?.()
			}
		} as unknown as typeof Image

		const { result } = renderHook(() => useExportZip())

		await act(async () => {
			await result.current.exportWechatCoverImage({
				post: {
					meta: { id: "wechat-1", title: "公众号封面" },
					cards: [],
					thumbnailCover: { path: "thumb.png", fileId: "thumb-file" },
					heroCover: { path: "hero.png", fileId: "hero-file" },
				} as any,
				pixelRatio: 2,
				format: "webp",
			})
		})

		await waitFor(() => expect(result.current.progress.status).toBe("done"))
		expect(mockCanvas.height).toBe(1080)
		expect(mockCanvas.width).toBe(3600)
		expect(mockContext.drawImage).toHaveBeenCalledTimes(2)
		expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.92)
		expect(saveAs).toHaveBeenCalledWith(outputBlob, "公众号封面-wechat-cover.webp")
	})
})
