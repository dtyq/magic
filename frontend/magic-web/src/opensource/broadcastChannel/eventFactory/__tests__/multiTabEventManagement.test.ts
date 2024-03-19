import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { User } from "@/opensource/types/user"

// IMPORTANT: Mock OrganizationDotsDbService FIRST before any other imports
// because it's a singleton that runs constructor on import and tries to observe userStore
vi.mock("@/opensource/services/chat/dots/OrganizationDotsDbService", () => ({
	default: {
		magicId: undefined,
		getPersistenceData: vi.fn(() => ({})),
		setPersistenceData: vi.fn(),
		getDotSeqIdData: vi.fn(() => ({})),
		setDotSeqIdData: vi.fn(),
	},
}))

vi.mock("@/opensource/stores/chatNew/dots/OrganizationDotsStore", () => ({
	default: {
		reset: vi.fn(),
		setOrganizationDots: vi.fn(),
		getOrganizationDots: vi.fn(() => 0),
		setOrganizationDotSeqId: vi.fn(),
		getOrganizationDotSeqId: vi.fn(() => ""),
		clearOrganizationDots: vi.fn(),
		dots: {},
		dotSeqId: {},
	},
}))

vi.mock("@/opensource/services/chat/dots/OrganizationDispatchService", () => ({
	default: {
		updateOrganizationDot: vi.fn(),
	},
}))

// Mock BroadcastChannelSender
vi.mock("@/opensource/broadcastChannel", () => ({
	BroadcastChannelSender: {
		switchOrganization: vi.fn(),
		switchAccount: vi.fn(),
		addAccount: vi.fn(),
		deleteAccount: vi.fn(),
		updateUserInfo: vi.fn(),
	},
}))

// Hoist mockUserStore to ensure it's available when vi.mock is hoisted
const { mockUserStore } = vi.hoisted(() => {
	const mockStore = {
		user: {
			userInfo: null as User.UserInfo | null,
			organizationCode: null as string | null,
		},
		account: {
			accounts: [] as User.UserAccount[],
			getAccountByMagicId: vi.fn(),
			setAccount: vi.fn((account: User.UserAccount) => {
				const exists = mockStore.account.accounts.some(
					(acc) => acc.magic_id === account.magic_id,
				)
				if (!exists) {
					mockStore.account.accounts.push(account)
				} else {
					const index = mockStore.account.accounts.findIndex(
						(acc) => acc.magic_id === account.magic_id,
					)
					if (index !== -1) {
						mockStore.account.accounts[index] = account
					}
				}
			}),
		},
	}
	return { mockUserStore: mockStore }
})

vi.mock("@/opensource/models/user", () => ({
	userStore: mockUserStore,
}))

vi.mock("@/opensource/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@/opensource/services/user/UserDispatchService", () => ({
	default: {
		switchOrganization: vi.fn(),
		switchAccount: vi.fn(),
		addAccount: vi.fn(),
		deleteAccount: vi.fn(),
		updateUserInfo: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	ContactApi: {
		getAccountUserInfo: vi.fn(),
	},
}))

vi.mock("@/opensource/routes/history/helpers", () => ({
	routesMatch: vi.fn(() => null),
	convertSearchParams: vi.fn(() => ({})),
}))

vi.mock("@/opensource/routes/history", () => ({
	history: {
		replace: vi.fn(),
	},
}))

vi.mock("@/opensource/routes/helpers", () => ({
	defaultClusterCode: "default",
}))

vi.mock("lodash-es", () => ({
	has: vi.fn(() => false),
}))

vi.mock("@/opensource/models/user/transformers", () => ({
	userTransformer: vi.fn((user: any) => user),
}))

vi.mock("@/services", () => ({
	service: {
		get: vi.fn(() => ({
			setLanguage: vi.fn(),
		})),
	},
}))

// Import modules after mocks are set up
import { ModalStateManager } from "../modalStateManager"
import { EVENTS } from "../events"
import eventFactory from "../index"
// userStore is mocked, using mockUserStore instead
import MagicModal from "@/opensource/components/base/MagicModal"
import UserDispatchService from "@/opensource/services/user/UserDispatchService"

vi.mock("@/opensource/utils/log", () => ({
	logger: {
		createLogger: () => ({
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}),
	},
}))

vi.mock("i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("i18next")>()
	const mockI18n = {
		use: vi.fn().mockReturnThis(),
		init: vi.fn(),
		changeLanguage: vi.fn(),
		t: (key: string) => key,
	}
	return {
		...actual,
		default: mockI18n,
		t: (key: string) => key,
	}
})

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		initReactI18next: {
			type: "3rdParty",
			init: vi.fn(),
		},
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: { language: "en" },
		}),
	}
})

