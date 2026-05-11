import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import type { MyCrewView } from "@/services/crew/CrewService"
import HiredCrewCard from "../HiredCrewCard"

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

vi.mock("@/pages/superMagic/components/CardFooterBadge", () => ({
	CardFooterBadge: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock("@/pages/superMagic/components/CardFooterLabel", () => ({
	CardFooterLabel: ({ label, dataTestId }: { label: string; dataTestId?: string }) => (
		<div data-testid={dataTestId}>{label}</div>
	),
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({
		children,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		"data-testid"?: string
	}) => <div data-testid={dataTestId}>{children}</div>,
	DropdownMenuItem: ({
		children,
		onClick,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		onClick?: () => void
		"data-testid"?: string
	}) => (
		<button type="button" data-testid={dataTestId} onClick={onClick}>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => <div data-testid="my-crew-card-menu-separator" />,
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
		creatorName: null,
		userRole: undefined,
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

	it("renders team shared creator label when card is in team-shared mode", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({ creatorName: "Cai" })}
				href="/crew/agent-1"
				isTeamSharedCard
				onConversation={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-crew-card-team-shared-creator")).toHaveTextContent(
			"createdBy Cai",
		)
	})

	it("does not render team shared creator label when API omits creator name", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({ creatorName: null })}
				href="/crew/agent-1"
				isTeamSharedCard
				onConversation={vi.fn()}
			/>,
		)

		expect(screen.queryByTestId("my-crew-card-team-shared-creator")).not.toBeInTheDocument()
	})

	it("shows edit and publish actions for team-shared editors", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.EDITABLE,
				})}
				href="/crew/agent-1"
				onEdit={vi.fn()}
				onConversation={vi.fn()}
				onPublishToStore={vi.fn()}
				isTeamSharedCard
			/>,
		)

		expect(screen.getByTestId("my-crew-card-edit-button")).toHaveTextContent("myCrewPage.edit")
		expect(screen.getByTestId("my-crew-card-more-trigger")).toBeInTheDocument()
		fireEvent.pointerDown(screen.getByTestId("my-crew-card-more-trigger"), {
			button: 0,
			ctrlKey: false,
		})
		expect(screen.getByTestId("my-crew-card-menu-chat")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-menu-publish")).toBeInTheDocument()
		expect(screen.queryByTestId("my-crew-card-menu-delete")).not.toBeInTheDocument()
	})

	it("shows delete action for team-shared managers", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.MANAGE,
				})}
				href="/crew/agent-1"
				onEdit={vi.fn()}
				onConversation={vi.fn()}
				onPublishToStore={vi.fn()}
				onDelete={vi.fn()}
				isTeamSharedCard
			/>,
		)

		fireEvent.pointerDown(screen.getByTestId("my-crew-card-more-trigger"), {
			button: 0,
			ctrlKey: false,
		})

		expect(screen.getByTestId("my-crew-card-menu-publish")).toBeInTheDocument()
		expect(screen.getByTestId("my-crew-card-menu-delete")).toBeInTheDocument()
	})

	it("keeps conversation-only action for team-shared viewers", () => {
		render(
			<HiredCrewCard
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.READONLY,
				})}
				href="/crew/agent-1"
				onConversation={vi.fn()}
				isTeamSharedCard
			/>,
		)

		expect(screen.getByTestId("my-crew-card-conversation-button")).toBeInTheDocument()
		expect(screen.queryByTestId("my-crew-card-edit-button")).not.toBeInTheDocument()
		expect(screen.queryByTestId("my-crew-card-more-trigger")).not.toBeInTheDocument()
	})

	it("does not enter edit from the card root for team-shared viewers", () => {
		const onEdit = vi.fn()

		render(
			<HiredCrewCard
				employee={createEmployee({
					userRole: CollaboratorPermissionEnum.READONLY,
				})}
				href="/crew/agent-1"
				onEdit={onEdit}
				onConversation={vi.fn()}
				isTeamSharedCard
			/>,
		)

		fireEvent.click(screen.getByTestId("my-crew-card"))

		expect(onEdit).not.toHaveBeenCalled()
	})
})
