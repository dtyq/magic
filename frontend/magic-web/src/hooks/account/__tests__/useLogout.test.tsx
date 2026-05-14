import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	cancelRecord: vi.fn(),
	accountLogout: vi.fn(),
	accountSwitch: vi.fn(),
	openLightModal: vi.fn(),
	modalConfirm: vi.fn(),
	deleteAccount: vi.fn(),
	historyReplace: vi.fn(),
	routesMatch: vi.fn(),
	convertSearchParams: vi.fn(),
	devices: {
		isMobile: false,
	},
	userStore: {
		user: {
			userInfo: {
				magic_id: "current-user",
			},
		},
		account: {
			accounts: [],
		},
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/components/business/RecordingSummary/hooks/useCancelRecord", () => ({
	default: () => ({
		cancelRecord: mocks.cancelRecord,
	}),
}))

vi.mock("@/stores/authentication", () => ({
	useAccount: () => ({
		accountLogout: mocks.accountLogout,
		accountSwitch: mocks.accountSwitch,
	}),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: mocks.modalConfirm,
	},
}))

vi.mock("@/utils/openLightModal", () => ({
	openLightModal: mocks.openLightModal,
}))

vi.mock("@/models/user", () => ({
	userStore: mocks.userStore,
}))

vi.mock("@/broadcastChannel", () => ({
	BroadcastChannelSender: {
		deleteAccount: mocks.deleteAccount,
	},
}))

vi.mock("@/routes", () => ({
	history: {
		replace: mocks.historyReplace,
	},
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		Login: "Login",
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	convertSearchParams: mocks.convertSearchParams,
	routesMatch: mocks.routesMatch,
}))

vi.mock("@/routes/helpers", () => ({
	defaultClusterCode: "default-cluster",
}))

vi.mock("@/utils/log", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
		}),
	},
}))

vi.mock("@/services/app/AppService", () => ({
	appService: {
		initUserData: vi.fn(),
	},
}))

vi.mock("@/utils/devices", () => ({
	get isMobile() {
		return mocks.devices.isMobile
	},
}))

import { openLightModal } from "@/utils/openLightModal"
import MagicModal from "@/components/base/MagicModal"
import useLogout from "../useLogout"

describe("useLogout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.devices.isMobile = false
		mocks.cancelRecord.mockResolvedValue(undefined)
		mocks.accountLogout.mockResolvedValue(undefined)
		mocks.accountSwitch.mockResolvedValue(undefined)
		mocks.convertSearchParams.mockImplementation((params: URLSearchParams) => params.toString())
		mocks.routesMatch.mockReturnValue(null)
		mocks.userStore.account.accounts = []
		mocks.userStore.user.userInfo = {
			magic_id: "current-user",
		}
	})

	it("在移动端使用轻量弹层而不是桌面确认框", async () => {
		mocks.devices.isMobile = true

		const { result } = renderHook(() => useLogout())

		await act(async () => {
			await result.current()
		})

		expect(openLightModal).toHaveBeenCalledTimes(1)
		expect(MagicModal.confirm).not.toHaveBeenCalled()
	})

	it("在桌面端继续使用桌面确认框", async () => {
		const { result } = renderHook(() => useLogout())

		await act(async () => {
			await result.current()
		})

		expect(MagicModal.confirm).toHaveBeenCalledTimes(1)
		expect(openLightModal).not.toHaveBeenCalled()
	})
})
