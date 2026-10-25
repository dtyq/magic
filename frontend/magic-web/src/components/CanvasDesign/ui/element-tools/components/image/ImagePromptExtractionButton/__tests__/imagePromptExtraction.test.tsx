import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ElementToolStateProvider } from "../../../../../../app/providers/ElementToolStateProvider"
import type { Canvas } from "../../../../../../runtime/core/Canvas"
import { ElementTypeEnum, type ImageElement } from "../../../../../../runtime/document/types"
import { getActiveContent } from "../../../../../../runtime/document/elementContent"
import { buildImagePromptExtractionPrompt } from "../imagePromptExtractionPrompt"
import {
	buildImagePromptTextElementData,
	createImagePromptTextElement,
	resolveImagePromptTextLayoutConfig,
	wrapPromptForTextNode,
} from "../imagePromptExtractionText"
import ImagePromptExtractionButton from "../index"
import { CONNECTION_CREATE_NODE_SPACING } from "../../../../../../runtime/shared/placement/connectionCreatePlacement"

const mockCompleteImagePrompt = vi.fn()
const mockElementManagerCreate = vi.fn()
const mockConnectElements = vi.fn(() => ({
	status: "created",
	connectionId: "connection-1" as const,
}))
const mockSelectMultiple = vi.fn()

let mockSelectedElements: ImageElement[] = []
let mockCanvas: Canvas

vi.mock("../../../../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../../../app/hooks/layout/useOverflowChange", () => ({
	useOverflowChange: () => undefined,
}))

vi.mock("../../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mockCanvas }),
}))

vi.mock("../../../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasUI: () => ({ selectedElements: mockSelectedElements }),
}))

vi.mock("../../../../../../app/providers/HostUiLocaleProvider", () => ({
	useHostUiLocale: () => "zh_CN",
}))

vi.mock("../../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
	},
}))

function ImagePromptExtractionButtonHarness({ show = true }: { show?: boolean }) {
	return (
		<ElementToolStateProvider>
			{show ? <ImagePromptExtractionButton /> : null}
		</ElementToolStateProvider>
	)
}

function renderImagePromptExtractionButton() {
	return render(<ImagePromptExtractionButtonHarness />)
}

describe("buildImagePromptExtractionPrompt", () => {
	it("builds a visual prompt extraction request", () => {
		const prompt = buildImagePromptExtractionPrompt({
			hostUiLocale: "zh_CN",
			fileName: "product.png",
			hasCrop: true,
		})

		expect(prompt).toContain("# 任务\n分析参考图 1 的可见画面")
		expect(prompt).toContain("已提供 1 张图片作为视觉输入")
		expect(prompt).toContain("文件名：product.png")
		expect(prompt).toContain("参考图已按画布裁剪区域提交")
		expect(prompt).toContain("最终提示词必须使用中文")
		expect(prompt).toContain("最终只输出一段提示词正文")
	})

	it("falls back to host locale for output language", () => {
		const prompt = buildImagePromptExtractionPrompt({ hostUiLocale: "en_US" })

		expect(prompt).toContain("最终提示词必须使用英文")
	})
})

