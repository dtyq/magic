import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import MicroAppListTransition from "../MicroAppListTransition"

it("keeps content mounted but blocks interaction until the new results are ready", () => {
	const onClick = vi.fn()
	const view = render(
		<MicroAppListTransition loading={false}>
			<button onClick={onClick}>App</button>
		</MicroAppListTransition>,
	)
	const button = screen.getByRole("button")
	view.rerender(
		<MicroAppListTransition loading>
			<button onClick={onClick}>App</button>
		</MicroAppListTransition>,
	)
	expect(screen.getByRole("button")).toBe(button)
	expect(button.parentElement).toHaveAttribute("inert")
	fireEvent.click(button)
	expect(onClick).not.toHaveBeenCalled()
	view.rerender(
		<MicroAppListTransition loading={false}>
			<button onClick={onClick}>App</button>
		</MicroAppListTransition>,
	)
	expect(button.parentElement).not.toHaveAttribute("inert")
	fireEvent.click(button)
	expect(onClick).toHaveBeenCalledOnce()
})
