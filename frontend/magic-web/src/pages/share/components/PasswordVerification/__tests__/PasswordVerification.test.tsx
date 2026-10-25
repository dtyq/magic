import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PasswordVerification from "../index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("antd", async () => {
	const React = await import("react")
	return {
		Input: ({ value, onChange, onKeyDown, maxLength, placeholder, ...props }: any) =>
			React.createElement("input", {
				value,
				onChange,
				onKeyDown,
				maxLength,
				placeholder,
				...props,
			}),
		Button: ({ children, onClick, loading: _loading, ...props }: any) =>
			React.createElement("button", { type: "button", onClick, ...props }, children),
	}
})

vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			container: "container",
			icon: "icon",
			title: "title",
			description: "description",
			inputContainer: "input-container",
			input: "input",
			button: "button",
		},
	}),
}))

describe("PasswordVerification", () => {
	it("keeps default six-character uppercase behavior", () => {
		render(
			<PasswordVerification
				resourceId="resource-1"
				onVerifySuccess={vi.fn()}
				getShareData={vi.fn()}
			/>,
		)

		fireEvent.change(screen.getByTestId("password-input"), {
			target: { value: "abcd1234" },
		})

		expect(screen.getByTestId("password-input")).toHaveValue("ABCD12")
		expect(screen.queryByTestId("password-remember-checkbox")).not.toBeInTheDocument()
	})

	it("supports configurable micro app password length without uppercasing", () => {
		render(
			<PasswordVerification
				resourceId="resource-1"
				onVerifySuccess={vi.fn()}
				getShareData={vi.fn()}
				maxLength={32}
				uppercase={false}
			/>,
		)

		fireEvent.change(screen.getByTestId("password-input"), {
			target: { value: "abcd1234efgh5678ijkl9012mnop3456ZZ" },
		})

		expect(screen.getByTestId("password-input")).toHaveValue("abcd1234efgh5678ijkl9012mnop3456")
	})

	it("shows the optional remember-password control only when configured", () => {
		const onCheckedChange = vi.fn()
		render(
			<PasswordVerification
				resourceId="resource-1"
				onVerifySuccess={vi.fn()}
				getShareData={vi.fn()}
				rememberPassword={{ enabled: true, checked: false, onCheckedChange }}
			/>,
		)

		fireEvent.click(screen.getByTestId("password-remember-checkbox"))
		expect(onCheckedChange).toHaveBeenCalledWith(true)
	})
})