describe("image prompt text element helpers", () => {
	const imageElement: ImageElement = {
		id: "image-1",
		type: ElementTypeEnum.Image,
		x: 100,
		y: 200,
		width: 800,
		height: 600,
		scaleX: 1,
		scaleY: 1,
		zIndex: 1,
		activeContentId: "image-1-content-1",
		mainContentId: "image-1-content-1",
		contents: [{ contentId: "image-1-content-1", src: "images/product.png" }],
	}

	it("creates text element data to the right of the image and connects image to text", () => {
		const result = buildImagePromptTextElementData({
			imageElement,
			prompt: "商业摄影产品图，柔和光线，白色背景",
			zIndex: 9,
			elementId: "text-1",
			imageBoundingRect: { x: 100, y: 200, width: 800, height: 600 },
			measureLayout: () => ({ width: 300, height: 100 }),
		})

		expect(result.element).toMatchObject({
			id: "text-1",
			type: ElementTypeEnum.Text,
			x: 1924,
			y: 450,
			width: 300,
			height: 100,
			zIndex: 9,
		})
		expect(getActiveContent(result.element)?.content?.[0]?.children?.[0]?.text).toBe(
			"商业摄影产品图，柔和光线，白色背景",
		)
		expect(result.connection).toEqual({
			sourceElementId: "image-1",
			targetElementId: "text-1",
		})
	})

	it("places extracted prompt text below an occupied right-side slot", () => {
		const result = buildImagePromptTextElementData({
			imageElement,
			prompt: "商业摄影产品图，柔和光线，白色背景",
			zIndex: 9,
			elementId: "text-1",
			imageBoundingRect: { x: 100, y: 200, width: 800, height: 600 },
			obstacleRects: [{ x: 1924, y: 450, width: 300, height: 100 }],
			measureLayout: () => ({ width: 300, height: 100 }),
		})

		expect(result.element).toMatchObject({
			x: 1924,
			y: 450 + 100 + CONNECTION_CREATE_NODE_SPACING,
		})
	})

	it("creates the text element on canvas and selects it", () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 0
		})
		mockCanvas = {
			elementManager: {
				getElementInstance: () => ({
					getBoundingRect: () => ({ x: 100, y: 200, width: 800, height: 600 }),
				}),
				getAllElementIds: () => [],
				isElementVisibleInDataTree: () => true,
				getNextZIndexInLevel: () => 10,
				create: mockElementManagerCreate,
			},
			geometryCacheManager: {
				getElementBounds: vi.fn(),
			},
			connectionManager: {
				connectElements: mockConnectElements,
			},
			historyManager: {
				runTransaction: (callback: () => unknown) => callback(),
			},
			selectionManager: {
				selectMultiple: mockSelectMultiple,
			},
			viewportController: {
				isElementInViewport: () => true,
				moveElementToViewport: vi.fn(),
			},
		} as unknown as Canvas

		const result = createImagePromptTextElement({
			canvas: mockCanvas,
			imageElement,
			prompt: "商业摄影产品图",
		})

		expect(result?.connection).toEqual({
			sourceElementId: "image-1",
			targetElementId: result?.element.id,
		})
		expect(mockElementManagerCreate).toHaveBeenCalledWith(result?.element)
		expect(mockConnectElements).toHaveBeenCalledWith(result?.connection)
		expect(mockSelectMultiple).toHaveBeenCalledWith([result?.element.id])
	})

	it("wraps long prompt text for readable canvas text nodes", () => {
		expect(wrapPromptForTextNode("一二三四五六七八九十", 4)).toBe("一二三四\n五六七八\n九十")
	})

	it("uses discrete image-size presets for extracted prompt text layout", () => {
		const square2k = resolveImagePromptTextLayoutConfig({
			x: 0,
			y: 0,
			width: 2048,
			height: 2048,
		})
		const sameBucket = resolveImagePromptTextLayoutConfig({
			x: 0,
			y: 0,
			width: 2400,
			height: 2400,
		})
		const hugePortrait = resolveImagePromptTextLayoutConfig({
			x: 0,
			y: 0,
			width: 4837,
			height: 7256,
		})

		expect(square2k).toEqual({
			fontSize: 96,
			lineHeight: 1.45,
			maxLineLength: 24,
		})
		expect(sameBucket.fontSize).toBe(square2k.fontSize)
		expect(hugePortrait).toEqual({
			fontSize: 224,
			lineHeight: 1.45,
			maxLineLength: 25,
		})
	})

	it("wraps and stores typography for a 2K image prompt text node", () => {
		const result = buildImagePromptTextElementData({
			imageElement: {
				...imageElement,
				width: 2048,
				height: 2048,
			},
			prompt: "一二三四五六七八九十".repeat(6),
			zIndex: 9,
			elementId: "text-2k",
			imageBoundingRect: { x: 0, y: 0, width: 2048, height: 2048 },
			measureLayout: () => ({ width: 1200, height: 900 }),
		})

		expect(getActiveContent(result.element)?.defaultStyle?.fontSize).toBe(96)
		expect(result.displayPrompt).toContain("\n")
		result.displayPrompt.split("\n").forEach((line) => {
			expect(line.length).toBeLessThanOrEqual(24)
		})
	})
})

