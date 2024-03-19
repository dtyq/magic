import { render } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicDropdown from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicDropdown", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicDropdown menu={{ items: [] }}>下拉</MagicDropdown>)
		// 只要不报错即可
		expect(true).toBe(true)
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown menu={{ items: [] }}>下拉菜单</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带菜单项下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown
					menu={{
						items: [
							{ key: "1", label: "菜单项1" },
							{ key: "2", label: "菜单项2" },
						],
					}}
				>
					下拉菜单
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带图标下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown
					menu={{
						items: [
							{ key: "1", label: "菜单项1", icon: <span>🏠</span> },
							{ key: "2", label: "菜单项2", icon: <span>⚙️</span> },
						],
					}}
				>
					<div>🏠 下拉菜单</div>
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用状态下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown disabled menu={{ items: [] }}>
					下拉菜单
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义属性下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown data-testid="custom-dropdown" menu={{ items: [] }}>
					下拉菜单
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown className="custom-dropdown" menu={{ items: [] }}>
					下拉菜单
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带按钮样式下拉菜单快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicDropdown menu={{ items: [] }}>
					<button>按钮下拉</button>
				</MagicDropdown>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
