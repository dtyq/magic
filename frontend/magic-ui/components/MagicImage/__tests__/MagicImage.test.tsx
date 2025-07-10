import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicImage from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicImage", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicImage src="test.jpg" alt="测试图片" />)
		expect(screen.getByAltText("测试图片")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础图片快照", () => {
			const { asFragment } = renderWithTheme(<MagicImage src="test.jpg" alt="测试图片" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名图片快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicImage src="test.jpg" alt="测试图片" className="custom-image" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带点击事件图片快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicImage src="test.jpg" alt="测试图片" onClick={() => {}} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("自定义宽度图片快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicImage src="test.jpg" alt="测试图片" width={200} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("自定义高度图片快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicImage src="test.jpg" alt="测试图片" height={150} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带样式图片快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicImage src="test.jpg" alt="测试图片" style={{ borderRadius: "8px" }} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
