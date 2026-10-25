import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecordingSessionManager } from "../RecordingSessionManager"

const historyDB = {
	upsert: vi.fn().mockResolvedValue(undefined),
}

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "",
			getOrganization: () => null,
		},
	},
}))

vi.mock("../utils/RecordingLogger", () => {
	const logger = {
		log: vi.fn(),
		report: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setSessionId: vi.fn(),
	}
	return { recordingLogger: { namespace: vi.fn(() => logger) } }
})

describe("RecordingSessionManager server cancellation", () => {
	beforeEach(() => {
		historyDB.upsert.mockClear()
	})

	it("marks the session and retains its history snapshot", () => {
		const manager = new RecordingSessionManager(
			{ autoRestore: true, confirmRestore: false, clearOnRestore: false },
			historyDB as never,
		)
		const session = manager.createSession({
			workspace: null,
			model: null,
			userId: "user-1",
			project: null,
			sessionId: "session-1",
		})

		const cancelled = manager.markServerCancelledSession(43202, "server_auto_summary")

		expect(cancelled).toMatchObject({
			id: session.id,
			status: "server_cancelled",
			termination: {
				source: "server_auto_summary",
				code: 43202,
			},
		})
		expect(manager.getCurrentSession()).toBeNull()
		expect(cancelled).not.toBeNull()
		if (!cancelled) return
		expect(manager.shouldRestoreSession(cancelled)).toBe(false)
		expect(manager.restoreSession(cancelled)).toBe(false)
		expect(historyDB.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "session-1",
				status: "server_cancelled",
				termination: expect.objectContaining({ code: 43202 }),
			}),
		)
	})
})
