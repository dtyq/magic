import { act, render, screen } from "@testing-library/react"
import { observable, runInAction } from "mobx"
import { describe, expect, it, vi } from "vitest"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { StoreSkillCardMobile } from "../StoreSkillCardMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { dateTime?: string }) => {
			switch (key) {
				case "skillsLibrary.addToMySkills":
					return "Add to My Skills"
				case "skillsLibrary.added":
					return "Added"
				case "skillsLibrary.upgrade":
					return "Upgrade"
				case "skillsLibrary.updatedAt":
					return `Updated ${params?.dateTime ?? ""}`.trim()
				case "skillsLibrary.official":
					return "Official"
				case "employeeCard.officialBuiltin":
					return "Official Built-in"
				case "skillsLibrary.featured":
					return "Featured"
				case "skillsLibrary.authorFallback":
					return "Unknown"
				default:
					return key
			}
		},
		i18n: { language: "en_US" },
	}),
}))

vi.mock("@/pages/superMagic/components/SkillThumbnail", () => ({
	SkillThumbnail: ({ alt }: { alt: string }) => <div data-testid="skill-thumbnail">{alt}</div>,
}))

vi.mock("@/pages/superMagic/components/SkillDetailDialog", () => ({
	SkillDetailDialog: () => null,
}))

function createSkill(overrides: Partial<StoreSkillView> = {}) {
	return observable({
		id: "skill-1",
		storeSkillId: "store-skill-1",
		skillCode: "skill.code",
		userSkillCode: undefined,
		name: "Skill Name",
		description: "Skill description",
		thumbnail: undefined,
		isFeatured: false,
		latestVersion: "v1.0.0",
		status: "not-added",
		authorName: undefined,
		publisherType: "OFFICIAL",
		needUpgrade: false,
		updatedAt: "2026-03-22 10:00",
		...overrides,
	}) as StoreSkillView
}

describe("StoreSkillCardMobile", () => {
	it("opens detail when the card body is clicked", () => {
		const skill = createSkill()
		const onOpenDetail = vi.fn()

		render(<StoreSkillCardMobile skill={skill} language="en_US" onOpenDetail={onOpenDetail} />)

		screen.getByTestId("skills-library-mobile-card").click()

		expect(onOpenDetail).toHaveBeenCalledWith(skill)
	})

	it("updates the action label after the observable skill becomes added", () => {
		const skill = createSkill()

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.getByTestId("skills-library-mobile-card-action")).toHaveTextContent(
			"Add to My Skills",
		)

		act(() => {
			runInAction(() => {
				skill.status = "added"
			})
		})

		expect(screen.getByTestId("skills-library-mobile-card-action")).toHaveTextContent("Added")
		expect(screen.getByTestId("skills-library-mobile-card-action")).toBeDisabled()
	})

	it("keeps the upgrade action when an added skill still needs upgrade", () => {
		const skill = createSkill({
			status: "added",
			needUpgrade: true,
		})

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.getByTestId("skills-library-mobile-card-action")).toHaveTextContent("Upgrade")
		expect(screen.getByTestId("skills-library-mobile-card-action")).not.toBeDisabled()
	})

	it("does not open detail when action button is clicked", () => {
		const skill = createSkill()
		const onOpenDetail = vi.fn()
		const onAdd = vi.fn()

		render(
			<StoreSkillCardMobile
				skill={skill}
				language="en_US"
				onOpenDetail={onOpenDetail}
				onAdd={onAdd}
			/>,
		)

		screen.getByTestId("skills-library-mobile-card-action").click()

		expect(onAdd).toHaveBeenCalledWith("skill-1")
		expect(onOpenDetail).not.toHaveBeenCalled()
	})

	it("shows official built-in when publisher type matches", () => {
		const skill = createSkill({
			publisherType: "OFFICIAL_BUILTIN",
		})

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.getByText("Official Built-in")).toBeInTheDocument()
	})
})
