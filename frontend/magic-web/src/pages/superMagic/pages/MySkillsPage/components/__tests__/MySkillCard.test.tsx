import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import type { UserSkillView } from "@/services/skills/SkillsService"
import MySkillCard from "../MySkillCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { date?: string; name?: string }) => {
			if (key === "mySkills.updatedAt") return `Updated ${options?.date ?? ""}`.trim()
			if (key === "mySkills.poweredBy") return `Powered by ${options?.name ?? ""}`.trim()
			if (key === "mySkills.creatorUnknown") return "@Unknown"
			if (key === "skillsLibrary.official") return "Official"
			if (key === "employeeCard.officialBuiltin") return "Official Built-In"
			if (key === "employeeCard.publisherUser") return "Community"
			return key
		},
	}),
}))

vi.mock("@/pages/superMagic/components/SkillThumbnail", () => ({
	SkillThumbnail: ({ alt }: { alt: string }) => <div data-testid="skill-thumbnail">{alt}</div>,
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({
		children,
		menu,
	}: {
		children: React.ReactNode
		menu?: { items?: Array<Record<string, unknown>> }
	}) => (
		<div>
			{children}
			{menu?.items?.map((item) => {
				if (!item) return null
				const key = String(item.key ?? "item")
				return (
					<button
						key={key}
						type="button"
						data-testid={String(item["data-testid"] ?? key)}
						onClick={(event) =>
							(
								item.onClick as
									| ((info: {
											key: string
											keyPath: string[]
											domEvent: React.MouseEvent<HTMLButtonElement>
									  }) => void)
									| undefined
							)?.({
								key,
								keyPath: [key],
								domEvent: event,
							})
						}
					>
						{key}
					</button>
				)
			})}
		</div>
	),
}))

function createSkill(overrides: Partial<UserSkillView> = {}) {
	return {
		id: "skill-1",
		name: "Skill Name",
		skillCode: "skill.code",
		packageName: "skill-name",
		description: "Skill description",
		thumbnail: undefined,
		needUpgrade: false,
		latestVersion: "v1.0.0",
		latestPublishedAt: "2026-03-22 10:00",
		updatedAt: "2026-03-22 10:00",
		publisherType: undefined,
		publisherName: undefined,
		sourceType: "LOCAL_UPLOAD",
		userRole: undefined,
		...overrides,
	} as UserSkillView
}

