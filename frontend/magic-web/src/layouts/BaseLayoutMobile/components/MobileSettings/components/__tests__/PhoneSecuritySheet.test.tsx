import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { UserApi } from "@/apis"
import { VerificationCode } from "@/constants/bussiness"
import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"

import { MobileSettingsPhoneSecuritySheet } from "../PhoneSecuritySheet"

const serviceMocks = vi.hoisted(() => ({
	getUsersVerificationCode: vi.fn().mockResolvedValue(undefined),
	getPhoneVerificationCode: vi.fn().mockResolvedValue(undefined),
}))

const phoneStateCodeSelectMocks = vi.hoisted(() => ({
	render: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.phone ? `${key}:${options.phone}` : key,
	}),
}))

vi.mock("swr", () => ({
	mutate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/apis", () => ({
	UserApi: {
		changePhone: vi.fn().mockResolvedValue(undefined),
	},
}))

vi.mock("@/services", () => ({
	service: {
		get: vi.fn(() => ({
			getUsersVerificationCode: serviceMocks.getUsersVerificationCode,
			getPhoneVerificationCode: serviceMocks.getPhoneVerificationCode,
		})),
	},
}))

vi.mock("@/components/business/VerificationCodeButton", () => ({
	default: ({
		trigger,
		phone,
		stateCode,
		codeType,
		"data-testid": dataTestId = "verification-code-button",
	}: {
		trigger?: (codeType: string, phone: string, stateCode?: string) => Promise<void>
		phone?: string
		stateCode?: string
		codeType: string
		"data-testid"?: string
	}) => (
		<button
			type="button"
			data-testid={dataTestId}
			onClick={() => trigger?.(codeType, phone ?? "", stateCode)}
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

vi.mock("@/components/other/PhoneStateCodeSelect", () => ({
	default: ({
		value,
		onChange,
		popupZIndex,
	}: {
		value?: string
		onChange?: (value: string) => void
		popupZIndex?: number
	}) => {
		phoneStateCodeSelectMocks.render({ popupZIndex })

		return (
			<select
				data-testid="mobile-settings-phone-country-code-select"
				value={value}
				onChange={(event) => onChange?.(event.target.value)}
			>
				<option value="+86">+86</option>
			</select>
		)
	},
}))

vi.mock("@/utils/phone", () => ({
	validatePhone: vi.fn((phone: string) => Boolean(phone) && phone !== "12345677777"),
	encryptPhoneWithCountryCode: vi.fn(
		(phone: string, countryCode: string) => `${countryCode} ${phone}`,
	),
}))

/** 手机号换绑回归测试：保持原型式层级，当前手机号验证后进入新手机号输入层。 */
describe("MobileSettingsPhoneSecuritySheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetOverlayStackForTest()
	})

	test("当前手机号验证完成后进入新手机号输入层", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-current-code-button"))
		await waitFor(() => {
			expect(serviceMocks.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "111111" },
		})

		await waitFor(() => {
			expect(screen.getByText("setting.accountSecurityPhone.inputTitle")).toBeTruthy()
		})
		expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
	})

	test("手机号 Sheet 进入自动层级栈且地区选择不再硬编码层级", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-current-code-button"))
		await waitFor(() => {
			expect(serviceMocks.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "111111" },
		})

		// Sheet 和后续 MagicPopup 共享全局栈，地区选择器不再传固定 popupZIndex。
		await waitFor(() => {
			expect(phoneStateCodeSelectMocks.render).toHaveBeenLastCalledWith({
				popupZIndex: undefined,
			})
		})
		expect(screen.getByTestId("mobile-settings-phone-security-sheet").style.zIndex).toBe("1011")
	})

	test("新手机号输入层点击确认后发送验证码并进入验证码层", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-current-code-button"))
		await waitFor(() => {
			expect(serviceMocks.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "111111" },
		})
		await waitFor(() => {
			expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
		})
		fireEvent.change(screen.getByTestId("mobile-settings-phone-new-phone-input"), {
			target: { value: "13900001111" },
		})

		// 新手机号页的确认按钮只负责触发验证码发送，验证码内容会在下一层输入。
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(serviceMocks.getPhoneVerificationCode).toHaveBeenCalledWith(
				VerificationCode.BindPhone,
				"13900001111",
				"+86",
			)
		})
		expect(screen.getByText("setting.accountSecurityPhone.codeTitle")).toBeTruthy()
	})

	test("新手机号格式无效时点击确认会展示错误提示", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-current-code-button"))
		await waitFor(() => {
			expect(serviceMocks.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "111111" },
		})
		await waitFor(() => {
			expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
		})
		fireEvent.change(screen.getByTestId("mobile-settings-phone-new-phone-input"), {
			target: { value: "12345677777" },
		})

		// 有输入但格式不合法时，确认按钮必须进入校验逻辑，避免用户点击后没有任何反馈。
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(screen.getByText("setting.invalidPhone")).toBeTruthy()
		})
		expect(serviceMocks.getPhoneVerificationCode).not.toHaveBeenCalled()
	})

	test("新手机号验证码输满后携带两段验证码一起提交换绑", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-current-code-button"))
		await waitFor(() => {
			expect(serviceMocks.getUsersVerificationCode).toHaveBeenCalledTimes(1)
		})

		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "111111" },
		})
		await waitFor(() => {
			expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
		})
		fireEvent.change(screen.getByTestId("mobile-settings-phone-new-phone-input"), {
			target: { value: "13900001111" },
		})
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(screen.getByText("setting.accountSecurityPhone.codeTitle")).toBeTruthy()
		})
		fireEvent.change(screen.getByTestId("mock-verification-code-input"), {
			target: { value: "222222" },
		})

		// 当前没有独立验证码校验 API，最终换绑接口仍负责一次性校验两段验证码。
		await waitFor(() => {
			expect(UserApi.changePhone).toHaveBeenCalledWith(
				"111111",
				"13900001111",
				"222222",
				"+86",
			)
		})
	})
})
