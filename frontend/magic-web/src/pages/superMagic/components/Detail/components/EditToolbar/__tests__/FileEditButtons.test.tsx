import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ButtonHTMLAttributes, PropsWithChildren } from "react"
import FileEditButtons from "../FileEditButtons"

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/hooks/useHTMLGuideTour", () => ({
	HTMLGuideTourElementId: { HTMLFileEditButton: "html-file-edit-button" },
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		...props
	}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/kbd", () => ({
	Kbd: ({ children }: PropsWithChildren) => <span>{children}</span>,
}))

vi.mock("../ConditionalTooltip", () => ({
	default: ({ children }: PropsWithChildren) => children,
}))

describe("FileEditButtons", () => {
	it("exposes stable scoped test ids for view and edit states", () => {
		const { rerender } = render(<FileEditButtons testIdPrefix="html-editor" onEdit={vi.fn()} />)

		expect(screen.getByTestId("html-editor-file-actions")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-edit-button")).toBeInTheDocument()

		rerender(
			<FileEditButtons
				testIdPrefix="html-editor"
				isEditMode
				onSave={vi.fn()}
				onSaveAndExit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("html-editor-save-button")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-save-and-exit-button")).toBeInTheDocument()
		expect(screen.getByTestId("html-editor-cancel-button")).toBeInTheDocument()
	})

	it("ignores global edit shortcuts while interaction is disabled", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined)
		const onCancel = vi.fn()
		const { rerender } = render(
			<FileEditButtons
				interactionDisabled
				isEditMode
				showButtonText
				onSave={onSave}
				onCancel={onCancel}
			/>,
		)

		fireEvent.keyDown(document, { key: "s", ctrlKey: true })
		fireEvent.keyDown(document, { key: "Escape" })
		expect(onSave).not.toHaveBeenCalled()
		expect(onCancel).not.toHaveBeenCalled()

		rerender(<FileEditButtons isEditMode showButtonText onSave={onSave} onCancel={onCancel} />)

		fireEvent.keyDown(document, { key: "s", ctrlKey: true })
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

		fireEvent.keyDown(document, { key: "Escape" })
		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it("re-enables saving after a handler throws synchronously", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		const onSave = vi
			.fn<() => void | Promise<void>>()
			.mockImplementationOnce(() => {
				throw new Error("sync failure")
			})
			.mockResolvedValue(undefined)
		render(<FileEditButtons isEditMode showButtonText onSave={onSave} />)

		fireEvent.keyDown(document, { key: "s", ctrlKey: true })
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

		fireEvent.keyDown(document, { key: "s", ctrlKey: true })
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
	})

	it("cancels from the button without throwing when Escape has no mouse event", () => {
		const onCancel = vi.fn()
		render(
			<FileEditButtons
				testIdPrefix="html-editor"
				isEditMode
				showButtonText
				onSave={vi.fn()}
				onCancel={onCancel}
			/>,
		)

		fireEvent.click(screen.getByTestId("html-editor-cancel-button"))
		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it("adapts button padding based on showButtonText", () => {
		const { rerender } = render(
			<FileEditButtons testIdPrefix="html-editor" showButtonText={true} onEdit={vi.fn()} />,
		)

		const editBtnWithText = screen.getByTestId("html-editor-edit-button")
		expect(editBtnWithText.className).toContain("px-3")
		expect(editBtnWithText.className).toContain("gap-1.5")

		rerender(
			<FileEditButtons testIdPrefix="html-editor" showButtonText={false} onEdit={vi.fn()} />,
		)

		const editBtnIconOnly = screen.getByTestId("html-editor-edit-button")
		expect(editBtnIconOnly.className).toContain("px-1.5")
		expect(editBtnIconOnly.className).toContain("gap-0")
	})
})

it("does not paint saving while the handler is in flight", async () => {
	let resolveSave: (() => void) | undefined
	const onSave = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				resolveSave = resolve
			}),
	)
	render(
		<FileEditButtons
			testIdPrefix="html-editor"
			isEditMode
			showButtonText
			onSave={onSave}
			onCancel={vi.fn()}
		/>,
	)
	fireEvent.click(screen.getByTestId("html-editor-save-button"))
	expect(onSave).toHaveBeenCalledTimes(1)
	expect(screen.getByTestId("html-editor-save-button")).toHaveTextContent("fileViewer.save")
	expect(screen.queryByText("fileViewer.saving")).toBeNull()
	resolveSave?.()
	await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
})
