import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SlidesTemplatePreviewHeader from "../SlidesTemplatePreviewHeader"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"slidesTemplatePreview.settings.open": "编辑模板信息",
				"slidesTemplatePreview.save.fullLabel": "存入我的模板",
				"slidesTemplatePreview.save.mobileLabel": "存入模板",
			})[key] || key,
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

describe("SlidesTemplatePreviewHeader", () => {
	it("shows the editable controls and accessible save label", () => {
		const onOpenSettings = vi.fn()
		const onSave = vi.fn()
		render(
			<SlidesTemplatePreviewHeader
				isSaving={false}
				onOpenSettings={onOpenSettings}
				onSaveToMyTemplates={onSave}
				title="一个很长的模板名称"
			/>,
		)

		expect(screen.getByTestId("slides-template-preview-title")).toHaveTextContent(
			"一个很长的模板名称",
		)
		fireEvent.click(screen.getByTestId("slides-template-preview-settings-button"))
		fireEvent.click(screen.getByTestId("slides-template-preview-save-button"))
		expect(onOpenSettings).toHaveBeenCalledOnce()
		expect(onSave).toHaveBeenCalledOnce()
		expect(screen.getByRole("button", { name: "存入我的模板" })).toBeInTheDocument()
	})

	it("hides settings for read-only users", () => {
		render(
			<SlidesTemplatePreviewHeader
				isSaving={false}
				onSaveToMyTemplates={vi.fn()}
				title="Template"
			/>,
		)

		expect(
			screen.queryByTestId("slides-template-preview-settings-button"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("slides-template-preview-save-button")).toBeInTheDocument()
	})

	it("hides settings and save actions in share preview", () => {
		render(<SlidesTemplatePreviewHeader isSaving={false} title="Shared template" />)

		expect(screen.getByTestId("slides-template-preview-title")).toHaveTextContent(
			"Shared template",
		)
		expect(
			screen.queryByTestId("slides-template-preview-settings-button"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("slides-template-preview-save-button")).not.toBeInTheDocument()
	})
})
