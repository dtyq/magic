import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { applyPlaceholderTextLayout, createPlaceholderTextNode } from "../placeholderTextLayout"

const originalGetContextDescriptor = Object.getOwnPropertyDescriptor(
	HTMLCanvasElement.prototype,
	"getContext",
)

const create = (text: string, overrides: Record<string, unknown> = {}) =>
	createPlaceholderTextNode({
		text,
		availableWidth: 120,
		inverseScaleX: 1,
		fontSize: 12,
		fontFamily: "Arial, sans-serif",
		...overrides,
	})

beforeAll(() => {
	const context = {
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(400) })),
		measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
		save: vi.fn(),
		restore: vi.fn(),
	}
	Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
		configurable: true,
		value: vi.fn(() => context),
	})
})

afterAll(() => {
	if (originalGetContextDescriptor) {
		Object.defineProperty(
			HTMLCanvasElement.prototype,
			"getContext",
			originalGetContextDescriptor,
		)
		return
	}

	Reflect.deleteProperty(HTMLCanvasElement.prototype, "getContext")
})

describe("placeholderTextLayout", () => {
	it("keeps short text on one line", () => {
		const result = create("正在生成中...")

		expect(result.layout.lineCount).toBe(1)
		expect(result.layout.nodeWidth).toBe(result.layout.naturalWidth)
		expect(result.layout.truncated).toBe(false)
	})

	it("wraps CJK and unbroken latin text within the available width", () => {
		const chinese = create("这是一段足够长的中文提示文本，需要在卡片内部自动换行")
		const latin = create("https://example.com/a-very-long-placeholder-without-spaces")

		expect(chinese.layout.lineCount).toBeGreaterThan(1)
		expect(latin.layout.lineCount).toBeGreaterThan(1)
		expect(chinese.layout.nodeWidth).toBeLessThanOrEqual(chinese.layout.maxTextWidth)
		expect(latin.layout.nodeWidth).toBeLessThanOrEqual(latin.layout.maxTextWidth)
	})

	it("preserves explicit newlines and sizes the background from the longest line", () => {
		const result = create("第一行\n第二行很长", {
			paddingX: 8,
			paddingY: 4,
		})

		expect(result.layout.lineCount).toBeGreaterThanOrEqual(2)
		expect(result.layout.backgroundWidth).toBe(result.layout.textWidth + 16)
		expect(result.layout.backgroundHeight).toBe(result.layout.textHeight + 8)
	})

	it("marks text as truncated when the minimum-height fallback is used", () => {
		const result = create("这是一段非常长的提示文本，需要触发省略兜底", { maxHeight: 12 })

		expect(result.layout.truncated).toBe(true)
		expect(result.layout.textHeight).toBe(12)
	})

	it("can apply a recalculated layout to an existing node", () => {
		const initial = create("short")
		const recalculated = create("这是一段足够长的中文提示文本，需要在卡片内部自动换行")

		applyPlaceholderTextLayout(initial.node, recalculated)

		expect(initial.node.width()).toBe(recalculated.layout.nodeWidth)
		expect(initial.node.wrap()).toBe("char")
	})
})
