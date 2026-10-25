import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import type { CanvasLayersFilterState } from "../../../../public/magic-types"
import LayersFilterPopover, { LayersFilterForm } from "../LayersFilterPopover"

const defaultFilter: CanvasLayersFilterState = {
	visibility: "all",
	locked: "all",
	types: [],
}

function StatefulFilterPopover({
	filter = defaultFilter,
	onFilterChange = vi.fn(),
	onReset = vi.fn(),
}: {
	filter?: CanvasLayersFilterState
	onFilterChange?: <K extends keyof CanvasLayersFilterState>(
		key: K,
		value: CanvasLayersFilterState[K],
	) => void
	onReset?: () => void
}) {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<CanvasDesignI18nProvider>
			<LayersFilterPopover
				filter={filter}
				isActive={
					filter.visibility !== "all" ||
					filter.locked !== "all" ||
					filter.types.length > 0
				}
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				onFilterChange={onFilterChange}
				onReset={onReset}
			/>
		</CanvasDesignI18nProvider>
	)
}

describe("LayersFilterPopover", () => {
	it("opens the filter popover to the right of the trigger", () => {
		render(<StatefulFilterPopover />)

		fireEvent.click(screen.getByRole("button", { name: "筛选图层" }))

		expect(screen.getByRole("button", { name: "筛选图层" })).toHaveAttribute(
			"aria-expanded",
			"true",
		)
		expect(screen.getByText("筛选")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "重置" })).toBeDisabled()
		expect(screen.getByText("可见状态")).toBeInTheDocument()
		expect(screen.getByText("锁定状态")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "元素类型" })).toBeInTheDocument()
	})

	it("forwards status, type and reset interactions", () => {
		const onFilterChange = vi.fn()
		const onReset = vi.fn()

		const { rerender } = render(
			<CanvasDesignI18nProvider>
				<LayersFilterForm
					filter={defaultFilter}
					isActive={false}
					onFilterChange={onFilterChange}
					onReset={onReset}
				/>
			</CanvasDesignI18nProvider>,
		)
		fireEvent.click(screen.getByRole("radio", { name: "隐藏" }))
		fireEvent.click(screen.getByRole("button", { name: "元素类型" }))
		fireEvent.click(screen.getByRole("option", { name: "图片" }))

		expect(onFilterChange).toHaveBeenCalledWith("visibility", "hidden")
		expect(onFilterChange).toHaveBeenCalledWith("types", [ElementTypeEnum.Image])
		expect(screen.getByRole("button", { name: "重置" })).toBeDisabled()

		rerender(
			<CanvasDesignI18nProvider>
				<LayersFilterForm
					filter={{
						visibility: "hidden",
						locked: "all",
						types: [ElementTypeEnum.Image],
					}}
					isActive
					onFilterChange={onFilterChange}
					onReset={onReset}
				/>
			</CanvasDesignI18nProvider>,
		)
		fireEvent.click(screen.getByRole("button", { name: "重置" }))
		expect(onReset).toHaveBeenCalledTimes(1)
	})
})
