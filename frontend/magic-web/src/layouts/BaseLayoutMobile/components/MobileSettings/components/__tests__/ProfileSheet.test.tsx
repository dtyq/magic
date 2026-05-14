import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { MagicUserApi } from "@/apis"
import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"
import { MobileSettingsProfileSheet } from "../ProfileSheet"

const userServiceRefreshMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const uploadAvatarMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

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

vi.mock("@/components/base/MagicAvatar", () => ({
	default: ({ children }: { children: ReactNode }) => (
		<div data-testid="mock-magic-avatar">{children}</div>
	),
}))

/** 个人资料 Sheet 回归测试：入口切到子 Sheet 后仍复用真实头像上传和昵称保存链路。 */
describe("MobileSettingsProfileSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetOverlayStackForTest()
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

	test("昵称未变化时直接关闭且不发保存请求", () => {
		const handleClose = vi.fn()
		render(<MobileSettingsProfileSheet open onClose={handleClose} />)

		fireEvent.click(screen.getByLabelText("button.confirm"))

		expect(MagicUserApi.updateUserInfo).not.toHaveBeenCalled()
		expect(handleClose).toHaveBeenCalledTimes(1)
	})

	test("头像按钮触发隐藏文件输入", () => {
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {})
		render(<MobileSettingsProfileSheet open onClose={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mobile-settings-profile-avatar-button"))

		expect(clickSpy).toHaveBeenCalledTimes(1)
		clickSpy.mockRestore()
	})
})
