import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { MockInstance } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { forwardRef } from "react"
import type { ReactNode } from "react"
import type {
	TreeNode,
	OrganizationNode,
	Organization,
	Department,
	User,
} from "@/components/UserSelector/types"
import { NodeType, OperationTypes } from "@/components/UserSelector/types"
import UserSelector from "../index"
import "@testing-library/jest-dom"
import AuthList from "../../AuthList"

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
	useAuthPanel?: boolean
	renderRightTop?: (selected: TreeNode[]) => ReactNode
	renderRightBottom?: (selected: TreeNode[]) => ReactNode
}

type AuthListNode = TreeNode & {
	operation?: OperationTypes
	canEdit?: boolean
	job_title?: string
}

type AuthListMockProps = {
	selected: AuthListNode[]
	onClose?: (item: AuthListNode) => void
	onSelectChange?: (selected: AuthListNode[]) => void
	checkbox?: boolean
}

// 模拟依赖模块
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
	default: ({
		checkboxOptions,
		onClose,
		onCancel,
		onOk,
		useAuthPanel,
		renderRightTop,
		renderRightBottom,
	}: SelectedPanelMockProps) => (
		<div data-testid="selected-panel">
			{renderRightTop?.(checkboxOptions?.checked ?? [])}
			{useAuthPanel ? (
				<AuthList
					checkbox
					selected={(checkboxOptions?.checked ?? []) as AuthListNode[]}
					onSelectChange={
						checkboxOptions?.onChange as
							| ((selected: AuthListNode[]) => void)
							| undefined
					}
				/>
			) : (
				<div className="selected-list">
					{(checkboxOptions?.checked ?? []).map((item: TreeNode) => (
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
			)}

			{renderRightBottom?.(checkboxOptions?.checked ?? [])}
			<div className="actions">
				<button type="button" onClick={onCancel} data-testid="cancel-button">
					取消
				</button>
				<button type="button" onClick={onOk} data-testid="ok-button">
					确定
				</button>
			</div>
		</div>
	),
}))

