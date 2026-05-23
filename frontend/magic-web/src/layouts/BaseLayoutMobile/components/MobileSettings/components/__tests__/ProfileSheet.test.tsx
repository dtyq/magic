import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import type { UpdateUserInfoPermission } from "@/apis/modules/magic-user"
import { MagicUserApi } from "@/apis"
import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"
import { MobileSettingsProfileSheet } from "../ProfileSheet"

const userServiceRefreshMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const uploadAvatarMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const getUpdateUserInfoPermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

const permissionsState = vi.hoisted(() => ({
	value: ["nickname", "avatar_url"] as UpdateUserInfoPermission[],
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	MagicUserApi: {
		updateUserInfo: vi.fn().mockResolvedValue(undefined),
	},
}))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({
		userInfo: {
			avatar: "https://example.com/avatar.png",
			nickname: "Old Name",
		},
	}),
}))

vi.mock("@/components/settings/UserAvatar/hooks/useAvatarUpload", () => ({
	useAvatarUpload: () => ({
		uploadAvatar: uploadAvatarMock,
		isUploading: false,
	}),
}))

vi.mock("@/services", () => ({
	service: {
		get: vi.fn(() => ({
			refreshUserInfo: userServiceRefreshMock,
		})),
	},
}))

vi.mock("@/services/setting", () => ({
	default: {
		getUpdateUserInfoPermission: getUpdateUserInfoPermissionMock,
	},
}))

vi.mock("@/stores/setting", () => ({
	default: {
		get hasUpdateUserInfoPermission() {
			return permissionsState.value
		},
		get canUpdateNickname() {
			return permissionsState.value.includes("nickname")
		},
		get canUpdateAvatar() {
			return permissionsState.value.includes("avatar_url")
		},
		get canUpdateUserInfo() {
			return (
				permissionsState.value.includes("nickname") ||
				permissionsState.value.includes("avatar_url")
			)
		},
		setHasUpdateUserInfoPermission: (next: UpdateUserInfoPermission[]) => {
			permissionsState.value = next
		},
	},
}))

vi.mock("@/components/base/MagicAvatar", () => ({
	default: ({ children }: { children: ReactNode }) => (
		<div data-testid="mock-magic-avatar">{children}</div>
	),
}))

/** 设置测试用 update-permission，与 PC EditProfileModal 门控口径一致。 */
function setProfilePermissions(permissions: UpdateUserInfoPermission[]) {
	permissionsState.value = permissions
}

/** 个人资料 Sheet 回归：昵称保存、头像上传与 update-permission 门控。 */
describe("MobileSettingsProfileSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetOverlayStackForTest()
		setProfilePermissions(["nickname", "avatar_url"])
	})

	test("打开 Sheet 时拉取 update-permission", () => {
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		expect(getUpdateUserInfoPermissionMock).toHaveBeenCalledTimes(1)
	})

	test("昵称为空时禁用确认按钮", () => {
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		fireEvent.change(screen.getByTestId("mobile-settings-profile-nickname-input"), {
			target: { value: "" },
		})

		expect((screen.getByLabelText("button.confirm") as HTMLButtonElement).disabled).toBe(true)
	})

	test("修改昵称后调用保存 API、刷新用户信息并关闭 Sheet", async () => {
		const handleClose = vi.fn()
		render(<MobileSettingsProfileSheet open onClose={handleClose} />)

		fireEvent.change(screen.getByTestId("mobile-settings-profile-nickname-input"), {
			target: { value: "New Name" },
		})
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(MagicUserApi.updateUserInfo).toHaveBeenCalledWith({ nickname: "New Name" })
		})
		expect(userServiceRefreshMock).toHaveBeenCalledTimes(1)
		expect(handleClose).toHaveBeenCalledTimes(1)
	})

	test("昵称未变化时确认按钮禁用且不发起保存", () => {
		const handleClose = vi.fn()
		render(<MobileSettingsProfileSheet open onClose={handleClose} />)

		const confirmButton = screen.getByLabelText("button.confirm") as HTMLButtonElement
		expect(confirmButton.disabled).toBe(true)
		fireEvent.click(confirmButton)

		expect(MagicUserApi.updateUserInfo).not.toHaveBeenCalled()
		expect(handleClose).not.toHaveBeenCalled()
	})

	test("头像按钮触发隐藏文件输入", () => {
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {})
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mobile-settings-profile-avatar-button"))

		expect(clickSpy).toHaveBeenCalledTimes(1)
		clickSpy.mockRestore()
	})

	test("无 avatar_url 权限时不展示头像上传入口", () => {
		setProfilePermissions(["nickname"])
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		expect(screen.queryByTestId("mobile-settings-profile-avatar-button")).toBeNull()
		expect(screen.getByTestId("mobile-settings-profile-avatar-readonly")).toBeTruthy()
		expect(screen.queryByTestId("mobile-settings-profile-avatar-input")).toBeNull()
	})

	test("无 nickname 权限时不展示确认按钮与昵称输入框", () => {
		setProfilePermissions(["avatar_url"])
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		expect(screen.queryByLabelText("button.confirm")).toBeNull()
		expect(screen.queryByTestId("mobile-settings-profile-nickname-input")).toBeNull()
		expect(screen.getByTestId("mobile-settings-profile-nickname-readonly")).toHaveTextContent(
			"Old Name",
		)
	})
})
