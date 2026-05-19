import { fireEvent, render, screen } from "@testing-library/react"
import { forwardRef, useImperativeHandle } from "react"
import { describe, expect, it, vi } from "vitest"
import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { PromptRichTextLocaleDialog } from "../components/DemoItemEditDialog/PromptRichTextLocaleDialog"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, params?: Record<string, string>) => {
				if (key === "playbook.edit.basicInfo.localeDialog.title") {
					return `Localize: ${params?.label ?? ""}`
				}
				if (key === "playbook.edit.basicInfo.localeDialog.usingDefault") {
					return `Using default: ${params?.value ?? ""}`
				}
				return key
			},
		}),
	}
})

vi.mock("../components/DemoItemEditDialog/PromptRichTextEditor", () => ({
	PromptRichTextEditor: forwardRef(function MockPromptRichTextEditor(
		{
			value,
			onChange,
			"data-testid": testId,
		}: {
			value: string
			onChange: (value: string) => void
			"data-testid"?: string
		},
		ref,
	) {
		useImperativeHandle(ref, () => ({
			focus: () => undefined,
			insertPresetValue: () => onChange(value ? `${value}{preset_value}` : "{preset_value}"),
		}))

		return (
			<textarea
				data-testid={testId}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		)
	}),
}))

describe("PromptRichTextLocaleDialog", () => {
	it("keeps confirm disabled until default locale has content and supports preset insertion", () => {
		const handleChange = vi.fn()

		render(
			<PromptRichTextLocaleDialog
				value={{ default: "", en_US: "", zh_CN: "" } satisfies LocaleText}
				onChange={handleChange}
				placeholder="Prompt"
				localizeLabel="Prompt"
				mentionPanelStore={{} as never}
				data-testid="prompt"
			/>,
		)

		fireEvent.click(screen.getByTestId("prompt-locale-btn"))

		const confirmButton = screen.getByTestId("prompt-localize-confirm")
		expect(confirmButton).toBeDisabled()

		fireEvent.click(screen.getByTestId("prompt-default-insert-preset-value-btn"))

		expect(screen.getByTestId("prompt-default")).toHaveValue("{preset_value}")
		expect(confirmButton).not.toBeDisabled()

		fireEvent.click(confirmButton)

		expect(handleChange).toHaveBeenCalledWith({
			default: "{preset_value}",
			en_US: "",
			zh_CN: "",
		})
	})
})
