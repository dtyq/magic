import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom"
import MagicSegmented from "../index"
import type { ReactNode } from "react"

// 模拟antd组件
vi.mock("antd", () => {
	const Segmented = ({
		className,
		options,
		defaultValue,
		value,
		onChange,
		...props
	}: {
		className?: string
		options?: Array<{ label: ReactNode; value: string | number } | string | number>
		defaultValue?: string | number
		value?: string | number
		onChange?: (value: string | number) => void
	}) => {
		const handleChange = (newValue: string | number) => {
			onChange?.(newValue)
		}

		return (
			<div data-testid="antd-segmented" className={className} {...props}>
				{Array.isArray(options) &&
					options.map((option, index) => {
						const optionValue = typeof option === "object" ? option.value : option
						const optionLabel = typeof option === "object" ? option.label : option
						const isSelected = value
							? value === optionValue
							: defaultValue === optionValue

						return (
							<div
								key={index}
								data-testid={`segmented-item-${index}`}
								className={`segmented-item ${isSelected ? "segmented-item-selected" : ""}`}
								onClick={() => handleChange(optionValue)}
							>
								{optionLabel}
							</div>
						)
					})}
			</div>
		)
	}

	return {
		Segmented,
	}
})

// 模拟样式
vi.mock("../styles", () => ({
	default: () => ({
		styles: {
			segmented: "mock-segmented-styles",
		},
	}),
}))

describe("MagicSegmented组件", () => {
	it("应该正确渲染基本分段控制器", () => {
		render(<MagicSegmented options={["每日", "每周", "每月"]} defaultValue="每日" />)

		expect(screen.getByTestId("antd-segmented")).toBeInTheDocument()
		expect(screen.getByText("每日")).toBeInTheDocument()
		expect(screen.getByText("每周")).toBeInTheDocument()
		expect(screen.getByText("每月")).toBeInTheDocument()
	})

	it("应该支持复杂选项格式", () => {
		render(
			<MagicSegmented
				options={[
					{ label: "选项一", value: "option1" },
					{ label: "选项二", value: "option2" },
					{ label: "选项三", value: "option3" },
				]}
				defaultValue="option1"
			/>,
		)

		expect(screen.getByTestId("antd-segmented")).toBeInTheDocument()
		expect(screen.getByText("选项一")).toBeInTheDocument()
		expect(screen.getByText("选项二")).toBeInTheDocument()
		expect(screen.getByText("选项三")).toBeInTheDocument()
	})

	it("应该响应选项点击事件", () => {
		const handleChange = vi.fn()
		render(
			<MagicSegmented
				options={["选项一", "选项二", "选项三"]}
				defaultValue="选项一"
				onChange={handleChange}
			/>,
		)

		fireEvent.click(screen.getByText("选项二"))
		expect(handleChange).toHaveBeenCalledWith("选项二")
	})

	it("应该应用圆形样式类", () => {
		render(<MagicSegmented options={["选项一", "选项二"]} circle={true} />)

		expect(screen.getByTestId("antd-segmented")).toHaveClass("mock-segmented-styles")
	})

	it("应该应用非圆形样式类", () => {
		render(<MagicSegmented options={["选项一", "选项二"]} circle={false} />)

		expect(screen.getByTestId("antd-segmented")).toHaveClass("mock-segmented-styles")
	})

	it("应该支持自定义类名", () => {
		render(<MagicSegmented options={["选项一", "选项二"]} className="custom-class" />)

		const segmentedElement = screen.getByTestId("antd-segmented")
		expect(segmentedElement.className).toContain("mock-segmented-styles")
		expect(segmentedElement.className).toContain("custom-class")
	})
})
