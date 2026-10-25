import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ElementRenamePanel from "../ElementRenamePanel"

const mocks = vi.hoisted(() => ({
	canvas: {
		elementRenameManager: {
			cancelRename: vi.fn(),
			commitRename: vi.fn().mockResolvedValue(undefined),
		},
		elementManager: {
			getElementInstance: vi.fn(() => ({ getRenderName: () => "Rectangle 1" })),
		},
	},
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback?: string | Record<string, unknown>) =>
			typeof fallback === "string"
				? fallback
				: typeof fallback?.defaultValue === "string"
					? fallback.defaultValue
					: _key,
	}),
}))

vi.mock("../../../../app/hooks/layout/useCanvasSelectionFloatingPanel", () => ({
	default: () => ({ setRefs: vi.fn() }),
}))

vi.mock("../RenameNameField", () => ({
	default: (props: {
		id?: string
		value: string
		onChange: (value: string) => void
		onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
	}) => (
		<textarea
			id={props.id}
			aria-label="元素名称"
			value={props.value}
			onChange={(event) => props.onChange(event.target.value)}
			onKeyDown={props.onKeyDown}
		/>
	),
}))

describe("ElementRenamePanel", () => {
	it("uses the common name form without exposing a file-name field", async () => {
		const element = {
			id: "rectangle-1",
			type: "rectangle",
			name: "Rectangle 1",
		} as never

		render(<ElementRenamePanel element={element} />)

		expect(screen.getByRole("dialog", { name: "重命名" })).toBeInTheDocument()
		expect(screen.getByLabelText("元素名称")).toHaveValue("Rectangle 1")
		expect(screen.queryByText("文件名")).not.toBeInTheDocument()

		fireEvent.change(screen.getByLabelText("元素名称"), {
			target: { value: "Renamed rectangle" },
		})
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "确认重命名" }))
		})

		expect(mocks.canvas.elementRenameManager.commitRename).toHaveBeenCalledWith(
			"Renamed rectangle",
		)
	})
})
