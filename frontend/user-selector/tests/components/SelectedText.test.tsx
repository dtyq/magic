import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SelectedText from "@/components/SelectedPanel/components/SelectedText"
import { AppearanceProvider } from "@/context/AppearanceProvider"
import { NodeType, type TreeNode } from "@/components/UserSelector/types"

const selectedNodes: TreeNode[] = [
	{ id: "d-1", name: "研发部", dataType: NodeType.Department },
	{ id: "u-1", name: "Alice", dataType: NodeType.User },
	{ id: "u-2", name: "Bob", dataType: NodeType.User },
	{ id: "g-1", name: "项目群", dataType: NodeType.Group },
] as TreeNode[]

describe("SelectedText", () => {
	it("根据 selected 统计并展示文案", () => {
		render(
			<AppearanceProvider language="en_US">
				<SelectedText selected={selectedNodes} />
			</AppearanceProvider>,
		)

		expect(screen.getByText("Selected")).toBeInTheDocument()
		expect(screen.getByText(/1 departments/)).toBeInTheDocument()
		expect(screen.getByText(/2 members/)).toBeInTheDocument()
		expect(screen.getByText(/1 groups/)).toBeInTheDocument()
	})

	it("checkbox 触发 onCheckAll 回调", () => {
		const onCheckAll = vi.fn()

		render(<SelectedText checkbox selected={selectedNodes} onCheckAll={onCheckAll} />)

		fireEvent.click(screen.getByRole("checkbox"))
		expect(onCheckAll).toHaveBeenCalledWith(true)
	})
})
