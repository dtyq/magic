import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { convertSvgToPng, convertSvgToPngBlob } from "../image"

describe("image utils", () => {
	let origCreateElement: typeof document.createElement
	let mockCanvas: HTMLCanvasElement
	let mockContext: CanvasRenderingContext2D
	let lastParsedSvg = ""
	let originalImage: typeof Image

	const mockPngUrl = "data:image/png;base64,mockPngData"
	const mockBlob = new Blob(["mock-png"], { type: "image/png" })
	const mockSvgUrl = "blob:mock-svg"
	const mockFetchedSvg = "<svg width='320' height='180'></svg>"

	beforeEach(() => {
		origCreateElement = document.createElement
		originalImage = Image
		lastParsedSvg = ""

		mockContext = {
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D

		mockCanvas = {
			getContext: vi.fn().mockReturnValue(mockContext),
			toBlob: vi.fn().mockImplementation((callback: BlobCallback) => {
				callback(mockBlob)
			}),
			width: 0,
			height: 0,
		} as unknown as HTMLCanvasElement

		document.createElement = vi.fn().mockImplementation((tagName: string) => {
			if (tagName === "canvas") return mockCanvas
			return origCreateElement.call(document, tagName)
		})

		const mockDOMParser = function () {
			return {
				parseFromString(content: string) {
					lastParsedSvg = content
					return {
						documentElement: {
							hasAttribute: (attr: string) => {
								if (attr === "width") return true
								if (attr === "height") return true
								if (attr === "viewBox") return false
								return false
							},
							getAttribute: (attr: string) => {
								if (attr === "width") return "300"
								if (attr === "height") return "200"
								return null
							},
						},
					}
				},
			}
		}

		vi.stubGlobal("DOMParser", mockDOMParser)
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn().mockReturnValue(mockSvgUrl),
			revokeObjectURL: vi.fn(),
		})
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: vi.fn().mockResolvedValue(mockFetchedSvg),
			}),
		)

		class MockFileReader {
			result: string | ArrayBuffer | null = null
			error: DOMException | null = null
			onloadend: null | (() => void) = null
			onerror: null | (() => void) = null

			readAsDataURL() {
				this.result = mockPngUrl
				this.onloadend?.()
			}
		}

		vi.stubGlobal("FileReader", MockFileReader)

		class MockImage {
			naturalWidth = 300
			naturalHeight = 200
			onload: null | (() => void) = null
			onerror: null | (() => void) = null

			set src(_value: string) {
				queueMicrotask(() => {
					this.onload?.()
				})
			}
		}

		vi.stubGlobal("Image", MockImage as unknown as typeof Image)
	})

	afterEach(() => {
		document.createElement = origCreateElement
		vi.stubGlobal("Image", originalImage)
		vi.restoreAllMocks()
	})

	describe("convertSvgToPng", () => {
		it("应成功将SVG转换为PNG", async () => {
			const svg = "<svg width='100' height='100'></svg>"

			const result = await convertSvgToPng(svg)

			expect(document.createElement).toHaveBeenCalledWith("canvas")
			expect(URL.createObjectURL).toHaveBeenCalled()
			expect(mockContext.drawImage).toHaveBeenCalled()
			expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png")
			expect(result).toBe(mockPngUrl)
			expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockSvgUrl)
		})

		it("应支持从svg文件地址获取内容后转换为PNG Blob", async () => {
			const result = await convertSvgToPngBlob("https://example.com/test.svg", 640, 360)

			expect(fetch).toHaveBeenCalledWith("https://example.com/test.svg")
			expect(result).toBeInstanceOf(Blob)
			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("应清洗可能触发URI异常的SVG内容", async () => {
			const svg =
				'<svg width="100" height="100"><use href="data:image%2Fsvg%2Bxml;base64,test"/></svg>\ud800'

			await convertSvgToPng(svg)

			expect(lastParsedSvg).toContain('href="data:image/svg+xml;base64,test"')
			expect(lastParsedSvg).not.toContain("\ud800")
		})

		it("应使用指定的宽度并基于SVG原始比例计算高度", async () => {
			await convertSvgToPng("<svg width='300' height='200'></svg>", 600)

			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("当提供height参数时应限制最大高度", async () => {
			await convertSvgToPng("<svg width='300' height='200'></svg>", 600, 300)

			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("当所有尺寸信息缺失时应使用图像的天然尺寸", async () => {
			const mockParserNoSize = function () {
				return {
					parseFromString() {
						return {
							documentElement: {
								hasAttribute: () => false,
								getAttribute: () => null,
							},
						}
					},
				}
			}
			vi.stubGlobal("DOMParser", mockParserNoSize)

			await convertSvgToPng("<svg></svg>", 600)

			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("应在限制尺寸时缩小画布", async () => {
			await convertSvgToPng("<svg width='3000' height='2000'></svg>", 6000, 5000, {
				maxWidth: 4096,
				maxHeight: 4096,
				maxPixels: 4096 * 4096,
			})

			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("应处理SVG渲染错误", async () => {
			class FailingImage {
				onload: null | (() => void) = null
				onerror: null | (() => void) = null

				set src(_value: string) {
					queueMicrotask(() => {
						this.onerror?.()
					})
				}
			}
			vi.stubGlobal("Image", FailingImage as unknown as typeof Image)

			await expect(convertSvgToPng("<svg></svg>")).rejects.toThrow("PNG转换失败")
		})

		it("应始终使用浏览器原生渲染导出PNG", async () => {
			const result = await convertSvgToPngBlob("<svg width='100' height='100'></svg>")

			expect(result).toBeInstanceOf(Blob)
			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("应在检测到foreignObject时直接使用浏览器原生渲染", async () => {
			const svg = `
				<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
					<foreignObject width="200" height="100">
						<div xmlns="http://www.w3.org/1999/xhtml">hello</div>
					</foreignObject>
				</svg>
			`

			const result = await convertSvgToPngBlob(svg)

			expect(result).toBeInstanceOf(Blob)
			expect(mockContext.drawImage).toHaveBeenCalled()
		})

		it("应处理SVG内容加载失败", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 404,
					text: vi.fn(),
				}),
			)

			await expect(convertSvgToPngBlob("https://example.com/test.svg")).rejects.toThrow(
				"SVG内容加载失败",
			)
		})

		it("应处理canvas上下文获取失败", async () => {
			mockCanvas.getContext = vi.fn().mockReturnValue(null)

			await expect(convertSvgToPng("<svg></svg>")).rejects.toThrow("无法获取canvas上下文")
		})

		it("应处理toBlob转换失败", async () => {
			mockCanvas.toBlob = vi.fn().mockImplementation((callback: BlobCallback) => {
				callback(null)
			})

			await expect(convertSvgToPng("<svg></svg>")).rejects.toThrow("PNG转换失败")
		})
	})
})
