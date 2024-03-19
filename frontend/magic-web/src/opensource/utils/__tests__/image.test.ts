import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { convertSvgToPng } from "../image"

describe("image utils", () => {
	// 模拟浏览器环境
	let origCreateElement: typeof document.createElement
	let mockCanvas: HTMLCanvasElement
	let mockContext: CanvasRenderingContext2D
	let mockImage: HTMLImageElement

	// 模拟toDataURL方法的返回值
	const mockPngUrl = "data:image/png;base64,mockPngData"

	beforeEach(() => {
		// 保存原始方法
		origCreateElement = document.createElement

		// 模拟context
		mockContext = {
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D

		// 模拟canvas
		mockCanvas = {
			getContext: vi.fn().mockReturnValue(mockContext),
			toDataURL: vi.fn().mockReturnValue(mockPngUrl),
			width: 0,
			height: 0,
		} as unknown as HTMLCanvasElement

		// 模拟Image
		mockImage = {} as HTMLImageElement
		Object.defineProperties(mockImage, {
			onload: { value: null, writable: true },
			onerror: { value: null, writable: true },
			src: { value: "", writable: true },
			naturalWidth: { value: 300 },
			naturalHeight: { value: 200 },
		})

		// 模拟document.createElement
		document.createElement = vi.fn().mockImplementation((tagName: string) => {
			if (tagName === "canvas") {
				return mockCanvas
			}
			if (tagName === "img") {
				// 使用setTimeout模拟图片异步加载
				setTimeout(() => {
					if (mockImage.onload && typeof mockImage.onload === "function") {
						mockImage.onload.call(mockImage, new Event("load"))
					}
				}, 0)
				return mockImage
			}
			return origCreateElement.call(document, tagName)
		})

		// 模拟DOMParser
		const mockDOMParser = function () {
			return {
				parseFromString() {
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

		// 模拟btoa (Base64编码)
		vi.stubGlobal("btoa", () => "mockBase64String")

		// 模拟encodeURIComponent
		vi.stubGlobal("encodeURIComponent", () => "encodedSvg")

		// 模拟unescape
		vi.stubGlobal("unescape", () => "unescapedSvg")
	})

	afterEach(() => {
		// 恢复原始方法
		document.createElement = origCreateElement
		vi.restoreAllMocks()
	})

	describe("convertSvgToPng", () => {
		it("应成功将SVG转换为PNG", async () => {
			const svg = "<svg width='100' height='100'></svg>"

			const result = await convertSvgToPng(svg)

			// 验证创建canvas和图片元素
			expect(document.createElement).toHaveBeenCalledWith("canvas")
			expect(document.createElement).toHaveBeenCalledWith("img")

			// 验证canvas的toDataURL被调用
			expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/png")

			// 验证返回正确的数据URL
			expect(result).toBe(mockPngUrl)
		})

		it("应使用指定的宽度并基于SVG原始比例计算高度", async () => {
			const svg = "<svg width='300' height='200'></svg>"
			const width = 600

			await convertSvgToPng(svg, width)

			// 验证canvas尺寸设置正确
			expect(mockCanvas.width).toBe(600)
			expect(mockCanvas.height).toBe(400) // 保持300:200的原始比例

			// 验证drawImage调用正确
			expect(mockContext.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 600, 400)
		})

		it("当提供height参数时应限制最大高度", async () => {
			const svg = "<svg width='300' height='200'></svg>"
			const width = 600
			const height = 300 // 比例计算应为400，但我们限制为300

			await convertSvgToPng(svg, width, height)

			// 验证canvas尺寸被正确限制
			expect(mockCanvas.width).toBe(600)
			expect(mockCanvas.height).toBe(300) // 被限制为300

			// 验证drawImage调用
			expect(mockContext.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 600, 300)
		})

		it("当height小于按比例计算的高度时应限制高度", async () => {
			// 模拟SVG比例为2:1
			const mockParser21 = function () {
				return {
					parseFromString() {
						return {
							documentElement: {
								hasAttribute: (attr: string) => {
									return attr === "width" || attr === "height"
								},
								getAttribute: (attr: string) => {
									if (attr === "width") return "200"
									if (attr === "height") return "100" // 2:1比例
									return null
								},
							},
						}
					},
				}
			}
			vi.stubGlobal("DOMParser", mockParser21)

			const svg = "<svg width='200' height='100'></svg>" // 2:1比例
			const width = 500
			const height = 200 // 按比例应为250，但我们限制为200

			await convertSvgToPng(svg, width, height)

			expect(mockCanvas.width).toBe(500)
			expect(mockCanvas.height).toBe(200) // 验证被限制为200
		})

		it("当未指定height时不应限制高度", async () => {
			// 模拟SVG比例为1:2
			const mockParser12 = function () {
				return {
					parseFromString() {
						return {
							documentElement: {
								hasAttribute: (attr: string) => {
									return attr === "width" || attr === "height"
								},
								getAttribute: (attr: string) => {
									if (attr === "width") return "100"
									if (attr === "height") return "200" // 1:2比例
									return null
								},
							},
						}
					},
				}
			}
			vi.stubGlobal("DOMParser", mockParser12)

			const svg = "<svg width='100' height='200'></svg>" // 1:2比例
			const width = 300

			await convertSvgToPng(svg, width)

			expect(mockCanvas.width).toBe(300)
			expect(mockCanvas.height).toBe(600) // 应保持1:2的原始比例
		})

		it("当SVG没有宽高属性时应从viewBox获取比例", async () => {
			// 模拟只有viewBox的SVG
			const mockParserViewBox = function () {
				return {
					parseFromString() {
						return {
							documentElement: {
								hasAttribute: (attr: string) => {
									if (attr === "width") return false
									if (attr === "height") return false
									if (attr === "viewBox") return true
									return false
								},
								getAttribute: (attr: string) => {
									if (attr === "viewBox") return "0 0 400 300"
									return null
								},
							},
						}
					},
				}
			}
			vi.stubGlobal("DOMParser", mockParserViewBox)

			const svg = "<svg viewBox='0 0 400 300'></svg>"
			const width = 800

			await convertSvgToPng(svg, width)

			expect(mockCanvas.width).toBe(800)
			expect(mockCanvas.height).toBe(600) // 保持400:300的原始比例
		})

		it("当所有尺寸信息缺失时应使用图像的天然尺寸", async () => {
			// 模拟没有尺寸信息的SVG
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

			const svg = "<svg></svg>"
			const width = 600

			// 使用新的mock图像对象来测试不同的天然尺寸
			const tempImage = {} as HTMLImageElement
			Object.defineProperties(tempImage, {
				onload: { value: null, writable: true },
				onerror: { value: null, writable: true },
				src: { value: "", writable: true },
				naturalWidth: { value: 400 },
				naturalHeight: { value: 300 },
			})

			// 临时替换mockImage
			const origMockImage = mockImage
			mockImage = tempImage

			document.createElement = vi.fn().mockImplementation((tagName: string) => {
				if (tagName === "canvas") return mockCanvas
				if (tagName === "img") {
					setTimeout(() => {
						if (mockImage.onload && typeof mockImage.onload === "function") {
							mockImage.onload.call(mockImage, new Event("load"))
						}
					}, 0)
					return mockImage
				}
				return origCreateElement.call(document, tagName)
			})

			await convertSvgToPng(svg, width)

			expect(mockCanvas.width).toBe(600)
			expect(mockCanvas.height).toBe(450) // 保持400:300的比例

			// 恢复原始mockImage
			mockImage = origMockImage
		})

		it("应处理SVG加载错误", async () => {
			const svg = "<svg></svg>"

			// 模拟图片加载错误
			document.createElement = vi.fn().mockImplementation((tagName: string) => {
				if (tagName === "canvas") {
					return mockCanvas
				}
				if (tagName === "img") {
					setTimeout(() => {
						if (mockImage.onerror && typeof mockImage.onerror === "function") {
							mockImage.onerror.call(mockImage, new Event("error"))
						}
					}, 0)
					return mockImage
				}
				return origCreateElement.call(document, tagName)
			})

			await expect(convertSvgToPng(svg)).rejects.toThrow("SVG图片加载失败")
		})

		it("应处理canvas上下文获取失败", async () => {
			const svg = "<svg></svg>"

			// 模拟无法获取canvas上下文
			mockCanvas.getContext = vi.fn().mockReturnValue(null)

			await expect(convertSvgToPng(svg)).rejects.toThrow("无法获取canvas上下文")
		})

		it("应处理toDataURL转换失败", async () => {
			const svg = "<svg></svg>"

			// 模拟toDataURL失败
			mockCanvas.toDataURL = vi.fn().mockImplementation(() => {
				throw new Error("转换失败")
			})

			await expect(convertSvgToPng(svg)).rejects.toThrow("PNG转换失败")
		})
	})
})
