import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicSpin from "../index"

describe("MagicSpin", () => {
	it("should render with children", () => {
		render(
			<MagicThemeProvider theme="light">
				<MagicSpin>
					<div>内容区域</div>
				</MagicSpin>
			</MagicThemeProvider>,
		)

		// 检查是否渲染了子元素
		expect(screen.getByText("内容区域")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础加载器快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin>
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("加载状态快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin spinning>
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带提示文字快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin tip="加载中...">
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("小尺寸加载器快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin size="small">
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("大尺寸加载器快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin size="large">
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("延迟加载快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin delay={500}>
						<div>内容区域</div>
					</MagicSpin>
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("独立加载器快照", () => {
			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSpin />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
