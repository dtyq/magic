import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MyCrewDetailSheet, { type CrewDetailSheetEmployee } from "../MyCrewDetailSheet"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en_US" },
	}),
}))

vi.mock("@/providers/TimezoneProvider/hooks", () => ({
	useTimezone: () => ({ timezone: "UTC" }),
}))

function createEmployee(overrides: Partial<CrewDetailSheetEmployee> = {}): CrewDetailSheetEmployee {
	return {
		agentCode: "agent-1",
		name: "Crew Name",
		role: "Analyst",
		description: "Crew description",
		icon: null,
		sourceType: "LOCAL_CREATE",
		playbooks: [],
		updatedAt: "2025-02-01T00:00:00.000Z",
		latestPublishedAt: "2025-02-01T00:00:00.000Z",
		allowDelete: true,
		...overrides,
	}
}

describe("MyCrewDetailSheet", () => {
	it("shows unpublished notice for created crews without a published version", () => {
		render(
			<MyCrewDetailSheet
				employee={createEmployee({ latestPublishedAt: null })}
				open
				onOpenChange={vi.fn()}
				onChat={vi.fn()}
				primaryAction={{
					label: "myCrewPage.detailSheet.unpublishedAction",
					onClick: vi.fn(),
					testId: "my-crew-detail-sheet-unpublished-button",
					disabled: true,
				}}
			/>,
		)

		expect(screen.getByText("myCrewPage.detailSheet.unpublishedNotice")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-detail-sheet-unpublished-button")).toBeDisabled()
	})

	it("does not trigger chat for unpublished created crews", () => {
		const onChat = vi.fn()

		render(
			<MyCrewDetailSheet
				employee={createEmployee({ latestPublishedAt: null })}
				open
				onOpenChange={vi.fn()}
				onChat={onChat}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-detail-sheet-chat-button"))

		expect(onChat).not.toHaveBeenCalled()
	})

	it("renders dismiss and chat buttons when primary and secondary actions are provided", () => {
		const onDismiss = vi.fn()
		const onChat = vi.fn()

		render(
			<MyCrewDetailSheet
				employee={createEmployee({
					scope: "market_installed",
					allowDelete: true,
				})}
				open
				onOpenChange={vi.fn()}
				onChat={onChat}
				primaryAction={{
					label: "myCrewPage.detailSheet.startChat",
					onClick: onChat,
					testId: "my-crew-detail-sheet-chat-button",
				}}
				secondaryAction={{
					label: "dismiss",
					onClick: onDismiss,
					testId: "my-crew-detail-sheet-dismiss-button",
				}}
			/>,
		)

		expect(screen.getByTestId("my-crew-detail-sheet-dismiss-button")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-detail-sheet-chat-button")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("my-crew-detail-sheet-dismiss-button"))
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it("shows only default chat button for team-shared agents without custom actions", () => {
		const onChat = vi.fn()

		render(
			<MyCrewDetailSheet
				employee={createEmployee({
					scope: "team_shared",
					allowDelete: false,
				})}
				open
				onOpenChange={vi.fn()}
				onChat={onChat}
			/>,
		)

		expect(screen.getByTestId("my-crew-detail-sheet-chat-button")).toBeInTheDocument()
		expect(screen.queryByTestId("my-crew-detail-sheet-dismiss-button")).not.toBeInTheDocument()
	})

	it("does not render dismiss when only secondaryAction is passed without primaryAction", () => {
		render(
			<MyCrewDetailSheet
				employee={createEmployee({
					scope: "market_installed",
					allowDelete: true,
				})}
				open
				onOpenChange={vi.fn()}
				onChat={vi.fn()}
				secondaryAction={{
					label: "dismiss",
					onClick: vi.fn(),
					testId: "my-crew-detail-sheet-dismiss-button",
				}}
			/>,
		)

		expect(screen.queryByTestId("my-crew-detail-sheet-dismiss-button")).not.toBeInTheDocument()
		expect(screen.getByTestId("my-crew-detail-sheet-chat-button")).toBeInTheDocument()
	})
})
