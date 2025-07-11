import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicSwitch from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicSwitch", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicSwitch />)
		expect(screen.getByRole("switch")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("默认开关快照", () => {
			const { asFragment } = renderWithTheme(<MagicSwitch />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("开启状态开关快照", () => {
			const { asFragment } = renderWithTheme(<MagicSwitch defaultChecked />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用状态开关快照", () => {
			const { asFragment } = renderWithTheme(<MagicSwitch disabled />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用且开启状态开关快照", () => {
			const { asFragment } = renderWithTheme(<MagicSwitch disabled defaultChecked />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("小尺寸开关快照", () => {
			const { asFragment } = renderWithTheme(<MagicSwitch size="small" />)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带标签开关快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSwitch checkedChildren="开" unCheckedChildren="关" />,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
