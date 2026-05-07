import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import CommonListPanel from "@/components/CommonListPanel"
import { NodeType, type TreeNode } from "@/components/UserSelector/types"

const list: TreeNode[] = [
	{
		id: "dept-1",
		name: "研发部",
		dataType: NodeType.Department,
		employee_sum: 12,
	},
	{
		id: "user-1",
		name: "张三",
		dataType: NodeType.User,
		position: "前端工程师",
	},
]

describe("CommonListPanel", () => {
	it("支持按选中状态渲染列表项右侧文案", () => {
		render(
			<CommonListPanel<TreeNode>
				list={list}
				checkboxOptions={{ checked: [list[0]] }}
				renderItemRight={(item, { isChecked }) => (
					<span>{isChecked ? "已选择" : `${item.name} 可选择`}</span>
				)}
			/>,
		)

		expect(screen.getByText("已选择")).toBeInTheDocument()
		expect(screen.getByText("张三 可选择")).toBeInTheDocument()
	})
})
