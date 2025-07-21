import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import MagicButton from "../index"
import MagicThemeProvider from "../../ThemeProvider"

const renderWithTheme = (component: React.ReactElement) => {
	return render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)
}

describe("MagicButton", () => {
	it("应该正确渲染按钮", () => {
		renderWithTheme(<MagicButton>测试按钮</MagicButton>)
		expect(screen.getByRole("button", { name: "测试按钮" })).toBeInTheDocument()
	})

	it("应该支持不同的按钮类型", () => {
		const { rerender } = renderWithTheme(<MagicButton type="primary">主要按钮</MagicButton>)
		expect(screen.getByRole("button")).toHaveClass("magic-btn-primary")

		rerender(
			<MagicThemeProvider theme="light">
				<MagicButton type="dashed">虚线按钮</MagicButton>
			</MagicThemeProvider>,
		)
		expect(screen.getByRole("button")).toHaveClass("magic-btn-dashed")
	})

	it("应该支持点击事件", () => {
		const handleClick = vi.fn()
		renderWithTheme(<MagicButton onClick={handleClick}>点击按钮</MagicButton>)

		fireEvent.click(screen.getByRole("button"))
		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it("应该支持禁用状态", () => {
		renderWithTheme(<MagicButton disabled>禁用按钮</MagicButton>)
		expect(screen.getByRole("button")).toBeDisabled()
	})

	it("应该支持加载状态", () => {
		renderWithTheme(<MagicButton loading>加载按钮</MagicButton>)
		expect(screen.getByRole("button")).toHaveClass("magic-btn-loading")
	})

	it("应该支持自定义样式类名", () => {
		renderWithTheme(<MagicButton className="custom-class">自定义按钮</MagicButton>)
		expect(screen.getByRole("button")).toHaveClass("custom-class")
	})

	it("应该支持图标", () => {
		renderWithTheme(
			<MagicButton icon={<span data-testid="icon">🚀</span>}>带图标按钮</MagicButton>,
		)
		expect(screen.getByTestId("icon")).toBeInTheDocument()
	})

	it("应该支持 tooltip", () => {
		renderWithTheme(<MagicButton tip="这是一个提示">带提示按钮</MagicButton>)
		expect(screen.getByRole("button")).toBeInTheDocument()
	})

	it("当 hidden 为 true 时应该不渲染", () => {
		const { container } = renderWithTheme(<MagicButton hidden>隐藏按钮</MagicButton>)
		expect(container.firstChild).toBeNull()
	})

	it("应该支持不同的 justify 属性", () => {
		renderWithTheme(<MagicButton justify="flex-start">左对齐按钮</MagicButton>)
		const button = screen.getByRole("button")
		expect(button).toBeInTheDocument()
	})

	it("应该支持 ref 转发", () => {
		const ref = vi.fn()
		renderWithTheme(<MagicButton ref={ref}>Ref 按钮</MagicButton>)
		expect(ref).toHaveBeenCalled()
	})

	// 快照测试
	describe("快照测试", () => {
		it("默认按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton>默认按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("主要按钮快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicButton type="primary">主要按钮</MagicButton>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("虚线按钮快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicButton type="dashed">虚线按钮</MagicButton>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("文本按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton type="text">文本按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("链接按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton type="link">链接按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用状态按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton disabled>禁用按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("加载状态按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton loading>加载按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带图标按钮快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicButton icon={<span>🚀</span>}>带图标按钮</MagicButton>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("不同尺寸按钮快照", () => {
			const { asFragment: smallFragment } = renderWithTheme(
				<MagicButton size="small">小按钮</MagicButton>,
			)
			expect(smallFragment()).toMatchSnapshot()

			const { asFragment: largeFragment } = renderWithTheme(
				<MagicButton size="large">大按钮</MagicButton>,
			)
			expect(largeFragment()).toMatchSnapshot()
		})

		it("隐藏按钮快照", () => {
			const { asFragment } = renderWithTheme(<MagicButton hidden>隐藏按钮</MagicButton>)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
