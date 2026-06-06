import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoredSessionHistory } from "@/services/recordSummary/RecordingSessionHistoryDB"
import SessionHistoryTable, { buildSessionKeyInfo } from "../SessionHistoryTable"

const mocks = vi.hoisted(() => ({
	writeText: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	retentionDays: 14,
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: mocks.writeText,
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}))

vi.mock("@/services/recordSummary/RecordingSessionHistoryDB", () => ({
	RECORDING_HISTORY_RETENTION_DAYS: mocks.retentionDays,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				cancel: "Cancel",
				"recordingHistoryPanel.copied": "Copied",
				"recordingHistoryPanel.copiedKeyInfo": "Key info copied",
				"recordingHistoryPanel.copyKeyInfo": "Copy key info",
				"recordingHistoryPanel.confirmDelete": "Delete",
				"recordingHistoryPanel.deleteDescription":
					"This cannot be undone. Uploaded audio chunks and server data are not affected.",
				"recordingHistoryPanel.deleteTitle": "Delete this recording session?",
				"recordingHistoryPanel.emptyDescription": `No recording sessions were started in the last ${mocks.retentionDays} days, or the data has been cleaned up.`,
				"recordingHistoryPanel.emptyTitle": "No recording sessions",
				"recordingHistoryPanel.export": "Export",
				"recordingHistoryPanel.exporting": "Exporting",
				"recordingHistoryPanel.table.actions": "Actions",
				"recordingHistoryPanel.table.duration": "Duration",
				"recordingHistoryPanel.table.note": "Notes",
				"recordingHistoryPanel.table.scope": "Workspace / Project / Topic",
				"recordingHistoryPanel.table.startTime": "Start Time",
				"recordingHistoryPanel.table.status": "Status",
				"recordingHistoryPanel.table.text": "Text",
				"recordingHistoryPanel.toastCopyFailed": "Copy failed",
				"recordingHistoryPanel.toastCopySuccess": "Key info copied",
			}
			return translations[key] || key
		},
	}),
}))

const createSession = (): StoredSessionHistory =>
	({
		id: "session-1",
		startTime: new Date("2026-06-05T01:00:00").getTime(),
		lastActivityTime: new Date("2026-06-05T01:12:00").getTime(),
		totalDuration: 12 * 60 * 1000,
		status: "paused",
		textContent: [],
		currentChunkIndex: 12,
		metadata: {},
		userId: "user-1",
		organizationName: "Magic Org",
		organizationCode: "magic-org-code",
		model: null,
		workspace: {
			id: "workspace-1",
			name: "Workspace A",
		},
		project: {
			id: "project-1",
			project_name: "Project A",
		},
		topic: {
			id: "topic-1",
			topic_name: "Topic A",
		},
		createdAt: 1,
		updatedAt: 1,
	}) as unknown as StoredSessionHistory

describe("SessionHistoryTable", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.writeText.mockResolvedValue(undefined)
	})

	it("builds key info text for troubleshooting copy", () => {
		const text = buildSessionKeyInfo(createSession())

		expect(text).toContain("Session ID: session-1")
		expect(text).toContain("Topic ID: topic-1")
		expect(text).toContain("Status: paused")
		expect(text).toContain("Current Chunk Index: 12")
		expect(text).not.toContain("Project ID")
		expect(text).not.toContain("Workspace ID")
		expect(text).not.toContain("User ID")
		expect(text).not.toContain("Organization")
		expect(text).not.toContain("project-1")
		expect(text).not.toContain("workspace-1")
		expect(text).not.toContain("user-1")
		expect(text).not.toContain("Magic Org")
		expect(text).not.toContain("magic-org-code")
	})

	it("renders table labels from i18n", () => {
		const zhStartTime = "\u5f00\u59cb\u65f6\u95f4"
		const zhActions = "\u64cd\u4f5c"

		render(
			<SessionHistoryTable
				sessions={[createSession()]}
				loading={false}
				onExport={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		expect(screen.getByText("Start Time")).toBeInTheDocument()
		expect(screen.getByText("Actions")).toBeInTheDocument()
		expect(screen.queryByText(zhStartTime)).not.toBeInTheDocument()
		expect(screen.queryByText(zhActions)).not.toBeInTheDocument()
	})

	it("copies key info and shows user feedback", async () => {
		const session = createSession()

		render(
			<SessionHistoryTable
				sessions={[session]}
				loading={false}
				onExport={vi.fn()}
				onDelete={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("recording-history-copy-info"))

		await waitFor(() => {
			expect(mocks.writeText).toHaveBeenCalledWith(
				expect.stringContaining("Session ID: session-1"),
			)
			expect(mocks.toastSuccess).toHaveBeenCalledWith({
				content: "Key info copied",
				key: "recording-history-copy-info-session-1",
			})
		})
		expect(screen.getByRole("button", { name: "Key info copied" })).toBeInTheDocument()
	})
})
