import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { UserApi } from "@/apis"
import { MobileSettingsPasswordSheet } from "../PasswordSecuritySheets"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/apis", () => ({
	UserApi: {
		getUsersVerificationCode: vi.fn().mockResolvedValue(undefined),
		changePassword: vi.fn().mockResolvedValue(undefined),
	},
}))

vi.mock("@/components/business/VerificationCodeButton", () => ({
	default: ({
		trigger,
		phone,
		codeType,
		"data-testid": dataTestId,
	}: {
		trigger?: (codeType: string, phone: string) => Promise<void>
		phone?: string
		codeType: string
		"data-testid"?: string
	}) => (
		<button
			type="button"
			data-testid={dataTestId}
			onClick={() => trigger?.(codeType, phone ?? "")}
		>
			send
		</button>
	),
}))

vi.mock("@/components/business/VerificationCodeInput", () => ({
	default: ({
		value,
		onChange,
		disabled,
	}: {
		value?: string
		onChange?: (value: string) => void
		onInputComplete?: (value: string) => void
		disabled?: boolean
	}) => (
		<input
			data-testid="mock-verification-code-input"
			value={value}
			disabled={disabled}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	),
}))

/** 修改密码单页：Tab 切换、禁止自动进下一步、Header 重置密码提交。 */
describe("MobileSettingsPasswordSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("发送验证码后输满 6 位不会自动进入仅密码步骤，Header 提交成功", async () => {
		render(
			<MobileSettingsPasswordSheet
				open
				onClose={vi.fn()}
				hasPhone
				hasEmail={false}
				currentPhone="13800000000"
				countryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-password-send-code-button"))

		await waitFor(() => {
			expect(UserApi.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "123456" },
		})

		expect(screen.getByTestId("mobile-settings-password-new-input")).toBeTruthy()
		expect(screen.queryByText("setting.accountSecurityPassword.setNewTitle")).toBeNull()

		fireEvent.change(screen.getByTestId("mobile-settings-password-new-input"), {
			target: { value: "password123" },
		})
		fireEvent.change(screen.getByTestId("mobile-settings-password-confirm-input"), {
			target: { value: "password123" },
		})
		fireEvent.click(screen.getByLabelText("setting.resetPassword"))

		await waitFor(() => {
			expect(UserApi.changePassword).toHaveBeenCalledWith(
				"123456",
				"password123",
				"password123",
			)
			expect(screen.getByTestId("mobile-settings-password-success")).toBeTruthy()
		})
	})

	test("切换邮箱 Tab 会清空验证码与密码字段", async () => {
		render(
			<MobileSettingsPasswordSheet
				open
				onClose={vi.fn()}
				hasPhone
				hasEmail
				currentPhone="13800000000"
				currentEmail="user@example.com"
				countryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-password-send-code-button"))
		await waitFor(() => {
			expect(UserApi.getUsersVerificationCode).toHaveBeenCalled()
		})
		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "123456" },
		})
		fireEvent.change(screen.getByTestId("mobile-settings-password-new-input"), {
			target: { value: "password123" },
		})

		fireEvent.click(screen.getByTestId("mobile-settings-password-tab-email"))

		expect(screen.getByTestId("mock-verification-code-input")).toHaveValue("")
		expect(screen.getByTestId("mobile-settings-password-new-input")).toHaveValue("")
	})

	test("仅邮箱可用时默认选中邮箱 Tab", () => {
		render(
			<MobileSettingsPasswordSheet
				open
				onClose={vi.fn()}
				hasPhone={false}
				hasEmail
				currentEmail="user@example.com"
			/>,
		)

		const emailTab = screen.getByTestId("mobile-settings-password-tab-email")
		expect(emailTab.className).toContain("border-primary")
	})
})
