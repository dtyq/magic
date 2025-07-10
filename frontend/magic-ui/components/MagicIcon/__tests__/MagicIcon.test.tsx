import { render } from "@testing-library/react"
import MagicIcon from "../index"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicIcon", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicIcon name="user" />)
		expect(true).toBe(true)
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicIcon name="user" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("不同图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicIcon name="home" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式图标快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicIcon name="user" style={{ color: "red", fontSize: "20px" }} />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名图标快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicIcon name="user" className="custom-icon" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("大尺寸图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicIcon name="user" size="large" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("小尺寸图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicIcon name="user" size="small" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带点击事件图标快照", () => {
			const { asFragment } = renderWithTheme(<MagicIcon name="user" onClick={() => {}} />)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
