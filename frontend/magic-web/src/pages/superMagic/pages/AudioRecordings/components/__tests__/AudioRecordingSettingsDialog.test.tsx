import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { checkRecordingHealth, reportRecordingHealthCheck } = vi.hoisted(() => ({
	checkRecordingHealth: vi.fn(),
	reportRecordingHealthCheck: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "zh-CN" },
	}),
}))

vi.mock("@/components/shadcn-ui/dialog", () => ({
	Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
		open ? <div>{children}</div> : null,
	DialogContent: ({ children, ...props }: { children: ReactNode }) => (
		<div {...props}>{children}</div>
	),
	DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/shadcn-ui/switch", () => ({
	Switch: () => <button type="button">switch</button>,
}))

vi.mock(
	"@/pages/superMagic/components/MessageEditor/components/ModelSwitch/LanguageModelSwitch",
	() => ({ default: () => <div>model</div> }),
)

vi.mock("../../hooks/useRecordingSettings", () => ({
	useRecordingSettings: () => ({
		settings: {
			transcription_enabled: true,
			auto_summary_enabled: true,
			model_id: "mock-model",
		},
		summaryModels: [{ model_id: "mock-model" }],
		summaryModelGroups: [{ models: [{ model_id: "mock-model" }] }],
		selectedModel: { model_id: "mock-model" },
		isLoading: false,
		isSaving: false,
		updateSetting: vi.fn(),
	}),
}))

vi.mock("../../utils/recording-health-check", () => ({
	checkRecordingHealth,
	reportRecordingHealthCheck,
}))

import { AudioRecordingSettingsDialog } from "../AudioRecordingSettingsDialog"

const healthResult = {
	checkedAt: new Date("2026-09-14T02:38:24.000Z").getTime(),
	browserName: "Edge",
	browserVersion: 152,
	platform: "Win32",
	userAgent: "Mozilla/5.0 Chrome/152.0.0.0 Edg/152.0.0.0",
	isSecureContext: true,
	hasGetUserMedia: true,
	hasAudioContext: true,
	hasAudioWorklet: true,
	hasAudioWorkletNode: true,
	processingMode: "worklet" as const,
	overallStatus: "supported" as const,
}

describe("AudioRecordingSettingsDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		checkRecordingHealth.mockReturnValue(healthResult)
	})

	it("shows recording capabilities when the dialog opens", () => {
		render(<AudioRecordingSettingsDialog open onOpenChange={vi.fn()} />)

		expect(screen.getByTestId("recording-health-check")).toHaveTextContent("Edge 152")
		expect(screen.getByTestId("recording-health-check")).toHaveTextContent("Win32")
		expect(screen.getByTestId("recording-health-check")).toHaveTextContent("environment")
		expect(screen.getByTestId("recording-health-check-time")).toHaveTextContent(
			/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/,
		)
		expect(checkRecordingHealth).toHaveBeenCalledTimes(1)
		expect(reportRecordingHealthCheck).not.toHaveBeenCalled()
	})

	it("reruns and reports the complete result after a user click", () => {
		render(<AudioRecordingSettingsDialog open onOpenChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("recording-health-check-button"))

		expect(checkRecordingHealth).toHaveBeenCalledTimes(2)
		expect(reportRecordingHealthCheck).toHaveBeenCalledTimes(1)
		expect(reportRecordingHealthCheck).toHaveBeenCalledWith(healthResult)
	})
})
