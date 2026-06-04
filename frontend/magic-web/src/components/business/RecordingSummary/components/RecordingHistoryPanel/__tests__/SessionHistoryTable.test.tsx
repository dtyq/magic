import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoredSessionHistory } from "@/services/recordSummary/RecordingSessionHistoryDB"
import SessionHistoryTable, { buildSessionKeyInfo } from "../SessionHistoryTable"

const mocks = vi.hoisted(() => ({
	writeText: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
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
		expect(text).toContain("Project ID: project-1")
		expect(text).toContain("Workspace ID: workspace-1")
		expect(text).toContain("User ID: user-1")
		expect(text).toContain("Current Chunk Index: 12")
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
				content: "关键信息已复制",
				key: "recording-history-copy-info-session-1",
			})
		})
		expect(screen.getByRole("button", { name: "已复制关键信息" })).toBeInTheDocument()
	})
})
