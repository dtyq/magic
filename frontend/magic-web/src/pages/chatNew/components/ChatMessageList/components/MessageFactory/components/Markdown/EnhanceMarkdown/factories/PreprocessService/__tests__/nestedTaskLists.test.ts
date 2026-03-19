import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Nested Task Lists", () => {
	it("should handle single level task lists", () => {
		const markdown = `
- [x] Completed task
- [ ] Incomplete task
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should generate proper HTML structure
		expect(content).toContain('<ul class="task-list-container">')
		expect(content).toContain('<li class="task-list-item">')
		expect(content).toContain('<input type="checkbox" checked readonly')
		expect(content).toContain('<input type="checkbox"  readonly')
		expect(content).toContain("Completed task</li>")
		expect(content).toContain("Incomplete task</li>")
	})

	it("should handle nested task lists correctly", () => {
		const markdown = `
- [x] Top level completed task
- [ ] Top level incomplete task
  - [x] Second level completed
  - [ ] Second level incomplete
    - [x] Third level completed
    - [ ] Third level incomplete
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should contain nested ul elements
		expect(content).toContain('<ul class="task-list-container">')
		expect(content).toContain("Top level completed task</li>")
		expect(content).toContain("Top level incomplete task")
		expect(content).toContain("Second level completed</li>")
		expect(content).toContain("Third level completed</li>")

		// Check for proper nesting structure
		const nestedUlCount = (content.match(/<ul>/g) || []).length
		expect(nestedUlCount).toBeGreaterThan(1) // Should have nested ul elements
	})

	it("should handle multiple separate task lists", () => {
		const markdown = `
First task list:
- [x] Task 1
- [ ] Task 2

Some text in between.

Second task list:
- [ ] Task A
  - [x] Subtask A1
- [x] Task B
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should handle multiple task lists separately
		expect(content).toContain("First task list:")
		expect(content).toContain("Some text in between.")
		expect(content).toContain("Second task list:")
		expect(content).toContain("Task 1</li>")
		expect(content).toContain("Task A")
		expect(content).toContain("Subtask A1</li>")
		expect(content).toContain("Task B</li>")
	})

	it("should handle task lists with mixed content", () => {
		const markdown = `
# Task List Example

- [x] Learn **Markdown**
  - [ ] Basic syntax
  - [x] Advanced features like ~~strikethrough~~
    - [ ] Task lists
    - [x] Tables
- [ ] Write documentation

Some other content.
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should preserve other markdown formatting within tasks
		expect(content).toContain("# Task List Example")
		expect(content).toContain("Learn **Markdown**")
		expect(content).toContain('<span class="strikethrough">strikethrough</span>')
		expect(content).toContain("Some other content.")
	})

	it("should handle empty task lists", () => {
		const markdown = `
Some text without task lists.

More text here.
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should not create any task list HTML
		expect(content).not.toContain('<ul style="margin: 0.25em 0; padding-left: 1.5em;">')
		expect(content).not.toContain("task-list-item")
		expect(content).toContain("Some text without task lists.")
		expect(content).toContain("More text here.")
	})

	it("should handle deeply nested task lists", () => {
		const markdown = `
- [x] Level 1
  - [ ] Level 2
    - [x] Level 3
      - [ ] Level 4
        - [x] Level 5
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should handle deep nesting
		expect(content).toContain("Level 1")
		expect(content).toContain("Level 2")
		expect(content).toContain("Level 3")
		expect(content).toContain("Level 4")
		expect(content).toContain("Level 5</li>")

		// Should have proper nesting structure
		const nestedUlCount = (content.match(/<ul>/g) || []).length
		expect(nestedUlCount).toBeGreaterThan(3) // Should have multiple nested levels
	})

	it("should handle inconsistent indentation gracefully", () => {
		const markdown = `
- [x] Normal task
   - [ ] 3 spaces (should be level 1)
  - [x] 2 spaces (should be level 1)
    - [ ] 4 spaces (should be level 2)
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should handle inconsistent indentation based on space count
		expect(content).toContain("Normal task")
		expect(content).toContain("3 spaces")
		expect(content).toContain("2 spaces")
		expect(content).toContain("4 spaces")
	})
})
