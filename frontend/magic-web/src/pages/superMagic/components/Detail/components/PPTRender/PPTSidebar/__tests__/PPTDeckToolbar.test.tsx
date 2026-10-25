import { act, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import PPTDeckToolbar from "../PPTDeckToolbar"
import type { PPTDeckTools } from "../../hooks/usePPTDeckTools"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuItem: ({
		children,
		onSelect,
		disabled,
	}: {
		children: ReactNode
		onSelect: () => void
		disabled?: boolean
	}) => (
		<button disabled={disabled} onClick={onSelect}>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => null,
}))
vi.mock("@/components/shadcn-ui/dialog", () => ({
	Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
		open ? <>{children}</> : null,
	DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
	DialogHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
	DialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
	DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	DialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function makeTools() {
	return {
		selected: new Set(["first"]),
		selecting: true,
		busy: false,
		setSelecting: vi.fn(),
		clearSelection: vi.fn(),
		selectAll: vi.fn(),
		deselectAll: vi.fn(),
		isAllSelected: false,
		duplicate: vi.fn(),
		setHidden: vi.fn(),
		move: vi.fn(),
		remove: vi.fn(),
		cancel: vi.fn(),
	} as unknown as PPTDeckTools
}

describe("PPTDeckToolbar", () => {
	it("switches between select all and deselect all without a clear button", () => {
		const tools = makeTools()
		const { rerender } = render(
			<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />,
		)
		expect(screen.queryByText("ppt.batch.clear")).not.toBeInTheDocument()
		expect(screen.getByRole("checkbox", { name: "ppt.batch.selectAll" })).toHaveAttribute(
			"aria-checked",
			"mixed",
		)
		fireEvent.click(screen.getByText("ppt.batch.selectAll"))
		expect(tools.selectAll).toHaveBeenCalledOnce()
		tools.isAllSelected = true
		rerender(<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />)
		expect(screen.queryByText("ppt.batch.selectAll")).not.toBeInTheDocument()
		expect(screen.getByRole("checkbox", { name: "ppt.deselectAll" })).toBeChecked()
		fireEvent.click(screen.getByText("ppt.deselectAll"))
		expect(tools.deselectAll).toHaveBeenCalledOnce()
		expect(tools.clearSelection).not.toHaveBeenCalled()
		tools.isAllSelected = false
		tools.selected = new Set()
		rerender(<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />)
		expect(screen.getByRole("checkbox", { name: "ppt.batch.selectAll" })).not.toBeChecked()
	})

	it("requires confirmation to remove a frozen set of files and explains source retention", async () => {
		const tools = makeTools()
		let finish!: () => void
		vi.mocked(tools.remove).mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve
			}),
		)
		const { rerender } = render(
			<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />,
		)
		fireEvent.click(screen.getByText("ppt.batch.remove"))
		expect(tools.remove).not.toHaveBeenCalled()
		expect(screen.getByText("ppt.batch.removeDescription")).toBeInTheDocument()
		tools.selected = new Set(["second"])
		rerender(<PPTDeckToolbar tools={tools} allowEdit slideCount={3} isMobile={false} />)
		fireEvent.click(within(screen.getByRole("dialog")).getByText("ppt.batch.remove"))
		expect(tools.remove).toHaveBeenCalledWith(new Set(["first"]))
		const confirm = within(screen.getByRole("dialog")).getByText("ppt.batch.remove")
		expect(confirm).toBeDisabled()
		expect(confirm).toHaveAttribute("aria-busy", "true")
		expect(confirm.querySelector(".animate-spin")).not.toBeNull()
		fireEvent.click(confirm)
		expect(tools.remove).toHaveBeenCalledOnce()
		await act(async () => finish())
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("keeps search and write actions absent in a read-only deck", () => {
		const tools = makeTools()
		render(<PPTDeckToolbar tools={tools} allowEdit={false} slideCount={3} isMobile={false} />)
		expect(screen.queryByText("ppt.batch.search")).not.toBeInTheDocument()
		expect(screen.queryByText("ppt.batch.copy")).not.toBeInTheDocument()
		expect(screen.queryByText("ppt.batch.remove")).not.toBeInTheDocument()
	})

	it("disables removing the final page and sends move gaps to the shared owner", () => {
		const tools = makeTools()
		render(<PPTDeckToolbar tools={tools} allowEdit slideCount={1} isMobile={false} />)
		expect(screen.getByText("ppt.batch.remove")).toBeDisabled()
		fireEvent.click(screen.getByText("ppt.batch.moveLast"))
		expect(tools.move).toHaveBeenCalledWith(1)
		fireEvent.click(screen.getByText("ppt.batch.hide"))
		expect(tools.setHidden).toHaveBeenCalledWith(true)
	})
})
