import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommandHistory } from "../../core/CommandHistory"
import { PPTBuildManager } from "../PPTBuildManager"
import { StyleManager } from "../StyleManager"
import { PPT_BUILD_ATTRIBUTE, writePPTBuild, type PPTBuild } from "../../utils/pptBuild"
import { markSourceNodes } from "../../utils/sourceNodes"
import { getElementSelector } from "../../utils/dom"

const build = (step: number): PPTBuild => ({ step, effect: "appear" })

describe("PPTBuildManager", () => {
	let history: CommandHistory
	let manager: PPTBuildManager
	let style: StyleManager
	beforeEach(() => {
		document.documentElement.removeAttribute("data-magic-source-node")
		document.body.innerHTML =
			'<section id="a"><p id="child">Child</p></section><p id="b">Second</p>'
		vi.stubGlobal("CSS", { escape: (value: string) => value })
		history = new CommandHistory()
		manager = new PPTBuildManager(history, () => true)
		style = new StyleManager(history)
		style.registerCommandHandler(manager)
	})
	afterEach(() => vi.unstubAllGlobals())

	it("reorders multiple elements as one undoable command and preserves unrelated attributes", async () => {
		writePPTBuild(document.querySelector("#a")!, build(1))
		writePPTBuild(document.querySelector("#b")!, build(2))
		document.querySelector("#a")!.setAttribute("title", "Keep me")
		const entries = manager.getBuilds()
		manager.updateBuilds(
			entries.map((entry, index) => ({ selector: entry.selector, build: build(2 - index) })),
		)
		expect(history.getUndoStackSize()).toBe(1)
		expect(manager.getBuilds().map((entry) => entry.label)).toEqual(["Second", "Child"])
		await style.undo()
		expect(manager.getBuilds().map((entry) => entry.label)).toEqual(["Child", "Second"])
		await style.redo()
		expect(manager.getBuilds().map((entry) => entry.label)).toEqual(["Second", "Child"])
		expect(document.querySelector("#a")!.getAttribute("title")).toBe("Keep me")
	})

	it("rejects invalid batches without changing any document attributes or history", () => {
		const original = document.body.innerHTML
		expect(() =>
			manager.updateBuilds([
				{ selector: "#a", build: build(1) },
				{ selector: "#b", build: build(0) },
			]),
		).toThrow("PPT_BUILD_INVALID")
		expect(document.body.innerHTML).toBe(original)
		expect(history.canUndo()).toBe(false)
	})

	it("allows a container and its descendant to be configured together and undone as one command", async () => {
		manager.updateBuilds([
			{ selector: "#a", build: build(2) },
			{ selector: "#child", build: build(1) },
		])
		expect(history.getUndoStackSize()).toBe(1)
		const entries = manager.getBuilds()
		expect(entries.map((entry) => entry.label)).toEqual(["Child", "Child"])
		expect(entries.find((entry) => entry.build.step === 1)?.ancestorStep).toBe(2)
		expect(entries.find((entry) => entry.build.step === 2)?.ancestorStep).toBeUndefined()
		await style.undo()
		expect(document.querySelector("#a")!.hasAttribute(PPT_BUILD_ATTRIBUTE)).toBe(false)
		expect(document.querySelector("#child")!.hasAttribute(PPT_BUILD_ATTRIBUTE)).toBe(false)
	})

	it("returns valid authored builds, including nested ones, using the canvas selection selectors", () => {
		for (const selector of ["#a", "#child", "#b"])
			writePPTBuild(document.querySelector(selector)!, build(3))
		markSourceNodes(document)
		const runtime = document.createElement("div")
		writePPTBuild(runtime, build(1))
		document.body.append(runtime)
		const entries = manager.getBuilds()
		expect(entries).toHaveLength(3)
		const first = document.querySelector(entries[0].selector)!
		expect(entries[0].selector).toBe(getElementSelector(first as HTMLElement))
		expect(first.hasAttribute("data-magic-editor-node-id")).toBe(false)
		manager.updateBuilds([{ selector: entries[1].selector, build: build(4) }])
		expect(manager.getBuilds().find((entry) => entry.build.step === 4)?.selector).toBe(
			entries[1].selector,
		)
		expect(() => manager.updateBuilds([{ selector: "body > div", build: build(1) }])).toThrow(
			"PPT_BUILD_INVALID",
		)
	})

	it("treats a changed automatic delay as a real change, including undo", async () => {
		writePPTBuild(document.querySelector("#a")!, build(1))
		manager.updateBuilds([{ selector: "#a", build: { ...build(1), after: 800 } }])
		expect(history.getUndoStackSize()).toBe(1)
		expect(manager.getBuilds()[0].build.after).toBe(800)
		manager.updateBuilds([{ selector: "#a", build: build(1) }])
		expect(manager.getBuilds()[0].build.after).toBeUndefined()
		await style.undo()
		expect(manager.getBuilds()[0].build.after).toBe(800)
	})

	it("rejects writes outside edit mode and ambiguous or duplicate targets", () => {
		expect(() =>
			new PPTBuildManager(history, () => false).updateBuilds([
				{ selector: "#a", build: build(1) },
			]),
		).toThrow("PPT_BUILD_EDIT_MODE_REQUIRED")
		expect(() => manager.updateBuilds([{ selector: "p", build: build(1) }])).toThrow(
			"PPT_BUILD_INVALID",
		)
		expect(() =>
			manager.updateBuilds([
				{ selector: "#a", build: build(1) },
				{ selector: "#a", build: null },
			]),
		).toThrow("PPT_BUILD_DUPLICATE")
		expect(history.canUndo()).toBe(false)
	})
})
