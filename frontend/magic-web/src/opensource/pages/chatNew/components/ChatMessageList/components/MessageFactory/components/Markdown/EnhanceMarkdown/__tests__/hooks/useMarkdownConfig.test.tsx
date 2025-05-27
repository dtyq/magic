import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { useMarkdownConfig } from "../../hooks/useMarkdownConfig"
import defaultRemarkPlugins from "../../remarkPlugins"

// 模拟组件
vi.mock("../../components/A", () => ({
	A: vi.fn().mockReturnValue(null),
}))

vi.mock("../../components/Code", () => ({
	default: vi.fn().mockReturnValue(null),
}))

vi.mock("../../components/Pre", () => ({
	default: vi.fn().mockReturnValue(null),
}))

vi.mock("../../components/Sup", () => ({
	default: vi.fn().mockReturnValue(null),
}))

vi.mock("../../components/Table/TableCell", () => ({
	default: vi.fn().mockReturnValue(null),
}))

vi.mock("../../components/Table/TableWrapper", () => ({
	default: vi.fn().mockReturnValue(null),
}))

// 模拟 remark 插件
vi.mock("../../remarkPlugins", () => ({
	default: ["mockRemarkPlugin1", "mockRemarkPlugin2"],
}))

describe("useMarkdownConfig", () => {
	it("应该使用默认配置", () => {
		// Arrange
		const props = {}

		// Act
		const { result } = renderHook(() => useMarkdownConfig(props))

		// Assert
		// 检查 rehype 插件
		expect(result.current.rehypePlugins).toContain(rehypeRaw)
		expect(result.current.rehypePlugins).toContain(rehypeSanitize)
		expect(result.current.rehypePlugins).toContain(rehypeKatex)

		// 检查 remark 插件
		expect(result.current.remarkPlugins).toEqual(expect.arrayContaining(defaultRemarkPlugins))

		// 检查组件是否存在
		expect(result.current.components).toHaveProperty("pre")
		expect(result.current.components).toHaveProperty("a")
		expect(result.current.components).toHaveProperty("table")
		expect(result.current.components).toHaveProperty("td")
		expect(result.current.components).toHaveProperty("th")
		expect(result.current.components).toHaveProperty("code")
		expect(result.current.components).toHaveProperty("sup")
	})

	it("应该根据传入的参数配置 rehype 插件", () => {
		// Arrange
		const customRehypePlugin = () => {}
		const props = {
			allowHtml: false,
			enableLatex: false,
			rehypePlugins: [customRehypePlugin],
		}

		// Act
		const { result } = renderHook(() => useMarkdownConfig(props))

		// Assert
		// 检查禁用 HTML 和 LaTeX 后的插件
		expect(result.current.rehypePlugins).not.toContain(rehypeRaw)
		expect(result.current.rehypePlugins).not.toContain(rehypeSanitize)
		expect(result.current.rehypePlugins).not.toContain(rehypeKatex)

		// 自定义插件应该被添加
		expect(result.current.rehypePlugins).toContain(customRehypePlugin)
	})

	it("应该根据传入的参数配置 remark 插件", () => {
		// Arrange
		const customRemarkPlugin = () => {}
		const props = {
			remarkPlugins: [customRemarkPlugin],
		}

		// Act
		const { result } = renderHook(() => useMarkdownConfig(props))

		// Assert
		// 默认插件和自定义插件都应该存在
		expect(result.current.remarkPlugins).toEqual([...defaultRemarkPlugins, customRemarkPlugin])
	})

	it("应该合并自定义组件", () => {
		// Arrange
		const CustomComponent = () => null
		const props = {
			components: {
				h1: CustomComponent,
			},
		}

		// Act
		const { result } = renderHook(() => useMarkdownConfig(props))

		// Assert
		// 默认组件应该存在
		expect(result.current.components).toHaveProperty("pre")
		expect(result.current.components).toHaveProperty("a")

		// 自定义组件应该被添加
		expect(result.current.components.h1).toBe(CustomComponent)
	})
})
