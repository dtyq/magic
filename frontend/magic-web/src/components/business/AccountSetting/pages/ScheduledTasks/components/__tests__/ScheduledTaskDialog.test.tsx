import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useState } from "react"
import ScheduledTaskDialog from "../ScheduledTaskDialog"

function Example() {
	const [open, setOpen] = useState(false)
	return (
		<>
			<button onClick={() => setOpen(true)}>Configure</button>
			<ScheduledTaskDialog
				open={open}
				onClose={() => setOpen(false)}
				title="Task configuration"
			>
				<input aria-label="Task name" defaultValue="Original" />
			</ScheduledTaskDialog>
		</>
	)
}

describe("ScheduledTaskDialog", () => {
	it("closes with Escape and resets form contents when reopened", async () => {
		render(<Example />)
		fireEvent.click(screen.getByText("Configure"))
		expect(screen.getByRole("dialog", { name: "Task configuration" })).toBeInTheDocument()
		fireEvent.change(screen.getByLabelText("Task name"), { target: { value: "Edited" } })
		fireEvent.keyDown(screen.getByLabelText("Task name"), { key: "Escape" })
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		fireEvent.click(screen.getByText("Configure"))
		expect(screen.getByLabelText("Task name")).toHaveValue("Original")
	})
	it("routes the close button through the caller cleanup", () => {
		const close = vi.fn()
		render(
			<ScheduledTaskDialog open onClose={close} title="Run records" records>
				<span>Record</span>
			</ScheduledTaskDialog>,
		)
		fireEvent.click(screen.getByRole("button", { name: "Close" }))
		expect(close).toHaveBeenCalledTimes(1)
	})
})

vi.mock("antd", async (importOriginal) => ({
	...(await importOriginal<typeof import("antd")>()),
}))
