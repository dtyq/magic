import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { serializePromptRichTextLocaleValue } from "@/pages/superMagic/components/MainInputContainer/panels/promptRichText"
import { DemoItemEditDialog } from "../components/DemoItemEditDialog"

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

vi.mock("@/pages/superMagic/pages/CrewEdit/context", () => ({
	useCrewEditStore: () => ({
		mentionPanelStore: {},
	}),
}))

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
	ImageUploadField: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../components/DemoGroupEditDialog", () => ({
	DemoGroupEditDialog: () => null,
}))

vi.mock("../components/DemoItemEditDialog/PromptRichTextLocaleEditor", () => ({
	PromptRichTextLocaleEditor: ({
		value,
		onChange,
		"data-testid": testId,
	}: {
		value: { default?: string } | string
		onChange: (nextValue: { default?: string } | string) => void
		"data-testid"?: string
	}) => {
		const rawValue = typeof value === "string" ? value : (value.default ?? "")

		return (
			<textarea
				data-testid={testId}
				value={rawValue}
				onChange={(event) =>
					onChange({
						default: serializePromptRichTextLocaleValue({
							type: "doc",
							content: [
								{
									type: "paragraph",
									content: event.target.value
										? [{ type: "text", text: event.target.value }]
										: undefined,
								},
							],
						}),
					})
				}
			/>
		)
	},
}))

describe("DemoItemEditDialog", () => {
	it("returns serialized prompt rich text on confirm", () => {
		const handleConfirm = vi.fn()
		const handleOpenChange = vi.fn()

		render(
			<DemoItemEditDialog
				groups={[]}
				open
				onOpenChange={handleOpenChange}
				onConfirm={handleConfirm}
			/>,
		)

		const confirmButton = screen.getByTestId("demo-item-dialog-confirm")
		expect(confirmButton).toBeDisabled()

		fireEvent.change(screen.getByTestId("demo-item-title-input"), {
			target: { value: "Demo title" },
		})
		fireEvent.change(screen.getByTestId("demo-item-prompt-input"), {
			target: { value: "Prompt body" },
		})

		expect(confirmButton).not.toBeDisabled()

		fireEvent.click(confirmButton)

		expect(handleConfirm).toHaveBeenCalledTimes(1)
		expect(handleConfirm.mock.calls[0][0]).toMatchObject({
			label: "Demo title",
			description: {
				default: JSON.stringify({
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "Prompt body" }],
						},
					],
				}),
			},
		})
		expect(handleOpenChange).toHaveBeenCalledWith(false)
	})
})
