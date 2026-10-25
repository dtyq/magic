import { act, fireEvent, render } from "@testing-library/react"
import { useEffect, useRef } from "react"
import { describe, expect, it } from "vitest"
import { FloatingUIProvider, useFloatingBoundary, useFloatingUI } from "../FloatingUIProvider"

function FloatingHarness(props: { onReady: (api: ReturnType<typeof useFloatingUI>) => void }) {
	const api = useFloatingUI()
	const firstRef = useRef<HTMLDivElement>(null)
	const secondRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!firstRef.current || !secondRef.current) return
		api.registerFloatingComponent("first", firstRef.current, { interactive: true })
		api.registerFloatingComponent("second", secondRef.current, { interactive: true })
		props.onReady(api)
		return () => {
			api.unregisterFloatingComponent("first")
			api.unregisterFloatingComponent("second")
		}
	}, [api, props])

	return (
		<>
			<div ref={firstRef} data-testid="first" />
			<div ref={secondRef} data-testid="second" />
		</>
	)
}

function FloatingBoundaryHarness(props: { onReady: (boundary: HTMLElement | null) => void }) {
	const boundary = useFloatingBoundary()

	useEffect(() => {
		props.onReady(boundary)
	}, [boundary, props])

	return null
}

describe("FloatingUIProvider interactive surfaces", () => {
	it("exposes the host-provided floating boundary", () => {
		const boundary = document.createElement("div")
		let observedBoundary: HTMLElement | null | undefined

		render(
			<FloatingUIProvider canvas={null} floatingBoundary={boundary}>
				<FloatingBoundaryHarness
					onReady={(nextBoundary) => (observedBoundary = nextBoundary)}
				/>
			</FloatingUIProvider>,
		)

		expect(observedBoundary).toBe(boundary)
	})

	it("promotes one surface and restores the previous surface when switching", () => {
		let api: ReturnType<typeof useFloatingUI> | undefined
		const { getByTestId } = render(
			<FloatingUIProvider canvas={null}>
				<FloatingHarness onReady={(nextApi) => (api = nextApi)} />
			</FloatingUIProvider>,
		)

		const first = getByTestId("first")
		const second = getByTestId("second")
		if (!api) throw new Error("Floating UI API was not initialized")

		act(() => api?.activateFloatingComponent("first"))
		expect(first).toHaveStyle({ zIndex: "3" })
		expect(second).not.toHaveStyle({ zIndex: "3" })

		act(() => api?.activateFloatingComponent("second"))
		expect(first).not.toHaveStyle({ zIndex: "3" })
		expect(second).toHaveStyle({ zIndex: "3" })
	})

	it("restores the default layer after leaving and on unmount", async () => {
		let api: ReturnType<typeof useFloatingUI> | undefined
		const { getByTestId, unmount } = render(
			<FloatingUIProvider canvas={null}>
				<FloatingHarness onReady={(nextApi) => (api = nextApi)} />
			</FloatingUIProvider>,
		)

		const first = getByTestId("first")
		if (!api) throw new Error("Floating UI API was not initialized")

		act(() => {
			api?.activateFloatingComponent("first")
			api?.deactivateFloatingComponent("first")
		})
		await new Promise((resolve) => window.setTimeout(resolve, 0))
		expect(first).not.toHaveStyle({ zIndex: "3" })

		act(() => api?.activateFloatingComponent("first"))
		unmount()
		expect(first).not.toHaveStyle({ zIndex: "3" })
	})

	it("keeps the owner promoted when moving into a registered portal surface", async () => {
		let api: ReturnType<typeof useFloatingUI> | undefined
		const { getByTestId } = render(
			<FloatingUIProvider canvas={null}>
				<FloatingHarness onReady={(nextApi) => (api = nextApi)} />
			</FloatingUIProvider>,
		)

		const first = getByTestId("first")
		const relatedElement = document.createElement("div")
		document.body.appendChild(relatedElement)
		if (!api) throw new Error("Floating UI API was not initialized")
		const unregisterRelatedElement = api.registerFloatingRelatedElement("first", relatedElement)

		act(() => {
			api?.activateFloatingComponent("first")
			api?.deactivateFloatingComponent("first", relatedElement)
		})
		await new Promise((resolve) => window.setTimeout(resolve, 0))
		expect(first).toHaveStyle({ zIndex: "3" })

		unregisterRelatedElement()
		relatedElement.remove()
	})

	it("restores the owner layer after leaving a Radix popover", async () => {
		let api: ReturnType<typeof useFloatingUI> | undefined
		const { getByTestId } = render(
			<FloatingUIProvider canvas={null}>
				<FloatingHarness onReady={(nextApi) => (api = nextApi)} />
			</FloatingUIProvider>,
		)

		const first = getByTestId("first")
		const popover = document.createElement("div")
		popover.setAttribute("data-floating-surface-popover", "")
		popover.setAttribute("data-floating-surface-owner", "first")
		document.body.appendChild(popover)
		if (!api) throw new Error("Floating UI API was not initialized")

		act(() => api?.activateFloatingComponent("first"))
		fireEvent.pointerOver(popover)
		fireEvent.pointerOut(popover, { relatedTarget: document.body })
		await new Promise((resolve) => window.setTimeout(resolve, 0))
		expect(first).not.toHaveStyle({ zIndex: "3" })

		popover.remove()
	})

	it("ignores popovers without an explicit floating surface owner", async () => {
		let api: ReturnType<typeof useFloatingUI> | undefined
		const { getByTestId } = render(
			<FloatingUIProvider canvas={null}>
				<FloatingHarness onReady={(nextApi) => (api = nextApi)} />
			</FloatingUIProvider>,
		)

		const first = getByTestId("first")
		const popover = document.createElement("div")
		popover.setAttribute("data-floating-surface-popover", "")
		document.body.appendChild(popover)
		if (!api) throw new Error("Floating UI API was not initialized")

		act(() => api?.activateFloatingComponent("first"))
		fireEvent.pointerOver(popover)
		fireEvent.pointerOut(popover, { relatedTarget: document.body })
		await new Promise((resolve) => window.setTimeout(resolve, 0))
		expect(first).toHaveStyle({ zIndex: "3" })

		popover.remove()
	})
})
