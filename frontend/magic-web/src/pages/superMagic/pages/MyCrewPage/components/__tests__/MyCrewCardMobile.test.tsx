import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import type { MyCrewView } from "@/services/crew/CrewService"
import MyCrewCardMobile from "../MyCrewCardMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { company?: string; name?: string }) => {
			if (key === "interface:appList.powerBy")
				return `powerBy ${params?.company ?? ""}`.trim()
			if (key === "myCrewPage.footerPoweredByBrand") return "MagiCrew"
			if (key === "myCrewPage.teamSharedCreatedBy")
				return `createdBy ${params?.name ?? ""}`.trim()
			return key
		},
	}),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/components/CardFooterBadge", () => ({
	CardFooterBadge: ({
		label,
		className,
		"data-testid": dataTestId,
	}: {
		label: string
		className?: string
		"data-testid"?: string
	}) => (
		<div className={className} data-testid={dataTestId}>
			{label}
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/CardFooterLabel", () => ({
	CardFooterLabel: ({
		label,
		className,
		dataTestId,
	}: {
		label: string
		className?: string
		dataTestId?: string
	}) => (
		<div className={className} data-testid={dataTestId}>
			{label}
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/CrewFallbackAvatar", () => ({
	default: () => <div data-testid="crew-fallback-avatar" />,
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
	it("opens more actions without triggering card navigation", () => {
		const onMoreClick = vi.fn()
		const onNavigate = vi.fn()
		const employee = createEmployee()

		render(
			<MyCrewCardMobile
				employee={employee}
				listVariant="created"
				href="/crew/agent-1"
				onNavigate={onNavigate}
				onMoreClick={onMoreClick}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-card-mobile-more-trigger"))

		expect(onMoreClick).toHaveBeenCalledWith(employee)
		expect(onNavigate).not.toHaveBeenCalled()
	})

	it("uses desktop footer labels for created cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ sourceType: "LOCAL_CREATE", needUpgrade: false })}
				listVariant="created"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-footer-created-by")).toHaveTextContent(
			"myCrewPage.crewType.createdByMe",
		)
		expect(screen.getByTestId("my-crew-card-mobile-footer-badge")).toHaveTextContent(
			"status.unpublished",
		)
	})

	it("uses desktop footer labels for hired cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "MARKET",
					latestVersionCode: "v2.0.0",
					publisherType: "USER",
					publisherName: "Alice",
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-footer-powered-by")).toHaveTextContent(
			"powerBy Alice",
		)
		expect(screen.getByTestId("my-crew-card-mobile-footer-version-badge")).toHaveTextContent(
			"v2.0.0",
		)
	})

	it("does not show powered by fallback without publisher info", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "MARKET",
					latestVersionCode: "v2.0.0",
					publisherType: null,
					publisherName: null,
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(
			screen.queryByTestId("my-crew-card-mobile-footer-powered-by"),
		).not.toBeInTheDocument()
		expect(screen.queryByText(/powerBy/i)).not.toBeInTheDocument()
	})

	it("shows official builtin publisher in hired footer", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					publisherType: "OFFICIAL_BUILTIN",
					publisherName: null,
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-official-publisher")).toHaveTextContent(
			"employeeCard.officialBuiltin",
		)
		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toHaveTextContent(
			"employeeCard.officialBuiltin",
		)
	})

	it("shows official builtin label for official publisher actions", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					publisherType: "OFFICIAL",
					publisherName: null,
					allowDelete: false,
					enabled: true,
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toHaveTextContent(
			"employeeCard.officialBuiltin",
		)
		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toBeDisabled()
	})

	it("renders disable action for non-store hired cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					allowDelete: true,
					enabled: false,
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toHaveTextContent(
			"myCrewPage.disable",
		)
		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toBeDisabled()
	})

	it("shows team shared creator label for team-shared list", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ creatorName: "Alice" })}
				listVariant="team-shared"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-team-shared-creator")).toHaveTextContent(
			"createdBy Alice",
		)
	})

	it("omits team shared creator and created-by fallback when creator name is absent", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({ creatorName: null })}
				listVariant="team-shared"
				href="/crew/agent-1"
			/>,
		)

		expect(
			screen.queryByTestId("my-crew-card-mobile-team-shared-creator"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("my-crew-card-mobile-footer-created-by"),
		).not.toBeInTheDocument()
	})

	it("uses team shared label for shared hired cards", () => {
		render(
			<MyCrewCardMobile
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					allowDelete: false,
					enabled: true,
				})}
				listVariant="hired"
				href="/crew/agent-1"
			/>,
		)

		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toHaveTextContent(
			"myCrewPage.sharedByTeamAction",
		)
		expect(screen.getByTestId("my-crew-card-mobile-disable-button")).toBeDisabled()
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
