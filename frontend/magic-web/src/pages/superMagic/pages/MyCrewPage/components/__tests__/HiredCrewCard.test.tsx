import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MyCrewView } from "@/services/crew/CrewService"
import HiredCrewCard from "../HiredCrewCard"

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

vi.mock("@/pages/superMagic/components/CardFooterBadge", () => ({
	CardFooterBadge: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock("@/pages/superMagic/components/CardFooterLabel", () => ({
	CardFooterLabel: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock("../MyCrewCardMainSection", () => ({
	MyCrewCardMainSection: ({
		actions,
		footer,
	}: {
		actions: React.ReactNode
		footer: React.ReactNode
	}) => (
		<div>
			<div data-testid="my-crew-card-actions">{actions}</div>
			<div data-testid="my-crew-card-footer">{footer}</div>
		</div>
	),
}))

function createEmployee(overrides: Partial<MyCrewView> = {}): MyCrewView {
	return {
		id: "crew-1",
		agentCode: "agent-1",
		name: "Crew Name",
		role: "Analyst",
		description: "Crew description",
		icon: "",
		playbooks: [],
		sourceType: "MARKET",
		publisherType: null,
		publisherName: null,
		enabled: true,
		isStoreOffline: false,
		needUpgrade: false,
		allowDelete: true,
		latestVersionCode: "v1.0.0",
		latestPublishedAt: null,
		pinnedAt: null,
		updatedAt: "2026-03-21 10:00:00",
		...overrides,
	}
}

describe("HiredCrewCard", () => {
	it("uses chat action for the primary button", () => {
		const onConversation = vi.fn()

		render(
			<HiredCrewCard
				employee={createEmployee()}
				href="/crew/agent-1"
				onConversation={onConversation}
			/>,
		)

		const button = screen.getByTestId("my-crew-card-conversation-button")
		expect(button).toHaveTextContent("myCrewPage.openConversation")

		fireEvent.click(button)

		expect(onConversation).toHaveBeenCalledWith("agent-1")
	})

	it("renders dismiss action for market hires", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({ sourceType: "MARKET", allowDelete: true })}
				href="/crew/agent-1"
				onDismiss={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-dismiss-button")).toHaveTextContent("dismiss")
	})

	it("renders disable action for non-store hires", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					allowDelete: true,
					enabled: false,
				})}
				href="/crew/agent-1"
				onDisable={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-disable-button")).toHaveTextContent(
			"myCrewPage.disable",
		)
		expect(screen.getByTestId("my-crew-card-disable-button")).toBeDisabled()
	})

	it("uses team shared label for shared hires", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({
					sourceType: "LOCAL_CREATE",
					allowDelete: false,
					enabled: true,
				})}
				href="/crew/agent-1"
				onDisable={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-disable-button")).toHaveTextContent(
			"myCrewPage.sharedByTeamAction",
		)
		expect(screen.getByTestId("my-crew-card-disable-button")).toBeDisabled()
	})
})
