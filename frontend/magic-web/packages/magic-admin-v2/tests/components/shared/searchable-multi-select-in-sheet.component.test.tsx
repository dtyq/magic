import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SearchableMultiSelect } from "@magic-admin-v2/components/searchable-multi-select"
import { MarketCategorySelectCell } from "@magic-admin-v2/features/platform-official-marketplace/components/market-category-select-cell"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@magic-admin-v2/components/ui/sheet"

function ControlledSearchableMultiSelect() {
	const [open, setOpen] = useState(false)
	const [value, setValue] = useState<string[]>([])

	return (
		<SearchableMultiSelect
			ariaLabel="选择多个分类"
			clearLabel="清空分类搜索"
			emptyLabel="未分类"
			noMatchingLabel="没有匹配分类"
			onChange={setValue}
			onOpenChange={setOpen}
			open={open}
			options={[
				{ label: "研发", value: "engineering" },
				{ label: "设计", value: "design" },
			]}
			searchPlaceholder="搜索分类"
			selectedCountLabel={(count) => `已选 ${count} 个分类`}
			value={value}
		/>
	)
}

function MarketCategoryCell() {
	const [savedValue, setSavedValue] = useState<string[]>([])

	return (
		<>
			<MarketCategorySelectCell
				ariaLabel="选择市场分类"
				canEdit
				categoryIds={[]}
				categoryLabels={[]}
				categoryOptions={[
					{ label: "研发", value: "engineering" },
					{ label: "设计", value: "design" },
				]}
				clearLabel="清空分类"
				emptyLabel="未分类"
				isLoading={false}
				isSaving={false}
				noMatchingLabel="没有匹配分类"
				onSave={setSavedValue}
				searchPlaceholder="搜索分类"
				selectedCountLabel={(count) => `已选 ${count} 个分类`}
			/>
			<span data-testid="saved-category-value">{savedValue.join(",")}</span>
		</>
	)
}

function SearchableMultiSelectSheet() {
	return (
		<Sheet open onOpenChange={vi.fn()}>
			<SheetContent>
				<SheetTitle>高级搜索</SheetTitle>
				<SheetDescription>筛选审批模板交接记录</SheetDescription>
				<SearchableMultiSelect
					ariaLabel="选择审批模板"
					clearLabel="清空模板搜索"
					emptyLabel="全部模板"
					noMatchingLabel="没有匹配模板"
					onChange={vi.fn()}
					options={[
						{ label: "差旅审批", value: "travel" },
						{ label: "报销审批", value: "expense" },
					]}
					searchPlaceholder="搜索审批模板"
					selectedCountLabel={(count) => `已选 ${count} 个模板`}
					value={[]}
				/>
			</SheetContent>
		</Sheet>
	)
}

describe("SearchableMultiSelect in Sheet", () => {
	it("keeps the searchable popover inside the sheet focus scope", () => {
		render(<SearchableMultiSelectSheet />)

		fireEvent.click(screen.getByRole("button", { name: "选择审批模板" }))

		const searchInput = screen.getByPlaceholderText("搜索审批模板")
		const sheetContent = searchInput.closest('[data-slot="sheet-content"]')
		expect(sheetContent).not.toBeNull()
		const popoverContent = searchInput.closest('[data-slot="popover-content"]')
		expect(popoverContent).toHaveClass("absolute")
		expect(popoverContent).not.toHaveClass("fixed")

		fireEvent.change(searchInput, { target: { value: "报销" } })
		const listbox = screen.getByRole("listbox")
		expect(within(listbox).getByText("报销审批")).toBeInTheDocument()
		expect(within(listbox).queryByText("差旅审批")).not.toBeInTheDocument()
	})

	it("keeps category drafts local until the popover loses focus", () => {
		render(<MarketCategoryCell />)

		fireEvent.click(screen.getByRole("button", { name: "选择市场分类" }))
		fireEvent.click(screen.getByRole("option", { name: "研发" }))

		expect(screen.getByRole("listbox")).toBeInTheDocument()
		expect(screen.getByTestId("saved-category-value")).toHaveTextContent("")

		fireEvent.pointerDown(document.body)
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
		expect(screen.getByTestId("saved-category-value")).toHaveTextContent("engineering")
	})

	it("keeps a controlled popover open while selections rerender", () => {
		render(<ControlledSearchableMultiSelect />)

		fireEvent.click(screen.getByRole("button", { name: "选择多个分类" }))
		const listbox = screen.getByRole("listbox")
		fireEvent.pointerDown(within(listbox).getByRole("option", { name: "研发" }))
		fireEvent.click(within(listbox).getByRole("option", { name: "研发" }))

		expect(screen.getByRole("listbox")).toBeInTheDocument()
		expect(screen.getByRole("option", { name: "设计" })).toBeInTheDocument()

		fireEvent.pointerDown(document.body)
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
	})
})
