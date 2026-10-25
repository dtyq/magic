import { render, screen } from "@testing-library/react"
import { createPortal } from "react-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import usePortalTarget from "../usePortalTarget"

function Portal({ id, immediate = true }: { id: string; immediate?: boolean }) {
	const target = usePortalTarget({ portalId: id, resolveBeforePaint: immediate })
	return target && createPortal(<span>editor</span>, target)
}

afterEach(() => vi.unstubAllGlobals())

describe("home editor portal timing", () => {
	it("fills the newly committed target without waiting for an animation frame", () => {
		vi.stubGlobal("requestAnimationFrame", vi.fn())
		render(
			<>
				<div id="home-input" />
				<Portal id="home-input" />
			</>,
		)
		expect(screen.getByText("editor").parentElement).toHaveAttribute("id", "home-input")
	})

	it("uses the new session target instead of retaining the previous composer", () => {
		vi.stubGlobal("requestAnimationFrame", vi.fn())
		const { rerender } = render(
			<>
				<div id="task-input" />
				<Portal id="task-input" />
			</>,
		)
		rerender(
			<>
				<div id="chat-input" />
				<Portal id="chat-input" />
			</>,
		)
		expect(screen.getAllByText("editor")).toHaveLength(1)
		expect(screen.getByText("editor").parentElement).toHaveAttribute("id", "chat-input")
	})

	it("keeps deferred resolution as the default for existing callers", () => {
		vi.stubGlobal("requestAnimationFrame", vi.fn())
		render(
			<>
				<div id="legacy-input" />
				<Portal id="legacy-input" immediate={false} />
			</>,
		)
		expect(screen.queryByText("editor")).not.toBeInTheDocument()
	})
})
