import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicEllipseWithTooltip from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicEllipseWithTooltip", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicEllipseWithTooltip text="测试内容" maxWidth="100px" />)
		expect(screen.getByText("测试内容")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础省略文本快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip text="测试内容" maxWidth="100px" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("长文本省略快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip
					text="这是一个很长的文本内容，应该会被省略显示"
					maxWidth="100px"
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("自定义最大宽度快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip text="测试内容" maxWidth="200px" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip
					text="测试内容"
					maxWidth="100px"
					style={{ color: "red" }}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip
					text="测试内容"
					maxWidth="100px"
					className="custom-ellipse"
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("空文本快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicEllipseWithTooltip text="" maxWidth="100px" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
