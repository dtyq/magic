import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicSelect from "../index"

describe("MagicSelect", () => {
	it("should render without crashing", () => {
		const options = [
			{ label: "选项1", value: "1" },
			{ label: "选项2", value: "2" },
			{ label: "选项3", value: "3" },
		]

		render(
			<MagicThemeProvider theme="light">
				<MagicSelect options={options} placeholder="请选择" />
			</MagicThemeProvider>,
		)

		// 检查是否渲染了占位符
		expect(screen.getByText("请选择")).toBeInTheDocument()
	})

	it("should display selected value", () => {
		const options = [
			{ label: "选项1", value: "1" },
			{ label: "选项2", value: "2" },
		]

		render(
			<MagicThemeProvider theme="light">
				<MagicSelect options={options} value="1" />
			</MagicThemeProvider>,
		)

		// 检查是否显示了选中的值
		expect(screen.getByText("选项1")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
				{ label: "选项3", value: "3" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} placeholder="请选择" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带默认值选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} defaultValue="1" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用状态选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} disabled />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("多选选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
				{ label: "选项3", value: "3" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} mode="multiple" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("大尺寸选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} size="large" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("小尺寸选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} size="small" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带清除按钮选择器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSelect options={options} allowClear />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
