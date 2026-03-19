import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, test, expect } from "vitest"
import MagicList from "../MagicList"
import type { MagicListItemData } from "../types"

// 模拟样式模块，解决token问题
vi.mock("../styles", () => ({
	useMagicListItemStyles: () => ({
		styles: {
			container: "mock-container",
			active: "mock-active",
			mainWrapper: "mock-main-wrapper",
			avatar: "mock-avatar",
			title: "mock-title",
			content: "mock-content",
			time: "mock-time",
			extra: "mock-extra",
		},
	}),
}))

// 创建测试数据
interface TestItemData extends MagicListItemData {
	id: string
	title: string
	customField?: string
}

// 生成测试项
const createTestItems = (count: number): TestItemData[] => {
	return Array.from({ length: count }).map((_, index) => ({
		id: `item-${index}`,
		title: `测试项 ${index}`,
		customField: `自定义字段 ${index}`,
	}))
}

describe("MagicList 组件", () => {
	// 测试基本渲染
	test("正确渲染列表项", () => {
		const items = createTestItems(3)

		render(<MagicList items={items} />)

		// 验证所有项都被渲染
		items.forEach((item) => {
			expect(screen.getByText(item.title)).toBeInTheDocument()
		})
	})

	// 测试空列表
	test("空列表时渲染 MagicEmpty 组件", () => {
		const { container } = render(<MagicList items={[]} />)

		// 由于 MagicEmpty 可能没有特定的测试 ID，我们检查是否没有渲染列表项
		expect(container.querySelectorAll(".ant-flex").length).toBe(0)
	})

	// 测试项点击事件
	test("点击列表项触发 onItemClick 回调", () => {
		const items = createTestItems(3)
		const handleItemClick = vi.fn()

		render(<MagicList items={items} onItemClick={handleItemClick} />)

		// 点击第二个列表项
		fireEvent.click(screen.getByText("测试项 1"))

		// 验证回调被调用，并传入了正确的数据
		expect(handleItemClick).toHaveBeenCalledTimes(1)
		expect(handleItemClick).toHaveBeenCalledWith(items[1])
	})

	// 测试 active 状态（string 类型）
	test("正确应用 active 状态（string 类型）", () => {
		const items = createTestItems(3)
		const activeId = "item-1"

		const { container } = render(<MagicList items={items} active={activeId} />)

		// 检查是否只有一个项目有 active 样式类
		const activeItems = container.querySelectorAll(".mock-active")
		expect(activeItems.length).toBe(1)

		// 检查激活项是否包含预期的标题
		const activeItem = activeItems[0]
		const parentElement = activeItem.closest(".mock-container")
		expect(parentElement?.textContent).toContain("测试项 1")
	})

	// 测试 active 状态（函数类型）
	test("正确应用 active 状态（函数类型）", () => {
		const items = createTestItems(5)
		const isActive = (_: TestItemData, index: number) => index === 2

		render(<MagicList items={items} active={isActive} />)

		// 检查是否只有一个项目有 active 样式类
		const activeItems = document.querySelectorAll(".mock-active")
		expect(activeItems.length).toBe(1)

		// 检查激活项是否包含预期的标题
		const activeItem = activeItems[0]
		const parentElement = activeItem.closest(".mock-container")
		expect(parentElement?.textContent).toContain("测试项 2")
	})

	// 测试字符串项转换
	test("正确处理字符串项", () => {
		const stringItems = ["item-0", "item-1", "item-2"]

		render(<MagicList items={stringItems} />)

		// 验证所有项都被渲染
		const elements = document.querySelectorAll(".mock-container")
		expect(elements.length).toBe(3)
	})

	// 性能测试：渲染大量项目
	test("性能测试：渲染大量列表项", () => {
		// 创建100个测试项
		const items = createTestItems(100)

		// 记录渲染开始时间
		const startTime = performance.now()

		render(<MagicList items={items} />)

		// 记录渲染结束时间
		const endTime = performance.now()

		// 计算渲染时间
		const renderTime = endTime - startTime

		// 渲染时间不应该超过特定阈值，这里设置为200ms作为示例
		console.log(`渲染100个项目耗时: ${renderTime}ms`)
		expect(renderTime).toBeLessThan(200)

		// 验证所有项都被渲染
		const elements = document.querySelectorAll(".mock-container")
		expect(elements.length).toBe(100)
	})

	// 测试自定义列表项组件
	test("支持自定义列表项组件", () => {
		const items = createTestItems(3)

		// 创建自定义列表项组件
		const CustomListItem = vi.fn().mockImplementation((props: any) => (
			<div data-testid="custom-item">
				<span>自定义项: {props.data.title}</span>
			</div>
		))

		render(<MagicList items={items} listItemComponent={CustomListItem} />)

		// 验证自定义组件被使用
		expect(CustomListItem).toHaveBeenCalledTimes(3)
		expect(screen.getAllByTestId("custom-item").length).toBe(3)
	})
})
