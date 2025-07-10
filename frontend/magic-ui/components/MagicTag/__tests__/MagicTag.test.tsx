import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicTag from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicTag", () => {
	it("应该正常渲染", () => {
		renderWithTheme(<MagicTag>标签内容</MagicTag>)
		expect(screen.getByText("标签内容")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("默认标签快照", () => {
			const { asFragment } = renderWithTheme(<MagicTag>默认标签</MagicTag>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("不同颜色标签快照", () => {
			const { asFragment: blueFragment } = renderWithTheme(
				<MagicTag color="blue">蓝色标签</MagicTag>,
			)
			expect(blueFragment()).toMatchSnapshot()

			const { asFragment: redFragment } = renderWithTheme(
				<MagicTag color="red">红色标签</MagicTag>,
			)
			expect(redFragment()).toMatchSnapshot()

			const { asFragment: greenFragment } = renderWithTheme(
				<MagicTag color="green">绿色标签</MagicTag>,
			)
			expect(greenFragment()).toMatchSnapshot()
		})

		it("可关闭标签快照", () => {
			const { asFragment } = renderWithTheme(<MagicTag closable>可关闭标签</MagicTag>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("不同样式标签快照", () => {
			const { asFragment: successFragment } = renderWithTheme(
				<MagicTag color="success">成功标签</MagicTag>,
			)
			expect(successFragment()).toMatchSnapshot()

			const { asFragment: warningFragment } = renderWithTheme(
				<MagicTag color="warning">警告标签</MagicTag>,
			)
			expect(warningFragment()).toMatchSnapshot()
		})

		it("边框样式标签快照", () => {
			const { asFragment } = renderWithTheme(<MagicTag bordered>边框标签</MagicTag>)
			expect(asFragment()).toMatchSnapshot()
		})

		it("图标标签快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTag icon={<span>🏷️</span>}>带图标标签</MagicTag>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
