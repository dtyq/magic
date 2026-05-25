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

/** 手机号换绑单页：同屏收集两段验证码与新号，Header 保存一次提交。 */
describe("MobileSettingsPhoneSecuritySheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetOverlayStackForTest()
	})

	test("单页同屏展示当前号、新号与两段验证码输入", () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		expect(screen.getByTestId("mobile-settings-phone-send-current-code-button")).toBeTruthy()
		expect(screen.getByTestId("mobile-settings-phone-send-new-code-button")).toBeTruthy()
		expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
		expect(screen.getAllByTestId("mock-verification-code-input")).toHaveLength(2)
	})

	test("输满验证码不会自动跳转步骤", async () => {
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

		const codeInputs = screen.getAllByTestId("mock-verification-code-input")
		fireEvent.change(codeInputs[0], { target: { value: "111111" } })

		expect(screen.getByTestId("mobile-settings-phone-new-phone-input")).toBeTruthy()
		expect(screen.queryByText("setting.accountSecurityPhone.codeTitle")).toBeNull()
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

		await waitFor(() => {
			expect(phoneStateCodeSelectMocks.render).toHaveBeenLastCalledWith({
				popupZIndex: undefined,
			})
		})

		const sheetEl = screen.getByTestId("mobile-settings-phone-security-sheet")
		const drawerContent = sheetEl.closest('[data-slot="drawer-content"]') as HTMLElement
		expect(drawerContent?.style.zIndex).toBe("1101")
	})

	test("新手机号格式无效时点击发码会展示错误提示", async () => {
		render(
			<MobileSettingsPhoneSecuritySheet
				open
				onClose={vi.fn()}
				currentPhone="13800000000"
				defaultCountryCode="+86"
			/>,
		)

		fireEvent.change(screen.getByTestId("mobile-settings-phone-new-phone-input"), {
			target: { value: "12345677777" },
		})
		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-new-code-button"))

		await waitFor(() => {
			expect(screen.getByText("setting.invalidPhone")).toBeTruthy()
		})
		expect(serviceMocks.getPhoneVerificationCode).not.toHaveBeenCalled()
	})

	test("Header 保存一次性提交换绑", async () => {
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

		const codeInputs = screen.getAllByTestId("mock-verification-code-input")
		fireEvent.change(codeInputs[0], { target: { value: "111111" } })
		fireEvent.change(screen.getByTestId("mobile-settings-phone-new-phone-input"), {
			target: { value: "13900001111" },
		})
		fireEvent.click(screen.getByTestId("mobile-settings-phone-send-new-code-button"))

		await waitFor(() => {
			expect(serviceMocks.getPhoneVerificationCode).toHaveBeenCalledWith(
				VerificationCode.BindPhone,
				"13900001111",
				"+86",
			)
		})

		fireEvent.change(codeInputs[1], { target: { value: "222222" } })
		fireEvent.click(screen.getByLabelText("button.save"))

		await waitFor(() => {
			expect(UserApi.changePhone).toHaveBeenCalledWith(
				"111111",
				"13900001111",
				"222222",
				"+86",
			)
			expect(screen.getByTestId("mobile-settings-phone-success")).toBeTruthy()
		})
	})
})
