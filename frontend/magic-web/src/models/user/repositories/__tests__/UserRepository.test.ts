import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }))

vi.mock("@/models/repository/logger", () => ({
	logger: { error: loggerError, warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}))

vi.mock("@/models/repository/Cache", () => ({
	Storage: { get: vi.fn(() => ({})), set: vi.fn() },
}))

import { Storage } from "@/models/repository/Cache"
import { UserRepository } from "../UserRepository"

/** Collect rejections that escape every handler while a test runs. */
function trackUnhandledRejections() {
	const reasons: unknown[] = []
	const onRejection = (reason: unknown) => reasons.push(reason)
	process.on("unhandledRejection", onRejection)
	return {
		reasons,
		dispose: () => process.off("unhandledRejection", onRejection),
	}
}

/** Let pending microtasks and the unhandled-rejection check run. */
const flushRejections = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("UserRepository setters when IndexedDB put fails", () => {
	let repository: UserRepository
	let tracker: ReturnType<typeof trackUnhandledRejections>

	beforeEach(() => {
		vi.clearAllMocks()
		repository = new UserRepository()
		vi.spyOn(repository, "put").mockRejectedValue(
			new Error("Repository operation 'put' failed on table 'user': timed out"),
		)
		tracker = trackUnhandledRejections()
	})

	afterEach(() => {
		tracker.dispose()
	})

	const cases: Array<{
		name: string
		run: (repo: UserRepository) => Promise<void>
		eventKey: string
		storageKey: string
	}> = [
		{
			name: "setUserInfo",
			run: (repo) => repo.setUserInfo(null),
			eventKey: "set_user_info_failed",
			storageKey: "user:userInfo",
		},
		{
			name: "setOrganization",
			run: (repo) => repo.setOrganization(null),
			eventKey: "set_organization_failed",
			storageKey: "user:organization",
		},
		{
			name: "setOrganizations",
			run: (repo) => repo.setOrganizations({}),
			eventKey: "set_organizations_failed",
			storageKey: "user:organizations",
		},
		{
			name: "setTeamshareOrganizations",
			run: (repo) => repo.setTeamshareOrganizations([]),
			eventKey: "set_teamshare_organizations_failed",
			storageKey: "user:teamshareOrganizations",
		},
		{
			name: "setOrganizationCode",
			run: (repo) => repo.setOrganizationCode("org"),
			eventKey: "set_organization_code_failed",
			storageKey: "user:organizationCode",
		},
		{
			name: "setTeamshareOrganizationCode",
			run: (repo) => repo.setTeamshareOrganizationCode("org"),
			eventKey: "set_teamshare_organization_code_failed",
			storageKey: "user:teamshareOrganizationCode",
		},
	]

	it.each(cases)(
		"$name handles the failure and keeps the localStorage fallback",
		async ({ run, eventKey, storageKey }) => {
			await expect(run(repository)).resolves.toBeUndefined()
			await flushRejections()

			expect(tracker.reasons).toEqual([])
			expect(loggerError).toHaveBeenCalledWith(expect.objectContaining({ eventKey }))
			expect(Storage.set).toHaveBeenCalledWith(storageKey, expect.any(Object))
		},
	)
})
