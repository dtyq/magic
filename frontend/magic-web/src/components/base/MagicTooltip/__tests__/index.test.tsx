import {
	cloneElement,
	createContext,
	isValidElement,
	useContext,
	type ReactElement,
	type ReactNode,
} from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MagicTooltip from "../index"

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

interface MockTooltipContextValue {
	open: boolean
	onOpenChange?: (open: boolean) => void
}

const MockTooltipContext = createContext<MockTooltipContextValue>({ open: false })

vi.mock("@/components/shadcn-ui/tooltip", () => ({
	/** Controlled root that records the open request MagicTooltip accepts or rejects. */
	Tooltip: function MockTooltip({
		open = false,
		onOpenChange,
		children,
	}: {
		open?: boolean
		onOpenChange?: (open: boolean) => void
		children: ReactNode
	}) {
		return (
			<MockTooltipContext.Provider value={{ open, onOpenChange }}>
				{children}
			</MockTooltipContext.Provider>
		)
	},
	/** Forwards trigger events and immediately requests open, standing in for Radix. */
	TooltipTrigger: function MockTooltipTrigger({
		children,
		onPointerEnter,
		onPointerDown,
		onFocus,
	}: {
		children: ReactElement
		onPointerEnter?: React.PointerEventHandler
		onPointerDown?: React.PointerEventHandler
		onFocus?: React.FocusEventHandler
	}) {
		const { onOpenChange } = useContext(MockTooltipContext)
		if (!isValidElement(children)) return children
		const childProps = children.props as {
			onPointerEnter?: React.PointerEventHandler
			onPointerDown?: React.PointerEventHandler
			onFocus?: React.FocusEventHandler
		}
		// Compose like Radix Slot so child-owned handlers still run.
		return cloneElement(children, {
			onPointerEnter: (event: React.PointerEvent) => {
				childProps.onPointerEnter?.(event)
				onPointerEnter?.(event)
				onOpenChange?.(true)
			},
			onPointerDown: (event: React.PointerEvent) => {
				childProps.onPointerDown?.(event)
				onPointerDown?.(event)
			},
			onFocus: (event: React.FocusEvent) => {
				childProps.onFocus?.(event)
				onFocus?.(event)
				onOpenChange?.(true)
			},
		} as never)
	},
	/** Renders the title only while MagicTooltip keeps the tip open. */
	TooltipContent: function MockTooltipContent({ children }: { children: ReactNode }) {
		const { open } = useContext(MockTooltipContext)
		if (!open) return null
		return <div role="tooltip">{children}</div>
	},
}))

/** Render a titled icon button so click, hover, and keyboard tooltip rules can be asserted. */
function renderIconTooltip() {
	return render(
		<MagicTooltip title="sidebarPanels.projectManager">
			<button type="button">open manager</button>
		</MagicTooltip>,
	)
}

describe("MagicTooltip", () => {
	it("shows on hover", () => {
		renderIconTooltip()

		fireEvent.pointerEnter(screen.getByRole("button", { name: "open manager" }))

		expect(screen.getByRole("tooltip")).toHaveTextContent("sidebarPanels.projectManager")
	})

	it("closes on pointer down and does not reopen from the following click-focus", () => {
		renderIconTooltip()
		const trigger = screen.getByRole("button", { name: "open manager" })

		fireEvent.pointerEnter(trigger)
		expect(screen.getByRole("tooltip")).toBeInTheDocument()

		fireEvent.pointerDown(trigger)
		fireEvent.focus(trigger)

		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
	})

	it("shows on keyboard focus-visible", () => {
		renderIconTooltip()
		const trigger = screen.getByRole("button", { name: "open manager" })
		vi.spyOn(trigger, "matches").mockImplementation(
			(selector: string) => selector === ":focus-visible",
		)

		fireEvent.focus(trigger)

		expect(screen.getByRole("tooltip")).toHaveTextContent("sidebarPanels.projectManager")
	})
})
