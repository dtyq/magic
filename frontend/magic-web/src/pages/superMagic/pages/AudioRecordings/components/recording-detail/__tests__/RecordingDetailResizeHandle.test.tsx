import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RecordingDetailConversationResizeHandle } from "../RecordingDetailConversationResizeHandle"
import { RecordingDetailTranscriptResizeHandle } from "../RecordingDetailTranscriptResizeHandle"
import { recordingConversationPanelDragStore } from "../../../stores/RecordingConversationPanelDragStore"
import { recordingTranscriptPanelDragStore } from "../../../stores/RecordingTranscriptPanelDragStore"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("Recording detail resize handles", () => {
	afterEach(() => {
		// End any real store drag started by the pointer-entry assertions before the next test.
		act(() => {
			recordingTranscriptPanelDragStore.cancelDrag()
			recordingConversationPanelDragStore.cancelDrag()
		})
	})

	it("renders the transcript handle with the three-dot grip and drag state", () => {
		const onCommit = vi.fn()

		render(
			<RecordingDetailTranscriptResizeHandle
				gridRef={{ current: null }}
				transcriptWidth={320}
				canCollapse
				onCommit={onCommit}
			/>,
		)

		const handle = screen.getByTestId("recording-detail-transcript-resize-handle")
		const grip = screen.getByTestId("resize-grip")
		expect(handle).toHaveClass("group/resize")
		expect(handle).not.toHaveAttribute("data-dragging")
		expect(grip).toHaveAttribute("data-orientation", "vertical")
		expect(grip.children).toHaveLength(3)

		// Pointer entry still goes through the existing transcript drag store.
		act(() => {
			fireEvent(
				handle,
				new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200 }),
			)
		})
		expect(handle).toHaveAttribute("data-resizing", "true")
		expect(handle).toHaveAttribute("data-dragging", "true")
	})

	it("renders the conversation handle and enters its existing drag lifecycle", () => {
		const onCommit = vi.fn()

		render(
			<RecordingDetailConversationResizeHandle
				panelRef={{ current: null }}
				conversationWidth={360}
				historyOffset={0}
				onCommit={onCommit}
			/>,
		)

		const handle = screen.getByTestId("recording-detail-conversation-resize-handle")
		const grip = screen.getByTestId("resize-grip")
		expect(handle).toHaveClass("group/resize")
		expect(grip.children).toHaveLength(3)

		// Pointer entry still goes through the existing conversation drag store.
		act(() => {
			fireEvent(
				handle,
				new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 600 }),
			)
		})
		expect(handle).toHaveAttribute("data-resizing", "true")
		expect(handle).toHaveAttribute("data-dragging", "true")
	})
})
