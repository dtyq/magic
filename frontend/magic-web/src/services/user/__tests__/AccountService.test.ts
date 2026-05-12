import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
	return {
		clearAccount: vi.fn(),
		deleteAccountRepository: vi.fn(),
		setAuthorization: vi.fn(),
		destroyMessageService: vi.fn(),
		setUserInfo: vi.fn(),
		removeOrganization: vi.fn(),
		clearUserAuthorization: vi.fn(),
		deleteAccountStore: vi.fn(),
		logout: vi.fn(),
		setClusterCode: vi.fn(),
		userStore: {
			user: {
				setAuthorization: vi.fn(),
			},
			account: {
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

vi.mock("@/utils/log", () => ({
	logger: {
		createLogger: () => ({
			report: vi.fn(),
			error: vi.fn(),
			log: vi.fn(),
		}),
	},
}))

import { AccountService } from "../AccountService"

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
	})
})
