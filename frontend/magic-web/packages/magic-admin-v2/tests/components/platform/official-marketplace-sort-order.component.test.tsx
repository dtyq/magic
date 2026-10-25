import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SortOrderCell } from "../../../src/features/platform-official-marketplace/components/sort-order-cell"
import { useMarketTableState } from "../../../src/features/platform-official-marketplace/hooks/use-market-table-state"
import type {
	MarketRecord,
	MarketTableState,
} from "../../../src/features/platform-official-marketplace/types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn() },
}))

const record: MarketRecord = {
	created_at: "2026-09-09T00:00:00Z",
	id: "market-1",
	publish_status: "PUBLISHED",
	sort_order: 0,
	updated_at: "2026-09-09T00:00:00Z",
}

function SortOrderHarness({
	updateMarketInfo,
	canEdit = true,
}: {
	updateMarketInfo: (payload: { id: string; values: { sort_order?: number } }) => Promise<unknown>
	canEdit?: boolean
}) {
	const tableState: MarketTableState<MarketRecord> = useMarketTableState({
		canEdit,
		updateMarketInfo,
	})

	return (
		<SortOrderCell
			ariaLabel="sort order"
			record={record}
			tableState={tableState}
		/>
	)
}

afterEach(() => {
	vi.clearAllMocks()
})

describe("official marketplace sort order input", () => {
	it("keeps consecutive input local until blur and allows zero to be cleared", () => {
		const updateMarketInfo = vi.fn().mockResolvedValue(undefined)
		render(<SortOrderHarness updateMarketInfo={updateMarketInfo} />)

		const input = screen.getByRole("spinbutton", { name: "sort order" })
		act(() => {
			fireEvent.change(input, { target: { value: "1" } })
			fireEvent.change(input, { target: { value: "12" } })
		})

		expect(input).toHaveValue(12)
		expect(updateMarketInfo).not.toHaveBeenCalled()

		act(() => fireEvent.change(input, { target: { value: "" } }))
		expect(input).toHaveValue(null)
		expect(updateMarketInfo).not.toHaveBeenCalled()
	})

	it("commits the final value once when Enter blurs the input", async () => {
		const updateMarketInfo = vi.fn().mockResolvedValue(undefined)
		render(<SortOrderHarness updateMarketInfo={updateMarketInfo} />)

		const input = screen.getByRole("spinbutton", { name: "sort order" })
		input.focus()
		await act(async () => {
			fireEvent.change(input, { target: { value: "12" } })
			fireEvent.keyDown(input, { key: "Enter" })
			await Promise.resolve()
		})

		expect(updateMarketInfo).toHaveBeenCalledOnce()
		expect(updateMarketInfo).toHaveBeenCalledWith({
			id: record.id,
			values: { sort_order: 12 },
		})
	})

	it("disables the input while the sort request is pending", async () => {
		let resolveRequest: (() => void) | undefined
		const updateMarketInfo = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRequest = resolve
				}),
		)
		render(<SortOrderHarness updateMarketInfo={updateMarketInfo} />)

		const input = screen.getByRole("spinbutton", { name: "sort order" })
		fireEvent.change(input, { target: { value: "8" } })
		fireEvent.blur(input)

		expect(input).toBeDisabled()
		expect(updateMarketInfo).toHaveBeenCalledOnce()

		await act(async () => resolveRequest?.())
		expect(input).not.toBeDisabled()
	})

	it("does not save when the value is unchanged", () => {
		const updateMarketInfo = vi.fn().mockResolvedValue(undefined)
		render(<SortOrderHarness updateMarketInfo={updateMarketInfo} />)

		const input = screen.getByRole("spinbutton", { name: "sort order" })
		fireEvent.blur(input)

		expect(updateMarketInfo).not.toHaveBeenCalled()
	})
})
