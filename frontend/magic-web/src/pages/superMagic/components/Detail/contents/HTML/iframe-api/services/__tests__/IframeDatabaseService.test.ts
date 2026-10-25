import { describe, expect, it, vi } from "vitest"
import { DB_MESSAGE_TYPES } from "../../types"
import { getMagicBaseTables } from "../../magicBaseApi"
import { IframeDatabaseService, type IframeDatabaseConfig } from "../IframeDatabaseService"

vi.mock("../../magicBaseApi", () => ({
	getMagicBaseTables: vi.fn(),
	getMagicBaseProjectAdminAccess: vi.fn(),
	getMagicBaseTable: vi.fn(),
	createMagicBaseRow: vi.fn(),
	queryMagicBaseRows: vi.fn(),
	getMagicBaseRow: vi.fn(),
	updateMagicBaseRow: vi.fn(),
	deleteMagicBaseRow: vi.fn(),
	getMagicBaseRelations: vi.fn(),
}))

function createService(overrides?: Partial<IframeDatabaseConfig>) {
	const postToIframe = vi.fn()
	const cfg: IframeDatabaseConfig = {
		postToIframe,
		getProjectId: () => "project-1",
		...overrides,
	}
	return { service: new IframeDatabaseService(cfg), postToIframe, cfg }
}

describe("IframeDatabaseService", () => {
	it("returns a context error without calling MagicBase when project is unavailable", async () => {
		const projectContextError = "Share mode does not support project APIs"
		const { service, postToIframe } = createService({
			getProjectId: () => undefined,
			projectContextUnavailableError: projectContextError,
		})

		await service.handleMessage(DB_MESSAGE_TYPES.GET_TABLES_REQUEST, {
			type: DB_MESSAGE_TYPES.GET_TABLES_REQUEST,
			requestId: "req-share-context",
		})

		expect(getMagicBaseTables).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith({
			type: DB_MESSAGE_TYPES.GET_TABLES_RESPONSE,
			requestId: "req-share-context",
			success: false,
			error: projectContextError,
		})
	})
})
