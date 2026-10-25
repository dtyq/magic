import { createRef, forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { InputRef } from "antd"
import type { FilePresentation } from "../../../utils/file-presentation"
import type { useRename } from "../../../hooks/useRename"
import { FileManagerItem } from "../FileManagerItem"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({
		children,
		menu,
	}: {
		children: ReactNode
		menu?: {
			items?: Array<{
				key?: string
				label?: ReactNode
				onClick?: () => void
			} | null>
		}
	}) => (
		<div>
			{children}
			{menu?.items?.map((item) =>
				item?.key ? (
					<button
						key={String(item.key)}
						type="button"
						data-testid={`file-manager-menu-${item.key}`}
						onClick={() => item.onClick?.()}
					>
						{item.label}
					</button>
				) : null,
			)}
		</div>
	),
}))

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("../../FileResourceIcon", () => ({
	FileResourceIcon: () => <span>icon</span>,
}))

vi.mock("../../TopicFileTag", () => ({
	ProjectFileTag: () => null,
}))

vi.mock("@/components/shadcn-ui/tooltip", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => children,
	TooltipTrigger: ({ children }: { children: ReactNode }) => children,
	TooltipContent: () => null,
}))

vi.mock("../../InputWithError", () => ({
	default: forwardRef<
		InputRef,
		{ value?: string; onBlur?: () => void; onFocus?: () => void; errorMessage?: string }
	>(function MockInputWithError({ value, onBlur, onFocus, errorMessage, ...props }, ref) {
		// Drop errorMessage so it is not forwarded as a DOM attribute.
		void errorMessage
		const inputRef = useRef<HTMLInputElement>(null)
		useImperativeHandle(ref, () => ({
			input: inputRef.current as HTMLInputElement,
			focus: () => inputRef.current?.focus(),
			blur: () => inputRef.current?.blur(),
			setSelectionRange: () => undefined,
		}))
		return (
			<input
				ref={inputRef}
				data-testid="file-manager-rename-input"
				value={value}
				onBlur={onBlur}
				onFocus={onFocus}
				{...props}
			/>
		)
	}),
}))

const presentation: FilePresentation = {
	item: {
		file_id: "mock-file-1",
		file_name: "mock-document.docx",
		name: "mock-document.docx",
		is_directory: false,
	},
	name: "mock-document.docx",
	path: "mock-folder/mock-document.docx",
	context: { kind: "project", projectId: "mock-project-1" },
	isDirectory: false,
	type: "docx",
}

/** Build a rename controller with fake file ids and names for tests. */
function createRenameMock(
	overrides: Partial<ReturnType<typeof useRename>> = {},
): ReturnType<typeof useRename> {
	return {
		renamePending: false,
		isRenamePending: () => false,
		renamingItemId: "mock-file-1",
		renameValue: "mock-document.docx",
		setRenameValue: vi.fn(),
		renameInputRef: createRef<InputRef>(),
		renamingFileIds: new Set(),
		renameErrorMessage: "",
		handleStartRename: vi.fn(),
		handleRenameConfirm: vi.fn(),
		handleRenameCancel: vi.fn(),
		handleRenameKeyDown: vi.fn(),
		getItemId: vi.fn(),
		isFileRenaming: vi.fn(),
		resetRename: vi.fn(),
		...overrides,
	}
}

const itemProps = {
	columns: ["name" as const],
	getColumnText: () => "",
	showActions: false,
	onToggleFolder: () => undefined,
	id: "mock-row-1",
	presentation,
	view: "list" as const,
	selected: true,
	focused: true,
	onSelect: () => undefined,
	onOpen: () => undefined,
	getPopupContainer: () => document.body,
}

describe("FileManagerItem rename", () => {
	it("enters inline rename after the context menu rename action is clicked", () => {
		function RenameFromMenu() {
			const [renaming, setRenaming] = useState(false)
			return (
				<FileManagerItem
					{...itemProps}
					rename={renaming ? createRenameMock() : undefined}
					menuItems={[
						{
							key: "rename",
							label: "Rename",
							onClick: () => setRenaming(true),
						},
					]}
				/>
			)
		}

		render(<RenameFromMenu />)
		fireEvent.click(screen.getByTestId("file-manager-menu-rename"))
		expect(screen.getByTestId("file-manager-rename-input")).toBeTruthy()
	})

	it("does not cancel rename when the input blurs before it has been focused", () => {
		const rename = createRenameMock()
		render(
			<FileManagerItem
				{...itemProps}
				rename={rename}
				menuItems={[{ key: "rename", label: "Rename" }]}
			/>,
		)

		fireEvent.blur(screen.getByTestId("file-manager-rename-input"))
		expect(rename.handleRenameCancel).not.toHaveBeenCalled()
	})

	it("cancels rename after the input has been focused and then blurs", () => {
		const rename = createRenameMock()
		render(
			<FileManagerItem
				{...itemProps}
				rename={rename}
				menuItems={[{ key: "rename", label: "Rename" }]}
			/>,
		)

		const input = screen.getByTestId("file-manager-rename-input")
		fireEvent.focus(input)
		fireEvent.blur(input)
		expect(rename.handleRenameCancel).toHaveBeenCalledTimes(1)
	})

	it("keeps the rename input inside the name slot", () => {
		render(
			<FileManagerItem
				{...itemProps}
				rename={createRenameMock()}
				menuItems={[{ key: "rename", label: "Rename" }]}
			/>,
		)

		const root = screen
			.getByTestId("file-manager-rename-input")
			.closest("[data-manager-rename]")
		expect(root?.className).toContain("max-w-full")
		expect(root?.className).toContain("w-full")
		expect(root?.className).toContain("min-w-0")
	})

	it("sizes the grid rename editor from one line up to two without scrolling", () => {
		render(
			<FileManagerItem
				{...itemProps}
				view="grid"
				rename={createRenameMock({
					renameValue: "mock-very-long-filename-that-wraps-to-two-lines.docx",
				})}
				menuItems={[{ key: "rename", label: "Rename" }]}
			/>,
		)

		const input = screen.getByTestId("file-manager-rename-input") as HTMLTextAreaElement
		expect(input.tagName).toBe("TEXTAREA")
		expect(input.getAttribute("rows")).toBe("1")
		// 17px line + 1px padding + 1px border on each side, so two lines fit inside border-box.
		expect(input.style.minHeight).toBe("21px")
		expect(input.style.maxHeight).toBe("38px")
		expect(input.style.overflowY).toBe("hidden")
		expect(input.style.overflowX).toBe("hidden")
	})

	it("does not cancel when blur moves focus to the row trigger ancestor", () => {
		const rename = createRenameMock()
		render(
			<FileManagerItem
				{...itemProps}
				rename={rename}
				menuItems={[{ key: "rename", label: "Rename" }]}
			/>,
		)

		const input = screen.getByTestId("file-manager-rename-input")
		const trigger = input.closest("[data-manager-item]")?.parentElement
		fireEvent.focus(input)
		fireEvent.blur(input, { relatedTarget: trigger })
		expect(rename.handleRenameCancel).not.toHaveBeenCalled()
	})
})
