import { render } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicFileIcon from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicFileIcon", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicFileIcon type="pdf" />)
		expect(true).toBe(true)
	})

	// 快照测试
	describe("快照测试", () => {
		it("PDF文件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicFileIcon type="pdf" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("Word文件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicFileIcon type="word" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("Excel文件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicFileIcon type="excel" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("图片文件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicFileIcon type="image" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("视频文件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicFileIcon type="video" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式文件图标快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicFileIcon type="pdf" style={{ width: "32px", height: "32px" }} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名文件图标快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicFileIcon type="pdf" className="custom-file-icon" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
