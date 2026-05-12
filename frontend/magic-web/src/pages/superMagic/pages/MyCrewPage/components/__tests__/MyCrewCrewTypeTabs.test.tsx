import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MyCrewCrewTypeTabs from "../MyCrewCrewTypeTabs"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("MyCrewCrewTypeTabs", () => {
	it("renders the team shared tab when enabled", () => {
		const onChange = vi.fn()

		render(<MyCrewCrewTypeTabs value="created" onChange={onChange} includeTeamShared />)

		const teamSharedTab = screen.getByTestId("my-crew-tab-team-shared")
		expect(teamSharedTab).toHaveTextContent("myCrewPage.crewType.teamShared")

		fireEvent.click(teamSharedTab)

		expect(onChange).toHaveBeenCalledWith("team-shared")
	})

	it("does not render the team shared tab by default", () => {
		render(<MyCrewCrewTypeTabs value="created" onChange={vi.fn()} />)

		expect(screen.queryByTestId("my-crew-tab-team-shared")).not.toBeInTheDocument()
	})
})
