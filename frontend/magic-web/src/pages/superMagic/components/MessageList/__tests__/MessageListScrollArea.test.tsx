import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MessageListScrollArea } from "../components/MessageListScrollArea"
import { findMessageListViewport } from "../message-list-viewport"

afterEach(cleanup)

describe("MessageListScrollArea", () => {
	it("exposes the same actual viewport to the caller and message descendants", () => {
		const viewportRef = createRef<HTMLDivElement>()
		const { container, unmount } = render(
			<MessageListScrollArea viewportRef={viewportRef}>
				<div data-testid="message">Message</div>
			</MessageListScrollArea>,
		)
		const viewport = screen.getByTestId("message-list-viewport")
		expect(viewportRef.current).toBe(viewport)
		expect(findMessageListViewport(screen.getByTestId("message"))).toBe(viewport)
		expect(container.querySelectorAll("[data-radix-scroll-area-viewport]")).toHaveLength(1)
		expect(viewport.parentElement).not.toBe(viewportRef.current)
		unmount()
		expect(viewportRef.current).toBeNull()
	})

	it("keeps the viewport and its scroll position when message content grows", () => {
		const viewportRef = vi.fn()
		const { rerender } = render(
			<MessageListScrollArea viewportRef={viewportRef}>First message</MessageListScrollArea>,
		)
		const viewport = screen.getByTestId("message-list-viewport")
		viewport.scrollTop = 120
		fireEvent.scroll(viewport)
		rerender(
			<MessageListScrollArea viewportRef={viewportRef}>
				First message and its streamed continuation
			</MessageListScrollArea>,
		)
		expect(screen.getByTestId("message-list-viewport")).toBe(viewport)
		expect(viewport.scrollTop).toBe(120)
		expect(viewportRef).toHaveBeenLastCalledWith(viewport)
	})
})
