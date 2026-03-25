import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { UserSkillView } from "@/services/skills/SkillsService"
import MySkillCard from "../MySkillCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { date?: string; name?: string }) => {
			if (key === "mySkills.updatedAt") return `Updated ${options?.date ?? ""}`.trim()
			if (key === "mySkills.poweredBy") return `Powered by ${options?.name ?? ""}`.trim()
			if (key === "mySkills.creatorUnknown") return "@Unknown"
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
		description: "Skill description",
		thumbnail: undefined,
		needUpgrade: false,
		latestVersion: "v1.0.0",
		latestPublishedAt: "2026-03-22 10:00",
		updatedAt: "2026-03-22 10:00",
		sourceType: "custom",
		...overrides,
	} as UserSkillView
}

describe("MySkillCard", () => {
	it("navigates when the card body is clicked", () => {
		const onNavigate = vi.fn()

		render(
			<MySkillCard
				skill={createSkill()}
				cardVariant="created"
				href="/skills/skill-1"
				onNavigate={onNavigate}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-skill-card"))

		expect(onNavigate).toHaveBeenCalledTimes(1)
	})

	it("does not navigate when delete action is clicked", () => {
		const onDelete = vi.fn()
		const onNavigate = vi.fn()

		render(
			<MySkillCard
				skill={createSkill()}
				cardVariant="created"
				href="/skills/skill-1"
				onNavigate={onNavigate}
				onDelete={onDelete}
			/>,
		)

		fireEvent.click(screen.getByTestId("my-skill-card-delete"))

		expect(onDelete).toHaveBeenCalledWith("skill-1")
		expect(onNavigate).not.toHaveBeenCalled()
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

	it("shows powered by footer with menu for skills library items", () => {
		render(
			<MySkillCard
				skill={createSkill({ creatorName: "@LibraryAuthor" })}
				cardVariant="library"
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByText("Powered by @LibraryAuthor")).toBeInTheDocument()
		expect(screen.getByTestId("my-skill-card-more-button")).toBeInTheDocument()
	})
})
