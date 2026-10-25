import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
	return {
		clearAccount: vi.fn(),
		addAccountRepository: vi.fn(),
		deleteAccountRepository: vi.fn(),
		setAuthorization: vi.fn(),
		destroyMessageService: vi.fn(),
		setUserInfo: vi.fn(),
		removeOrganization: vi.fn(),
		clearUserAuthorization: vi.fn(),
		deleteAccountStore: vi.fn(),
		logout: vi.fn(),
		setClusterCode: vi.fn(),
		clearHtmlPermissionGrants: vi.fn(),
		accountLoggerError: vi.fn(),
		userStore: {
			user: {
				userInfo: { magic_id: "current-account" },
				setAuthorization: vi.fn(),
				setUserInfo: vi.fn(),
			},
			account: {
				setAccount: vi.fn(),
				accounts: [] as Array<{ magic_id: string }>,
				clearAccount: vi.fn(),
				deleteAccount: vi.fn(),
			},
		},
	}
})

vi.mock("@/models/user", () => ({
	userStore: mocks.userStore,
}))

vi.mock("@/models/user/repositories/AccountRepository", () => ({
	AccountRepository: vi.fn().mockImplementation(() => ({
		addAccount: mocks.addAccountRepository,
		clearAccount: mocks.clearAccount,
		deleteAccount: mocks.deleteAccountRepository,
	})),
}))

vi.mock("@/models/user/repositories/UserRepository", () => ({
	UserRepository: vi.fn().mockImplementation(() => ({
		setAuthorization: mocks.setAuthorization,
	})),
}))

vi.mock("@/services/chat/message/MessageService", () => ({
	default: {
		destroy: mocks.destroyMessageService,
	},
}))

vi.mock("@/broadcastChannel", () => ({
	BroadcastChannelSender: {
		addAccount: vi.fn(),
	},
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			report: vi.fn(),
			error: mocks.accountLoggerError,
			log: vi.fn(),
		}),
	},
}))

vi.mock(
	"@/pages/superMagic/components/Detail/contents/HTML/iframe-api/services/IndexedDbHtmlPermissionGrantStore",
	() => ({
		getHtmlPermissionGrantStore: vi.fn(() => ({
			clear: mocks.clearHtmlPermissionGrants,
		})),
	}),
)

import { AccountService } from "../AccountService"

describe("AccountService.setAccount", () => {
	it("updates memory immediately but waits for persistence before completing", async () => {
		let resolve!: () => void
		mocks.addAccountRepository.mockReturnValueOnce(
			new Promise<void>((res) => {
				resolve = res
			}),
		)
		const accountService = new AccountService({} as never, {} as never)
		const account = { magic_id: "new-account" } as Parameters<AccountService["setAccount"]>[0]
		let completed = false
		const task = accountService.setAccount(account).then(() => {
			completed = true
		})
		expect(mocks.userStore.account.setAccount).toHaveBeenCalledWith(account)
		await Promise.resolve()
		expect(completed).toBe(false)
		resolve()
		await task
		expect(completed).toBe(true)
	})

	it("propagates persistence failure to callers awaiting login completion", async () => {
		const error = new Error("account persistence failed")
		mocks.addAccountRepository.mockRejectedValueOnce(error)
		const accountService = new AccountService({} as never, {} as never)
		await expect(accountService.setAccount({ magic_id: "new-account" } as never)).rejects.toBe(
			error,
		)
	})
})

