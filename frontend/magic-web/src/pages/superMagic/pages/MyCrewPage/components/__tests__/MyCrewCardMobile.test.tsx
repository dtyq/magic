import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
		latestPublishedAt: "2025-02-01T00:00:00.000Z",
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
		const onCardClick = vi.fn()
		const employee = createEmployee()

		render(<MyCrewCardMobile employee={employee} onCardClick={onCardClick} />)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile"))

		expect(onCardClick).toHaveBeenCalledWith(employee.agentCode)
	})

	it("does not trigger card details when tapping the chat button", () => {
		const onCardClick = vi.fn()
		const onChat = vi.fn()

		render(
			<MyCrewCardMobile employee={createEmployee()} onCardClick={onCardClick} onChat={onChat} />,
		)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile-chat-button"))

		expect(onChat).toHaveBeenCalledWith("agent-1")
		expect(onCardClick).not.toHaveBeenCalled()
	})

	it("renders the simplified prototype content structure", () => {
		render(<MyCrewCardMobile employee={createEmployee()} />)

		expect(screen.getByText("Crew Name")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-mobile-role")).toHaveTextContent("Analyst")
		expect(screen.getByText("Crew description")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-mobile-chat-button")).toHaveTextContent(
			"myCrewPage.openConversation",
		)
	})

	it("shows generated initials when the remote avatar is unavailable", () => {
		render(<MyCrewCardMobile employee={createEmployee({ icon: "" })} />)

		expect(screen.getByTestId("my-crew-card-mobile-avatar-wrap")).toHaveTextContent("CN")
	})

	it("renders unpublished CTA for created crews without a published version", () => {
		const onChat = vi.fn()

		render(
			<MyCrewCardMobile
				employee={createEmployee({ sourceType: "LOCAL_CREATE", latestPublishedAt: null })}
				onChat={onChat}
			/>,
		)

		const chatButton = screen.getByTestId("my-crew-card-mobile-chat-button")
		expect(chatButton).toBeDisabled()
		expect(chatButton).toHaveTextContent("myCrewPage.detailSheet.unpublishedAction")

		fireEvent.click(chatButton)

		expect(onChat).not.toHaveBeenCalled()
	})
})
