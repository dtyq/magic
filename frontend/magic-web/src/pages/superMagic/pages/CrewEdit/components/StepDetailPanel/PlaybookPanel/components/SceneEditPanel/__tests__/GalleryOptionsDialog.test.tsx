import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GalleryOptionsDialog } from "../components/GalleryOptionsDialog"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: { language: "en_US" },
		}),
	}
})

vi.mock("../components/LocaleTextInput", () => ({
	LocaleTextInput: ({
		value,
		onChange,
		multiline,
		"data-testid": testId,
	}: {
		value: { default?: string } | string
		onChange: (nextValue: { default?: string } | string) => void
		multiline?: boolean
		"data-testid"?: string
	}) => {
		const resolvedValue = typeof value === "string" ? value : (value.default ?? "")
		const Component = multiline ? "textarea" : "input"

		return (
			<Component
				data-testid={testId}
				value={resolvedValue}
				onChange={(event: { target: { value: string } }) =>
					onChange(
						typeof value === "string"
							? event.target.value
							: { ...value, default: event.target.value },
					)
				}
			/>
		)
	},
}))

vi.mock("../components/ImageUploadField", () => ({
	ImageUploadField: ({
		onChange,
		onUploadSuccess,
		uploadBtnTestId,
	}: {
		onChange: (url: string) => void
		onUploadSuccess?: (file: File) => void
		uploadBtnTestId?: string
	}) => (
		<button
			type="button"
			data-testid={uploadBtnTestId}
			onClick={() => {
				onChange("https://example.com/cover.png")
				onUploadSuccess?.(new File([""], "cover image.png", { type: "image/png" }))
			}}
		>
			upload
		</button>
	),
}))

vi.mock("../components/DemoItemEditDialog/PromptRichTextLocaleEditor", () => ({
	PromptRichTextLocaleEditor: () => <textarea data-testid="gallery-options-preset-content" />,
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/panels/TemplateViewSwitcher", () => ({
	default: ({
		items,
		onReorder,
	}: {
		items: { value: string }[]
		onReorder?: (items: { value: string }[]) => void
	}) => (
		<button
			type="button"
			data-testid="gallery-options-reorder-btn"
			onClick={() => onReorder?.([items[1], items[0], ...items.slice(2)])}
		>
			reorder
		</button>
	),
}))

describe("GalleryOptionsDialog", () => {
	function renderDialog() {
		render(<GalleryOptionsDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

		fireEvent.click(screen.getByTestId("gallery-options-add-btn"))
	}

	it("prefills preset value from uploaded file name when title and value are empty", () => {
		renderDialog()

		fireEvent.click(screen.getByTestId("gallery-item-upload-btn"))

		expect(screen.getByTestId("gallery-item-value-input")).toHaveValue("cover image")
	})

	it("does not prefill preset value when title is already filled", () => {
		renderDialog()

		fireEvent.change(screen.getByTestId("gallery-item-title-input"), {
			target: { value: "Manual title" },
		})
		fireEvent.click(screen.getByTestId("gallery-item-upload-btn"))

		expect(screen.getByTestId("gallery-item-value-input")).toHaveValue("")
	})

	it("persists reordered gallery options on confirm", () => {
		const onConfirm = vi.fn()

		render(
			<GalleryOptionsDialog
				open
				onOpenChange={vi.fn()}
				onConfirm={onConfirm}
				galleryItem={{
					data_key: "gallery",
					label: "Gallery",
					options: [
						{ value: "first", label: "First" },
						{ value: "second", label: "Second" },
					],
				}}
			/>,
		)

		fireEvent.click(screen.getByTestId("gallery-options-reorder-btn"))
		fireEvent.click(screen.getByTestId("gallery-options-confirm"))

		expect(onConfirm).toHaveBeenCalledWith(
			expect.objectContaining({
				options: [
					expect.objectContaining({ value: "second" }),
					expect.objectContaining({ value: "first" }),
				],
			}),
		)
	})
})
