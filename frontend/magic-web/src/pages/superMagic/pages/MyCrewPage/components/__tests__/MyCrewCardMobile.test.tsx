import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MyCrewView } from "@/services/crew/CrewService"
import MyCrewCardMobile from "../MyCrewCardMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { company?: string }) => {
			if (key === "interface:appList.powerBy")
				return `powerBy ${params?.company ?? ""}`.trim()
			if (key === "myCrewPage.footerPoweredByBrand") return "MagiCrew"
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
})