describe("MySkillCard", () => {
	it("opens detail when the card body is clicked", () => {
		const onOpenDetail = vi.fn()

		render(
			<MySkillCard skill={createSkill()} cardVariant="created" onOpenDetail={onOpenDetail} />,
		)

		fireEvent.click(screen.getByTestId("my-skill-card"))

		expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: "skill-1" }))
	})

	it("does not open detail when delete action is clicked", () => {
		const onDelete = vi.fn()
		const onOpenDetail = vi.fn()

		render(
			<MySkillCard
				skill={createSkill()}
				cardVariant="created"
				onOpenDetail={onOpenDetail}
				onDelete={onDelete}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-skill-card-delete"))

		expect(onDelete).toHaveBeenCalledWith("skill-1")
		expect(onOpenDetail).not.toHaveBeenCalled()
	})

	it("shows updated footer for created skills", () => {
		render(<MySkillCard skill={createSkill()} cardVariant="created" />)

		expect(screen.getByText("Updated 2026-03-22 10:00")).toBeInTheDocument()
	})

	it("shows powered by footer without menu for team skills", () => {
		render(
			<MySkillCard
				skill={createSkill({ creatorName: "@Teammate" })}
				cardVariant="team"
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByText("Powered by @Teammate")).toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-more-button")).not.toBeInTheDocument()
	})

	it("shows edit-only actions for team-shared editors", () => {
		render(
			<MySkillCard
				skill={createSkill({
					creatorName: "@Teammate",
					userRole: CollaboratorPermissionEnum.EDITABLE,
				})}
				cardVariant="team"
				onEdit={vi.fn()}
				onRemove={vi.fn()}
				canEdit
			/>,
		)

		expect(screen.getByTestId("my-skill-card-more-button")).toBeInTheDocument()
		expect(screen.getByTestId("my-skill-card-edit")).toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-delete")).not.toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-remove")).not.toBeInTheDocument()
	})

	it("shows edit and delete actions for team-shared managers", () => {
		render(
			<MySkillCard
				skill={createSkill({
					creatorName: "@Teammate",
					userRole: CollaboratorPermissionEnum.MANAGE,
				})}
				cardVariant="team"
				onEdit={vi.fn()}
				onDelete={vi.fn()}
				canEdit
			/>,
		)

		expect(screen.getByTestId("my-skill-card-more-button")).toBeInTheDocument()
		expect(screen.getByTestId("my-skill-card-edit")).toBeInTheDocument()
		expect(screen.getByTestId("my-skill-card-delete")).toBeInTheDocument()
	})

	it("keeps team-shared viewers in details-only mode", () => {
		render(
			<MySkillCard
				skill={createSkill({
					creatorName: "@Teammate",
					userRole: CollaboratorPermissionEnum.READONLY,
				})}
				cardVariant="team"
				onOpenDetail={vi.fn()}
				isInteractive
			/>,
		)

		expect(screen.queryByTestId("my-skill-card-more-button")).not.toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-edit")).not.toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-delete")).not.toBeInTheDocument()
		expect(screen.queryByTestId("my-skill-card-remove")).not.toBeInTheDocument()
	})

	it("shows powered by footer with market publisher for skills library items", () => {
		render(
			<MySkillCard
				skill={createSkill({
					creatorName: "@LibraryAuthor",
					publisherType: "USER",
					publisherName: "@MarketPublisher",
				})}
				cardVariant="library"
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByText("Powered by @MarketPublisher")).toBeInTheDocument()
		expect(screen.getByTestId("my-skill-card-more-button")).toBeInTheDocument()
	})

	it("shows package name badge before other badges", () => {
		render(<MySkillCard skill={createSkill()} cardVariant="created" />)

		expect(screen.getByTestId("my-skill-card-package-name-badge")).toHaveTextContent(
			"skill-name",
		)
	})

	it("shows unpublished changes when update time is newer than publish time", () => {
		render(
			<MySkillCard
				skill={createSkill({
					latestPublishedAt: "2026-03-21 10:00",
					latestVersion: "v1.0.0",
					updatedAt: "2026-03-22 10:00",
					needUpgrade: false,
				})}
				cardVariant="created"
			/>,
		)

		expect(screen.getByTestId("my-skill-card-unpublished-changes-badge")).toHaveTextContent(
			"skillEditPage.actions.unpublishedChanges",
		)
		expect(screen.queryByTestId("my-skill-card-unpublished-badge")).not.toBeInTheDocument()
	})

	it("keeps unpublished when publish time is missing", () => {
		render(
			<MySkillCard
				skill={createSkill({
					latestPublishedAt: null,
					latestVersion: "v1.0.0",
				})}
				cardVariant="created"
			/>,
		)

		expect(screen.getByTestId("my-skill-card-unpublished-badge")).toHaveTextContent(
			"mySkills.badges.unpublished",
		)
		expect(
			screen.queryByTestId("my-skill-card-unpublished-changes-badge"),
		).not.toBeInTheDocument()
	})

	it("hides more menu for OFFICIAL_BUILTIN publisher skills", () => {
		render(
			<MySkillCard
				skill={createSkill({ publisherType: "OFFICIAL_BUILTIN" })}
				cardVariant="library"
				onRemove={vi.fn()}
				canEdit={false}
			/>,
		)

		expect(screen.queryByTestId("my-skill-card-more-button")).not.toBeInTheDocument()
	})

	it("shows plain publisher label footer for OFFICIAL_BUILTIN (no Powered by prefix)", () => {
		render(
			<MySkillCard
				skill={createSkill({
					publisherType: "OFFICIAL_BUILTIN",
				})}
				cardVariant="library"
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByText("Official Built-In")).toBeInTheDocument()
		expect(screen.queryByText(/^Powered by/)).not.toBeInTheDocument()
	})

	it("does not show unpublished changes badge for non-created cards", () => {
		render(
			<MySkillCard
				skill={createSkill({
					latestPublishedAt: "2026-03-21 10:00",
					latestVersion: "v1.0.0",
					updatedAt: "2026-03-22 10:00",
				})}
				cardVariant="library"
				onRemove={vi.fn()}
			/>,
		)

		expect(
			screen.queryByTestId("my-skill-card-unpublished-changes-badge"),
		).not.toBeInTheDocument()
	})
})
