import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "../../../src/components/data-table"
import { Checkbox } from "../../../src/components/ui/checkbox"
import { Switch } from "../../../src/components/ui/switch"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"common.details": "详情",
				"common.viewDetails": "查看详情",
			})[key] ?? key,
	}),
}))

type Item = {
	id: string
	status: string
	team: string
}

const columns: Array<ColumnDef<Item>> = [
	{
		id: "select",
		header: "",
		cell: () => <Checkbox aria-label="选择模型 A" />,
	},
	{
		accessorKey: "id",
		header: "名称",
		cell: ({ row }) => row.original.id,
	},
	{
		accessorKey: "status",
		header: "状态",
		meta: { mobile: { kind: "control" } },
		cell: ({ row }) => <Switch aria-label={row.original.status} checked />,
	},
	{
		accessorKey: "team",
		header: "组织",
		cell: ({ row }) => row.original.team,
	},
]

function mockMobileViewport(isMobile: boolean) {
	vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
		matches: isMobile && query === "(max-width: 767px)",
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
		onchange: null,
	}))
}

describe("DataTable mobile presentation", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
	})
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it("renders cards and opens the complete row detail sheet on mobile", () => {
		mockMobileViewport(true)

		render(
			<DataTable
				columns={columns}
				data={[{ id: "模型 A", status: "已启用", team: "平台组" }]}
				emptyState={<div>暂无数据</div>}
			/>,
		)

		const mobileList = document.querySelector('[data-slot="data-table-mobile-list"]')
		expect(mobileList).toHaveClass("grid", "gap-3", "bg-transparent")
		expect(mobileList).not.toHaveClass("border", "rounded-lg", "overflow-hidden")
		expect(mobileList?.querySelector("article")).toHaveClass(
			"border",
			"border-border/70",
			"rounded-lg",
			"bg-card",
			"shadow-none",
		)
		expect(screen.getByText("模型 A")).toBeInTheDocument()
		expect(screen.getByRole("checkbox", { name: "选择模型 A" })).toBeInTheDocument()
		expect(screen.getByText("状态")).toBeInTheDocument()
		expect(screen.getByRole("switch").closest('[data-mobile-field="control"]')).toHaveClass(
			"flex",
			"items-center",
			"justify-between",
		)
		expect(screen.getByRole("button", { name: "查看详情" })).toBeInTheDocument()
		expect(screen.queryByRole("columnheader")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "查看详情" }))

		const detailSheet = screen.getByRole("dialog", { name: "详情" })
		expect(detailSheet).toBeInTheDocument()
		expect(within(detailSheet).queryByRole("checkbox")).not.toBeInTheDocument()
		expect(within(detailSheet).getByText("组织")).toBeInTheDocument()
		expect(within(detailSheet).getByText("平台组")).toBeInTheDocument()
	})

	it("owns the table surface styling on desktop", () => {
		mockMobileViewport(false)

		render(
			<DataTable
				columns={columns}
				data={[{ id: "模型 A", status: "已启用", team: "平台组" }]}
				emptyState={<div>暂无数据</div>}
			/>,
		)

		expect(document.querySelector('[data-slot="data-table-desktop"]')).toHaveClass(
			"relative",
			"rounded-lg",
			"border",
			"border-border/50",
			"bg-card",
		)
		expect(screen.getByRole("columnheader", { name: "名称" })).toBeInTheDocument()
	})

	it("keeps the configured first column fixed on desktop", () => {
		mockMobileViewport(false)

		render(
			<DataTable
				columns={columns}
				data={[{ id: "模型 A", status: "已启用", team: "平台组" }]}
				emptyState={<div>暂无数据</div>}
				stickyLeftColumnId="id"
			/>,
		)

		expect(screen.getByRole("columnheader", { name: "名称" })).toHaveClass(
			"sticky",
			"left-0",
			"z-30",
		)
		expect(screen.getByText("模型 A").closest("td")).toHaveClass("sticky", "left-0", "z-20")
	})
})
