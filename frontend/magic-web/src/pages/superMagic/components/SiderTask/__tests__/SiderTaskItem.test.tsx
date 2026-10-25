import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import SiderTaskItem from "../SiderTaskItem"

vi.mock("antd", () => ({
	Switch: ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
		<button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} />
	),
}))
vi.mock("../styles", () => ({ useStyles: () => ({ styles: {}, cx: () => "" }) }))
vi.mock("@/components/base/MagicIcon", () => ({ default: () => null }))
vi.mock("../../ActionButton", () => ({
	default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>More</button>,
}))
it("opens task configuration from the row without intercepting switch or menu actions", () => {
	const onEdit = vi.fn()
	const onSwitchChange = vi.fn()
	const onDropdownActionClick = vi.fn()
	render(
		<SiderTaskItem
			data={{ id: "task-1", task_name: "Daily report", enabled: 1 } as never}
			onEdit={onEdit}
			onSwitchChange={onSwitchChange}
			onDropdownActionClick={onDropdownActionClick}
		/>,
	)
	fireEvent.click(screen.getByText("Daily report"))
	expect(onEdit).toHaveBeenCalledTimes(1)
	fireEvent.click(screen.getByRole("switch"))
	expect(onSwitchChange).toHaveBeenCalledWith(false)
	fireEvent.click(screen.getByRole("button", { name: "More" }))
	expect(onDropdownActionClick).toHaveBeenCalledTimes(1)
	expect(onEdit).toHaveBeenCalledTimes(1)
	fireEvent.keyDown(screen.getByTestId("handle-context-menu-click"), { key: "Enter" })
	expect(onEdit).toHaveBeenCalledTimes(2)
})
