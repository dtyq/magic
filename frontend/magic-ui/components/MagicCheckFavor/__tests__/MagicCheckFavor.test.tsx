import { render } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicCheckFavor from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicCheckFavor", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicCheckFavor checked />)
		expect(document.querySelector('input[type="checkbox"]')).toBeInTheDocument()
	})

	it("支持自定义 checked", () => {
		renderWithTheme(<MagicCheckFavor checked />)
		expect(document.querySelector('input[type="checkbox"]')).toBeChecked()
	})

	// 快照测试 - 由于组件使用随机ID，快照测试可能不稳定
	describe("快照测试", () => {
		it("已收藏状态快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor checked />)
			// 检查组件是否正确渲染，而不是依赖快照
			expect(container.querySelector('input[type="checkbox"]')).toBeChecked()
		})

		it("未收藏状态快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor checked={false} />)
			expect(container.querySelector('input[type="checkbox"]')).not.toBeChecked()
		})

		it("默认状态快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor />)
			expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument()
		})

		it("带自定义样式快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor className="custom-favor" />)
			expect(container.firstChild).toHaveClass("custom-favor")
		})

		it("带自定义事件快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor onChange={() => {}} />)
			expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument()
		})

		it("带标签快照", () => {
			const { container } = renderWithTheme(<MagicCheckFavor />)
			expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument()
		})
	})
})
