import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

const openUploadPickerSpy = vi.fn()
let emitSelectedFiles: (() => void) | null = null

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"actions.startRecording": "Start Recording",
				"card.sourceImported": "Imported audio",
				"super:mobile.recordingEntry.settings.title": "Recording Settings",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/components/business/RecordingSummary/AudioUploadAction", () => ({
	default: ({
		handler,
		onFileChange,
	}: {
		handler: (onUpload: () => void) => ReactNode
		onFileChange?: (files: FileList) => void
	}) => {
		// Split picker opening from file delivery to mirror the native file input timing.
		const trigger = handler(() => {
			openUploadPickerSpy()
			emitSelectedFiles = () => {
				const file = new File(["demo"], "demo.wav", { type: "audio/wav" })
				const files = {
					0: file,
					length: 1,
					item: (index: number) => (index === 0 ? file : null),
				} as unknown as FileList
				onFileChange?.(files)
			}
		})
		return (
			<>
				{trigger}
				<button
					type="button"
					data-testid="audio-upload-action-file-change"
					onClick={() => emitSelectedFiles?.()}
				/>
			</>
		)
	},
}))

import { AudioRecordingsPrimaryActions } from "../AudioRecordingsPrimaryActions"

/** Renders the desktop header action cluster with isolated spies per test. */
function renderPrimaryActions(
	overrides: Partial<Parameters<typeof AudioRecordingsPrimaryActions>[0]> = {},
) {
	const onStartRecording = vi.fn()
	const onOpenSettings = vi.fn()
	const onImportFiles = vi.fn()
	render(
		<AudioRecordingsPrimaryActions
			onStartRecording={onStartRecording}
			onOpenSettings={onOpenSettings}
			onImportFiles={onImportFiles}
			isStartingRecording={false}
			{...overrides}
		/>,
	)

	return {
		onStartRecording,
		onOpenSettings,
		onImportFiles,
	}
}

beforeEach(() => {
	openUploadPickerSpy.mockClear()
	emitSelectedFiles = null
})

describe("AudioRecordingsPrimaryActions", () => {
	it("renders the desktop primary action cluster", () => {
		renderPrimaryActions()

		expect(screen.getByTestId("audio-recordings-primary-actions")).toBeInTheDocument()
		expect(screen.getByTestId("audio-recordings-start-recording-button")).toHaveTextContent(
			"Start Recording",
		)
		expect(screen.getByTestId("audio-recordings-import-audio-button")).toHaveTextContent(
			"Imported audio",
		)
		expect(screen.getByTestId("audio-recordings-settings-button")).toHaveTextContent(
			"Recording Settings",
		)
	})

	it("forwards the primary recording click handler", () => {
		const handlers = renderPrimaryActions()

		fireEvent.click(screen.getByTestId("audio-recordings-start-recording-button"))
		expect(handlers.onStartRecording).toHaveBeenCalledTimes(1)
	})

	it("does not render a separate force-start action", () => {
		renderPrimaryActions()
		expect(
			screen.queryByTestId("audio-recordings-force-start-recording-button"),
		).not.toBeInTheDocument()
	})

	it("disables the recording action while start preparation is running", () => {
		renderPrimaryActions({ isStartingRecording: true })

		expect(screen.getByTestId("audio-recordings-start-recording-button")).toBeDisabled()
	})

	it("opens the stable file picker when clicking the import audio button", () => {
		const handlers = renderPrimaryActions()

		fireEvent.click(screen.getByTestId("audio-recordings-import-audio-button"))
		expect(openUploadPickerSpy).toHaveBeenCalledTimes(1)
		expect(handlers.onImportFiles).not.toHaveBeenCalled()
	})

	it("forwards imported files after the file picker has been triggered", () => {
		const handlers = renderPrimaryActions()

		fireEvent.click(screen.getByTestId("audio-recordings-import-audio-button"))
		fireEvent.click(screen.getByTestId("audio-upload-action-file-change"))

		expect(handlers.onImportFiles).toHaveBeenCalledTimes(1)
	})

	it("forwards the settings button click", () => {
		const handlers = renderPrimaryActions()

		fireEvent.click(screen.getByTestId("audio-recordings-settings-button"))
		expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1)
	})

	it("disables recording while the startup flow is in progress", () => {
		renderPrimaryActions({ isStartingRecording: true })

		expect(screen.getByTestId("audio-recordings-start-recording-button")).toBeDisabled()
	})
})
