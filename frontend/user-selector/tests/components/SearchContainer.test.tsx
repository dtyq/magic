import { createRef } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SearchContainer, { type SearchContainerRef } from "@/components/SearchContainer"
import type { TreeNode } from "@/components/UserSelector/types"

const searchList: TreeNode[] = [
	{
		id: "user-1",
		name: "Alice",
		dataType: "user",
	},
] as TreeNode[]

describe("SearchContainer", () => {
	it("默认展示 children，输入后切换为搜索列表并触发回调", () => {
		const onSearchChange = vi.fn()

		render(
			<SearchContainer searchData={{ items: searchList }} onSearchChange={onSearchChange}>
				<div>default-content</div>
			</SearchContainer>,
		)

		expect(screen.getByText("default-content")).toBeInTheDocument()

		const input = screen.getByRole("textbox")
		fireEvent.change(input, { target: { value: "al" } })

		expect(onSearchChange).toHaveBeenCalledWith("al")
		expect(screen.queryByText("default-content")).not.toBeInTheDocument()
		expect(screen.getByRole("button")).toBeInTheDocument()
	})

	it("点击清空按钮会重置输入并回调空字符串", () => {
		const onSearchChange = vi.fn()

		render(<SearchContainer onSearchChange={onSearchChange} />)

		const input = screen.getByRole("textbox") as HTMLInputElement
		fireEvent.change(input, { target: { value: "keyword" } })
		fireEvent.click(screen.getByRole("button"))

		expect(input.value).toBe("")
		expect(onSearchChange).toHaveBeenLastCalledWith("")
	})

	it("支持通过 ref 调用 clearSearchValue", () => {
		const onSearchChange = vi.fn()
		const ref = createRef<SearchContainerRef>()

		render(<SearchContainer ref={ref} onSearchChange={onSearchChange} />)

		const input = screen.getByRole("textbox") as HTMLInputElement
		fireEvent.change(input, { target: { value: "hello" } })
		expect(input.value).toBe("hello")

		act(() => {
			ref.current?.clearSearchValue()
		})

		expect(input.value).toBe("")
		expect(onSearchChange).toHaveBeenLastCalledWith("")
	})
})