describe("AccountService.deleteAccount", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.userStore.account.accounts = [{ magic_id: "current-account" }]
		mocks.userStore.account.deleteAccount = mocks.deleteAccountStore
		mocks.deleteAccountStore.mockImplementation(() => {
			mocks.userStore.account.accounts = []
		})
	})

	it("clears current cluster after logging out the current account", async () => {
		const service = {
			get: vi.fn((key: string) => {
				if (key === "loginService") return { logout: mocks.logout }
				if (key === "configService") return { setClusterCode: mocks.setClusterCode }
				if (key === "userService")
					return {
						setUserInfo: mocks.setUserInfo,
						removeOrganization: mocks.removeOrganization,
					}
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}

		const accountService = new AccountService({} as never, service as never)

		await accountService.deleteAccount()

		expect(mocks.logout).toHaveBeenCalled()
		expect(mocks.setClusterCode).toHaveBeenCalledWith("")
		expect(mocks.setAuthorization).toHaveBeenCalledWith("")
		expect(mocks.userStore.user.setAuthorization).toHaveBeenCalledWith(null)
		expect(mocks.clearAccount).toHaveBeenCalled()
		expect(mocks.clearHtmlPermissionGrants).toHaveBeenCalledTimes(1)
	})

	it("continues logging out when permission grant cleanup fails", async () => {
		const cleanupError = new Error("IndexedDB failed")
		mocks.clearHtmlPermissionGrants.mockRejectedValueOnce(cleanupError)
		const service = {
			get: vi.fn((key: string) => {
				if (key === "loginService") return { logout: mocks.logout }
				if (key === "configService") return { setClusterCode: mocks.setClusterCode }
				if (key === "userService")
					return {
						setUserInfo: mocks.setUserInfo,
						removeOrganization: mocks.removeOrganization,
					}
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}
		const accountService = new AccountService({} as never, service as never)

		await accountService.deleteAccount()

		expect(mocks.logout).toHaveBeenCalled()
		expect(mocks.clearAccount).toHaveBeenCalled()
		expect(mocks.accountLoggerError).toHaveBeenCalledWith({
			eventKey: "clear_html_permission_grants_failed",
			errorKind: "storage",
			error: cleanupError,
			message: "Failed to clear HTML permission grants during account removal",
		})
	})

	it("clears current cluster after removing the last cached account", async () => {
		const service = {
			get: vi.fn((key: string) => {
				if (key === "configService") return { setClusterCode: mocks.setClusterCode }
				if (key === "userService")
					return {
						setUserInfo: mocks.setUserInfo,
						removeOrganization: mocks.removeOrganization,
					}
				if (key === "loginService") return { logout: mocks.logout }
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}

		const accountService = new AccountService({} as never, service as never)

		await accountService.deleteAccount("current-account")

		expect(mocks.deleteAccountRepository).toHaveBeenCalledWith("current-account")
		expect(mocks.deleteAccountStore).toHaveBeenCalledWith("current-account")
		expect(mocks.setClusterCode).toHaveBeenCalledWith("")
		expect(mocks.clearAccount).toHaveBeenCalled()
		expect(mocks.clearHtmlPermissionGrants).toHaveBeenCalledTimes(1)
	})

	it("clears permission grants when removing a cached account without switching accounts", async () => {
		mocks.userStore.account.accounts = [
			{ magic_id: "current-account" },
			{ magic_id: "other-account" },
		]
		mocks.deleteAccountStore.mockImplementation(() => {
			mocks.userStore.account.accounts = [{ magic_id: "current-account" }]
		})
		const service = { get: vi.fn() }
		const accountService = new AccountService({} as never, service as never)

		await accountService.deleteAccount("other-account")

		expect(mocks.clearHtmlPermissionGrants).toHaveBeenCalledTimes(1)
		expect(service.get).not.toHaveBeenCalled()
	})

	it("invalidates a local session without remote logout", async () => {
		const service = {
			get: vi.fn((key: string) => {
				if (key === "configService") return { setClusterCode: mocks.setClusterCode }
				if (key === "userService")
					return {
						setUserInfo: mocks.setUserInfo,
						removeOrganization: mocks.removeOrganization,
					}
				if (key === "loginService") return { logout: mocks.logout }
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}
		const accountService = new AccountService({} as never, service as never)

		const result = await accountService.invalidateSession({ accountId: "current-account" })

		expect(result).toEqual({ cleanupStatus: "completed" })
		expect(mocks.logout).not.toHaveBeenCalled()
		expect(mocks.deleteAccountRepository).toHaveBeenCalledWith("current-account")
		expect(mocks.setAuthorization).toHaveBeenCalledWith("")
		expect(mocks.destroyMessageService).toHaveBeenCalled()
	})

	it("reports partial cleanup when permission storage cannot be cleared", async () => {
		mocks.clearHtmlPermissionGrants.mockRejectedValueOnce(new Error("IndexedDB failed"))
		const service = {
			get: vi.fn((key: string) => {
				if (key === "configService") return { setClusterCode: mocks.setClusterCode }
				if (key === "userService")
					return {
						setUserInfo: mocks.setUserInfo,
						removeOrganization: mocks.removeOrganization,
					}
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}
		const accountService = new AccountService({} as never, service as never)

		const result = await accountService.invalidateSession({ accountId: "current-account" })

		expect(result).toEqual({ cleanupStatus: "partial" })
		expect(mocks.setAuthorization).toHaveBeenCalledWith("")
	})
})
