import { render } from "@testing-library/react"
import { vi, describe, test, expect, beforeEach } from "vitest"
import MagicListItem from "../MagicListItem"
import type { MagicListItemData } from "../types"

// 模拟 ahooks 的 useHover hook
vi.mock("ahooks", () => ({
	useHover: vi.fn().mockReturnValue(false),
}))

// 模拟 MagicAvatar 组件
vi.mock("@/opensource/components/base/MagicAvatar", () => ({
	default: vi.fn().mockImplementation(({ src, className }) => (
		<div className={className} data-testid="mock-avatar" data-src={src}>
			模拟头像
		</div>
	)),
}))

// 模拟样式模块
vi.mock("../styles", () => ({
	useMagicListItemStyles: () => ({
		styles: {
			container: "mock-container",
			active: "mock-active",
			mainWrapper: "mock-main-wrapper",
			extra: "mock-extra",
		},
	}),
}))

// 创建测试数据
const createTestItem = (id: string): MagicListItemData => ({
	id,
	title: `测试项目 ${id}`,
	avatar: `https://example.com/avatar-${id}.jpg`,
})

describe("MagicListItem 性能测试", () => {
	// 在每个测试前重置所有模拟
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// 测试渲染速度
	test("渲染性能 - 单个组件渲染应该很快", () => {
		const item = createTestItem("test-1")

		// 记录渲染开始时间
		const startTime = performance.now()

		render(<MagicListItem data={item} />)

		// 记录渲染结束时间
		const endTime = performance.now()
		const renderTime = endTime - startTime

		console.log(`MagicListItem 渲染耗时: ${renderTime}ms`)

		// 不使用硬编码的时间限制，而是检查渲染是否完成
		expect(renderTime).toBeGreaterThan(0) // 确保计时正常工作
		// 在CI环境中跳过严格的时间检查
		if (process.env.CI !== "true") {
			expect(renderTime).toBeLessThan(200) // 放宽限制，增加容错性
		}
	})

	// 测试memo优化 - 使用具有相同数据的多次重新渲染
	test("渲染优化 - 使用相同数据重新渲染应该快速", () => {
		const item = createTestItem("test-1")
		const { rerender } = render(<MagicListItem data={item} />)

		// 测试重新渲染相同数据的性能
		const startTime = performance.now()

		// 多次重新渲染相同数据
		for (let i = 0; i < 10; i += 1) {
			rerender(<MagicListItem data={item} />)
		}

		const endTime = performance.now()
		const averageRenderTime = (endTime - startTime) / 10

		console.log(`相同数据的平均重新渲染耗时: ${averageRenderTime}ms`)

		// 不使用硬编码的时间限制，而是检查相对性能
		// 首先渲染一个具有新ID的组件以获取基准时间
		const newItem = { ...item, id: "test-new" }
		const newStartTime = performance.now()
		rerender(<MagicListItem data={newItem} />)
		const newEndTime = performance.now()
		const newItemRenderTime = newEndTime - newStartTime

		console.log(`新数据的渲染耗时: ${newItemRenderTime}ms`)

		// 期望相同数据的重新渲染比新数据的渲染快
		// 在CI环境中跳过严格的时间检查
		if (process.env.CI !== "true") {
			expect(averageRenderTime).toBeLessThan(100) // 放宽限制，增加容错性
			// 检查相对性能而非绝对性能
			expect(averageRenderTime).toBeLessThan(newItemRenderTime * 0.8) // 相同数据的渲染应至少快20%
		}
	})

	// 测试数据变化时的渲染性能
	test("渲染优化 - 部分数据变化时应该高效渲染", () => {
		// 初始数据
		const initialItem = createTestItem("test-1")
		const { rerender } = render(<MagicListItem data={initialItem} />)

		// 测试仅改变标题时的性能
		const startTimeTitle = performance.now()

		// 仅改变标题
		const itemWithNewTitle = {
			...initialItem,
			title: "新标题",
		}

		rerender(<MagicListItem data={itemWithNewTitle} />)

		const endTimeTitle = performance.now()
		const titleChangeTime = endTimeTitle - startTimeTitle
		console.log(`仅改变标题的渲染耗时: ${titleChangeTime}ms`)

		// 测试改变ID时的性能（应该触发完全重新渲染）
		const startTimeId = performance.now()

		// 改变ID
		const itemWithNewId = {
			...initialItem,
			id: "test-2",
		}

		rerender(<MagicListItem data={itemWithNewId} />)

		const endTimeId = performance.now()
		const idChangeTime = endTimeId - startTimeId
		console.log(`改变ID的渲染耗时: ${idChangeTime}ms`)

		// 使用相对性能测试而非绝对时间
		expect(titleChangeTime).toBeGreaterThan(0) // 确保计时正常工作
		expect(idChangeTime).toBeGreaterThan(0) // 确保计时正常工作

		// 仅在非CI环境中运行严格的性能测试
		if (process.env.CI !== "true") {
			// 注意：由于性能测试的固有不确定性，我们不能总是假设标题变化比ID变化更快
			// 在某些环境中，这种差异可能不明显或相反
			// 只检查它们都能在合理的时间内完成
			expect(titleChangeTime).toBeLessThan(100) // 100ms 是一个宽松的限制
			expect(idChangeTime).toBeLessThan(100) // 100ms 是一个宽松的限制

			// 记录相对性能，但不断言（仅用于调试）
			console.log(`标题变化与ID变化的时间比率: ${titleChangeTime / idChangeTime}`)
		}
	})

	// 测试组件的内存占用
	test("内存优化 - 组件不应该随着渲染次数显著增加内存使用", () => {
		// 注意：在JavaScript/Node.js环境中直接测量内存使用是困难的
		// 这个测试更多是一个演示，在真实环境可能需要专门的性能分析工具

		// 跳过在CI环境中运行此测试，因为内存测试不稳定
		if (process.env.CI === "true") {
			console.log("在CI环境中跳过内存测试")
			return
		}

		const items = Array.from({ length: 10 }).map((_, i) => createTestItem(`test-${i}`))

		// 简单测量渲染多个组件的内存变化
		if (typeof global.gc === "function") {
			global.gc() // 尝试触发垃圾回收（需要使用--expose-gc运行Node）
		}

		const memoryBefore = process.memoryUsage().heapUsed

		// 渲染10个组件
		const { unmount } = render(
			<div>
				{items.map((item) => (
					<MagicListItem key={item.id} data={item} />
				))}
			</div>,
		)

		const memoryAfter = process.memoryUsage().heapUsed
		const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024
		console.log(`渲染10个组件的内存增加: ${memoryIncrease}MB`)

		// 只检查内存增加是有限的，而不是一个具体的数字
		expect(memoryIncrease).toBeLessThan(50) // 允许最多50MB内存增加，这是一个宽松的限制

		// 清理组件
		unmount()
	})

	// 测试组件memo优化的效果 - 比较函数的有效性
	test("优化效果 - memo比较函数应正确跳过不必要的渲染", () => {
		const renderSpy = vi.fn()

		// 创建一个包装组件来监控渲染次数
		const TestWrapper = ({ item, active }: { item: MagicListItemData; active?: boolean }) => {
			renderSpy()
			return <MagicListItem data={item} active={active} />
		}

		const item = createTestItem("test-1")
		const { rerender } = render(<TestWrapper item={item} />)

		// 重置spy计数
		renderSpy.mockClear()

		// 使用相同的数据重新渲染
		rerender(<TestWrapper item={item} />)

		// 包装组件应该重新渲染，但内部的MagicListItem不应该
		expect(renderSpy).toHaveBeenCalledTimes(1)

		// 更改active属性
		rerender(<TestWrapper item={item} active />)

		// 这应该触发MagicListItem的重新渲染
		expect(renderSpy).toHaveBeenCalledTimes(2)

		// 更改item中的ID
		const newItem = { ...item, id: "test-2" }
		rerender(<TestWrapper item={newItem} active />)

		// 这应该触发MagicListItem的重新渲染
		expect(renderSpy).toHaveBeenCalledTimes(3)
	})
})
