import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicModal from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicModal", () => {
	it("应该正常渲染", () => {
		renderWithTheme(
			<MagicModal open title="测试标题">
				测试内容
			</MagicModal>,
		)
		expect(screen.getByText("测试标题")).toBeInTheDocument()
		expect(screen.getByText("测试内容")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础模态框快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicModal open title="基础模态框">
					这是模态框内容
				</MagicModal>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("关闭状态模态框快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicModal open={false} title="关闭的模态框">
					这是模态框内容
				</MagicModal>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带确认按钮模态框快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicModal open title="确认模态框" okText="确认" cancelText="取消">
					确认要执行此操作吗？
				</MagicModal>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("自定义宽度模态框快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicModal open title="宽模态框" width={800}>
					这是一个较宽的模态框
				</MagicModal>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("无标题模态框快照", () => {
			const { asFragment } = renderWithTheme(<MagicModal open>没有标题的模态框</MagicModal>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("居中模态框快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicModal open title="居中模态框" centered>
					这是一个居中的模态框
				</MagicModal>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
