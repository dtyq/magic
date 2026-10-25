import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ListFilterPanel } from "../../../src/components/list-filter-panel"

const viewport = vi.hoisted(() => ({ mobile: true }))
vi.mock("@magic-admin-v2/hooks/use-is-mobile", () => ({ useIsMobile: () => viewport.mobile }))

type Draft = { name: string; code: string }

const createDefaultValue = (): Draft => ({ name: "", code: "" })

function renderPanel(props: {
	onChange?: (patch: Partial<Draft>) => void
	onReset?: () => void
	value?: Draft
}) {
	return render(
		<ListFilterPanel<Draft>
			applyLabel="apply"
			createDefaultValue={createDefaultValue}
			onChange={props.onChange ?? vi.fn()}
			onReset={props.onReset ?? vi.fn()}
			renderFields={({ onChange, value }) => (
				<>
					<input
						aria-label="name"
						onChange={(event) => onChange({ name: event.target.value })}
						value={value.name}
					/>
					<input
						aria-label="code"
						onChange={(event) => onChange({ code: event.target.value })}
						value={value.code}
					/>
				</>
			)}
			resetLabel="reset"
			title="search"
			value={props.value ?? createDefaultValue()}
		/>,
	)
}

afterEach(() => {
	cleanup()
	viewport.mobile = true
})

it("collapses mobile fields and applies the draft only after confirmation", () => {
	const onChange = vi.fn()
	renderPanel({ onChange })

	expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
	fireEvent.click(screen.getByRole("button", { name: "search" }))
	const panel = screen.getByRole("dialog")
	expect(panel).toHaveClass("bottom-0", "h-[85vh]", "max-h-[85vh]", "rounded-t-xl")
	expect(panel).not.toHaveClass("right-0")
	fireEvent.change(within(panel).getByRole("textbox", { name: "name" }), {
		target: { value: "magic" },
	})
	expect(onChange).not.toHaveBeenCalled()

	fireEvent.click(within(panel).getByRole("button", { name: "apply" }))
	expect(onChange).toHaveBeenCalledWith({ name: "magic", code: "" })
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("discards dismissed edits and resets the draft inside the panel", () => {
	const onChange = vi.fn()
	renderPanel({ onChange, value: { name: "applied", code: "" } })
	const open = () => fireEvent.click(screen.getByRole("button", { name: "search" }))

	open()
	fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "draft" } })
	fireEvent.click(screen.getByRole("button", { name: "Close" }))
	open()
	expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("applied")

	fireEvent.click(screen.getByRole("button", { name: "reset" }))
	expect(screen.getByRole("textbox", { name: "name" })).toHaveValue("")
	expect(onChange).not.toHaveBeenCalled()
	fireEvent.click(screen.getByRole("button", { name: "apply" }))
	expect(onChange).toHaveBeenCalledWith({ name: "", code: "" })
})

it("renders desktop fields directly and applies edits immediately", () => {
	viewport.mobile = false
	const onChange = vi.fn()
	const onReset = vi.fn()
	renderPanel({ onChange, onReset })

	expect(screen.getAllByRole("textbox")).toHaveLength(2)
	expect(screen.queryByRole("button", { name: "search" })).not.toBeInTheDocument()
	fireEvent.change(screen.getByRole("textbox", { name: "code" }), { target: { value: "c1" } })
	expect(onChange).toHaveBeenCalledWith({ code: "c1" })
	fireEvent.click(screen.getByRole("button", { name: "reset" }))
	expect(onReset).toHaveBeenCalledOnce()
})
