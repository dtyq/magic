import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	accounts: [] as Array<Record<string, unknown>>,
	authorization: "token-mock",
	currentDeploymentCode: "private-mock-target",
	organization: {
		organizationCode: "org-mock-current",
		organizations: [] as Array<Record<string, unknown>>,
		magicOrganizationMap: {} as Record<string, Record<string, unknown>>,
		organizationListReady: true,
	},
	switchOrganization: vi.fn(),
	userInfo: {
		magic_id: "magic-id-mock-current",
		user_id: "user-id-mock-current",
		nickname: "User Mock",
		avatar: "avatar-mock",
		organization_code: "org-mock-current",
	},
}))

vi.mock("@/models/user/hooks/useAccount", () => ({
	useAccount: () => ({ accounts: mocks.accounts }),
}))

vi.mock("@/models/user/hooks/useAuthorization", () => ({
	useAuthorization: () => ({ authorization: mocks.authorization }),
}))

vi.mock("@/providers/ClusterProvider", () => ({
	useClusterCode: () => ({ clusterCode: mocks.currentDeploymentCode }),
}))

vi.mock("@/models/user/hooks/useOrganization", () => ({
	useOrganization: () => mocks.organization,
}))

vi.mock("@/models/user/hooks/useUserInfo", () => ({
	useUserInfo: () => ({ userInfo: mocks.userInfo }),
}))

vi.mock("@/hooks/account/useSwitchOrganization", () => ({
	useSwitchOrganization: () => mocks.switchOrganization,
}))

vi.mock("@/app/services/httpService/interceptors/request/waitForAppInit", () => ({
	awaitAppInitPromise: vi.fn(() => Promise.resolve()),
}))

import { useCrewConversationOrganizationGuard } from "../useCrewConversationOrganizationGuard"

describe("useCrewConversationOrganizationGuard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.accounts = []
		mocks.currentDeploymentCode = "private-mock-target"
		mocks.organization.organizationCode = "org-mock-current"
		mocks.organization.organizations = []
		mocks.organization.magicOrganizationMap = {}
		mocks.organization.organizationListReady = true
		mocks.userInfo.organization_code = "org-mock-current"
		mocks.switchOrganization.mockResolvedValue(undefined)
	})

	it("switches to an organization from an account in the requested private deployment", async () => {
		const targetOrganization = {
			magic_id: "magic-id-mock-target",
			magic_user_id: "user-id-mock-target",
			magic_organization_code: "org-mock-target",
		}
		const targetAccount = {
			deployCode: "private-mock-target",
			magic_id: "magic-id-mock-target",
			magic_user_id: "user-id-mock-target",
			organizationCode: "org-mock-target",
			organizations: [targetOrganization],
		}
		mocks.accounts = [targetAccount]

		const { result } = renderHook(() =>
			useCrewConversationOrganizationGuard("org-mock-target", "private-mock-target"),
		)

		await waitFor(() => expect(mocks.switchOrganization).toHaveBeenCalledTimes(1))
		expect(mocks.switchOrganization).toHaveBeenCalledWith(targetAccount, targetOrganization)
		await waitFor(() => expect(result.current.status).toBe("ready"))
	})

	it("does not select the same organization code from another deployment", async () => {
		mocks.accounts = [
			{
				deployCode: "private-mock-other",
				magic_id: "magic-id-mock-other",
				magic_user_id: "user-id-mock-other",
				organizationCode: "org-mock-target",
				organizations: [
					{
						magic_id: "magic-id-mock-other",
						magic_user_id: "user-id-mock-other",
						magic_organization_code: "org-mock-target",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useCrewConversationOrganizationGuard("org-mock-target", "private-mock-target"),
		)

		await waitFor(() => expect(result.current.status).toBe("error"))
		expect(mocks.switchOrganization).not.toHaveBeenCalled()
	})

	it("treats the global route as the SaaS account deployment", async () => {
		mocks.currentDeploymentCode = ""
		const targetOrganization = {
			magic_id: "magic-id-mock-saas",
			magic_user_id: "user-id-mock-saas",
			magic_organization_code: "org-mock-saas",
		}
		const targetAccount = {
			deployCode: "",
			magic_id: "magic-id-mock-saas",
			magic_user_id: "user-id-mock-saas",
			organizationCode: "org-mock-saas",
			organizations: [targetOrganization],
		}
		mocks.accounts = [targetAccount]

		renderHook(() => useCrewConversationOrganizationGuard("org-mock-saas", "global"))

		await waitFor(() => expect(mocks.switchOrganization).toHaveBeenCalledTimes(1))
		expect(mocks.switchOrganization).toHaveBeenCalledWith(targetAccount, targetOrganization)
	})

	it("waits for the active deployment before evaluating the organization", async () => {
		mocks.currentDeploymentCode = "private-mock-current"
		mocks.accounts = [
			{
				deployCode: "private-mock-target",
				magic_id: "magic-id-mock-target",
				magic_user_id: "user-id-mock-target",
				organizationCode: "org-mock-target",
				organizations: [
					{
						magic_id: "magic-id-mock-target",
						magic_user_id: "user-id-mock-target",
						magic_organization_code: "org-mock-target",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useCrewConversationOrganizationGuard("org-mock-target", "private-mock-target"),
		)

		await waitFor(() => expect(result.current.status).toBe("switching"))
		expect(mocks.switchOrganization).not.toHaveBeenCalled()
	})
})
