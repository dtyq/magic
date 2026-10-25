import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { MessageEditorView } from "../MessageEditorView"

/**
 * Stands in for the real context menu, whose module graph reaches `@dtyq/magic-admin` — a package
 * the test runner cannot resolve (`@admin-components` is missing from the alias map). The DOM it
 * contributes is one `contents` wrapper, which is exactly what the real one renders (it only adds
 * an `onContextMenuCapture` handler), and `display: contents` makes it transparent to layout.
 */
vi.mock("../components/MentionContextMenu", () => ({
	default: ({ children }: { children: ReactNode }) => <div className="contents">{children}</div>,
}))

/**
 * The composer's scroll box has to be built out of flex, never out of percentage heights.
 *
 * `height: 100%` (on the Radix viewport) and `min-height: 100%` (on the content layer beneath it)
 * only resolve when every box above them has a definite height. The composer has none: it grows
 * with its content up to a `max-h`, and the host that renders it may hand it no height at all
 * (`absolute` with only `top`, which is what the home page's centred state does). Every ancestor is
 * then `auto`, the percentages fall back to `auto`, the viewport grows to the height of the whole
 * document instead of the box, and the text that overflows is clipped by the composer's
 * `overflow: hidden` — visible, but impossible to scroll.
 *
 * Measured in Chrome (1080×800, 60 paragraphs, the home page's `top`-only wrapper):
 *   - before: composer 400, content 1200, viewport 1200, `scrollTop` stuck at 0
 *   - after:  composer 400, content 1200, viewport 338, `scrollTop` reaches the bottom
 * and on a host that does give the composer a height (500px) both before and after come out at
 * 438/viewport 438, so nothing moves for the pages that already worked.
 *
 * A jsdom test cannot lay anything out, so what is locked here is the contract those classes
 * encode: which element is sized by flex, and in which direction.
 */
function renderScrollBox() {
	return render(
		<MessageEditorView
			size="default"
			tiptapEditor={null}
			domRef={{ current: null }}
			isDragOver={false}
			dragEvents={{
				onDragEnter: vi.fn(),
				onDragLeave: vi.fn(),
				onDragOver: vi.fn(),
				onDrop: vi.fn(),
			}}
			onPaste={vi.fn()}
			onCompositionStart={vi.fn()}
			onCompositionEnd={vi.fn()}
			showAiCompletion={false}
		/>,
	)
}

function readScrollBox() {
	const content = document.querySelector('[data-guide-anchor="message-editor-content"]')
	const root = content?.querySelector('[data-slot="scroll-area"]')
	const viewport = root?.querySelector('[data-slot="scroll-area-viewport"]')

	return {
		root,
		viewport,
		layer: viewport?.firstElementChild ?? null,
		rootClasses: root?.className.split(" ") ?? [],
		viewportClasses: viewport?.className.split(" ") ?? [],
	}
}

describe("MessageEditor composer scroll box", () => {
	it("sizes the Radix viewport with flex instead of a percentage height", () => {
		renderScrollBox()

		const { rootClasses, viewportClasses } = readScrollBox()

		// The root passes its own box down to the viewport, which is why it is a flex column.
		expect(rootClasses).toContain("flex")
		expect(rootClasses).toContain("flex-col")
		expect(rootClasses).toContain("flex-1")
		expect(rootClasses).toContain("min-h-0")

		// The viewport fills the box and may shrink below its content, so overflowing text scrolls
		// instead of stretching the box. `!h-auto` neutralises the `size-full` height, which is the
		// percentage that does not resolve in a content-sized composer.
		expect(viewportClasses).toContain("basis-auto")
		expect(viewportClasses).toContain("grow")
		expect(viewportClasses).toContain("shrink")
		expect(viewportClasses).toContain("min-h-0")
		expect(viewportClasses).toContain("!h-auto")
		expect(viewportClasses).not.toContain("min-h-full")

		// The Radix content layer does the opposite: it takes the content's height and never
		// shrinks, which is what keeps short content filling the click area. It is addressed
		// through the viewport (it has no classes of its own), so the rules live on the parent —
		// the next test locks the child relationship that makes them land.
		expect(viewportClasses).toContain("[&>div]:!flex")
		expect(viewportClasses).toContain("[&>div]:flex-col")
		expect(viewportClasses).toContain("[&>div]:basis-auto")
		expect(viewportClasses).toContain("[&>div]:grow")
		expect(viewportClasses).toContain("[&>div]:shrink-0")
		expect(viewportClasses).not.toContain("[&>div]:min-h-full")
	})

	it("keeps the content layer a direct child of the viewport", () => {
		renderScrollBox()

		const { root, viewport, layer } = readScrollBox()

		// Both sides of the contract are `[&>div]` selectors, so an extra wrapper anywhere between
		// them would silently address the wrong element.
		expect(viewport?.parentElement).toBe(root)
		expect(layer?.parentElement).toBe(viewport)
	})
})