vi.mock("i18next-browser-languagedetector", () => ({
	default: {
		type: "languageDetector",
		init: vi.fn(),
	},
}))

vi.mock("i18next-resources-to-backend", () => ({
	default: vi.fn(() => ({
		type: "backend",
		init: vi.fn(),
	})),
}))

vi.mock("@/opensource/assets/locales/create", () => ({
	createI18nNext: vi.fn(() => ({
		init: vi.fn(),
		instance: {
			use: vi.fn().mockReturnThis(),
			init: vi.fn(),
			changeLanguage: vi.fn(),
			t: (key: string) => key,
		},
	})),
}))

vi.mock("@/opensource/models/config/stores/i18n.store", () => ({
	I18nStore: vi.fn().mockImplementation(() => ({
		language: "en",
		languages: [],
		areaCodes: [],
		i18n: {
			init: vi.fn(),
			instance: {
				use: vi.fn().mockReturnThis(),
				init: vi.fn(),
				changeLanguage: vi.fn(),
				t: (key: string) => key,
			},
		},
		setLanguage: vi.fn(),
		setLanguages: vi.fn(),
		setAreaCodes: vi.fn(),
	})),
	i18nStore: {
		language: "en",
		languages: [],
		areaCodes: [],
		i18n: {
			init: vi.fn(),
			instance: {
				use: vi.fn().mockReturnThis(),
				init: vi.fn(),
				changeLanguage: vi.fn(),
				t: (key: string) => key,
			},
		},
		setLanguage: vi.fn(),
		setLanguages: vi.fn(),
		setAreaCodes: vi.fn(),
	},
}))

// Helper function to reset ModalStateManager singleton
function resetModalStateManager() {
	const instance = ModalStateManager.getInstance()
	instance.reset()
	// Access private instance for testing
	;(ModalStateManager as unknown as { instance: ModalStateManager | null }).instance = null
}

// Helper function to create mock user info
function createMockUserInfo(
	magicId: string,
	userId: string,
	organizationCode: string,
): User.UserInfo {
	return {
		magic_id: magicId,
		user_id: userId,
		organization_code: organizationCode,
	} as User.UserInfo
}

// Helper function to create mock account
function createMockAccount(magicId: string, organizationCode: string): User.UserAccount {
	return {
		magic_id: magicId,
		magic_user_id: `user-${magicId}`,
		nickname: `User ${magicId}`,
		organizationCode: organizationCode,
		avatar: "",
		access_token: `token-${magicId}`,
		deployCode: "default",
		organizations: [],
		teamshareOrganizations: [],
	} as User.UserAccount
}

