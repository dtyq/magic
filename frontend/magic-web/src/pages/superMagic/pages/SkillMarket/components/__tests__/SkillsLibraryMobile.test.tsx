import { act, render, screen } from "@testing-library/react"
import { observable, runInAction } from "mobx"
import { describe, expect, it, vi } from "vitest"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { StoreSkillCardMobile } from "../StoreSkillCardMobile"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { dateTime?: string; formattedCount?: string }) => {
			switch (key) {
				case "skillsLibrary.addToMySkills":
					return "Add to My Skills"
				case "skillsLibrary.added":
					return "Added"
				case "skillsLibrary.updatedAt":
					return `Updated ${params?.dateTime ?? ""}`.trim()
				case "skillsLibrary.updatedAtLabel":
					return "Updated"
				case "skillsLibrary.installCount":
					return `${params?.formattedCount ?? ""} installs`.trim()
				case "skillsLibrary.installCountLabel":
					return "Installs"
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
		installCount: 234,
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

	it("keeps added skills unavailable even when an older version is detected", () => {
		const skill = createSkill({
			status: "added",
			needUpgrade: true,
		})

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.getByTestId("skills-library-mobile-card-action")).toHaveTextContent("Added")
		expect(screen.getByTestId("skills-library-mobile-card-action")).toBeDisabled()
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

	it("shows install count alongside publisher and updated time", () => {
		const skill = createSkill()

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.getByTestId("skills-library-mobile-card-install-count")).toHaveTextContent(
			"Installs",
		)
		expect(screen.getByTestId("skills-library-mobile-card-install-count")).toHaveTextContent(
			"234",
		)
	})

	it("does not show a featured badge on the card", () => {
		const skill = createSkill({ isFeatured: true })

		render(<StoreSkillCardMobile skill={skill} language="en_US" />)

		expect(screen.queryByTestId("skills-library-mobile-card-featured")).not.toBeInTheDocument()
	})

	it("shows a featured badge when the card is rendered in the featured section", () => {
		const skill = createSkill({ isFeatured: true })

		render(<StoreSkillCardMobile skill={skill} language="en_US" showFeaturedTag />)

		expect(screen.getByTestId("skills-library-mobile-card-featured")).toHaveTextContent(
			"Featured",
		)
	})
})
