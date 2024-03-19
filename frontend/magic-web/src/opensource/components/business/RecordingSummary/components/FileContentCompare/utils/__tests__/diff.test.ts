import { describe, it, expect } from "vitest"
import { parseConflicts, resolveConflictsWithSelections, type ConflictInfo } from "../diff"

describe("parseConflicts", () => {
	it("should parse single conflict", () => {
		const mergedContent = `line1
<<<<<<< current version
current line 1
current line 2
=======
server line 1
server line 2
>>>>>>> server version
line2`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(1)
		expect(conflicts[0]).toMatchObject({
			id: "conflict-1",
			currentLines: ["current line 1", "current line 2"],
			serverLines: ["server line 1", "server line 2"],
			startIndex: 1,
			endIndex: 7,
			incomplete: false,
		})
	})

	it("should parse multiple conflicts", () => {
		const mergedContent = `line1
<<<<<<< current version
current 1
=======
server 1
>>>>>>> server version
line2
<<<<<<< current version
current 2
=======
server 2
>>>>>>> server version
line3`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(2)
		expect(conflicts[0].id).toBe("conflict-1")
		expect(conflicts[0].currentLines).toEqual(["current 1"])
		expect(conflicts[0].serverLines).toEqual(["server 1"])
		expect(conflicts[1].id).toBe("conflict-7")
		expect(conflicts[1].currentLines).toEqual(["current 2"])
		expect(conflicts[1].serverLines).toEqual(["server 2"])
	})

	it("should handle incomplete conflicts", () => {
		const mergedContent = `line1
<<<<<<< current version
current line 1
=======
server line 1`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(1)
		expect(conflicts[0]).toMatchObject({
			id: "conflict-1",
			currentLines: ["current line 1"],
			serverLines: ["server line 1"],
			incomplete: true,
		})
	})

	it("should handle incomplete conflict without separator", () => {
		const mergedContent = `line1
<<<<<<< current version
current line 1`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(1)
		expect(conflicts[0]).toMatchObject({
			id: "conflict-1",
			currentLines: ["current line 1"],
			serverLines: [],
			incomplete: true,
		})
	})

	it("should return empty array for content without conflicts", () => {
		const mergedContent = `line1
line2
line3`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(0)
	})

	it("should handle empty string", () => {
		const conflicts = parseConflicts("")

		expect(conflicts).toHaveLength(0)
	})

	it("should handle conflicts with empty lines", () => {
		const mergedContent = `line1
<<<<<<< current version

=======

>>>>>>> server version
line2`

		const conflicts = parseConflicts(mergedContent)

		expect(conflicts).toHaveLength(1)
		expect(conflicts[0].currentLines).toEqual([""])
		expect(conflicts[0].serverLines).toEqual([""])
	})
})

describe("resolveConflictsWithSelections", () => {
	it("should resolve conflict with current selection", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "current")
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
current line
line2`)
	})

	it("should resolve conflict with server selection", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "server")
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
server line
line2`)
	})

	it("should resolve conflict with custom content", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "custom")
		const customContents = new Map<string, string>()
		customContents.set("conflict-1", "custom line")

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
custom line
line2`)
	})

	it("should resolve multiple conflicts with different selections", () => {
		const mergedContent = `line1
<<<<<<< current version
current 1
=======
server 1
>>>>>>> server version
line2
<<<<<<< current version
current 2
=======
server 2
>>>>>>> server version
line3`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "current")
		selections.set("conflict-7", "server")
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
current 1
line2
server 2
line3`)
	})

	it("should handle partial resolution (some conflicts resolved)", () => {
		const mergedContent = `line1
<<<<<<< current version
current 1
=======
server 1
>>>>>>> server version
line2
<<<<<<< current version
current 2
=======
server 2
>>>>>>> server version
line3`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "current")
		// conflict-7 not resolved
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toContain("current 1")
		expect(result).toContain("line2")
		expect(result).toContain("<<<<<<<") // unresolved conflict should keep markers
		expect(result).toContain("current 2")
		expect(result).toContain("server 2")
	})

	it("should handle custom content with newlines", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "custom")
		const customContents = new Map<string, string>()
		customContents.set("conflict-1", "custom line 1\ncustom line 2")

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
custom line 1
custom line 2
line2`)
	})

	it("should fallback to server when custom content not provided", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "custom")
		const customContents = new Map<string, string>()
		// custom content not set

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
server line
line2`)
	})

	it("should handle incomplete conflicts with selections", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line`

		const selections = new Map<string, "current" | "server" | "custom">()
		selections.set("conflict-1", "current")
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
current line`)
	})

	it("should preserve normal lines without conflicts", () => {
		const mergedContent = `line1
line2
line3`

		const selections = new Map<string, "current" | "server" | "custom">()
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		expect(result).toBe(`line1
line2
line3`)
	})

	it("should handle empty selections map", () => {
		const mergedContent = `line1
<<<<<<< current version
current line
=======
server line
>>>>>>> server version
line2`

		const selections = new Map<string, "current" | "server" | "custom">()
		const customContents = new Map<string, string>()

		const result = resolveConflictsWithSelections(mergedContent, selections, customContents)

		// Should keep conflict markers when no selection
		expect(result).toContain("<<<<<<<")
		expect(result).toContain("=======")
		expect(result).toContain(">>>>>>>")
	})
})
