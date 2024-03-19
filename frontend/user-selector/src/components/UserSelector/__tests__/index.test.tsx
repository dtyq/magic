import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { forwardRef } from "react"
import type { ReactNode } from "react"
import type { TreeNode, Organization, OrganizationNode } from "@/components/UserSelector/types"
import { NodeType } from "@/components/UserSelector/types"
import UserSelector from "../index"
import "@testing-library/jest-dom"

type SearchContainerMockProps = {
	children?: ReactNode
	onSearchChange?: (value: string) => void
}

type CheckboxOptionsMock = {
	disabled?: TreeNode[]
	checked?: TreeNode[]
	onChange?: (checked: TreeNode[]) => void
}

type OrganizationPanelMockProps = {
	loading?: boolean
	data: TreeNode[]
	checkboxOptions?: CheckboxOptionsMock
	onItemClick?: (item: TreeNode) => void
}

type SelectedPanelMockProps = {
	checkboxOptions?: CheckboxOptionsMock
	onClose?: (item: TreeNode) => void
	onCancel?: () => void
	onOk?: () => void
}

// 模拟依赖模块
vi.mock("../../../components/SearchContainer", () => {
	const SearchContainerMock = forwardRef<HTMLDivElement, SearchContainerMockProps>(
		({ children, onSearchChange }, ref) => (
			<div data-testid="search-container" ref={ref}>
				<input
					placeholder="搜索"
					onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
					data-testid="search-input"
				/>
				{children}
			</div>
		),
	)
	SearchContainerMock.displayName = "SearchContainerMock"

	return {
		default: SearchContainerMock,
	}
})

vi.mock("../../../components/OrganizationPanel", () => ({
	default: ({ loading, data, checkboxOptions, onItemClick }: OrganizationPanelMockProps) => (
		<div data-testid="organization-panel">
			{loading && <div role="progressbar">Loading...</div>}
			<button
				type="button"
				onClick={() => {
					checkboxOptions?.onChange?.(data)
				}}
				data-testid="select-all"
			>
				全选
			</button>
			<div className="mock-tree">
				{data.map((item: TreeNode) => (
					<div key={item.id} data-testid={`tree-node-${item.id}`}>
						<label htmlFor={`checkbox-${item.id}`}>
							<input
								id={`checkbox-${item.id}`}
								type="checkbox"
								disabled={checkboxOptions?.disabled?.some(
									(disabled: TreeNode) => disabled.id === item.id,
								)}
								onChange={() => {
									const newChecked = [...(checkboxOptions?.checked || [])]
									const index = newChecked.findIndex(
										(node: TreeNode) => node.id === item.id,
									)
									if (index === -1) {
										newChecked.push(item)
									} else {
										newChecked.splice(index, 1)
									}
									checkboxOptions?.onChange?.(newChecked)
								}}
								aria-label={item.name}
							/>
							{item.name}
						</label>
						<button
							type="button"
							onClick={() => onItemClick && onItemClick(item)}
							data-testid={`click-${item.id}`}
						>
							展开
						</button>
					</div>
				))}
			</div>
		</div>
	),
}))

vi.mock("../../../components/SelectedPanel", () => ({
	default: ({ checkboxOptions, onClose, onCancel, onOk }: SelectedPanelMockProps) => {
		const selected = checkboxOptions?.checked ?? []
		return (
			<div data-testid="selected-panel">
				<div className="selected-list">
					{selected.map((item: TreeNode) => (
						<div key={item.id} data-testid={`selected-item-${item.id}`}>
							{item.name}
							<button
								type="button"
								onClick={() => onClose && onClose(item)}
								data-testid={`close-${item.id}`}
							>
								删除
							</button>
						</div>
					))}
				</div>
				<div className="actions">
					<button type="button" onClick={onCancel} data-testid="cancel-button">
						取消
					</button>
					<button type="button" onClick={onOk} data-testid="ok-button">
						确定
					</button>
				</div>
			</div>
		)
	},
}))

// 基础测试数据
const mockData: OrganizationNode[] = [
	{
		id: "1",
		name: "测试用户1",
		real_name: "测试用户1",
		dataType: NodeType.User,
	},
	{
		id: "2",
		name: "测试用户2",
		real_name: "测试用户2",
		dataType: NodeType.User,
	},
]

// 组织信息
const mockOrganization: Organization = {
	id: "org_001",
	name: "测试组织",
	logo: "https://example.com/logo.png",
}

