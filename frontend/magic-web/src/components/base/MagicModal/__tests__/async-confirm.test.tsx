import { act, fireEvent, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import MagicModalDesktop from "../MagicModalDesktop"

vi.mock("@/providers/ThemeProvider", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))

describe("async imperative confirmations", () => {
	it.each([false, true])(
		"locks while pending and recovers after rejection=%s",
		async (reject) => {
			let resolve!: () => void
			let fail!: (error: Error) => void
			const promise = new Promise<void>((done, error) => {
				resolve = done
				fail = error
			})
			const onOk = vi.fn().mockReturnValueOnce(promise)
			const onCancel = vi.fn()
			let modal!: ReturnType<typeof MagicModalDesktop.confirm>
			act(() => {
				modal = MagicModalDesktop.confirm({
					title: "Remove page?",
					content: "Keep source files",
					okText: "Confirm",
					cancelText: "Cancel",
					onOk,
					onCancel,
				})
			})
			try {
				fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
				const button = screen.getByRole("button", { name: "Confirm" })
				expect(button).toBeDisabled()
				expect(button).toHaveAttribute("aria-busy", "true")
				expect(button.querySelector(".animate-spin")).not.toBeNull()
				fireEvent.click(button)
				fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
				fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
				expect(onOk).toHaveBeenCalledOnce()
				expect(onCancel).not.toHaveBeenCalled()
				await act(async () => {
					if (reject) fail(new Error("failed"))
					else resolve()
					await promise.catch(() => undefined)
				})
				if (reject) {
					expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled()
					fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
					expect(onOk).toHaveBeenCalledTimes(2)
				}
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
			} finally {
				act(() => modal.destroy())
			}
		},
	)
})
