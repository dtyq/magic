import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecordingDetailSpeakerDialog } from "../RecordingDetailSpeakerDialog"

vi.mock("react-i18next", () => ({
	// Keep the component test independent from the application i18n provider.
	useTranslation: () => ({
		// Return stable labels for the dialog controls and speaker fields.
		t: (key: string, options?: { label?: string }) => {
			const labels: Record<string, string> = {
				"detail.speakerSettingsTitle": "Speaker settings",
				"detail.speakerSettingsHint": "Edit speaker names",
				"detail.speakerLabel": `Speaker ${options?.label ?? ""}`,
				"detail.speakerSettingsCancel": "Cancel",
				"detail.speakerSettingsSave": "Save",
			}
			return labels[key] ?? key
		},
	}),
}))

/** Covers desktop speaker-name editing focus behavior and interaction callbacks. */
describe("RecordingDetailSpeakerDialog", () => {
	it("keeps the trigger focused instead of auto-focusing the first input", () => {
		// Open the controlled dialog after focusing its trigger to observe Radix's focus behavior.
		const dialogProps = {
			speakerIds: ["Speaker-1", "Speaker-2"],
			value: { "Speaker-1": "", "Speaker-2": "" },
			onValueChange: vi.fn(),
			onOpenChange: vi.fn(),
			onConfirm: vi.fn(),
		}
		const { rerender } = render(
			<>
				<button type="button" data-testid="speaker-settings-trigger">
					Open speaker settings
				</button>
				<RecordingDetailSpeakerDialog {...dialogProps} open={false} />
			</>,
		)
		const trigger = screen.getByTestId("speaker-settings-trigger")
		trigger.focus()

		rerender(
			<>
				<button type="button" data-testid="speaker-settings-trigger">
					Open speaker settings
				</button>
				<RecordingDetailSpeakerDialog {...dialogProps} open />
			</>,
		)

		const inputs = screen.getAllByRole("textbox")
		expect(inputs[0]).not.toHaveFocus()
		expect(inputs[1]).not.toHaveFocus()
		expect(document.activeElement).toBe(trigger)
	})

	it("allows manual focus and editing of a speaker name", () => {
		// Confirm that preventing automatic focus does not change the existing edit callback.
		const onValueChange = vi.fn()

		render(
			<RecordingDetailSpeakerDialog
				open
				speakerIds={["Speaker-1", "Speaker-2"]}
				value={{ "Speaker-1": "", "Speaker-2": "" }}
				onValueChange={onValueChange}
				onOpenChange={vi.fn()}
				onConfirm={vi.fn()}
			/>,
		)

		const firstInput = screen.getAllByRole("textbox")[0]
		fireEvent.focus(firstInput)
		fireEvent.change(firstInput, { target: { value: "Edited speaker" } })

		expect(onValueChange).toHaveBeenCalledWith({
			"Speaker-1": "Edited speaker",
			"Speaker-2": "",
		})
	})
})