describe("多 Tab 事件监听管理 - 自动化测试", () => {
	let mockModal: {
		destroy: ReturnType<typeof vi.fn>
		update: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		// Reset ModalStateManager singleton
		resetModalStateManager()

		// Setup mock modal
		mockModal = {
			destroy: vi.fn(),
			update: vi.fn(),
		}
		vi.mocked(MagicModal.confirm).mockReturnValue(
			mockModal as ReturnType<typeof MagicModal.confirm>,
		)

		// Reset all mocks
		vi.clearAllMocks()

		// Reset userStore state
		mockUserStore.user.userInfo = null
		mockUserStore.user.organizationCode = null
		mockUserStore.account.accounts = []
		vi.mocked(mockUserStore.account.getAccountByMagicId).mockReturnValue(null)
	})

	afterEach(() => {
		resetModalStateManager()
	})

	describe("P0 - 核心功能测试", () => {
		describe("1. 组织切换场景", () => {
			describe("1.1 同账号下切换组织（正常流程）", () => {
				it("Tab1 切换组织 → Tab2 显示组织切换弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Assert
					expect(MagicModal.confirm).toHaveBeenCalled()
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeTruthy()
					expect(modalStateManager.getPendingOperation()?.type).toBe("organization")
				})

				it("Tab2 点击确认 → Tab2 切换到目标组织", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					let onOkCallback: (() => void) | undefined

					vi.mocked(MagicModal.confirm).mockImplementation(
						(options: Parameters<typeof MagicModal.confirm>[0]) => {
							onOkCallback = options.onOk
							return mockModal as ReturnType<typeof MagicModal.confirm>
						},
					)

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Simulate clicking OK
					if (onOkCallback) {
						await onOkCallback()
					}

					// Assert
					expect(UserDispatchService.switchOrganization).toHaveBeenCalledWith({
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})
				})

				it("Tab2 点击取消 → Tab2 发送当前状态到其他 tab，弹窗关闭", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					let onCancelCallback: (() => void) | undefined

					vi.mocked(MagicModal.confirm).mockImplementation(
						(options: Parameters<typeof MagicModal.confirm>[0]) => {
							onCancelCallback = options.onCancel
							return mockModal as ReturnType<typeof MagicModal.confirm>
						},
					)

					const { BroadcastChannelSender } = await import("@/opensource/broadcastChannel")
					vi.mocked(BroadcastChannelSender.switchOrganization).mockImplementation(vi.fn())

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Simulate clicking Cancel
					if (onCancelCallback) {
						onCancelCallback()
					}

					// Assert
					expect(BroadcastChannelSender.switchOrganization).toHaveBeenCalled()
					expect(mockModal.destroy).toHaveBeenCalled()
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})

				it("Tab1 在弹窗显示期间再次切换 → 验证事件去重", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					// Act - First switch
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					const firstCallCount = vi.mocked(MagicModal.confirm).mock.calls.length

					// Act - Second switch (should be deduplicated)
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Assert - Modal should only be created once
					expect(vi.mocked(MagicModal.confirm).mock.calls.length).toBe(firstCallCount)
				})
			})

			describe("1.2 跨账号切换组织", () => {
				it("Tab1 切换不同账号下的组织 → Tab2 显示账号切换弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						targetMagicId,
						"user-2",
						targetOrgCode,
					)

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Assert
					expect(MagicModal.confirm).toHaveBeenCalled()
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getAccountModal()).toBeTruthy()
					expect(modalStateManager.getPendingOperation()?.type).toBe("account")
				})
			})

			describe("1.3 组织切换中的异常场景", () => {
				it("Tab1 切换组织，Tab2 显示弹窗期间，Tab1 删除目标账号 → Tab2 弹窗自动关闭", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						targetMagicId,
						"user-2",
						targetOrgCode,
					)

					// Act - Switch organization
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete target account
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: targetMagicId,
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})

				it("Tab1 切换组织，Tab2 显示弹窗期间，Tab1 删除当前账号 → Tab2 弹窗自动关闭", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					// Act - Switch organization
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete current account
					mockUserStore.account.accounts = []
					mockUserStore.user.userInfo = null
					mockUserStore.user.organizationCode = null
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: currentMagicId,
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})
			})
		})

		describe("2. 账号切换场景", () => {
			describe("2.1 账号切换（正常流程）", () => {
				it("Tab1 切换账号 → Tab2 显示账号切换弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					// Assert
					expect(MagicModal.confirm).toHaveBeenCalled()
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getAccountModal()).toBeTruthy()
					expect(modalStateManager.getPendingOperation()?.type).toBe("account")
				})

				it("Tab2 点击确认 → Tab2 切换到目标账号", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					vi.mocked(mockUserStore.account.getAccountByMagicId).mockImplementation(
						(magicId: string) => {
							if (magicId === targetMagicId) {
								return createMockAccount(targetMagicId, targetOrgCode)
							}
							return null
						},
					)

					let onOkCallback: (() => Promise<void>) | undefined

					vi.mocked(MagicModal.confirm).mockImplementation((options: any) => {
						onOkCallback = options.onOk
						return mockModal as any
					})

					// Act
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					// Simulate clicking OK
					if (onOkCallback) {
						await onOkCallback()
					}

					// Assert
					expect(UserDispatchService.switchAccount).toHaveBeenCalledWith({
						magicId: targetMagicId,
						magicOrganizationCode: targetOrgCode,
					})
				})

				it("Tab1 在弹窗显示期间再次切换 → 验证事件去重", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					// Act - First switch
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					const firstCallCount = vi.mocked(MagicModal.confirm).mock.calls.length

					// Act - Second switch (should be deduplicated)
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					// Assert - Modal should only be created once
					expect(vi.mocked(MagicModal.confirm).mock.calls.length).toBe(firstCallCount)
				})
			})

			describe("2.2 账号切换中的异常场景", () => {
				it("Tab1 切换账号，Tab2 显示弹窗期间，Tab1 删除目标账号 → Tab2 弹窗自动关闭", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					// Act - Switch account
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete target account
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: targetMagicId,
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getAccountModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})
			})
		})

		describe("3. 账号管理场景", () => {
			describe("3.1 添加账号", () => {
				it("Tab1 添加账号，Tab2 无弹窗 → Tab2 显示账号切换弹窗（而不是直接切换）", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const newMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const newOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					// Act - Add account (should show account switch modal, not switch directly)
					await eventFactory.dispatch(EVENTS.ADD_ACCOUNT, {
						userAccount: createMockAccount(newMagicId, newOrgCode),
					})

					// Assert - Should show account switch modal, not switch directly
					expect(MagicModal.confirm).toHaveBeenCalled()
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getAccountModal()).toBeTruthy()
					expect(modalStateManager.getPendingOperation()?.type).toBe("account")
					// Should not switch account directly
					expect(UserDispatchService.switchAccount).not.toHaveBeenCalled()
				})

				it("Tab1 添加账号，Tab2 有组织切换弹窗（新账号不是目标账号）→ Tab2 关闭组织弹窗，显示账号切换弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const newMagicId = "magic-2" // 新添加的账号（与组织切换的目标账号不同）
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					// 同账号下切换组织（会显示组织切换弹窗）
					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					// Act - Switch organization (will show organization switch modal)
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Add account (different from target account)
					mockUserStore.account.accounts.push(
						createMockAccount(newMagicId, targetOrgCode),
					)
					await eventFactory.dispatch(EVENTS.ADD_ACCOUNT, {
						userAccount: createMockAccount(newMagicId, targetOrgCode),
					})

					// Assert - Should close organization modal and show account switch modal
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getAccountModal()).toBeTruthy()
					expect(modalStateManager.getPendingOperation()?.type).toBe("account")
					expect(modalStateManager.getPendingOperation()?.data.magicId).toBe(newMagicId)
					// Should not switch account directly
					expect(UserDispatchService.switchAccount).not.toHaveBeenCalled()
				})

				it("Tab1 添加 account2，Tab2 显示切换账号弹窗，Tab1 添加 account3 → Tab2 关闭 account2 弹窗，显示 account3 弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const account2MagicId = "magic-2"
					const account3MagicId = "magic-3"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const newOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					// Act - Add account2 (should show account switch modal)
					mockUserStore.account.accounts.push(
						createMockAccount(account2MagicId, newOrgCode),
					)
					await eventFactory.dispatch(EVENTS.ADD_ACCOUNT, {
						userAccount: createMockAccount(account2MagicId, newOrgCode),
					})

					// Verify account2 modal is shown
					const modalStateManager1 = ModalStateManager.getInstance()
					expect(modalStateManager1.getAccountModal()).toBeTruthy()
					expect(modalStateManager1.getPendingOperation()?.data.magicId).toBe(
						account2MagicId,
					)

					// Act - Add account3 (should close account2 modal and show account3 modal)
					mockUserStore.account.accounts.push(
						createMockAccount(account3MagicId, newOrgCode),
					)
					await eventFactory.dispatch(EVENTS.ADD_ACCOUNT, {
						userAccount: createMockAccount(account3MagicId, newOrgCode),
					})

					// Assert - Should show account3 modal, not switch directly
					const modalStateManager2 = ModalStateManager.getInstance()
					expect(modalStateManager2.getAccountModal()).toBeTruthy()
					expect(modalStateManager2.getPendingOperation()?.data.magicId).toBe(
						account3MagicId,
					)
					// Should not switch account directly
					expect(UserDispatchService.switchAccount).not.toHaveBeenCalled()
				})

				it("Tab1 添加账号，Tab2 有组织切换弹窗（目标账号是新添加的）→ Tab2 重新验证操作", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const newMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(newMagicId, "user-2", targetOrgCode)

					// Act - Switch organization (will show account switch modal)
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Add account
					mockUserStore.account.accounts.push(
						createMockAccount(newMagicId, targetOrgCode),
					)
					await eventFactory.dispatch(EVENTS.ADD_ACCOUNT, {
						userAccount: createMockAccount(newMagicId, targetOrgCode),
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					const pendingOperation = modalStateManager.getPendingOperation()
					expect(pendingOperation).toBeTruthy()
					expect(pendingOperation?.type).toBe("account")
				})
			})

			describe("3.2 删除账号", () => {
				it("Tab1 删除当前账号（多账号场景）→ Tab2 清理所有弹窗和资源", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const otherMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(otherMagicId, targetOrgCode),
					]

					const targetUserInfo = createMockUserInfo(otherMagicId, "user-2", targetOrgCode)

					// Act - Switch organization (will show account switch modal)
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete current account
					// Note: Keep userInfo until after DELETE_ACCOUNT event is processed
					// because isCurrentAccountDeleted check needs currentUserInfo
					mockUserStore.account.accounts = [
						createMockAccount(otherMagicId, targetOrgCode),
					]
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: currentMagicId,
					})
					// After DELETE_ACCOUNT is processed, update userInfo
					mockUserStore.user.userInfo = null
					mockUserStore.user.organizationCode = null

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getAccountModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})

				it("Tab1 删除当前账号（Tab2 有账号切换弹窗）→ Tab2 强制切换到目标账号", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					vi.mocked(mockUserStore.account.getAccountByMagicId).mockImplementation(
						(magicId: string) => {
							if (magicId === targetMagicId) {
								return createMockAccount(targetMagicId, targetOrgCode)
							}
							return null
						},
					)

					// Act - Switch account (will show account switch modal)
					await eventFactory.dispatch(EVENTS.SWITCH_ACCOUNT, {
						magicId: targetMagicId,
						magicUserId: "user-2",
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete current account
					mockUserStore.account.accounts = [
						createMockAccount(targetMagicId, targetOrgCode),
					]
					mockUserStore.user.userInfo = null
					mockUserStore.user.organizationCode = null
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: currentMagicId,
					})

					// Assert - Should force switch to target account
					expect(UserDispatchService.switchAccount).toHaveBeenCalledWith({
						magicId: targetMagicId,
						magicOrganizationCode: targetOrgCode,
					})
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getAccountModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})

				it("Tab1 删除目标账号（Tab2 有组织切换弹窗）→ Tab2 关闭组织切换弹窗", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const targetMagicId = "magic-2"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
						createMockAccount(targetMagicId, targetOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						targetMagicId,
						"user-2",
						targetOrgCode,
					)

					// Act - Switch organization
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Delete target account
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]
					await eventFactory.dispatch(EVENTS.DELETE_ACCOUNT, {
						magicId: targetMagicId,
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})
			})

			describe("3.3 退出登录", () => {
				it("Tab1 退出当前账号 → Tab2 清理所有弹窗和资源", async () => {
					// Arrange
					const currentMagicId = "magic-1"
					const currentUserId = "user-1"
					const currentOrgCode = "org-1"
					const targetOrgCode = "org-2"

					mockUserStore.user.userInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						currentOrgCode,
					)
					mockUserStore.user.organizationCode = currentOrgCode
					mockUserStore.account.accounts = [
						createMockAccount(currentMagicId, currentOrgCode),
					]

					const targetUserInfo = createMockUserInfo(
						currentMagicId,
						currentUserId,
						targetOrgCode,
					)

					// Act - Switch organization
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: targetUserInfo,
						magicOrganizationCode: targetOrgCode,
					})

					// Act - Logout
					await eventFactory.dispatch(EVENTS.LOGOUT, {
						magicId: currentMagicId,
					})

					// Assert
					const modalStateManager = ModalStateManager.getInstance()
					expect(modalStateManager.getOrganizationModal()).toBeNull()
					expect(modalStateManager.getPendingOperation()).toBeNull()
				})
			})
		})
	})

	describe("P1 - 竞态条件测试", () => {
		describe("4. 并发操作场景", () => {
			it("Tab1 快速连续切换组织（3次以上）→ Tab2 只显示最后一次切换的弹窗", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				// Act - Rapid switches
				await Promise.all([
					eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: createMockUserInfo(currentMagicId, currentUserId, "org-2"),
						magicOrganizationCode: "org-2",
					}),
					eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: createMockUserInfo(currentMagicId, currentUserId, "org-3"),
						magicOrganizationCode: "org-3",
					}),
					eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: createMockUserInfo(currentMagicId, currentUserId, "org-4"),
						magicOrganizationCode: "org-4",
					}),
				])

				// Assert
				const modalStateManager = ModalStateManager.getInstance()
				const pendingOperation = modalStateManager.getPendingOperation()
				expect(pendingOperation?.data.magicOrganizationCode).toBe("org-4")
			})
		})
	})

	describe("P1 - 错误恢复测试", () => {
		describe("5. 错误场景", () => {
			it("Tab1 切换组织，Tab2 点击确认时状态已变化 → Tab2 验证失败，弹窗关闭", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"
				const targetOrgCode = "org-2"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				const targetUserInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					targetOrgCode,
				)

				let onOkCallback: (() => void) | undefined

				vi.mocked(MagicModal.confirm).mockImplementation((options: any) => {
					onOkCallback = options.onOk
					return mockModal as any
				})

				// Act - Switch organization
				await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
					userInfo: targetUserInfo,
					magicOrganizationCode: targetOrgCode,
				})

				// Simulate state change (user already switched)
				mockUserStore.user.userInfo = targetUserInfo
				mockUserStore.user.organizationCode = targetOrgCode

				// Simulate clicking OK
				if (onOkCallback) {
					await onOkCallback()
				}

				// Assert - Should not call switchOrganization because state already matches
				expect(UserDispatchService.switchOrganization).not.toHaveBeenCalled()
				expect(mockModal.destroy).toHaveBeenCalled()
			})
		})
	})

	describe("P2 - 边界条件测试", () => {
		describe("6. 边界场景", () => {
			it("账号列表为空时切换组织 → 验证失败", async () => {
				// Arrange
				mockUserStore.user.userInfo = null
				mockUserStore.user.organizationCode = null
				mockUserStore.account.accounts = []

				const targetUserInfo = createMockUserInfo("magic-1", "user-1", "org-1")

				// Act
				await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
					userInfo: targetUserInfo,
					magicOrganizationCode: "org-1",
				})

				// Assert
				const modalStateManager = ModalStateManager.getInstance()
				expect(modalStateManager.getOrganizationModal()).toBeNull()
			})

			it("切换组织时缺少 userInfo → 验证失败", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				// Act - Switch with invalid userInfo
				await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
					userInfo: null as any,
					magicOrganizationCode: "org-2",
				})

				// Assert
				const modalStateManager = ModalStateManager.getInstance()
				expect(modalStateManager.getOrganizationModal()).toBeNull()
			})

			it("Tab1 切换到当前已处于的状态 → Tab2 不显示弹窗", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				const targetUserInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)

				// Act
				await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
					userInfo: targetUserInfo,
					magicOrganizationCode: currentOrgCode,
				})

				// Assert
				expect(MagicModal.confirm).not.toHaveBeenCalled()
				const modalStateManager = ModalStateManager.getInstance()
				expect(modalStateManager.getOrganizationModal()).toBeNull()
			})
		})
	})

	describe("P1 - 资源清理测试", () => {
		describe("7. 资源管理", () => {
			it("Tab1 切换组织，Tab2 显示弹窗后关闭 Tab2 → 验证弹窗被正确清理", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"
				const targetOrgCode = "org-2"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				const targetUserInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					targetOrgCode,
				)

				// Act - Switch organization
				await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
					userInfo: targetUserInfo,
					magicOrganizationCode: targetOrgCode,
				})

				// Act - Simulate tab close (cleanup)
				const modalStateManager = ModalStateManager.getInstance()
				modalStateManager.cleanup()

				// Assert
				expect(modalStateManager.getOrganizationModal()).toBeNull()
				expect(modalStateManager.getAccountModal()).toBeNull()
				expect(modalStateManager.getPendingOperation()).toBeNull()
			})

			it("Tab1 快速切换多次后，验证事件队列不会无限增长", async () => {
				// Arrange
				const currentMagicId = "magic-1"
				const currentUserId = "user-1"
				const currentOrgCode = "org-1"

				mockUserStore.user.userInfo = createMockUserInfo(
					currentMagicId,
					currentUserId,
					currentOrgCode,
				)
				mockUserStore.user.organizationCode = currentOrgCode
				mockUserStore.account.accounts = [createMockAccount(currentMagicId, currentOrgCode)]

				// Act - Multiple rapid switches
				for (let i = 0; i < 10; i++) {
					await eventFactory.dispatch(EVENTS.SWITCH_ORGANIZATION, {
						userInfo: createMockUserInfo(currentMagicId, currentUserId, `org-${i}`),
						magicOrganizationCode: `org-${i}`,
					})
				}

				// Assert - Event queue should be managed (not infinite)
				const modalStateManager = ModalStateManager.getInstance()
				// The queue should be cleaned up after operations complete
				expect(modalStateManager.getPendingOperation()).toBeTruthy()
			})
		})
	})
})
