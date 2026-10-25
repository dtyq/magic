import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SlidesTemplateSettingsDialog from "../SlidesTemplateSettingsDialog"
import type { SlidesTemplateManifest } from "../types"

const mocks = vi.hoisted(() => ({
	getSlidesTemplateCategories: vi.fn(),
	getSlidesTemplateTagGroups: vi.fn(),
}))

vi.mock("@/apis", () => ({ SuperMagicApi: mocks }))
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "zh_CN" },
		t: (key: string) => key,
	}),
}))

const manifest: SlidesTemplateManifest = {
	schema_version: "1.0",
	template_id: "SLIDE-settings",
	category_code: "business",
	tag_codes: ["historical-tag"],
	label: { zh_CN: "中文名称", en_US: "English name" },
	description: { zh_CN: "中文描述", en_US: "English description" },
	files: { slides_dir: "slides", unknown: true },
	slides: [
		{
			file: "slides/slide-1.html",
			title: "封面",
			layout: "cover",
			description: "页面描述",
		},
	],
}

describe("SlidesTemplateSettingsDialog", () => {
	beforeEach(() => {
		mocks.getSlidesTemplateCategories.mockResolvedValue({
			list: [{ code: "business", name_i18n: { zh_CN: "商务" } }],
		})
		mocks.getSlidesTemplateTagGroups.mockResolvedValue([
			{
				code: "style",
				name_i18n: { zh_CN: "风格" },
				tags: [{ code: "modern", name_i18n: { zh_CN: "现代" } }],
			},
		])
	})

	it("uses content height with a viewport maximum", async () => {
		render(
			<SlidesTemplateSettingsDialog
				manifest={manifest}
				open
				onOpenChange={vi.fn()}
				onSave={vi.fn().mockResolvedValue(undefined)}
			/>,
		)

		const dialog = screen.getByTestId("slides-template-settings-dialog")
		expect(dialog).toHaveClass("h-auto", "max-h-[min(90dvh,860px)]")
		expect(dialog.classList.contains("h-[min(90dvh,860px)]")).toBe(false)
		expect(screen.getByTestId("slides-template-settings-scroll-area")).toHaveClass(
			"min-h-0",
			"flex-1",
			"overflow-y-auto",
			"overscroll-contain",
		)
		expect(screen.getByTestId("slides-template-settings-content")).toHaveClass(
			"px-3",
			"pb-2",
			"pt-3",
			"sm:px-5",
			"sm:pt-5",
		)
		await waitFor(() => expect(mocks.getSlidesTemplateTagGroups).toHaveBeenCalled())
	})

	it("initializes values and preserves unavailable historical tags", async () => {
		render(
			<SlidesTemplateSettingsDialog
				manifest={manifest}
				open
				onOpenChange={vi.fn()}
				onSave={vi.fn().mockResolvedValue(undefined)}
			/>,
		)

		expect(screen.getByDisplayValue("中文名称")).toBeInTheDocument()
		const taxonomyTrigger = screen
			.getByText("slidesTemplatePreview.settings.taxonomy")
			.closest("button")
		if (!taxonomyTrigger) throw new Error("Missing taxonomy trigger")
		fireEvent.click(taxonomyTrigger)
		await waitFor(() => expect(screen.getByText("historical-tag")).toBeInTheDocument())
	})

	it("keeps the dialog and form when saving fails", async () => {
		const onSave = vi.fn().mockRejectedValue(new Error("save failed"))
		render(
			<SlidesTemplateSettingsDialog
				manifest={manifest}
				open
				onOpenChange={vi.fn()}
				onSave={onSave}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-settings-save-button"))
		await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
		expect(screen.getByTestId("slides-template-settings-dialog")).toBeInTheDocument()
		expect(screen.getByText("slidesTemplatePreview.settings.saveFailed")).toBeInTheDocument()
	})

	it("validates layout before writing", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined)
		render(
			<SlidesTemplateSettingsDialog
				manifest={manifest}
				open
				onOpenChange={vi.fn()}
				onSave={onSave}
			/>,
		)

		const slidesTrigger = screen
			.getByText("slidesTemplatePreview.settings.slides")
			.closest("button")
		if (!slidesTrigger) throw new Error("Missing slides trigger")
		fireEvent.click(slidesTrigger)
		expect(screen.getByText("页面描述")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: /^1\. 封面/ }))
		fireEvent.change(screen.getByDisplayValue("cover"), { target: { value: "Invalid Layout" } })
		fireEvent.click(screen.getByTestId("slides-template-settings-save-button"))
		await waitFor(() =>
			expect(
				screen.getByText("slidesTemplatePreview.settings.layoutInvalid"),
			).toBeInTheDocument(),
		)
		expect(onSave).not.toHaveBeenCalled()
	})
})
