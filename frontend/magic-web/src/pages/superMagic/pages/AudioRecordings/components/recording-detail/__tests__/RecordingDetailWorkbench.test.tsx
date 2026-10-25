import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RecordingDetailWorkbench } from "../RecordingDetailWorkbench"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH,
	RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
} from "../recording-detail-layout"

describe("RecordingDetailWorkbench", () => {
	/** Verifies the reusable owner/share workbench renders transcript, handle, and summary columns. */
	it("renders transcript, drag handle, and summary columns when expanded", () => {
		render(
			<RecordingDetailWorkbench
				left={<div data-testid="workbench-left">Left</div>}
				right={<div data-testid="workbench-right">Right</div>}
			/>,
		)

		const workbench = screen.getByTestId("recording-detail-workbench")
		const scrollContainer = screen.getByTestId("recording-detail-workbench-scroll")
		expect(workbench.children).toHaveLength(3)
		expect(scrollContainer).toHaveClass("overflow-x-auto", "overflow-y-hidden")
		expect(workbench).toHaveStyle({
			minWidth: `${RECORDING_DETAIL_WORKBENCH_MIN_WIDTH}px`,
			gridTemplateColumns: `${RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH}px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		})
		expect(screen.getByTestId("workbench-left")).toBeInTheDocument()
		expect(screen.getByTestId("workbench-right")).toBeInTheDocument()
		expect(screen.getByTestId("recording-detail-transcript-resize-handle")).toBeInTheDocument()
	})

	/** Verifies project previews can opt into a compact gutter without changing shared defaults. */
	it("supports compact horizontal padding for embedded project previews", () => {
		render(
			<RecordingDetailWorkbench
				compactHorizontalPadding
				left={<div>Left</div>}
				right={<div>Right</div>}
			/>,
		)

		expect(screen.getByTestId("recording-detail-workbench")).toHaveClass("px-2.5")
		expect(screen.getByTestId("recording-detail-workbench")).not.toHaveClass("px-8")
	})

	/** Verifies a collapsed transcript column yields a single summary track with no handle. */
	it("collapses to a single summary column and hides the drag handle", () => {
		render(
			<RecordingDetailWorkbench
				transcriptCollapsed
				left={<div>Left</div>}
				right={<div>Right</div>}
			/>,
		)

		expect(screen.getByTestId("recording-detail-workbench")).toHaveStyle({
			gridTemplateColumns: `minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		})
		expect(
			screen.queryByTestId("recording-detail-transcript-resize-handle"),
		).not.toBeInTheDocument()
	})

	/** Verifies the transcript column stays expanded when collapsing is disallowed (no expand entry). */
	it("forces expanded when collapsing is disallowed", () => {
		render(
			<RecordingDetailWorkbench
				transcriptCollapsed
				canCollapseTranscript={false}
				left={<div>Left</div>}
				right={<div>Right</div>}
			/>,
		)

		expect(screen.getByTestId("recording-detail-transcript-resize-handle")).toBeInTheDocument()
	})
})
