import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DismissCrewConfirmSheet, { type DismissCrewConfirmTarget } from "../DismissCrewConfirmSheet"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) => {
			if (key === "myCrewPage.dismissSheet.description" && options?.name) {
				return `description:${options.name}`
			}
			return key
		},
		i18n: { language: "en_US" },
	}),
}))

function createTarget(overrides: Partial<DismissCrewConfirmTarget> = {}): DismissCrewConfirmTarget {
	return {
		agentCode: "agent-1",
		name: "Meeting Maestro",
		icon: null,
		publisherType: "OFFICIAL",
		publisherName: "MagiCrew Official",
		...overrides,
	}
}

describe("DismissCrewConfirmSheet", () => {
	it("renders title, crew label, agent card, and description when open", () => {
		render(
			<DismissCrewConfirmSheet
				open
				onOpenChange={vi.fn()}
				target={createTarget()}
				onConfirm={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("crew-dismiss-confirm-sheet")).toBeInTheDocument()
		expect(screen.getByText("myCrewPage.dismissSheet.title")).toBeInTheDocument()
		expect(screen.getByText("myCrewPage.dismissSheet.crewLabel")).toBeInTheDocument()
		expect(screen.getByTestId("crew-dismiss-confirm-name")).toHaveTextContent("Meeting Maestro")
		expect(screen.getByTestId("crew-dismiss-confirm-description")).toHaveTextContent(
			"description:Meeting Maestro",
		)
	})

	it("calls onOpenChange(false) when cancel is clicked", () => {
		const onOpenChange = vi.fn()

		render(
			<DismissCrewConfirmSheet
				open
				onOpenChange={onOpenChange}
				target={createTarget()}
				onConfirm={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("crew-dismiss-confirm-cancel"))

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("calls onConfirm when submit is clicked", () => {
		const onConfirm = vi.fn()

		render(
			<DismissCrewConfirmSheet
				open
				onOpenChange={vi.fn()}
				target={createTarget()}
				onConfirm={onConfirm}
			/>,
		)

		fireEvent.click(screen.getByTestId("crew-dismiss-confirm-submit"))

		expect(onConfirm).toHaveBeenCalledTimes(1)
	})

	it("falls back to untitled crew label when name is empty", () => {
		render(
			<DismissCrewConfirmSheet
				open
				onOpenChange={vi.fn()}
				target={createTarget({ name: null })}
				onConfirm={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("crew-dismiss-confirm-name")).toHaveTextContent(
			"crew/create:untitledCrew",
		)
	})
})
