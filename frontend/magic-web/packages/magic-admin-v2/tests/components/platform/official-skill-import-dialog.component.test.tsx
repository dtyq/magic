import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createContext } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OfficialSkillImportDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/official-skill-import-dialog"

const { importOfficialSkill, parseOfficialSkillFile, uploadFile } = vi.hoisted(() => ({
	importOfficialSkill: vi.fn(),
	parseOfficialSkillFile: vi.fn(),
	uploadFile: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@magic-admin-v2/runtime/context", () => ({
	RuntimeContext: createContext(null),
	useApis: () => ({
		officialMarketplace: { importOfficialSkill, parseOfficialSkillFile },
	}),
	useRuntime: () => ({
		capabilities: {
			uploadFile,
			uploadPublicImage: vi.fn(),
		},
	}),
}))

afterEach(() => {
	vi.clearAllMocks()
})

function expectFieldError(fieldId: string, message: string) {
	const field = document.querySelector(`[data-form-field="${fieldId}"]`)
	expect(field).not.toBeNull()
	expect(within(field as HTMLElement).getByText("*")).toHaveClass("text-destructive")
	expect(within(field as HTMLElement).getByText(message)).toBeInTheDocument()
}

describe("official Skill import dialog", () => {
	it("marks names, descriptions, and version as required and shows field errors", async () => {
		uploadFile.mockResolvedValue({ path: "private/skill/demo.zip" })
		parseOfficialSkillFile.mockResolvedValue({
			code: "demo-skill",
			description_i18n: { en_US: "", zh_CN: "" },
			import_token: "import-token",
			name_i18n: { en_US: "", zh_CN: "" },
			package_description: "",
			package_name: "",
			version: "1.0.0",
		})

		render(
			<OfficialSkillImportDialog
				categories={[]}
				onCancel={vi.fn()}
				onSuccess={vi.fn()}
				open
			/>,
		)

		const archiveInput = document.querySelector(`input[accept^=".zip"]`) as HTMLInputElement
		fireEvent.change(archiveInput, {
			target: { files: [new File(["skill"], "demo.zip", { type: "application/zip" })] },
		})

		await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(parseOfficialSkillFile).toHaveBeenCalledTimes(1))
		const versionInput = await screen.findByLabelText(
			/officialMarketplace\.skillImport\.field\.version/,
		)
		fireEvent.change(versionInput, {
			target: { value: "" },
		})
		fireEvent.click(screen.getByRole("button", { name: "officialMarketplace.skillImport.confirm" }))

		await waitFor(() => {
			expectFieldError(
				"official-skill-name-zh",
				"officialMarketplace.skillImport.validation.nameZhRequired",
			)
			expectFieldError(
				"official-skill-name-en",
				"officialMarketplace.skillImport.validation.nameEnRequired",
			)
			expectFieldError(
				"official-skill-description-zh",
				"officialMarketplace.skillImport.validation.descriptionZhRequired",
			)
			expectFieldError(
				"official-skill-description-en",
				"officialMarketplace.skillImport.validation.descriptionEnRequired",
			)
			expectFieldError(
				"official-skill-version",
				"officialMarketplace.skillImport.validation.versionRequired",
			)
		})
		expect(importOfficialSkill).not.toHaveBeenCalled()
	})
})
