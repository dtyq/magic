import { act, fireEvent, render, screen } from "@testing-library/react"
import { observer } from "mobx-react-lite"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { PPTNotesPreferenceStore } from "../PPTNotesPreferenceStore"

describe("PPTNotesPreferenceStore", () => {
	beforeEach(() => localStorage.clear())
	afterEach(() => vi.restoreAllMocks())

	it("restores the resized height without changing visibility", () => {
		const store = new PPTNotesPreferenceStore()
		expect(store.height).toBe(144)
		store.setHeight(240)
		const restored = new PPTNotesPreferenceStore()
		expect(restored.height).toBe(240)
		expect(restored.visible).toBe(false)
	})

	it.each(["NaN", "Infinity", "-10", "0", "99", "invalid"])(
		"ignores invalid stored height %s",
		(value) => {
			localStorage.setItem("supermagic-ppt-notes-height", value)
			expect(new PPTNotesPreferenceStore().height).toBe(144)
		},
	)

	it("persists font size and review mode across presentations", () => {
		const store = new PPTNotesPreferenceStore()
		expect(store.fontSize).toBe(13)
		expect(store.autoApply).toBe(true)
		store.setFontSize(21)
		store.setAutoApply(false)
		const restored = new PPTNotesPreferenceStore()
		expect(restored.fontSize).toBe(21)
		expect(restored.autoApply).toBe(false)
	})
	it.each(["NaN", "Infinity", "10", "32", "13.5", "bad"])(
		"ignores invalid stored font size %s",
		(value) => {
			localStorage.setItem("supermagic-ppt-notes-font-size", value)
			expect(new PPTNotesPreferenceStore().fontSize).toBe(13)
		},
	)

	it("defaults to collapsed and restores both choices after reload", () => {
		const store = new PPTNotesPreferenceStore()
		expect(store.visible).toBe(false)
		store.toggle()
		expect(new PPTNotesPreferenceStore().visible).toBe(true)
		store.toggle()
		expect(new PPTNotesPreferenceStore().visible).toBe(false)
	})

	it("updates multiple PPT consumers together", () => {
		const store = new PPTNotesPreferenceStore()
		const Presentation = observer(({ name }: { name: string }) => (
			<button onClick={store.toggle} aria-pressed={store.visible}>
				{name}
			</button>
		))
		render(
			<>
				<Presentation name="Deck A" />
				<Presentation name="Deck B" />
			</>,
		)
		fireEvent.click(screen.getByText("Deck A"))
		expect(screen.getByText("Deck B")).toHaveAttribute("aria-pressed", "true")
		act(() => store.setVisible(false))
		expect(screen.getByText("Deck A")).toHaveAttribute("aria-pressed", "false")
	})

	it("stays usable when browser storage is unavailable", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked")
		})
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked")
		})
		const store = new PPTNotesPreferenceStore()
		expect(() => store.toggle()).not.toThrow()
		expect(store.visible).toBe(true)
		expect(() => store.setHeight(220)).not.toThrow()
		expect(store.height).toBe(220)
		expect(() => store.setFontSize(19)).not.toThrow()
		expect(store.fontSize).toBe(19)
		expect(() => store.setAutoApply(false)).not.toThrow()
		expect(store.autoApply).toBe(false)
	})
})
