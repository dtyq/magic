import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const mocks = vi.hoisted(() => ({
	accountSync: vi.fn(),
	getThirdPlatformOrganization: vi.fn(),
	magicOrganizationSync: vi.fn(),
	syncClusterConfig: vi.fn(),
	setAuthorization: vi.fn(),
	setOrganization: vi.fn(),
	wsLogin: vi.fn(),
	initUserData: vi.fn(),
	historyReplace: vi.fn(),
	routesMatch: vi.fn(),
	onClose: vi.fn(),
	onClusterChange: vi.fn(),
	refreshAccountContextPage: vi.fn(),
	triggerUserAgreedPolicy: vi.fn(),
	userStore: {
		user: {
			userInfo: {
				magic_id: "mock-magic-id",
				user_id: "mock-user-id",
				organization_code: "mock-org-code",
			},
		},
	},
}))

vi.mock("ahooks", async () => {
	const { useEffect } = await vi.importActual<typeof import("react")>("react")
	return {
		useDeepCompareEffect: useEffect,
		useMemoizedFn: <T extends (...args: any[]) => any>(fn: T) => fn,
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/styles/login-form-overrider", () => ({
	default: () => ({
		styles: {
			container: "mock-container",
		},
	}),
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}))

vi.mock("@/components/shadcn-ui/dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../components/MobilePhonePasswordForm", () => ({
	default: ({ onSubmit }: { onSubmit: (values: { access_token: string }) => Promise<void> }) => (
		<button type="button" onClick={() => onSubmit({ access_token: "mock-access-token" })}>
			submit-login
		</button>
	),
}))

vi.mock("../../components/Footer", () => ({
	default: () => <div>mock-footer</div>,
}))

vi.mock("../../hooks/useUserAgreedPolicy", () => ({
	useUserAgreedPolicy: () => ({
		agree: true,
		setAgree: vi.fn(),
		triggerUserAgreedPolicy: mocks.triggerUserAgreedPolicy,
	}),
}))

vi.mock("@/layouts/SSOLayout/providers/LoginServiceProvider", () => ({
	useLoginServiceContext: () => ({
		clusterCode: "mock-cluster-code",
		service: {
			get: (name: string) => {
				if (name === "userService") {
					return {
						setAuthorization: mocks.setAuthorization,
						setOrganization: mocks.setOrganization,
						wsLogin: mocks.wsLogin,
					}
				}
				return {
					magicOrganizationSync: mocks.magicOrganizationSync,
					syncClusterConfig: mocks.syncClusterConfig,
					getThirdPlatformOrganization: mocks.getThirdPlatformOrganization,
					accountSync: mocks.accountSync,
				}
			},
		},
		setPrivateClusterCode: vi.fn(),
		showPrivateDeployment: vi.fn(),
		showPublicDeployment: vi.fn(),
	}),
}))

vi.mock("@/models/user", () => ({
	userStore: mocks.userStore,
}))

vi.mock("@/services/app/AppService", () => ({
	appService: {
		initUserData: mocks.initUserData,
	},
}))

vi.mock("@/routes", () => ({
	history: {
		replace: mocks.historyReplace,
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	routesMatch: mocks.routesMatch,
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		Super: "Super",
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/broadcastChannel/eventFactory/accountContextRefresh", () => ({
	refreshAccountContextPage: mocks.refreshAccountContextPage,
}))

import AccountModal from "../AccountModal"

describe("AccountModal", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.magicOrganizationSync.mockResolvedValue({
			"mock-org-code": {
				magic_organization_code: "mock-org-code",
				magic_user_id: "mock-user-id",
			},
		})
		mocks.syncClusterConfig.mockResolvedValue({ clusterCode: "mock-next-cluster" })
		mocks.getThirdPlatformOrganization.mockResolvedValue({
			organizations: [{ organization_code: "mock-team-org" }],
			organizationCode: "mock-org-code",
			thirdPlatformOrganizationCode: "mock-team-org",
		})
		mocks.accountSync.mockResolvedValue(undefined)
		mocks.initUserData.mockResolvedValue(undefined)
		mocks.routesMatch.mockReturnValue({
			route: { name: "MockRoute" },
			params: { clusterCode: "mock-old-cluster" },
		})
	})

	it("添加账号并完成当前 tab 切换后刷新页面", async () => {
		render(
			<AccountModal onClose={mocks.onClose} onClusterChange={mocks.onClusterChange} open />,
		)

		fireEvent.click(screen.getByText("submit-login"))

		await waitFor(() => {
			expect(mocks.refreshAccountContextPage).toHaveBeenCalledTimes(1)
		})
		expect(mocks.accountSync).toHaveBeenCalledWith({
			deployCode: "mock-next-cluster",
			access_token: "mock-access-token",
			magicOrganizationMap: {
				"mock-org-code": {
					magic_organization_code: "mock-org-code",
					magic_user_id: "mock-user-id",
				},
			},
			organizations: [{ organization_code: "mock-team-org" }],
			teamshareOrganizationCode: "mock-team-org",
		})
		expect(mocks.historyReplace).toHaveBeenCalledWith({
			name: "MockRoute",
			params: {
				clusterCode: "mock-next-cluster",
			},
			query: {},
		})
		expect(mocks.onClose).toHaveBeenCalledTimes(1)
	})
})
