import type { ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const microphonePermissionMock = vi.hoisted(() => ({
	checkPermissionStatus: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/hooks/useMicrophonePermission", () => ({
	useMicrophonePermission: () => ({
		handlePermissionDenied: vi.fn(),
		handlePermissionError: vi.fn(),
	}),
}))

vi.mock("@/services/MicrophonePermissionService", () => ({
	MicrophonePermissionService: microphonePermissionMock,
}))

vi.mock("@/components/business/RecordingSummary/components/StartRecordingButton", () => ({
	default: ({
		disabled,
		onClick,
	}: {
		disabled: boolean
		onClick: (mode: "new" | "current") => void
	}) => (
		<button
			type="button"
			disabled={disabled}
			onClick={() => onClick("new")}
			data-testid="mock-start-recording-button"
		/>
	),
}))

vi.mock("@/components/business/RecordingSummary/components/RecordingIndicator", () => ({
	default: () => <span data-testid="mock-recording-indicator" />,
}))

vi.mock("@/components/business/RecordingSummary/AudioUploadAction", () => ({
	default: ({ handler }: { handler: (onUpload: () => void) => ReactNode }) => (
		<>{handler(vi.fn())}</>
	),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/components", () => ({
	InterruptButton: () => <span data-testid="mock-interrupt-button" />,
}))

import { IdleStateView } from "../IdleStateView"

function renderStartState(overrides: Partial<Parameters<typeof IdleStateView>[0]> = {}) {
	const onStartRecording = vi.fn().mockResolvedValue(undefined)
	render(
		<IdleStateView
			size="default"
			isSmall={false}
			iconSize={20}
			selectedProjectId="project-1"
			isStartingRecord={false}
			isModelReady
			uploading={false}
			uploadProgress={0}
			leftToolbar={<span data-testid="left-toolbar" />}
			audioSourceSelector={<span data-testid="audio-source-selector" />}
			isTaskRunning={false}
			onStartRecording={onStartRecording}
			onCancelUpload={vi.fn()}
			onUploadFile={vi.fn()}
			{...overrides}
		/>,
	)
	return { onStartRecording }
}

describe("IdleStateView", () => {
	beforeEach(() => {
		microphonePermissionMock.checkPermissionStatus.mockReset()
		microphonePermissionMock.checkPermissionStatus.mockResolvedValue({
			granted: true,
			state: "granted",
		})
	})

	it("keeps the original warning and layout when no recording conflicts", () => {
		renderStartState()

		expect(screen.getByTestId("recording-editor-initial-state")).toHaveAttribute(
			"data-mode",
			"idle",
		)
		expect(screen.getByTestId("recording-editor-warning-text")).toHaveTextContent(
			"recordingSummary.superEditorPanel.warning.beforeRecording",
		)
		expect(screen.queryByTestId("mock-recording-indicator")).not.toBeInTheDocument()
	})

	it("reuses the initial layout and only changes the warning for a recording conflict", () => {
		renderStartState({ isRecordingBlocked: true })

		expect(screen.getByTestId("recording-editor-initial-state")).toHaveAttribute(
			"data-mode",
			"blocked",
		)
		expect(screen.getByTestId("recording-editor-main-content")).toContainElement(
			screen.getByTestId("mock-start-recording-button"),
		)
		expect(screen.getByTestId("recording-editor-bottom-controls")).toContainElement(
			screen.getByTestId("audio-source-selector"),
		)
		expect(screen.getByTestId("recording-editor-bottom-controls")).toContainElement(
			screen.getByTestId("left-toolbar"),
		)
		expect(screen.getByTestId("recording-editor-warning-text")).toHaveTextContent(
			"recordingSummary.superEditorPanel.warning.recordingOverride",
		)
		expect(screen.getByTestId("mock-recording-indicator")).toBeInTheDocument()
	})

	it("uses the original start button as the recording override entry", async () => {
		const { onStartRecording } = renderStartState({ isRecordingBlocked: true })

		fireEvent.click(screen.getByTestId("mock-start-recording-button"))

		await waitFor(() => expect(onStartRecording).toHaveBeenCalledWith("new"))
	})

	it("shows the other-tab warning while keeping the same start surface", () => {
		renderStartState({ isRecordingBlocked: true, isOtherTabRecording: true })

		expect(screen.getByTestId("recording-editor-warning-text")).toHaveTextContent(
			"recordingSummary.superEditorPanel.warning.recordingOverrideOtherTab",
		)
		expect(screen.getByTestId("mock-start-recording-button")).toBeEnabled()
	})

	it("keeps start disabled when the model is not ready during a recording conflict", () => {
		renderStartState({
			isRecordingBlocked: true,
			isModelReady: false,
		})

		expect(screen.getByTestId("mock-start-recording-button")).toBeDisabled()
	})

	it("keeps recording disabled when the browser does not support it", () => {
		renderStartState({
			isRecordingBlocked: true,
			isMediaRecorderNotSupported: true,
		})

		expect(screen.getByTestId("mock-start-recording-button")).toBeDisabled()
		expect(screen.getByTestId("recording-editor-warning-text")).toHaveTextContent(
			"recordingSummary.superEditorPanel.warning.mediaRecorderNotSupported",
		)
		expect(screen.queryByTestId("mock-recording-indicator")).not.toBeInTheDocument()
	})
})
