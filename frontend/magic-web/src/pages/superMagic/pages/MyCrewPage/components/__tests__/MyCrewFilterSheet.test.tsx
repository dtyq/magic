import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	MY_CREW_MOBILE_FILTER_DEFAULT,
	type MyCrewMobileFilterState,
} from "../my-crew-mobile-shared"
import MyCrewFilterSheet from "../MyCrewFilterSheet"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/shadcn-ui/sheet", () => ({
	Sheet: ({
		open,
		children,
	}: {
		open: boolean
		children: React.ReactNode
		onOpenChange: (open: boolean) => void
	}) => (open ? <div>{children}</div> : null),
	SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const createdFilter: MyCrewMobileFilterState = {
	type: "created",
	sort: "updated_at",
}

describe("MyCrewFilterSheet", () => {
	it("resets filter to defaults when reset is tapped", () => {
		const onChange = vi.fn()

		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={createdFilter}
				onChange={onChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-filter-sheet-reset"))

		expect(onChange).toHaveBeenCalledWith(MY_CREW_MOBILE_FILTER_DEFAULT)
	})

	it("only switches the classification value without carrying sort state", () => {
		const onChange = vi.fn()

		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={createdFilter}
				onChange={onChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-filter-type-team-shared"))

		expect(onChange).toHaveBeenCalledWith({ type: "teamShared", sort: "updated_at" })
	})

	it("always renders team shared type option", () => {
		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={MY_CREW_MOBILE_FILTER_DEFAULT}
				onChange={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-filter-type-team-shared")).toBeInTheDocument()
	})

	it("renders sort section before type section", () => {
		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={MY_CREW_MOBILE_FILTER_DEFAULT}
				onChange={vi.fn()}
			/>,
		)

		const sortSection = screen.getByTestId("my-crew-filter-sort-section")
		const typeSection = screen.getByTestId("my-crew-filter-type-section")

		expect(
			sortSection.compareDocumentPosition(typeSection) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})
})
