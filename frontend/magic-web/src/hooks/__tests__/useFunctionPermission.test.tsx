import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	getFunctionPermissions: vi.fn(),
	getPermissionGroups: vi.fn(),
	userStore: {
		user: {
			userInfo: { user_id: "" },
			organizationCode: "",
		},
	},
}))

vi.mock("@/apis", () => ({
	FunctionPermissionApi: {
		getMe: mocks.getFunctionPermissions,
		getPermissionGroups: mocks.getPermissionGroups,
	},
	PLATFORM_SUPER_ADMIN_PERMISSION_KEY: "MAGIC_PLATFORM_PERMISSIONS",
}))

vi.mock("@/models/user", () => ({ userStore: mocks.userStore }))

import { useFunctionPermission, usePermissionKey } from "../useFunctionPermission"

const SKILL_CREATE = "skill.create" as const
const SKILL_MARKET_EDIT = "platform.skill.market.edit" as const

let testContext = 0

describe("useFunctionPermission", () => {
	beforeEach(() => {
		testContext += 1
		mocks.userStore.user.userInfo.user_id = `permission-test-user-${testContext}`
		mocks.userStore.user.organizationCode = `permission-test-org-${testContext}`
		mocks.getFunctionPermissions.mockReset()
		mocks.getPermissionGroups.mockReset()
		mocks.getFunctionPermissions.mockResolvedValue({})
		mocks.getPermissionGroups.mockResolvedValue({ permission_key: [] })
	})

	it("uses the function permission when it is granted", async () => {
		mocks.getFunctionPermissions.mockResolvedValue({ [SKILL_CREATE]: true })

		const { result } = renderHook(() => useFunctionPermission(SKILL_CREATE))

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(true)
		expect(mocks.getPermissionGroups).not.toHaveBeenCalled()
	})

	it("falls back to the platform permission group for super administrators", async () => {
		mocks.getPermissionGroups.mockResolvedValue({
			permission_key: ["MAGIC_PLATFORM_PERMISSIONS"],
		})

		const { result } = renderHook(() =>
			useFunctionPermission(SKILL_CREATE, { allowSuperAdmin: true }),
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(true)
		expect(mocks.getPermissionGroups).toHaveBeenCalledTimes(1)
	})

	it("deduplicates the fallback request for the same user and organization", async () => {
		mocks.getPermissionGroups.mockResolvedValue({
			permission_key: ["MAGIC_PLATFORM_PERMISSIONS"],
		})

		const first = renderHook(() =>
			useFunctionPermission(SKILL_CREATE, { allowSuperAdmin: true }),
		)
		const second = renderHook(() =>
			useFunctionPermission(SKILL_CREATE, { allowSuperAdmin: true }),
		)

		await waitFor(() => {
			expect(first.result.current.isLoading).toBe(false)
			expect(second.result.current.isLoading).toBe(false)
		})

		expect(first.result.current.isAllowed).toBe(true)
		expect(second.result.current.isAllowed).toBe(true)
		expect(mocks.getPermissionGroups).toHaveBeenCalledTimes(1)
	})

	it("does not treat organization or member groups as platform super administrators", async () => {
		mocks.getPermissionGroups.mockResolvedValue({
			permission_key: ["MAGIC_ALL_PERMISSIONS", "MAGIC_PERSON_PERMISSIONS"],
		})

		const { result, rerender } = renderHook(() =>
			useFunctionPermission(SKILL_CREATE, { allowSuperAdmin: true }),
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		rerender()

		expect(result.current.isAllowed).toBe(false)
		expect(mocks.getPermissionGroups).toHaveBeenCalledTimes(1)
	})

	it("does not request the fallback when it is not enabled", async () => {
		const { result } = renderHook(() => useFunctionPermission(SKILL_CREATE))

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(false)
		expect(mocks.getPermissionGroups).not.toHaveBeenCalled()
	})

	it("hides the permission when the fallback request fails", async () => {
		mocks.getPermissionGroups.mockRejectedValue(new Error("permission request failed"))

		const { result } = renderHook(() =>
			useFunctionPermission(SKILL_CREATE, { allowSuperAdmin: true }),
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(false)
		expect(result.current.error).toBeInstanceOf(Error)
	})

	it("reads the skill market permission from permission keys without requesting function permissions", async () => {
		mocks.getPermissionGroups.mockResolvedValue({
			permission_key: [SKILL_MARKET_EDIT],
		})

		const { result } = renderHook(() =>
			usePermissionKey(SKILL_MARKET_EDIT, { allowSuperAdmin: true }),
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(true)
		expect(mocks.getPermissionGroups).toHaveBeenCalledTimes(1)
		expect(mocks.getFunctionPermissions).not.toHaveBeenCalled()
	})

	it("allows the skill market permission for platform super administrators", async () => {
		mocks.getPermissionGroups.mockResolvedValue({
			permission_key: ["MAGIC_PLATFORM_PERMISSIONS"],
		})

		const { result } = renderHook(() =>
			usePermissionKey(SKILL_MARKET_EDIT, { allowSuperAdmin: true }),
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isAllowed).toBe(true)
		expect(mocks.getFunctionPermissions).not.toHaveBeenCalled()
	})
})
