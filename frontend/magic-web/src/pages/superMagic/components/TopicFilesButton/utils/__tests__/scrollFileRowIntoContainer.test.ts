import { afterEach, describe, expect, it } from "vitest"
import {
	isFileRowInViewport,
	revealLocatedFileRow,
	scrollFileRowIntoContainer,
} from "../scrollFileRowIntoContainer"

/** Build a viewport box for layout tests that do not depend on real browser geometry. */
function createRect(top: number, height: number): DOMRect {
	return new DOMRect(0, top, 120, height)
}

/**
 * A scroll parent whose row position follows scrollTop.
 * This mirrors the browser, where getBoundingClientRect updates immediately after scrollTop changes.
 */
function createScrollFixture(rowTop: number) {
	const container = document.createElement("div")
	const row = document.createElement("div")
	container.setAttribute("data-testid", "topic-files-list-area")
	row.setAttribute("data-file-id", "file-sample")
	container.appendChild(row)
	document.body.appendChild(container)

	let scrollTop = 0
	Object.defineProperty(container, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value
		},
	})
	Object.defineProperty(container, "scrollHeight", { configurable: true, value: 480 })
	Object.defineProperty(container, "clientHeight", { configurable: true, value: 120 })
	container.getBoundingClientRect = () => createRect(0, 120)
	row.getBoundingClientRect = () => createRect(rowTop - scrollTop, 32)

	return {
		container,
		row,
		cleanup() {
			container.remove()
		},
	}
}

describe("scrollFileRowIntoContainer", () => {
	// A leaked fixture would let the "not mounted" case pass on a previous test's row.
	afterEach(() => {
		document.body.innerHTML = ""
	})

	it("treats a row that fills the visible overlap as inside the file list", () => {
		expect(
			isFileRowInViewport(createRect(40, 32), {
				top: 0,
				bottom: 120,
				height: 120,
			}),
		).toBe(true)
		expect(
			isFileRowInViewport(createRect(200, 32), {
				top: 0,
				bottom: 120,
				height: 120,
			}),
		).toBe(false)
	})

	it("scrolls only the file-list container until the row is visible", () => {
		const fixture = createScrollFixture(280)

		expect(scrollFileRowIntoContainer(fixture.container, fixture.row)).toBe(true)
		expect(fixture.container.scrollTop).toBeGreaterThan(0)
		expect(fixture.row.getBoundingClientRect().top).toBeLessThan(120)

		fixture.cleanup()
	})

	it("reports a mounted row as visible only after it enters the file list", () => {
		const fixture = createScrollFixture(280)

		expect(revealLocatedFileRow("file-sample")).toBe("visible")
		expect(fixture.container.scrollTop).toBeGreaterThan(0)

		fixture.cleanup()
	})

	it("keeps locate pending while the target row is not mounted", () => {
		expect(revealLocatedFileRow("file-missing")).toBe("missing")
	})

	it("ignores the same file id mounted outside the file list", () => {
		const fixture = createScrollFixture(280)
		// The detail header mounts the same file id earlier in the document, so a global lookup
		// would report on an element that is not a file row and never scroll the list.
		const detachedRow = document.createElement("div")
		detachedRow.setAttribute("data-file-id", "file-sample")
		detachedRow.getBoundingClientRect = () => createRect(-400, 44)
		document.body.insertBefore(detachedRow, fixture.container)

		expect(revealLocatedFileRow("file-sample")).toBe("visible")
		expect(fixture.container.scrollTop).toBeGreaterThan(0)

		fixture.cleanup()
	})

	it("treats a file that is only mounted outside the file list as not mounted", () => {
		const container = document.createElement("div")
		container.setAttribute("data-testid", "topic-files-list-area")
		const detachedRow = document.createElement("div")
		detachedRow.setAttribute("data-file-id", "file-detached")
		detachedRow.getBoundingClientRect = () => createRect(0, 44)
		document.body.append(detachedRow, container)

		expect(revealLocatedFileRow("file-detached")).toBe("missing")
	})
})
