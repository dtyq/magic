import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { VerificationCode } from "@/constants/bussiness"
import VerificationCodeButton from "../index"

const triggerMocks = vi.hoisted(() => ({
	trigger: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: (ns?: string) => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (ns === "message") return key
			if (key === "afterSecondsCan") {
				return `${options?.seconds} 秒后可重新发送`
			}
			if (key === "sendVerificationCode") return "发送验证码"
			if (key === "reSendVerificationCode") return "重新发送验证码"
			return key
		},
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn() },
}))

/** Lightweight MagicButton stub so we can assert loading/disabled without Ant Design theme. */
vi.mock("@/components/base/MagicButton", () => ({
	default: ({
		children,
		loading,
		disabled,
		onClick,
		className,
		"data-testid": dataTestId,
	}: {
		children?: ReactNode
		loading?: boolean
		disabled?: boolean
		onClick?: () => void
		className?: string
		"data-testid"?: string
	}) => (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-loading={loading ? "true" : "false"}
			className={className}
			data-testid={dataTestId}
		>
			{children}
		</button>
	),
}))

describe("VerificationCodeButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		triggerMocks.trigger.mockReset()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test("keeps send label visible while request is in flight", async () => {
		let resolveTrigger: (() => void) | undefined
		triggerMocks.trigger.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveTrigger = resolve
				}),
		)

		render(
			<VerificationCodeButton
				phone="13800000000"
				codeType={VerificationCode.ChangePhone}
				trigger={triggerMocks.trigger}
			/>,
		)

		fireEvent.click(screen.getByTestId("verification-code-button"))

		const button = screen.getByTestId("verification-code-button")
		// Label must stay mounted during loading so full-width buttons do not collapse.
		expect(button.textContent?.trim()).not.toBe("")
		expect(button).toHaveAttribute("data-loading", "true")

		resolveTrigger?.()
		await waitFor(() => {
			expect(screen.getByTestId("verification-code-button")).toHaveAttribute(
				"data-loading",
				"false",
			)
		})
	})

	test("shows countdown copy and disables button after send succeeds", async () => {
		triggerMocks.trigger.mockResolvedValue(undefined)

		render(
			<VerificationCodeButton
				phone="13800000000"
				codeType={VerificationCode.ChangePhone}
				during={60}
				trigger={triggerMocks.trigger}
			/>,
		)

		fireEvent.click(screen.getByTestId("verification-code-button"))

		await waitFor(() => {
			expect(screen.getByText(/60 秒后可重新发送/)).toBeInTheDocument()
		})

		expect(screen.getByTestId("verification-code-button")).toBeDisabled()
	})
})
