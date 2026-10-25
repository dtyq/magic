import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	fetchUserInfo: vi.fn(),
	setAccount: vi.fn(),
	setUserInfo: vi.fn(),
}))

vi.mock("@/models/user/stores", () => ({ userStore: { user: { setUserInfo: mocks.setUserInfo } } }))
vi.mock("@/models/config", () => ({ configStore: {} }))
vi.mock("@/utils/devices", () => ({ getDeviceInfo: vi.fn() }))
vi.mock("@/services/user/AccountService", () => ({ AccountService: class {} }))
vi.mock("@/infrastructure/network/http/runtime", () => ({ defaultMagicClient: {} }))
vi.mock("@/models/user/transformers", () => ({ userTransformer: (user: unknown) => user }))

import { LoginService } from "../LoginService/LoginService"

describe("LoginService.accountSync persistence", () => {
	const service = new LoginService(
		{} as never,
		{
			get: (name: string) => {
				if (name === "userService") return { fetchUserInfo: mocks.fetchUserInfo }
				if (name === "accountService") return { setAccount: mocks.setAccount }
				throw new Error(`Unexpected service: ${name}`)
			},
		} as never,
	)
	const params = {
		deployCode: "kk",
		access_token: "test-token",
		magicOrganizationMap: {},
		organizations: [],
		teamshareOrganizationCode: "test-org",
	} as Parameters<LoginService["accountSync"]>[0]

	beforeEach(() => {
		vi.resetAllMocks()
		mocks.fetchUserInfo.mockResolvedValue({ magic_id: "test-account", user_id: "test-user" })
	})

	it("does not finish account synchronization until the account has been persisted", async () => {
		let resolve!: () => void
		mocks.setAccount.mockReturnValueOnce(
			new Promise<void>((res) => {
				resolve = res
			}),
		)
		let completed = false
		const options = { skipAppInitWait: true }
		const task = service.accountSync(params, options).then(() => {
			completed = true
		})
		await Promise.resolve()
		expect(mocks.fetchUserInfo).toHaveBeenCalledWith(options)
		expect(mocks.setAccount).toHaveBeenCalledWith(
			expect.objectContaining({ deployCode: "kk", access_token: "test-token" }),
		)
		expect(completed).toBe(false)
		resolve()
		await task
		expect(completed).toBe(true)
	})

	it("rejects synchronization when account persistence fails", async () => {
		const error = new Error("persistence failed")
		mocks.setAccount.mockRejectedValueOnce(error)
		await expect(service.accountSync(params)).rejects.toBe(error)
	})
})
