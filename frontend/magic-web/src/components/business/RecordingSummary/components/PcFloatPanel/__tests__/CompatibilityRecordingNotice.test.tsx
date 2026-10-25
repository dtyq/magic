import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { CompatibilityRecordingNotice } from "../CompatibilityRecordingNotice"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"mobile.recordingEntry.active.compatibilityModeTitle": "Keep browser in foreground",
				"mobile.recordingEntry.active.compatibilityModeDescription":
					"Keep this page visible while recording.",
			})[key] ?? key,
	}),
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: () => <span data-testid="compatibility-mode-icon" />,
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../style", () => ({
	useStyles: () => ({
		styles: {
			compatibilityModeIcon: "compatibility-mode-icon",
			compatibilityModeNotice: "compatibility-mode-notice",
			compatibilityModeTitle: "compatibility-mode-title",
			compatibilityModeDescription: "compatibility-mode-description",
		},
	}),
}))

describe("CompatibilityRecordingNotice", () => {
	it("shows the foreground guidance only for script-processor mode", () => {
		const { rerender } = render(
			<CompatibilityRecordingNotice processingMode="worklet" isAudioProjectMode isExpanded />,
		)

		expect(
			screen.queryByTestId("record-summary-pc-float-panel-compatibility-notice"),
		).toBeNull()

		rerender(
			<CompatibilityRecordingNotice
				processingMode="script-processor"
				isAudioProjectMode
				isExpanded
			/>,
		)

		expect(
			screen.getByTestId("record-summary-pc-float-panel-compatibility-notice"),
		).toHaveTextContent("Keep this page visible while recording.")
		expect(screen.getByText("Keep this page visible while recording.")).toBeInTheDocument()

		rerender(
			<CompatibilityRecordingNotice
				processingMode="script-processor"
				isAudioProjectMode={false}
				isExpanded
			/>,
		)
		expect(
			screen.queryByTestId("record-summary-pc-float-panel-compatibility-notice"),
		).toBeNull()
	})

	it("keeps a compact accessible warning when the panel is collapsed", () => {
		render(
			<CompatibilityRecordingNotice
				processingMode="script-processor"
				isAudioProjectMode
				isExpanded={false}
			/>,
		)

		expect(screen.getByLabelText("Keep browser in foreground")).toBeInTheDocument()
		expect(
			screen.queryByTestId("record-summary-pc-float-panel-compatibility-notice"),
		).toBeNull()
	})
})
