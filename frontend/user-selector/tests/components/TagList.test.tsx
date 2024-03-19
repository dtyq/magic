import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TagList from "@/components/TagList"
import { NodeType, type TreeNode } from "@/components/UserSelector/types"

const firstUser: TreeNode = {
	id: "u-1",
	name: "Alice",
	dataType: NodeType.User,
}

const secondUser: TreeNode = {
	id: "u-2",
	name: "Bob",
	dataType: NodeType.User,
}

describe("TagList", () => {
	it("渲染已选标签，且禁选项不展示关闭按钮", () => {
		const onClose = vi.fn()

		render(
			<TagList
				selected={[firstUser, secondUser]}
				disabledNodes={[firstUser]}
				onClose={onClose}
			/>,
		)

		expect(screen.getByText("Alice")).toBeInTheDocument()
		expect(screen.getByText("Bob")).toBeInTheDocument()

		const closeButtons = screen.getAllByRole("button")
		expect(closeButtons).toHaveLength(1)

		fireEvent.click(closeButtons[0])
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(onClose).toHaveBeenCalledWith(secondUser)
	})
})