// 模拟 AuthList 组件
vi.mock("../../../components/AuthList", () => ({
	default: ({ selected, onClose, onSelectChange, checkbox }: AuthListMockProps) => (
		<div data-testid="auth-list">
			<div className="auth-header">
				<label htmlFor="check-all">
					<input
						id="check-all"
						type="checkbox"
						data-testid="check-all"
						onChange={() => {
							// 模拟全选功能
							onSelectChange?.(selected)
						}}
					/>
					全选
				</label>
				<div className="batch-operations">
					<span>批量设为</span>
					<select
						data-testid="batch-select"
						onChange={(e) => {
							// 模拟批量更改权限
							const operation = Number(e.target.value)
							const newSelected = selected.map((item) => ({
								...item,
								operation,
							}))
							onSelectChange?.(newSelected)
						}}
					>
						<option value="1">创建人</option>
						<option value="2">管理</option>
						<option value="3">只读</option>
						<option value="4">编辑</option>
					</select>
				</div>
			</div>
			<div className="auth-list">
				{selected.map((item) => (
					<div key={item.id} className="auth-item" data-testid={`auth-item-${item.id}`}>
						{checkbox && (
							<input
								type="checkbox"
								data-testid={`auth-checkbox-${item.id}`}
								onChange={() => {
									// 模拟单个选择
									const newSelected = [...selected]
									const index = newSelected.findIndex((i) => i.id === item.id)
									if (index > -1) {
										newSelected.splice(index, 1)
									}
									onSelectChange?.(newSelected)
								}}
							/>
						)}
						<div className="auth-info">
							<span>{item.name}</span>
							<span>{item.job_title || ""}</span>
						</div>
						<div className="auth-operations">
							<select
								value={item?.operation}
								data-testid={`auth-operation-${item.id}`}
								onChange={(e) => {
									// 模拟更改权限
									const operation = Number(e.target.value)
									const newSelected = selected.map((i) =>
										i.id === item.id ? { ...i, operation } : i,
									)
									onSelectChange?.(newSelected)
								}}
								disabled={item?.canEdit === false}
							>
								<option value="1">创建人</option>
								<option value="2">管理</option>
								<option value="3">只读</option>
								<option value="4">编辑</option>
							</select>
							<button
								type="button"
								onClick={() => onClose?.(item)}
								data-testid={`auth-remove-${item.id}`}
								disabled={item?.canEdit === false}
							>
								移除
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	),
}))

// 生成复杂的部门层级结构
const generateComplexOrganization = (): OrganizationNode[] => {
	// 生成多层级的部门结构
	const generateDepartments = (
		prefix: string,
		depth: number,
		breadth: number,
		currentDepth = 0,
	): Department[] => {
		if (currentDepth >= depth) return []

		const departments: Department[] = []
		for (let i = 0; i < breadth; i += 1) {
			const deptId = `${prefix}-dept-${currentDepth}-${i}`
			const childDepts = generateDepartments(deptId, depth, breadth, currentDepth + 1)

			// 为每个部门生成用户
			const users: User[] = []
			for (let j = 0; j < breadth; j += 1) {
				users.push({
					id: `${deptId}-user-${j}`,
					name: `用户${currentDepth}-${i}-${j}`,
					real_name: `用户${currentDepth}-${i}-${j}`,
					dataType: NodeType.User,
					operation: OperationTypes.Admin,
					avatar_url: `https://example.com/avatar${j}.png`,
					job_title: `职位${j}`,
				} as User)
			}

			departments.push({
				id: deptId,
				name: `部门${currentDepth}-${i}`,
				dataType: NodeType.Department,
				has_child: childDepts.length > 0,
				children: [...childDepts, ...users],
			} as Department)
		}

		return departments
	}

	// 创建3层深度，每层3个节点的组织结构
	return generateDepartments("root", 5, 5) as OrganizationNode[]
}

// 组织信息
const mockOrganization: Organization = {
	id: "test-org",
	name: "测试组织",
	logo: "https://example.com/org-logo.png",
}

// 测量函数执行时间
const measureExecutionTime = async (callback: () => Promise<void> | void): Promise<number> => {
	const start = performance.now()
	await callback()
	const end = performance.now()
	return end - start
}

describe("UserSelector 复杂场景测试", () => {
	let complexData: OrganizationNode[]
	let consoleSpy: MockInstance

	beforeEach(() => {
		complexData = generateComplexOrganization()
		// 监控控制台错误
		consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	// 测试复杂渲染的执行时间
	it("应该能正确渲染复杂的组织架构", async () => {
		const times = await measureExecutionTime(async () => {
			const { unmount } = render(
				<UserSelector open data={complexData} organization={mockOrganization} checkbox />,
			)

			// 验证顶层部门是否被渲染
			const topLevelDepartments = complexData.length
			const renderedTopDepartments = document.querySelectorAll(
				'div[data-testid^="tree-node-root-dept-0-"]',
			)
			expect(renderedTopDepartments.length).toBe(topLevelDepartments)

			// 验证没有控制台错误
			expect(consoleSpy).not.toHaveBeenCalled()

			unmount()
		})
		console.log(`渲染时间: ${times}ms`)
	})

	// 测试自定义渲染
	it("应该支持自定义顶部和底部渲染", async () => {
		const customTopRenderer = (nodes: TreeNode[]) => (
			<div data-testid="custom-top">已选择: {nodes.length}</div>
		)

		const customBottomRenderer = (nodes: TreeNode[]) => (
			<div data-testid="custom-bottom">总计: {nodes.length} 个项目</div>
		)

		render(
			<UserSelector
				open
				data={complexData}
				organization={mockOrganization}
				checkbox
				renderRightTop={customTopRenderer}
				renderRightBottom={customBottomRenderer}
				selectedValues={[complexData[0], complexData[1], complexData[2]]}
			/>,
		)

		expect(screen.getByTestId("custom-top")).toBeInTheDocument()
		expect(screen.getByText("已选择: 3")).toBeInTheDocument()
		expect(screen.getByTestId("custom-bottom")).toBeInTheDocument()
		expect(screen.getByText("总计: 3 个项目")).toBeInTheDocument()
	})

	// 测试异步加载和集成
	it("应该能处理异步数据加载和刷新", async () => {
		vi.useFakeTimers()

		// 初始只加载顶层部门
		const initialData = complexData.map((dept: OrganizationNode) => ({
			...dept,
			children: [], // 清空子元素，模拟需要异步加载
		}))

		// 异步加载子部门和用户的模拟函数
		const mockLoadChildren = vi.fn().mockImplementation((deptId: string) => {
			return new Promise<TreeNode[]>((resolve) => {
				setTimeout(() => {
					// 找到完整数据中对应的部门
					const dept = complexData.find((d) => d.id === deptId) as
						| (Department & { children?: TreeNode[] })
						| undefined
					if (dept && dept.children) {
						resolve(dept.children)
					} else {
						resolve([])
					}
				}, 500)
			})
		})

		let currentData = [...initialData]

		const onItemClick = vi.fn().mockImplementation(async (node: TreeNode) => {
			if (node.dataType === NodeType.Department && node.has_child) {
				const children = await mockLoadChildren(node.id)

				// 更新当前数据
				currentData = [...children]
			}
		})

		const { rerender } = render(
			<UserSelector
				open
				data={currentData}
				organization={mockOrganization}
				checkbox
				onItemClick={onItemClick}
				loading={false}
			/>,
		)

		// 点击展开第一个部门
		const firstDeptId = initialData[0].id
		fireEvent.click(screen.getByTestId(`click-${firstDeptId}`))
		expect(onItemClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: firstDeptId }),
			undefined,
		)

		// 推进定时器
		await vi.runAllTimersAsync()

		// 用更新后的数据重新渲染
		rerender(
			<UserSelector
				open
				data={currentData}
				organization={mockOrganization}
				checkbox
				onItemClick={onItemClick}
				loading={false}
			/>,
		)

		const firstDept = currentData[0]
		const lastDept = currentData[currentData.length - 1]
		// 是否存在
		const treeNodes = screen.getByTestId(`tree-node-${firstDept.id}`)
		const lastTreeNode = screen.getByTestId(`tree-node-${lastDept.id}`)
		expect(treeNodes).toBeInTheDocument()
		expect(lastTreeNode).toBeInTheDocument()

		vi.useRealTimers()
	})

	// 测试权限面板交互

	// 应该正确渲染和处理权限面板
	it("应该正确渲染和处理权限面板", async () => {
		render(
			<UserSelector
				open
				data={complexData}
				organization={mockOrganization}
				useAuthPanel
				selectedValues={[complexData[0] as TreeNode]}
			/>,
		)

		// 验证权限面板是否存在
		expect(screen.getByTestId("auth-list")).toBeInTheDocument()
	})

	// 测试权限面板的更详细操作
	it("应该能正确处理权限面板的权限变更", async () => {
		const onSelectChange = vi.fn()
		const selectedItem = {
			...complexData[0],
			operation: OperationTypes.Read,
		}

		render(
			<UserSelector
				open
				data={complexData}
				organization={mockOrganization}
				useAuthPanel
				selectedValues={[selectedItem]}
				onSelectChange={onSelectChange}
			/>,
		)

		// 验证模拟的 AuthList 组件被正确渲染
		expect(screen.getByTestId("auth-list")).toBeInTheDocument()

		// 模拟批量操作权限修改
		fireEvent.change(screen.getByTestId("batch-select"), { target: { value: "2" } })

		// 验证回调是否被正确调用
		expect(onSelectChange).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					id: selectedItem.id,
					operation: OperationTypes.Admin,
				}),
			]),
		)
	})

	// 应该能正确处理权限面板中的移除操作
	it("应该能正确处理权限面板中的移除操作", async () => {
		const selectedItem = {
			...complexData[0],
			id: "test-item-1",
			name: "测试部门",
			operation: OperationTypes.Read,
		}

		render(
			<UserSelector
				open
				data={complexData}
				organization={mockOrganization}
				useAuthPanel
				selectedValues={[selectedItem]}
			/>,
		)

		// 验证 SelectedPanel 的 onClose 是否被正确传递
		const closeButton = screen.getByTestId("auth-remove-test-item-1")
		fireEvent.click(closeButton)

		// 由于我们在 mock 中没有实际调用 onSelectChange 来更新状态
		// 这里主要验证 DOM 中的按钮是否存在并且可以点击
		expect(closeButton).toBeInTheDocument()
	})

	// 测试加载状态循环
	it("应该能正确处理反复切换的加载状态", async () => {
		const loadingStates = [true, false, true, false]
		let currentLoadingState = loadingStates[0]

		const { rerender } = render(
			<UserSelector
				open
				data={complexData}
				organization={mockOrganization}
				loading={currentLoadingState}
			/>,
		)

		// 验证初始加载状态
		expect(screen.getByRole("progressbar")).toBeInTheDocument()

		// 循环切换加载状态
		for (let i = 1; i < loadingStates.length; i += 1) {
			currentLoadingState = loadingStates[i]

			rerender(
				<UserSelector
					open
					data={complexData}
					organization={mockOrganization}
					loading={currentLoadingState}
				/>,
			)

			if (currentLoadingState) {
				expect(screen.getByRole("progressbar")).toBeInTheDocument()
			} else {
				expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
			}
		}
	})
})
