import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { UserSkillView } from "@/services/skills/SkillsService"
import MySkillCardMobile from "../MySkillCardMobile"

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
	SkillThumbnail: ({ alt }: { alt: string }) => (
		<div data-testid="skill-thumbnail-mobile">{alt}</div>
	),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createSkill(overrides: Partial<UserSkillView> = {}) {
	return {
		id: "skill-1",
		userSkillId: "skill-1",
		userRole: undefined,
		name: "Skill Name",
		skillCode: "skill.code",
		packageName: "skill-name",
		description: "Skill description",
		thumbnail: undefined,
		nameI18n: { default: "Skill Name" },
		descriptionI18n: { default: "Skill description" },
		logo: "",
		sourceType: "LOCAL_UPLOAD",
		creatorName: "@Teammate",
		creatorAvatar: undefined,
		publisherType: undefined,
		publisherName: undefined,
		latestVersion: "v1.0.0",
		latestPublishedAt: "2026-03-22 10:00",
		needUpgrade: false,
		updatedAt: "2026-03-22 10:00",
		createdAt: "2026-03-22 10:00",
		...overrides,
	} as UserSkillView
}

describe("MySkillCardMobile", () => {
	it("opens detail when card content is clicked", () => {
		const onOpenDetail = vi.fn()
		const skill = createSkill()

		render(<MySkillCardMobile skill={skill} cardVariant="team" onOpenDetail={onOpenDetail} />)

		fireEvent.click(screen.getByTestId("my-skill-card-mobile"))

		expect(onOpenDetail).toHaveBeenCalledWith(skill)
	})

	it("shows more trigger when team-shared actions are available", () => {
		render(
			<MySkillCardMobile
				skill={createSkill()}
				cardVariant="team"
				onOpenDetail={vi.fn()}
				onMoreClick={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("my-skill-card-mobile-more-trigger")).toBeInTheDocument()
	})

	it("hides more trigger when team-shared actions are unavailable", () => {
		render(
			<MySkillCardMobile skill={createSkill()} cardVariant="team" onOpenDetail={vi.fn()} />,
		)

		expect(screen.queryByTestId("my-skill-card-mobile-more-trigger")).not.toBeInTheDocument()
	})
})
