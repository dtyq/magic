import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../../app/providers/I18nProvider"
import LinkedFrameMediaMenu from "../LinkedFrameMediaMenu"

vi.mock("../../../../previews/reference-media/index", () => ({
	default: () => <div data-testid="linked-frame-preview" />,
}))

const item = {
	connectionId: "connection-image",
	sourceElementId: "image-element",
	kind: "image" as const,
	path: "./images/source.png",
	fileName: "source.png",
	status: "active" as const,
}

function renderMenu(
	bindings: Array<
		| {
				framePath: string
				sourceConnectionId: string
				sourcePath: string
				sourceKind: "image"
				sourceFileName: string
				frameRole: "start" | "end"
		  }
		| undefined
	>,
	slotIndex = 0,
	frameRole: "start" | "end" = "start",
) {
	const onSelect = vi.fn()
	const onClear = vi.fn()
	render(
		<CanvasDesignI18nProvider>
			<LinkedFrameMediaMenu
				items={[item]}
				bindings={bindings}
				slotIndex={slotIndex}
				frameRole={frameRole}
				onSelect={onSelect}
				onClear={onClear}
			/>
		</CanvasDesignI18nProvider>,
	)
	return { onSelect, onClear }
}

function binding(frameRole: "start" | "end") {
	return {
		framePath: item.path,
		sourceConnectionId: item.connectionId,
		sourcePath: item.path,
		sourceKind: "image" as const,
		sourceFileName: item.fileName,
		frameRole,
	}
}

describe("LinkedFrameMediaMenu", () => {
	it("directly selects an unassigned linked image for the active slot", () => {
		const { onSelect, onClear } = renderMenu([undefined], 0, "end")

		expect(screen.getByText("关联媒体")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "关联媒体" }))
		fireEvent.click(screen.getByRole("button", { name: /source\.png/ }))

		expect(onSelect).toHaveBeenCalledWith(item)
		expect(onClear).not.toHaveBeenCalled()
	})

	it("opens the secondary menu on hover", () => {
		renderMenu([undefined])

		fireEvent.mouseEnter(screen.getByRole("button", { name: "关联媒体" }))

		expect(screen.getByRole("button", { name: /source\.png/ })).toBeInTheDocument()
	})

	it("clears only the active slot when the linked image is already assigned", () => {
		const { onSelect, onClear } = renderMenu([binding("start"), binding("end")], 1, "end")

		fireEvent.click(screen.getByRole("button", { name: "关联媒体" }))
		const option = screen.getByRole("button", { name: /source\.png/ })
		expect(option).toHaveAttribute("aria-pressed", "true")
		expect(option).toHaveTextContent("首帧 · 尾帧")

		fireEvent.click(option)

		expect(onClear).toHaveBeenCalledTimes(1)
		expect(onSelect).not.toHaveBeenCalled()
	})
})
