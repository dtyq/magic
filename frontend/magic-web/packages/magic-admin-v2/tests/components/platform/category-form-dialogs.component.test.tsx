import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AgentMarketCategoryFormDialog } from "../../../src/features/platform-official-marketplace/components/agent-market-category-form-dialog"
import { SkillMarketCategoryFormDialog } from "../../../src/features/platform-official-marketplace/components/skill-market-category-form-dialog"
import { CategoryDialog } from "../../../src/features/platform-slides-template/components/category-dialog"
import { TagDialog } from "../../../src/features/platform-slides-template/components/tag-dialog"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
	toast: { success: vi.fn() },
}))

const createMutation = {
	isPending: false,
	mutateAsync: vi.fn(),
}

const updateMutation = {
	isPending: false,
	mutateAsync: vi.fn(),
}

const slidesMutations = {
	create: createMutation,
	update: updateMutation,
} as never

afterEach(() => {
	vi.clearAllMocks()
})

function expectFieldError(fieldId: string, message: string) {
	const field = document.querySelector(`[data-form-field="${fieldId}"]`)
	expect(field).not.toBeNull()
	expect(within(field as HTMLElement).getByText(message)).toBeInTheDocument()
}

describe("category form dialogs", () => {
	it("shows PPT category validation beneath each field", async () => {
		render(
			<CategoryDialog
				editing={null}
				mutations={slidesMutations}
				onOpenChange={vi.fn()}
				open
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "common.save" }))

		await waitFor(() => {
			expectFieldError(
				"slides-template-category-name-zh",
				"slidesTemplate.validation.nameZhRequired",
			)
			expectFieldError(
				"slides-template-category-name-en",
				"slidesTemplate.validation.nameEnRequired",
			)
		})
		expect(createMutation.mutateAsync).not.toHaveBeenCalled()
	})

	it("shows PPT tag code and parent group validation beneath their fields", async () => {
		render(
			<TagDialog
				editing={null}
				groups={[]}
				mode="tag"
				mutations={slidesMutations}
				onOpenChange={vi.fn()}
				open
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "common.save" }))

		await waitFor(() => {
			expectFieldError("slides-template-tag-code", "slidesTemplate.validation.codeRequired")
			expectFieldError(
				"slides-template-tag-parent-group",
				"slidesTemplate.validation.parentGroupRequired",
			)
		})
		expect(createMutation.mutateAsync).not.toHaveBeenCalled()
	})

	it("shows employee market category validation beneath each field", async () => {
		const onSubmit = vi.fn()
		render(
			<AgentMarketCategoryFormDialog
				editing={null}
				isPending={false}
				onOpenChange={vi.fn()}
				onSubmit={onSubmit}
				open
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "common.save" }))

		await waitFor(() => {
			expectFieldError(
				"market-category-name-zh",
				"officialMarketplace.category.form.nameZhRequired",
			)
			expectFieldError(
				"market-category-name-en",
				"officialMarketplace.category.form.nameEnRequired",
			)
		})
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("shows Skill market category validation beneath each field", async () => {
		const onSubmit = vi.fn()
		render(
			<SkillMarketCategoryFormDialog
				editing={null}
				isPending={false}
				onOpenChange={vi.fn()}
				onSubmit={onSubmit}
				open
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "common.save" }))

		await waitFor(() => {
			expectFieldError(
				"skill-market-category-name-zh",
				"officialMarketplace.skillCategory.form.nameZhRequired",
			)
			expectFieldError(
				"skill-market-category-name-en",
				"officialMarketplace.skillCategory.form.nameEnRequired",
			)
		})
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("uses the Zod field error for a negative sort value", async () => {
		render(
			<CategoryDialog
				editing={null}
				mutations={slidesMutations}
				onOpenChange={vi.fn()}
				open
			/>,
		)

		fireEvent.change(document.querySelector("#slides-template-category-name-zh") as HTMLElement, {
			target: { value: "演示" },
		})
		fireEvent.change(document.querySelector("#slides-template-category-name-en") as HTMLElement, {
			target: { value: "Demo" },
		})
		fireEvent.change(document.querySelector("#slides-template-category-sort") as HTMLElement, {
			target: { value: "-1" },
		})
		fireEvent.click(screen.getByRole("button", { name: "common.save" }))

		await waitFor(() =>
			expectFieldError(
				"slides-template-category-sort",
				"slidesTemplate.validation.sortNonNegative",
			),
		)
		expect(createMutation.mutateAsync).not.toHaveBeenCalled()
	})
})
