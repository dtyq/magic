import { useRef } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import useElementToolPopoverAlign from "../useElementToolPopoverAlign"

function Harness({ open, side }: { open: boolean; side: "top" | "bottom" }) {
	const floatingRef = useRef<HTMLDivElement | null>(null)
	const { align, contentRef } = useElementToolPopoverAlign({ open, floatingRef })

	if (!open) return <div data-testid="alignment">{align}</div>

	return (
		<div ref={contentRef} data-testid="alignment" data-side={side}>
			{align}
		</div>
	)
}

describe("useElementToolPopoverAlign", () => {
	it("uses right alignment above and left alignment after flipping below", async () => {
		const { rerender } = render(<Harness open side="top" />)

		expect(screen.getByTestId("alignment")).toHaveTextContent("end")

		rerender(<Harness open side="bottom" />)
		await waitFor(() => {
			expect(screen.getByTestId("alignment")).toHaveTextContent("start")
		})

		rerender(<Harness open side="top" />)
		await waitFor(() => {
			expect(screen.getByTestId("alignment")).toHaveTextContent("end")
		})
	})

	it("resets to the preferred top alignment when closed", async () => {
		const { rerender } = render(<Harness open side="bottom" />)

		await waitFor(() => {
			expect(screen.getByTestId("alignment")).toHaveTextContent("start")
		})

		rerender(<Harness open={false} side="bottom" />)
		await waitFor(() => {
			expect(screen.getByTestId("alignment")).toHaveTextContent("end")
		})
	})
})
