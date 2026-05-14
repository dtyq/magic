import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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

describe("MyCrewFilterSheet", () => {
	it("keeps reset visible on the default created filter", () => {
		const onChange = vi.fn()

		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={{ type: "created" }}
				onChange={onChange}
				includeTeamShared
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-filter-sheet-reset"))

		expect(onChange).toHaveBeenCalledWith({ type: "created" })
	})

	it("only switches the classification value without carrying sort state", () => {
		const onChange = vi.fn()

		render(
			<MyCrewFilterSheet
				open
				onOpenChange={vi.fn()}
				filter={{ type: "created" }}
				onChange={onChange}
				includeTeamShared
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-filter-type-team-shared"))

		expect(onChange).toHaveBeenCalledWith({ type: "teamShared" })
	})
})
