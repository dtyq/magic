import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import type { MyCrewView } from "@/services/crew/CrewService"
import MyCrewCardMobile from "../MyCrewCardMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createEmployee(overrides: Partial<MyCrewView> = {}) {
	return {
		id: "crew-1",
		agentCode: "agent-1",
		name: "Crew Name",
		role: "Analyst",
		description: "Crew description",
		icon: "",
		enabled: true,
		needUpgrade: false,
		allowDelete: true,
		latestVersionCode: "v1",
		sourceType: "LOCAL_CREATE",
		publisherType: null,
		publisherName: null,
		playbooks: [],
		creatorName: null,
		userRole: undefined,
		...overrides,
	} as MyCrewView
}

describe("MyCrewCardMobile", () => {
	it("opens details when tapping the card body", () => {
		const onNavigate = vi.fn()
		const onCardClick = vi.fn()
		const employee = createEmployee()

		render(
			<MyCrewCardMobile
				employee={employee}
				listVariant="created"
				href="/crew/agent-1"
				onNavigate={onNavigate}
				onCardClick={onCardClick}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile"))

		expect(onNavigate).toHaveBeenCalled()
		expect(onCardClick).toHaveBeenCalledWith(employee.agentCode)
	})

	it("does not trigger card details when tapping the chat button", () => {
		const onCardClick = vi.fn()
		const onChat = vi.fn()

		render(
			<MyCrewCardMobile
				employee={createEmployee()}
				listVariant="created"
				href="/crew/agent-1"
				onCardClick={onCardClick}
				onChat={onChat}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile-chat-button"))

		expect(onChat).toHaveBeenCalledWith("agent-1")
		expect(onCardClick).not.toHaveBeenCalled()
	})

	it("renders the simplified prototype content structure", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee()}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByText("Crew Name")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-mobile-role")).toHaveTextContent("Analyst")
		expect(screen.getByText("Crew description")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-mobile-chat-button")).toHaveTextContent(
			"myCrewPage.openConversation",
		)
	})

	it("shows generated initials when the remote avatar is unavailable", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ icon: "" })}
				listVariant="created"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-avatar-wrap")).toHaveTextContent("CN")
	})

	it("shows the market source badge for hired market cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ sourceType: "MARKET", creatorName: null })}
				listVariant="hired"
				href="/my-crew"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-source-market")).toHaveTextContent(
			"myCrewPage.detailSheet.source.market",
		)
	})

	it("shows the team shared source badge for team-shared cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ sourceType: "MARKET", creatorName: "Alice" })}
				listVariant="team-shared"
				href="/my-crew"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-source-teamShared")).toHaveTextContent(
			"myCrewPage.detailSheet.source.team",
		)
	})

	it("shows the upgrade badge when an employee needs an update", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ needUpgrade: true })}
				listVariant="created"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-upgrade-badge")).toHaveTextContent(
			"myCrewPage.badgeUpdated",
		)
	})

	it("shows edit entry for team-shared editors", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.EDITABLE,
				})}
				listVariant="team-shared"
				href="/crew/agent-1"
				onEdit={vi.fn()}
				onMoreClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-edit-button")).toHaveTextContent(
			"myCrewPage.edit",
		)
		expect(screen.getByTestId("my-crew-card-mobile-more-trigger")).toBeInTheDocument()
	})

	it("shows details-only entry for team-shared viewers", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.READONLY,
				})}
				listVariant="team-shared"
				href="/crew/agent-1"
				onEdit={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-edit-button")).toHaveTextContent("details")
		expect(screen.queryByTestId("my-crew-card-mobile-more-trigger")).not.toBeInTheDocument()
	})

	it("does not navigate from the card root for team-shared viewers", () => {
		const onNavigate = vi.fn()

		render(
			<MyCrewCardMobile
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.READONLY,
				})}
				listVariant="team-shared"
				href="/crew/agent-1"
				onNavigate={onNavigate}
				onEdit={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile"))

		expect(onNavigate).not.toHaveBeenCalled()
	})
})
