import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicPageContainer from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicPageContainer", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicPageContainer title="页面标题">页面内容</MagicPageContainer>)
		expect(screen.getByText("页面标题")).toBeInTheDocument()
		expect(screen.getByText("页面内容")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer title="页面标题">页面内容</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带类名页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer title="页面标题" className="custom-page">
					页面内容
				</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义属性页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer title="页面标题" data-testid="page-container">
					页面内容
				</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带操作按钮页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer title="页面标题" extra={<button>操作按钮</button>}>
					页面内容
				</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带标签页页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer
					title="页面标题"
					tabList={[
						{ key: "tab1", tab: "标签1" },
						{ key: "tab2", tab: "标签2" },
					]}
				>
					页面内容
				</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带自定义样式页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer title="页面标题" style={{ backgroundColor: "#f0f0f0" }}>
					页面内容
				</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("无标题页面容器快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicPageContainer>页面内容</MagicPageContainer>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
