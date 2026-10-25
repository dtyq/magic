import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ResearchSpotlight from "../ResearchSpotlight"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, values?: { current: number; total: number }) =>
			values ? `${key} ${values.current}/${values.total}` : key,
	}),
}))

// jsdom has no layout: place the card at a fixed spot and run one measurement per step.
vi.mock("@floating-ui/dom", () => ({
	autoUpdate: (_anchor: unknown, _card: unknown, update: () => void) => {
		update()
		return () => undefined
	},
	computePosition: () => Promise.resolve({ x: 10, y: 20 }),
	flip: () => ({}),
	offset: () => ({}),
	shift: () => ({}),
}))

/** Renders anchors; only the visible ones get a box, like a breakpoint-hidden button. */
function mountAnchors(visible: string[], hidden: string[] = []) {
	for (const name of [...visible, ...hidden]) {
		const element = document.createElement("div")
		element.dataset.guideAnchor = name
		element.scrollIntoView = vi.fn()
		element.getBoundingClientRect = () =>
			visible.includes(name) ? new DOMRect(0, 0, 100, 40) : new DOMRect(0, 0, 0, 0)
		document.body.appendChild(element)
	}
}

const steps = [
	{ anchor: "a", title: "Step A", text: "A" },
	{ anchor: "hidden", title: "Step hidden", text: "H" },
	{ anchor: "b", title: "Step B", text: "B" },
]

beforeEach(() => mountAnchors(["a", "b"], ["hidden"]))
afterEach(() => {
	// Unmount the portal before dropping the anchors it was measuring.
	cleanup()
	document.body.innerHTML = ""
})

describe("ResearchSpotlight", () => {
	it("walks only the steps whose anchor is on screen and finishes on the last", () => {
		const onClose = vi.fn()
		render(<ResearchSpotlight steps={steps} finishLabel="Start" onClose={onClose} />)

		expect(screen.getByText("Step A")).toBeTruthy()
		expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
			"onboarding.stepLabel 1/2",
		)
		fireEvent.click(screen.getByTestId("research-onboarding-primary"))
		expect(screen.getByText("Step B")).toBeTruthy()
		expect(screen.queryByText("Step hidden")).toBeNull()

		fireEvent.click(screen.getByText("Start"))
		expect(onClose).toHaveBeenCalledWith("finished")
	})

	it("goes back a step and can be skipped with Escape", () => {
		const onClose = vi.fn()
		render(<ResearchSpotlight steps={steps} finishLabel="Start" onClose={onClose} />)
		fireEvent.click(screen.getByTestId("research-onboarding-primary"))
		fireEvent.click(screen.getByText("onboarding.previous"))
		expect(screen.getByText("Step A")).toBeTruthy()

		fireEvent.keyDown(window, { key: "Escape" })
		expect(onClose).toHaveBeenCalledWith("skipped")
	})

	it("moves focus to the card once shown and keeps it there", async () => {
		const outside = document.createElement("button")
		document.body.appendChild(outside)
		render(<ResearchSpotlight steps={steps} finishLabel="Start" onClose={vi.fn()} />)
		const primary = screen.getByTestId("research-onboarding-primary")
		await waitFor(() => expect(document.activeElement).toBe(primary))

		// A closing dialog handing focus back to its trigger must not pull it out of the tour.
		outside.focus()
		expect(document.activeElement).toBe(primary)

		// Tab cycles through the card's buttons (skip, next) instead of leaving the page.
		fireEvent.keyDown(window, { key: "Tab" })
		expect(document.activeElement?.textContent).toBe("onboarding.skip")
		fireEvent.keyDown(window, { key: "Tab" })
		expect(document.activeElement).toBe(primary)
	})

	it("returns focus to where it was once the tour closes", () => {
		const trigger = document.createElement("button")
		document.body.appendChild(trigger)
		trigger.focus()
		const { unmount } = render(
			<ResearchSpotlight steps={steps} finishLabel="Start" onClose={vi.fn()} />,
		)
		unmount()
		expect(document.activeElement).toBe(trigger)
	})

	it("reports an empty tour when no anchor is rendered", () => {
		const onClose = vi.fn()
		render(
			<ResearchSpotlight
				steps={[{ anchor: "hidden", title: "H", text: "H" }]}
				finishLabel="Start"
				onClose={onClose}
			/>,
		)
		expect(onClose).toHaveBeenCalledWith("empty")
		expect(screen.queryByRole("dialog")).toBeNull()
	})
})
