import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ChangeEvent, HTMLAttributes, ReactNode } from "react"
import { createContext, useContext } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RECORDING_DEBUG_FORMAT_STORAGE_KEY } from "../recordingFormatDebug"

const updateMediaRecorderConfig = vi.fn()
const getMediaRecorderConfig = vi.fn(() => ({
	mimeType: "audio/ogg; codecs=opus",
	audioBitsPerSecond: 32000,
	timeslice: 10000,
	enableEchoCancellation: false,
	enableNoiseSuppression: false,
	autoGainControl: false,
	audioSource: {
		source: "microphone" as const,
		microphoneGain: 1.1,
		systemGain: 1,
	},
}))

vi.mock("@/utils/env", () => ({ isDev: true }))

vi.mock("@/services/recordSummary/serviceInstance", () => ({
	initializeService: () => ({
		getMediaRecorderConfig,
		getMediaRecorderStream: () => null,
		updateMediaRecorderConfig,
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn() },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"recordingSummary.debugPanel.apply": "Apply",
				"recordingSummary.debugPanel.format": "Recording Format",
				"recordingSummary.debugPanel.formatAuto": "Auto",
				"recordingSummary.debugPanel.formatOggOpus": "Ogg/Opus",
				"recordingSummary.debugPanel.formatWav": "WAV",
			}
			return translations[key] ?? key
		},
	}),
}))

interface MockSelectContextValue {
	value?: string
	onValueChange?: (value: string) => void
}

const MockSelectContext = createContext<MockSelectContextValue>({})

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
	}: MockSelectContextValue & { children: ReactNode }) => (
		<MockSelectContext.Provider value={{ value, onValueChange }}>
			{children}
		</MockSelectContext.Provider>
	),
	SelectTrigger: ({
		"data-testid": dataTestId,
	}: HTMLAttributes<HTMLButtonElement> & {
		"data-testid"?: string
	}) => {
		const context = useContext(MockSelectContext)
		return (
			<select
				data-testid={dataTestId}
				value={context.value}
				onChange={(event: ChangeEvent<HTMLSelectElement>) =>
					context.onValueChange?.(event.target.value)
				}
			>
				<option value="auto">Auto</option>
				<option value="wav">WAV</option>
				<option value="ogg-opus">Ogg/Opus</option>
			</select>
		)
	},
	SelectContent: () => null,
	SelectItem: () => null,
	SelectValue: () => null,
}))

import { RecordingDebugPanel } from "../index"

describe("RecordingDebugPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		localStorage.clear()
	})

	it("restores the persisted format selection", async () => {
		localStorage.setItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY, "wav")
		render(<RecordingDebugPanel isOpen />)

		await waitFor(() => {
			expect(screen.getByTestId("recording-debug-format-select")).toHaveValue("wav")
		})
	})

	it("falls back to auto when the persisted value is invalid", async () => {
		localStorage.setItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY, "invalid-format")
		render(<RecordingDebugPanel isOpen />)

		await waitFor(() => {
			expect(screen.getByTestId("recording-debug-format-select")).toHaveValue("auto")
		})
	})

	it("applies and persists the selected WAV policy for the next recording", async () => {
		render(<RecordingDebugPanel isOpen />)
		const formatSelect = await screen.findByTestId("recording-debug-format-select")

		fireEvent.change(formatSelect, { target: { value: "wav" } })
		fireEvent.click(screen.getByRole("button", { name: "Apply" }))

		expect(updateMediaRecorderConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				mimeType: "audio/wav",
				encodingPolicy: expect.objectContaining({
					candidates: ["wav"],
					forceWav: true,
				}),
			}),
		)
		expect(localStorage.getItem(RECORDING_DEBUG_FORMAT_STORAGE_KEY)).toBe("wav")
	})

	it("does not render when the panel is closed", () => {
		render(<RecordingDebugPanel isOpen={false} />)

		expect(screen.queryByTestId("recording-debug-format-select")).not.toBeInTheDocument()
	})
})
