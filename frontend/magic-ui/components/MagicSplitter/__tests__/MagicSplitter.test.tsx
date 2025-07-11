import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicSplitter from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicSplitter", () => {
	it("应该正常渲染", () => {
		renderWithTheme(
			<MagicSplitter>
				<div>左侧</div>
				<div>右侧</div>
			</MagicSplitter>,
		)
		expect(screen.getByText("左侧")).toBeInTheDocument()
		expect(screen.getByText("右侧")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter>
					<div>左侧内容</div>
					<div>右侧内容</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter style={{ height: "400px" }}>
					<div>左侧内容</div>
					<div>右侧内容</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter className="custom-splitter">
					<div>左侧内容</div>
					<div>右侧内容</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter style={{ height: "400px" }}>
					<div>左侧内容</div>
					<div>右侧内容</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter className="custom-splitter">
					<div>左侧内容</div>
					<div>右侧内容</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("复杂内容分割器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicSplitter>
					<div>
						<h3>左侧标题</h3>
						<p>左侧详细内容</p>
					</div>
					<div>
						<h3>右侧标题</h3>
						<p>右侧详细内容</p>
					</div>
				</MagicSplitter>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
