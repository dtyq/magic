import { render, screen, fireEvent, act } from "@testing-library/react"
import { vi, describe, test, expect, beforeEach, afterEach } from "vitest"
import MagicList from "../MagicList"
import type { MagicListItemData } from "../types"

// 模拟MagicAvatar组件
vi.mock("@/opensource/components/base/MagicAvatar", () => ({
	default: ({ children, className, size }: any) => (
		<div className={className || "mock-avatar"} data-size={size}>
			{children || "Avatar"}
		</div>
	),
}))

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
		avatar: `https://example.com/avatar/${index}.jpg`,
		hoverSection: <div>悬停内容 {index}</div>,
	}))
}

describe("MagicList 性能测试", () => {
	// 高级别模拟
	let originalConsoleWarn: typeof console.warn
	let warnSpy: ReturnType<typeof vi.fn>

	beforeEach(() => {
		originalConsoleWarn = console.warn
		warnSpy = vi.fn()
		console.warn = warnSpy
	})

	afterEach(() => {
		console.warn = originalConsoleWarn
	})

	// 测试可能导致不必要重渲染的 active 属性
	test("active 属性变化时不应导致过度重渲染", async () => {
		const items = createTestItems(20)

		const { rerender } = render(<MagicList items={items} active="item-1" />)

		// 重置模拟
		warnSpy.mockReset()

		// 数据没变，只有 active 属性变化
		rerender(<MagicList items={items} active="item-2" />)

		// 期望没有发生 React 优化警告
		expect(warnSpy).not.toHaveBeenCalledWith(
			expect.stringMatching(/Component is re-rendering too many times/),
		)
	})

	// 测试大量数据渲染性能
	test("渲染大量数据时的性能", () => {
		const smallItems = createTestItems(10)
		const mediumItems = createTestItems(100)
		const largeItems = createTestItems(500)

		// 记录小列表渲染时间
		const smallStartTime = performance.now()
		const { unmount: unmountSmall } = render(<MagicList items={smallItems} />)
		const smallEndTime = performance.now()
		unmountSmall()

		// 记录中等列表渲染时间
		const mediumStartTime = performance.now()
		const { unmount: unmountMedium } = render(<MagicList items={mediumItems} />)
		const mediumEndTime = performance.now()
		unmountMedium()

		// 记录大列表渲染时间
		const largeStartTime = performance.now()
		const { unmount: unmountLarge } = render(<MagicList items={largeItems} />)
		const largeEndTime = performance.now()
		unmountLarge()

		// 计算渲染时间
		const smallRenderTime = smallEndTime - smallStartTime
		const mediumRenderTime = mediumEndTime - mediumStartTime
		const largeRenderTime = largeEndTime - largeStartTime

		console.log(`渲染 10 个项目耗时: ${smallRenderTime}ms`)
		console.log(`渲染 100 个项目耗时: ${mediumRenderTime}ms`)
		console.log(`渲染 500 个项目耗时: ${largeRenderTime}ms`)

		// 检查渲染时间是否接近线性增长
		// 如果线性增长，mediumRenderTime 应约为 smallRenderTime 的 10 倍
		// largeRenderTime 应约为 smallRenderTime 的 50 倍
		// 但考虑到 React 的优化和其他因素，使用一个合理的倍数检查
		expect(mediumRenderTime).toBeLessThan(smallRenderTime * 20)
		expect(largeRenderTime).toBeLessThan(mediumRenderTime * 10)
	})

	// 测试频繁更新的性能
	test("频繁更新时的性能", () => {
		const items = createTestItems(50)
		const { rerender } = render(<MagicList items={items} />)

		const iterations = 10
		const startTime = performance.now()

		// 模拟多次重新渲染
		for (let i = 0; i < iterations; i += 1) {
			// 每次更新不同的 active 项
			act(() => {
				rerender(<MagicList items={items} active={`item-${i}`} />)
			})
		}

		const endTime = performance.now()
		const averageRenderTime = (endTime - startTime) / iterations

		console.log(`频繁更新测试: 平均每次渲染耗时 ${averageRenderTime}ms`)

		// 期望平均渲染时间不超过一个合理阈值
		expect(averageRenderTime).toBeLessThan(50)
	})

	// 测试记忆化是否正常工作
	test("记忆化优化应该有效减少重渲染", () => {
		const items = createTestItems(20)
		const onClick = vi.fn()

		// 首次渲染
		const { rerender } = render(<MagicList items={items} onItemClick={onClick} />)

		// 用相同的 props 重新渲染
		const startTime = performance.now()
		rerender(<MagicList items={items} onItemClick={onClick} />)
		const endTime = performance.now()

		// 由于 memo 优化，相同 props 的重渲染应该非常快
		const rerenderTime = endTime - startTime
		console.log(`相同 props 重渲染耗时: ${rerenderTime}ms`)

		// 期望重渲染时间极短
		expect(rerenderTime).toBeLessThan(10)

		// 非引用相等但内容相同的 props
		const sameContentItems = createTestItems(20)
		const sameContentOnClick = vi.fn()

		const startTimeNewProps = performance.now()
		rerender(<MagicList items={sameContentItems} onItemClick={sameContentOnClick} />)
		const endTimeNewProps = performance.now()

		const newPropsRerenderTime = endTimeNewProps - startTimeNewProps
		console.log(`内容相同但引用不同的 props 重渲染耗时: ${newPropsRerenderTime}ms`)

		// 这里可能会暴露出记忆化不足的问题，因为 props 引用改变了
		// 但内容相同，理想情况下不应该触发完整重渲染
	})

	// 测试大量列表项的鼠标交互性能
	test("与大量列表项进行鼠标交互的性能", () => {
		const items = createTestItems(100)

		render(<MagicList items={items} />)

		// 获取所有列表项
		const listItems = screen.getAllByText(/测试项 \d+/)

		// 模拟鼠标悬停在多个项目上
		const startTime = performance.now()

		for (let i = 0; i < 10; i += 1) {
			// 模拟鼠标进入
			fireEvent.mouseEnter(listItems[i])
			// 模拟鼠标离开
			fireEvent.mouseLeave(listItems[i])
		}

		const endTime = performance.now()
		const hoverTime = endTime - startTime

		console.log(`10次鼠标悬停交互耗时: ${hoverTime}ms`)

		// 期望鼠标交互性能良好
		expect(hoverTime / 10).toBeLessThan(20) // 每次交互平均不超过20ms
	})
})