describe("ImagePromptExtractionButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSelectedElements = [
			{
				id: "image-1",
				type: ElementTypeEnum.Image,
				x: 100,
				y: 200,
				width: 800,
				height: 600,
				zIndex: 1,
				activeContentId: "image-1-content-1",
				mainContentId: "image-1-content-1",
				contents: [{ contentId: "image-1-content-1", src: "images/product.png" }],
				name: "product.png",
			},
		]
		mockCanvas = {
			magicConfigManager: {
				config: {
					methods: {
						completeImagePrompt: mockCompleteImagePrompt,
					},
				},
			},
			elementManager: {
				getElementInstance: () => ({
					getBoundingRect: () => ({ x: 100, y: 200, width: 800, height: 600 }),
				}),
				getAllElementIds: () => [],
				isElementVisibleInDataTree: () => true,
				getNextZIndexInLevel: () => 10,
				create: mockElementManagerCreate,
			},
			geometryCacheManager: {
				getElementBounds: vi.fn(),
			},
			connectionManager: {
				connectElements: mockConnectElements,
			},
			historyManager: {
				runTransaction: (callback: () => unknown) => callback(),
			},
			selectionManager: {
				selectMultiple: mockSelectMultiple,
			},
			viewportController: {
				isElementInViewport: () => true,
				moveElementToViewport: vi.fn(),
			},
			eventEmitter: {
				on: vi.fn(() => vi.fn()),
			},
		} as unknown as Canvas
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0)
			return 0
		})
	})

	it("extracts a prompt and creates a linked text node", async () => {
		mockCompleteImagePrompt.mockResolvedValue({
			prompt: "商业摄影产品图，柔和自然光，白色背景",
		})

		renderImagePromptExtractionButton()

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))

		expect(await screen.findByText("商业摄影产品图，柔和自然光，白色背景")).toBeInTheDocument()
		expect(mockCompleteImagePrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				reference_images: ["images/product.png"],
			}),
		)

		fireEvent.click(screen.getByRole("button", { name: "创建文本" }))

		await waitFor(() => {
			expect(mockElementManagerCreate).toHaveBeenCalled()
		})
		expect(mockConnectElements).toHaveBeenCalledWith({
			sourceElementId: "image-1",
			targetElementId: expect.stringMatching(/^element-/),
		})
	})

	it("keeps the loading popover hidden on first extraction click", async () => {
		let resolvePrompt!: (value: { prompt: string }) => void
		mockCompleteImagePrompt.mockReturnValue(
			new Promise((resolve) => {
				resolvePrompt = resolve
			}),
		)

		renderImagePromptExtractionButton()

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))

		expect(screen.queryByText("正在提炼提示词")).not.toBeInTheDocument()

		resolvePrompt({ prompt: "商业摄影产品图" })
		expect(await screen.findByText("商业摄影产品图")).toBeInTheDocument()
	})

	it("shows extraction loading while regenerating from the result popover", async () => {
		let resolvePrompt!: (value: { prompt: string }) => void
		mockCompleteImagePrompt
			.mockResolvedValueOnce({ prompt: "第一次提炼结果" })
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolvePrompt = resolve
				}),
			)

		renderImagePromptExtractionButton()

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))
		expect(await screen.findByText("第一次提炼结果")).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "重新提炼" }))

		expect(await screen.findByText("正在提炼提示词")).toBeInTheDocument()

		resolvePrompt({ prompt: "第二次提炼结果" })
		expect(await screen.findByText("第二次提炼结果")).toBeInTheDocument()
	})

	it("hides raw request errors behind a user-friendly retry message", async () => {
		mockCompleteImagePrompt.mockRejectedValue(new Error("HTTP 500: upstream timeout"))

		renderImagePromptExtractionButton()

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))

		expect(await screen.findByText("提示词提炼失败，请重试")).toBeInTheDocument()
		expect(screen.queryByText("HTTP 500: upstream timeout")).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument()
	})

	it("keeps user-facing empty result errors specific", async () => {
		mockCompleteImagePrompt.mockResolvedValue({ prompt: "" })

		renderImagePromptExtractionButton()

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))

		expect(await screen.findByText("AI 未生成有效提示词，请重试")).toBeInTheDocument()
	})

	it("keeps the extraction result when the toolbar button unmounts before completion", async () => {
		let resolvePrompt!: (value: { prompt: string }) => void
		mockCompleteImagePrompt.mockReturnValue(
			new Promise((resolve) => {
				resolvePrompt = resolve
			}),
		)

		const { rerender } = render(<ImagePromptExtractionButtonHarness />)

		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))
		rerender(<ImagePromptExtractionButtonHarness show={false} />)

		await act(async () => {
			resolvePrompt({ prompt: "卸载后完成的提炼结果" })
		})

		rerender(<ImagePromptExtractionButtonHarness />)
		fireEvent.click(screen.getByTestId("image-prompt-extraction-button"))

		expect(await screen.findByText("卸载后完成的提炼结果")).toBeInTheDocument()
		expect(mockCompleteImagePrompt).toHaveBeenCalledTimes(1)
	})
})
