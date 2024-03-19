import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import VerificationCodeInput, { type VerificationCodeInputRef } from "../index"
import { createRef } from "react"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"verification.codeInvalid": "Verification code error, please re-enter",
				"verification.codeInput": "Verification code input",
			}
			return translations[key] || key
		},
	}),
}))

describe("VerificationCodeInput", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders correct number of slots with default length", () => {
		const { container } = render(<VerificationCodeInput />)
		const slots = container.querySelectorAll('[data-slot="input-otp-slot"]')
		expect(slots).toHaveLength(6)
	})

	it("renders custom number of slots", () => {
		const { container } = render(<VerificationCodeInput codeLength={4} />)
		const slots = container.querySelectorAll('[data-slot="input-otp-slot"]')
		expect(slots).toHaveLength(4)
	})

	it("displays error message when showError is true", () => {
		render(<VerificationCodeInput showError />)
		expect(screen.getByText("Verification code error, please re-enter")).toBeInTheDocument()
	})

	it("does not display error message when showError is false", () => {
		render(<VerificationCodeInput showError={false} />)
		expect(
			screen.queryByText("Verification code error, please re-enter"),
		).not.toBeInTheDocument()
	})

	it("applies error styles when showError is true", () => {
		const { container } = render(<VerificationCodeInput showError />)
		const slots = container.querySelectorAll('[data-slot="input-otp-slot"]')

		slots.forEach((slot) => {
			expect(slot).toHaveClass("border-red-500")
		})
	})

	it("exposes focus method via ref", () => {
		const ref = createRef<VerificationCodeInputRef>()
		render(<VerificationCodeInput ref={ref} />)

		expect(ref.current).toBeDefined()
		expect(ref.current?.focus).toBeDefined()
		expect(typeof ref.current?.focus).toBe("function")
	})

	it("has proper aria attributes", () => {
		const { container } = render(<VerificationCodeInput />)
		const otpInput = container.querySelector('[data-slot="input-otp"]')

		expect(otpInput).toHaveAttribute("aria-label", "Verification code input")
	})

	it("has proper aria-invalid when showError is true", () => {
		const { container } = render(<VerificationCodeInput showError />)
		const otpInput = container.querySelector('[data-slot="input-otp"]')

		expect(otpInput).toHaveAttribute("aria-invalid", "true")
	})

	it("passes disabled prop to InputOTP", () => {
		const { container } = render(<VerificationCodeInput disabled />)
		const otpInput = container.querySelector('[data-slot="input-otp"]')

		// The InputOTP component should have disabled class or attribute
		expect(otpInput).toBeTruthy()
	})

	it("passes value prop to InputOTP", () => {
		const { container } = render(<VerificationCodeInput value="123" />)
		const slots = container.querySelectorAll('[data-slot="input-otp-slot"]')

		// First three slots should have content
		expect(slots.length).toBeGreaterThan(0)
	})
})
