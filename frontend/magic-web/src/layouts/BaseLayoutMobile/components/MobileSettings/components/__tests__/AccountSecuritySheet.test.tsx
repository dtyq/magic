import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { MobileSettingsAccountSecuritySheet } from "../AccountSecuritySheet"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

/** 账号安全浮层只展示已接入真实业务链路的入口，防止未完成的绑定项误暴露。 */
describe("MobileSettingsAccountSecuritySheet", () => {
	test("只展示手机号和密码入口，并分发点击事件", () => {
		const handleOpenPhone = vi.fn()
		const handleOpenPassword = vi.fn()

		render(
			<MobileSettingsAccountSecuritySheet
				open
				onClose={vi.fn()}
				phone="13800000000"
				countryCode="+86"
				onOpenPhone={handleOpenPhone}
				onOpenPassword={handleOpenPassword}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-account-security-phone"))
		fireEvent.click(screen.getByTestId("mobile-settings-account-security-password"))

		expect(screen.getByTestId("mobile-settings-account-security-sheet")).toBeTruthy()
		expect(screen.getByText("+86 138****0000")).toBeTruthy()
		expect(screen.queryByText("setting.email")).toBeNull()
		expect(handleOpenPhone).toHaveBeenCalledTimes(1)
		expect(handleOpenPassword).toHaveBeenCalledTimes(1)
	})

	test("未绑定手机号时不进入未接入的绑定流程", () => {
		const handleOpenPhone = vi.fn()

		render(
			<MobileSettingsAccountSecuritySheet
				open
				onClose={vi.fn()}
				onOpenPhone={handleOpenPhone}
				onOpenPassword={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-account-security-phone"))

		expect(screen.getByText("setting.notBind")).toBeTruthy()
		expect(handleOpenPhone).not.toHaveBeenCalled()
	})
})
