import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SkillCard, { type SkillCardData } from "../SkillCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { dateTime?: string; formattedCount?: string }) => {
			switch (key) {
				case "skillsLibrary.addToMySkills":
					return "添加到我的技能"
				case "skillsLibrary.added":
					return "已添加"
				case "skillsLibrary.official":
					return "官方"
				case "employeeCard.officialBuiltin":
					return "官方内置"
				case "skillsLibrary.community":
					return "社区"
				case "skillsLibrary.updatedAt":
					return `更新于 ${params?.dateTime ?? ""}`.trim()
				case "skillsLibrary.updatedAtLabel":
					return "更新于"
				case "skillsLibrary.installCount":
					return `${params?.formattedCount ?? ""} 次安装`.trim()
				case "skillsLibrary.installCountLabel":
					return "安装数"
				case "skillsLibrary.featured":
					return "精选"
				default:
					return key
			}
		},
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/pages/superMagic/components/SkillThumbnail", () => ({
	SkillThumbnail: ({ alt }: { alt: string }) => <div data-testid="skill-thumbnail">{alt}</div>,
}))

function createSkill(overrides: Partial<SkillCardData> = {}): SkillCardData {
	return {
		id: "skill-1",
		skillCode: "skill.code",
		name: "深度研究",
		description: "检索多源信息并生成结构清晰的专业研究报告。",
		isFeatured: true,
		status: "not-added",
		publisherType: "OFFICIAL",
		installCount: 1234,
		updatedAt: "2026-08-09 14:30",
		...overrides,
	}
}

describe("SkillCard", () => {
	it("shows the supported market metadata with a complete Chinese date and time", () => {
		render(<SkillCard skill={createSkill()} />)

		expect(screen.getByTestId("skill-thumbnail")).toHaveTextContent("深度研究")
		expect(screen.getByTestId("skill-card-source-badge")).toHaveTextContent("官方")
		expect(screen.getByTestId("skill-card-updated-at")).toHaveTextContent("更新于")
		expect(screen.getByTestId("skill-card-updated-at")).toHaveTextContent("2026年8月9日 14:30")
		expect(screen.getByTestId("skill-card-install-count")).toHaveTextContent("安装数")
		expect(screen.getByTestId("skill-card-install-count")).toHaveTextContent("1,234")
		expect(screen.queryByTestId("skill-card-featured")).not.toBeInTheDocument()
		expect(screen.queryByTestId("skill-card-category")).not.toBeInTheDocument()
	})

	it("shows official built-in skills with the dedicated publisher label", () => {
		render(<SkillCard skill={createSkill({ publisherType: "OFFICIAL_BUILTIN" })} />)

		expect(screen.getByTestId("skill-card-source-badge")).toHaveTextContent("官方内置")
		expect(screen.queryByTestId("skill-card-install-count")).not.toBeInTheDocument()
	})

	it("shows the featured tag only when rendered inside the featured section", () => {
		render(<SkillCard skill={createSkill()} showFeaturedTag />)

		expect(screen.getByTestId("skill-card-featured")).toHaveTextContent("精选")
	})

	it("shows a community label without inventing category metadata", () => {
		render(<SkillCard skill={createSkill({ publisherType: "USER" })} />)

		expect(screen.getByTestId("skill-card-source-badge")).toHaveTextContent("社区")
		expect(screen.queryByTestId("skill-card-category")).not.toBeInTheDocument()
	})

	it("adds a skill without opening its detail", () => {
		const onAdd = vi.fn()
		const onOpenDetail = vi.fn()
		render(<SkillCard skill={createSkill()} onAdd={onAdd} onOpenDetail={onOpenDetail} />)

		fireEvent.click(screen.getByTestId("skill-card-add-button"))

		expect(onAdd).toHaveBeenCalledWith("skill-1")
		expect(onOpenDetail).not.toHaveBeenCalled()
	})

	it("renders the added state as a disabled icon action", () => {
		render(<SkillCard skill={createSkill({ status: "added" })} />)

		expect(screen.getByTestId("skill-card-added-button")).toBeDisabled()
		expect(screen.getByTestId("skill-card-added-button")).toHaveAccessibleName("已添加")
	})

	it("opens detail from keyboard focus on the card body", () => {
		const onOpenDetail = vi.fn()
		render(<SkillCard skill={createSkill()} onOpenDetail={onOpenDetail} />)

		fireEvent.keyDown(screen.getByTestId("skill-card-detail-button"), { key: "Enter" })

		expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: "skill-1" }))
	})

	it("disables the add action while the shared request is pending", () => {
		render(<SkillCard skill={createSkill()} isAdding />)

		expect(screen.getByTestId("skill-card-add-button")).toBeDisabled()
		expect(screen.getByTestId("skill-card-add-button")).toHaveAccessibleName(
			"skillsLibrary.adding",
		)
	})
})
