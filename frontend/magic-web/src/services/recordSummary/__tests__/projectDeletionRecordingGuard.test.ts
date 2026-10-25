import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	assertProjectDeletionAllowed,
	getProjectDeletionBlock,
	ProjectDeletionBlockedByRecordingError,
} from "../projectDeletionRecordingGuard"

const { store, user, loadSession } = vi.hoisted(() => ({
	store: {
		status: "init",
		isWaitingUpload: false,
		isWaitingSummarize: false,
		isOtherTabRecording: false,
		businessData: { userId: "user-1", project: { id: "project-1" } },
	},
	user: { userInfo: { user_id: "user-1" }, organizationCode: "org-1" },
	loadSession: vi.fn(),
}))
vi.mock("@/models/user", () => ({ userStore: { user } }))
vi.mock("@/stores/recordingSummary", () => ({ default: store }))
vi.mock("../RecordingPersistence", () => ({
	RecordingPersistence: class {
		loadSession = loadSession
	},
}))

const session = {
	id: "session-1",
	status: "paused",
	project: { id: "project-1" },
	userId: "user-1",
	organizationCode: "org-1",
}

describe("project deletion recording guard", () => {
	beforeEach(() => {
		store.status = "init"
		store.isWaitingUpload = false
		store.isWaitingSummarize = false
		store.isOtherTabRecording = false
		store.businessData.userId = "user-1"
		loadSession.mockReset()
	})

	it.each(["recording", "paused"])(
		"blocks the %s project without affecting another project",
		(status) => {
			store.status = status
			expect(() => assertProjectDeletionAllowed(["project-1"])).toThrow(
				ProjectDeletionBlockedByRecordingError,
			)
			expect(getProjectDeletionBlock(["project-2"])).toBeNull()
		},
	)

	it.each(["isWaitingUpload", "isWaitingSummarize"] as const)(
		"protects unfinished %s",
		(flag) => {
			store[flag] = true
			expect(getProjectDeletionBlock(["project-1"])).toMatchObject({ projectId: "project-1" })
		},
	)

	it("blocks the whole batch when one project has an unfinished persisted recording", () => {
		loadSession.mockReturnValue(session)
		expect(() => assertProjectDeletionAllowed(["project-2", "project-1"])).toThrow(
			ProjectDeletionBlockedByRecordingError,
		)
	})

	it.each([
		{ userId: "other-user" },
		{ userId: undefined },
		{ organizationCode: "other-org" },
		{ status: "server_cancelled" },
	])("ignores foreign or terminal persistence %j", (overrides) => {
		loadSession.mockReturnValue({ ...session, ...overrides })
		expect(getProjectDeletionBlock(["project-1"])).toBeNull()
	})

	it("uses another tab's known project rather than blocking unrelated projects", () => {
		store.isOtherTabRecording = true
		loadSession.mockReturnValue(session)
		expect(getProjectDeletionBlock(["project-2"])).toBeNull()
		expect(getProjectDeletionBlock(["project-1"])).toMatchObject({ sessionId: "session-1" })
	})

	it("fails closed when another tab's project cannot be identified", () => {
		store.isOtherTabRecording = true
		expect(getProjectDeletionBlock(["project-2"])).toEqual({ reason: "unresolved-other-tab" })
	})

	it("allows deletion after the recording has finished", () => {
		expect(getProjectDeletionBlock(["project-1"])).toBeNull()
		expect(getProjectDeletionBlock([])).toBeNull()
	})
})
