import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createContext, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReviewActionDialogs } from "@magic-admin-v2/features/platform-publish-review/components/review-action-dialogs"

// The action-dialog contract is independent of Radix's portal/focus machinery.
// Use a native select here so this test exercises the real onValueChange wiring
// without leaving jsdom focus tasks pending after the dialog closes.
vi.mock("@magic-admin-v2/components/ui/select", () => {
	function Select({
		children,
		disabled,
		onValueChange,
		value,
	}: {
		children: ReactNode
		disabled?: boolean
		onValueChange?: (value: string) => void
		value?: string
	}) {
		return (
			<select
			disabled={disabled}
			value={value}
			onChange={(event) => onValueChange?.(event.target.value)}
			aria-label="publisher type"
		>
			{children}
		</select>
		)
	}

	function SelectContent({ children }: { children: ReactNode }) {
		return <>{children}</>
	}

	function SelectItem({ children, value }: { children: ReactNode; value: string }) {
		return <option value={value}>{children}</option>
	}

	return {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger: () => null,
		SelectValue: () => null,
	}
})

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
	toast: { error: toastError },
}))

vi.mock("@magic-admin-v2/runtime/context", () => ({
  RuntimeContext: createContext(null),
	useRuntime: () => ({
		organization: { current: { organizationCode: "CUSTOM-ORG" } },
	}),
}))

Object.defineProperty(Element.prototype, "scrollIntoView", {
	configurable: true,
	value: vi.fn(),
})

for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
	Object.defineProperty(Element.prototype, method, {
		configurable: true,
		value: method === "hasPointerCapture" ? vi.fn(() => false) : vi.fn(),
	})
}

const record = {
	created_at: "2026-08-25 10:00:00",
	id: "review-1",
	publish_status: "UNPUBLISHED",
	publish_target_type: "ORGANIZATION",
	review_status: "UNDER_REVIEW",
	version: "1.0.0",
}

afterEach(() => {
	vi.clearAllMocks()
})

describe("publish review action dialogs", () => {
	it("submits approval with the selected publisher type and closes on success", async () => {
		const rerenderRef: { current?: ReturnType<typeof render>["rerender"] } = {}
		const onConfirm = vi.fn().mockResolvedValue(undefined)
		const onClose = vi.fn(() => {
			rerenderRef.current?.(
				<ReviewActionDialogs
					dialogState={null}
					isPending={false}
					onClose={onClose}
					onConfirm={onConfirm}
					variant="platform"
				/>,
			)
		})

		const rendered = render(
			<ReviewActionDialogs
				dialogState={{ action: "APPROVED", record }}
				isPending={false}
				onClose={onClose}
				onConfirm={onConfirm}
				variant="platform"
			/>,
		)
		rerenderRef.current = rendered.rerender

		const dialog = screen.getByRole("alertdialog")
		const select = within(dialog).getByRole("combobox")
		fireEvent.change(select, { target: { value: "OFFICIAL" } })
		fireEvent.click(within(dialog).getByRole("button", { name: "publishReview.action.confirmApprove" }))

		expect(onConfirm).toHaveBeenCalledWith({
			action: "APPROVED",
			publisherType: "OFFICIAL",
			record,
		})
		await onConfirm.mock.results[0].value
		await Promise.resolve()
		expect(onClose).toHaveBeenCalledTimes(1)
		rendered.unmount()
	})

	it("keeps the approval dialog open and reports the error when approval fails", async () => {
		const onClose = vi.fn()
		const onConfirm = vi.fn().mockRejectedValue(new Error("review failed"))

		render(
			<ReviewActionDialogs
				dialogState={{ action: "APPROVED", record }}
				isPending={false}
				onClose={onClose}
				onConfirm={onConfirm}
				variant="platform"
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "publishReview.action.confirmApprove" }))
		await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
		expect(onClose).not.toHaveBeenCalled()
		expect(toastError).toHaveBeenCalledWith("review failed")
		expect(screen.getByRole("alertdialog")).toBeInTheDocument()
	})

	it("submits a trimmed rejection remark for internal review", async () => {
		const onClose = vi.fn()
		const onConfirm = vi.fn().mockResolvedValue(undefined)

		render(
			<ReviewActionDialogs
				dialogState={{ action: "REJECTED", record }}
				isPending={false}
				onClose={onClose}
				onConfirm={onConfirm}
				variant="internal"
			/>,
		)

		const dialog = screen.getByRole("alertdialog")
		fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "  invalid content  " } })
		fireEvent.click(within(dialog).getByRole("button", { name: "publishReview.action.confirmReject" }))

		await waitFor(() =>
			expect(onConfirm).toHaveBeenCalledWith({
				action: "REJECTED",
				reviewRemark: "  invalid content  ",
				record,
			}),
		)
		expect(onClose).toHaveBeenCalledTimes(1)
	})
})
