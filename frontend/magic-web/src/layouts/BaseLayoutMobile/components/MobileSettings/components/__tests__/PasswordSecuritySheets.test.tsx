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
		onInputComplete,
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
			onChange={(event) => {
				const nextValue = event.target.value
				onChange?.(nextValue)
				if (nextValue.length === 6) onInputComplete?.(nextValue)
			}}
		/>
	),
}))

/** 修改密码 Sheet 回归测试：验证原型式验证码格子、返回上一步和成功态。 */
describe("MobileSettingsPasswordSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("发送验证码后输入 6 位自动进入设置新密码，并提交到成功态", async () => {
		render(
			<MobileSettingsPasswordSheet
				open
				onClose={vi.fn()}
				method="phone"
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

		expect(screen.getByText("setting.accountSecurityPassword.setNewTitle")).toBeTruthy()

		fireEvent.change(screen.getByTestId("mobile-settings-password-new-input"), {
			target: { value: "password123" },
		})
		fireEvent.change(screen.getByTestId("mobile-settings-password-confirm-input"), {
			target: { value: "password123" },
		})
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(UserApi.changePassword).toHaveBeenCalledWith(
				"123456",
				"password123",
				"password123",
			)
			expect(screen.getByTestId("mobile-settings-password-success")).toBeTruthy()
		})
	})

	test("设置新密码页点击左侧按钮返回验证步骤", async () => {
		render(
			<MobileSettingsPasswordSheet
				open
				onClose={vi.fn()}
				method="phone"
				currentPhone="13800000000"
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

		fireEvent.click(screen.getByLabelText("button.close"))

		expect(screen.getByText("setting.accountSecurityPassword.verifyTitle")).toBeTruthy()
	})
})