describe("UserSelector 组件基础测试", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("应该正确渲染基本组件", () => {
		render(<UserSelector open data={mockData} />)
		expect(screen.getByTestId("search-container")).toBeInTheDocument()
		expect(screen.getByTestId("organization-panel")).toBeInTheDocument()
		expect(screen.getByTestId("selected-panel")).toBeInTheDocument()
	})

	it("应该能够选择用户", async () => {
		const onSelectChange = vi.fn()
		render(<UserSelector open data={mockData} onSelectChange={onSelectChange} />)

		const checkbox = screen.getByLabelText("测试用户1")
		fireEvent.click(checkbox)

		await waitFor(() => {
			expect(onSelectChange).toHaveBeenCalledWith([
				expect.objectContaining({
					id: "1",
					name: "测试用户1",
				}),
			])
		})
	})

	it("应该能够触发搜索", async () => {
		const onSearchChange = vi.fn()
		render(<UserSelector open data={mockData} onSearchChange={onSearchChange} />)

		const searchInput = screen.getByTestId("search-input")
		fireEvent.change(searchInput, { target: { value: "测试" } })

		await waitFor(() => {
			expect(onSearchChange).toHaveBeenCalledWith("测试", undefined)
		})
	})

	it("应该能够处理确认和取消操作", async () => {
		const onOk = vi.fn()
		const onCancel = vi.fn()

		render(<UserSelector open data={mockData} onOk={onOk} onCancel={onCancel} />)

		const okButton = screen.getByTestId("ok-button")
		const cancelButton = screen.getByTestId("cancel-button")

		fireEvent.click(okButton)
		expect(onOk).toHaveBeenCalled()

		fireEvent.click(cancelButton)
		expect(onCancel).toHaveBeenCalled()
	})

	it("应该正确处理禁用状态", async () => {
		const disabledValues = [mockData[0]]
		render(<UserSelector open data={mockData} disabledValues={disabledValues} />)

		const checkbox = screen.getByLabelText("测试用户1")
		expect(checkbox).toBeDisabled()
	})

	it("应该能够移除已选择的项目", async () => {
		const onSelectChange = vi.fn()
		const selectedUser = mockData[0]

		render(
			<UserSelector
				open
				data={mockData}
				selectedValues={[selectedUser]}
				onSelectChange={onSelectChange}
			/>,
		)

		const closeButton = screen.getByTestId(`close-${selectedUser.id}`)
		fireEvent.click(closeButton)

		await waitFor(() => {
			expect(onSelectChange).toHaveBeenCalledWith([])
		})
	})
})

// 生成大规模测试数据
const generateLargeStaticData = (count: number): OrganizationNode[] => {
	const result: OrganizationNode[] = []

	for (let i = 0; i < count; i += 1) {
		if (i % 5 === 0) {
			// 每5个添加一个部门
			result.push({
				id: `dept-${i}`,
				name: `部门${i}`,
				dataType: NodeType.Department,
				has_child: true,
			} as OrganizationNode)
		} else {
			// 其余添加用户
			result.push({
				id: `user-${i}`,
				name: `用户${i}`,
				real_name: `用户${i}`,
				dataType: NodeType.User,
			} as OrganizationNode)
		}
	}

	return result
}

describe("UserSelector 大规模静态数据测试", () => {
	it("应该能够正确处理大规模静态数据渲染", async () => {
		const largeData = generateLargeStaticData(1000)

		// 检查渲染时间是否在合理范围内
		const startTime = performance.now()
		render(<UserSelector open data={largeData} organization={mockOrganization} checkbox />)
		const renderTime = performance.now() - startTime
		// console.log(`大规模静态数据渲染耗时: ${renderTime}ms`)
		expect(renderTime).toBeLessThan(1000) // 确保渲染时间在1秒内

		// 检查树节点是否正确渲染
		const treeNodes = document.querySelectorAll('div[data-testid^="tree-node-"]')
		expect(treeNodes.length).toBe(1000)
	})

	it("应该能够高效处理大规模数据的选择操作", async () => {
		const largeData = generateLargeStaticData(50)
		const onSelectChange = vi.fn()

		render(
			<UserSelector
				open
				data={largeData}
				organization={mockOrganization}
				checkbox
				onSelectChange={onSelectChange}
			/>,
		)

		const selectAllButton = screen.getByTestId("select-all")
		fireEvent.click(selectAllButton)

		await waitFor(() => {
			expect(onSelectChange).toHaveBeenCalledWith(largeData)
		})
	})
})

// 模拟动态加载数据测试
describe("UserSelector 动态数据加载测试", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("应该能够处理动态数据加载", async () => {
		// 初始数据只包含几个部门
		const initialData: OrganizationNode[] = [
			{
				id: "dept-1",
				name: "部门1",
				dataType: NodeType.Department,
				has_child: true,
			} as OrganizationNode,
			{
				id: "dept-2",
				name: "部门2",
				dataType: NodeType.Department,
				has_child: true,
			} as OrganizationNode,
		]

		// 模拟onItemClick加载更多数据的行为
		const onItemClick = vi.fn()
		const { rerender } = render(
			<UserSelector
				open
				data={initialData}
				organization={mockOrganization}
				checkbox
				onItemClick={onItemClick}
			/>,
		)

		// 点击展开部门1
		const expandButton = screen.getByTestId("click-dept-1")
		fireEvent.click(expandButton)

		// 检查onItemClick是否被调用
		expect(onItemClick).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "dept-1",
				name: "部门1",
			}),
			undefined,
		)

		// 模拟数据加载后的新数据
		const updatedData: OrganizationNode[] = [
			{
				id: "user-1-1",
				name: "用户1-1",
				real_name: "用户1-1",
				dataType: NodeType.User,
			} as OrganizationNode,
			{
				id: "user-1-2",
				name: "用户1-2",
				real_name: "用户1-2",
				dataType: NodeType.User,
			} as OrganizationNode,
		]

		// 使用新数据重新渲染组件
		rerender(
			<UserSelector
				open
				data={updatedData}
				organization={mockOrganization}
				checkbox
				onItemClick={onItemClick}
			/>,
		)
	})

	it("应该正确处理加载状态", async () => {
		// 模拟加载状态变化
		const { rerender } = render(
			<UserSelector open data={[]} organization={mockOrganization} loading />,
		)

		// 验证加载状态显示
		expect(screen.getByRole("progressbar")).toBeInTheDocument()

		// 模拟数据加载完成
		rerender(
			<UserSelector open data={mockData} organization={mockOrganization} loading={false} />,
		)

		// 验证加载状态消失
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
	})
})
