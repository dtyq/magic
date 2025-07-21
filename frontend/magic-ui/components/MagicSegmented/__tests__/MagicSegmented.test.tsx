import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect, vi } from "vitest"
import MagicSegmented from "../index"

describe("MagicSegmented", () => {
	it("should render without crashing", () => {
		const options = [
			{ label: "选项1", value: "1" },
			{ label: "选项2", value: "2" },
			{ label: "选项3", value: "3" },
		]

		render(
			<MagicThemeProvider theme="light">
				<MagicSegmented options={options} />
			</MagicThemeProvider>,
		)

		// 检查是否渲染了选项
		expect(screen.getByText("选项1")).toBeInTheDocument()
		expect(screen.getByText("选项2")).toBeInTheDocument()
		expect(screen.getByText("选项3")).toBeInTheDocument()
	})

	it("should handle value change", () => {
		const options = [
			{ label: "选项1", value: "1" },
			{ label: "选项2", value: "2" },
		]
		const onChange = vi.fn()

		render(
			<MagicThemeProvider theme="light">
				<MagicSegmented options={options} onChange={onChange} />
			</MagicThemeProvider>,
		)

		const option2 = screen.getByText("选项2")
		option2.click()

		expect(onChange).toHaveBeenCalledWith("2")
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
				{ label: "选项3", value: "3" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带默认值分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
				{ label: "选项3", value: "3" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} defaultValue="2" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("禁用状态分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} disabled />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("大尺寸分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} size="large" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("小尺寸分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} size="small" />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带图标分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1", icon: <span>🚀</span> },
				{ label: "选项2", value: "2", icon: <span>⭐</span> },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("块级分段控制器快照", () => {
			const options = [
				{ label: "选项1", value: "1" },
				{ label: "选项2", value: "2" },
			]

			const { asFragment } = render(
				<MagicThemeProvider theme="light">
					<MagicSegmented options={options} block />
				</MagicThemeProvider>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
