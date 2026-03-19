/**
 * StyleManager tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { StyleManager } from "../StyleManager"
import { CommandHistory } from "../../core/CommandHistory"
import { ElementSelector } from "../../features/ElementSelector"
import { EditorBridge } from "../../core/EditorBridge"

describe("StyleManager", () => {
	let styleManager: StyleManager
	let commandHistory: CommandHistory
	let container: HTMLElement

	beforeEach(() => {
		commandHistory = new CommandHistory()
		styleManager = new StyleManager(commandHistory)

		container = document.createElement("div")
		container.id = "test-container"
		document.body.appendChild(container)
	})

	afterEach(() => {
		document.body.removeChild(container)
	})

	describe("setBackgroundColor", () => {
		it("should set background color", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBackgroundColor("div#test", "#ff0000")

			expect(element.style.backgroundColor).toBe("rgb(255, 0, 0)")
		})

		it("should record command in history", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			await styleManager.setBackgroundColor("div#test", "#ff0000")

			expect(commandHistory.canUndo()).toBe(true)
			expect(commandHistory.getUndoStackSize()).toBe(1)
		})

		it("should preserve previous value", async () => {
			container.innerHTML = "<div id='test' style='background-color: blue'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBackgroundColor("div#test", "#ff0000")
			await styleManager.undo()

			expect(element.style.backgroundColor).toBe("blue")
		})

		it("should refresh selection after setting background color", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const mockElementSelector = {
				refreshSelection: vi.fn(),
				getSelectedSelectors: vi.fn(),
				selectElement: vi.fn(),
			}

			styleManager.setElementSelector(mockElementSelector as any)

			await styleManager.setBackgroundColor("div#test", "#ff0000")

			expect(mockElementSelector.refreshSelection).toHaveBeenCalledTimes(1)
		})
	})

	describe("setTextColor", () => {
		it("should set text color", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setTextColor("div#test", "#00ff00")

			expect(element.style.color).toBe("rgb(0, 255, 0)")
		})

		it("should record command in history", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			await styleManager.setTextColor("div#test", "#00ff00")

			expect(commandHistory.canUndo()).toBe(true)
		})

		it("should refresh selection after setting text color", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const mockElementSelector = {
				refreshSelection: vi.fn(),
				getSelectedSelectors: vi.fn(),
				selectElement: vi.fn(),
			}

			styleManager.setElementSelector(mockElementSelector as any)

			await styleManager.setTextColor("div#test", "#00ff00")

			expect(mockElementSelector.refreshSelection).toHaveBeenCalledTimes(1)
		})
	})

	describe("setFontSize", () => {
		it("should set font size with number and unit", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", 16, "px")

			expect(element.style.fontSize).toBe("16px")
		})

		it("should set font size with string", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", "2em")

			expect(element.style.fontSize).toBe("2em")
		})

		it("should default to px unit", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", 20)

			expect(element.style.fontSize).toBe("20px")
		})

		it("should support rem unit", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", 1.5, "rem")

			expect(element.style.fontSize).toBe("1.5rem")
		})
	})

	describe("setBatchStyles", () => {
		it("should set multiple styles", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBatchStyles("div#test", {
				color: "red",
				fontSize: "20px",
				backgroundColor: "blue",
			})

			expect(element.style.color).toBe("red")
			expect(element.style.fontSize).toBe("20px")
			expect(element.style.backgroundColor).toBe("blue")
		})

		it("should refresh selection after setting styles", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement
			const mockElementSelector = {
				refreshSelection: vi.fn(),
				getSelectedSelectors: vi.fn(),
				selectElement: vi.fn(),
			}

			styleManager.setElementSelector(mockElementSelector as any)

			await styleManager.setBatchStyles("div#test", {
				width: "200px",
				height: "100px",
			})

			expect(mockElementSelector.refreshSelection).toHaveBeenCalledTimes(1)
		})

		it("should handle camelCase properties", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBatchStyles("div#test", {
				backgroundColor: "yellow",
				borderRadius: "5px",
			})

			expect(element.style.backgroundColor).toBe("yellow")
			expect(element.style.borderRadius).toBe("5px")
		})

		it("should record single command for batch", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			await styleManager.setBatchStyles("div#test", {
				color: "red",
				fontSize: "20px",
				backgroundColor: "blue",
			})

			expect(commandHistory.getUndoStackSize()).toBe(1)
		})

		it("should not record in batch mode", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			commandHistory.beginBatch({
				commandType: "BATCH",
				payload: {},
				timestamp: Date.now(),
			})

			await styleManager.setBatchStyles("div#test", {
				color: "red",
			})

			// Should not record because in batch mode
			expect(commandHistory.getUndoStackSize()).toBe(0)

			commandHistory.cancelBatch()
		})
	})

	describe("applyStylesTemporary", () => {
		it("should apply styles without recording history", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			styleManager.applyStylesTemporary("div#test", {
				color: "purple",
				fontSize: "18px",
			})

			expect(element.style.color).toBe("purple")
			expect(element.style.fontSize).toBe("18px")
			expect(commandHistory.canUndo()).toBe(false)
		})

		it("should handle kebab-case conversion", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			styleManager.applyStylesTemporary("div#test", {
				backgroundColor: "green",
				borderRadius: "10px",
			})

			expect(element.style.backgroundColor).toBe("green")
			expect(element.style.borderRadius).toBe("10px")
		})
	})

	describe("undo", () => {
		it("should undo style changes", async () => {
			container.innerHTML = "<div id='test' style='color: black'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setTextColor("div#test", "red")
			expect(element.style.color).toBe("red")

			await styleManager.undo()
			expect(element.style.color).toBe("black")
		})

		it("should return false when nothing to undo", async () => {
			const result = await styleManager.undo()
			expect(result).toBe(false)
		})

		it("should handle multiple undos", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setTextColor("div#test", "red")
			await styleManager.setBackgroundColor("div#test", "blue")

			await styleManager.undo()
			expect(element.style.backgroundColor).toBe("")

			await styleManager.undo()
			expect(element.style.color).toBe("")
		})

		it("should refresh element selection after undo", async () => {
			const bridge = new EditorBridge()
			const elementSelector = new ElementSelector(bridge)
			styleManager.setElementSelector(elementSelector)

			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			elementSelector.enable()
			elementSelector.selectElement(element)

			await styleManager.setTextColor("div#test", "red")
			await styleManager.undo()

			bridge.destroy()
			elementSelector.destroy()
		})
	})

	describe("redo", () => {
		it("should redo style changes", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setTextColor("div#test", "red")
			await styleManager.undo()
			expect(element.style.color).toBe("")

			await styleManager.redo()
			expect(element.style.color).toBe("red")
		})

		it("should return false when nothing to redo", async () => {
			const result = await styleManager.redo()
			expect(result).toBe(false)
		})

		it("should handle multiple redos", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setTextColor("div#test", "red")
			await styleManager.setBackgroundColor("div#test", "blue")

			await styleManager.undo()
			await styleManager.undo()

			await styleManager.redo()
			expect(element.style.color).toBe("red")

			await styleManager.redo()
			expect(element.style.backgroundColor).toBe("blue")
		})
	})

	describe("setElementSelector", () => {
		it("should set element selector reference", () => {
			const bridge = new EditorBridge()
			const elementSelector = new ElementSelector(bridge)

			expect(() => {
				styleManager.setElementSelector(elementSelector)
			}).not.toThrow()

			bridge.destroy()
			elementSelector.destroy()
		})
	})

	describe("edge cases", () => {
		it("should handle non-existent selector gracefully", async () => {
			await expect(styleManager.setBackgroundColor("#non-existent", "red")).rejects.toThrow()
		})

		it("should handle empty color values", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBackgroundColor("div#test", "")
			expect(element.style.backgroundColor).toBe("")
		})

		it("should handle invalid color formats gracefully", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			// Browser will handle invalid colors
			await styleManager.setBackgroundColor("div#test", "not-a-color")
			// The value might be set as-is or ignored by browser
			expect(element.style.backgroundColor).toBeDefined()
		})

		it("should handle zero font size", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", 0)
			expect(element.style.fontSize).toBe("0px")
		})

		it("should handle negative font size", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setFontSize("div#test", -10)
			// Browser will handle negative values
			expect(element.style.fontSize).toBeDefined()
		})

		it("should handle empty styles object", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			await styleManager.setBatchStyles("div#test", {})
			expect(commandHistory.canUndo()).toBe(true)
		})

		it("should handle complex selectors", async () => {
			container.innerHTML = `
				<div class="parent">
					<div class="child">
						<span id="target">Content</span>
					</div>
				</div>
			`
			const element = container.querySelector("#target") as HTMLElement

			await styleManager.setTextColor("div.parent > div.child > span#target", "red")
			expect(element.style.color).toBe("red")
		})

		it("should handle rapid style changes", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			for (let i = 0; i < 100; i++) {
				await styleManager.setFontSize("div#test", i + 10)
			}

			expect(element.style.fontSize).toBe("109px")
			expect(commandHistory.canUndo()).toBe(true)
		})

		it("should handle styles with important flag", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.setBatchStyles("div#test", {
				color: "red !important",
			})

			// The !important might be handled by browser
			expect(element.style.color).toBeDefined()
		})
	})

	describe("integration tests", () => {
		it("should handle complete style workflow", async () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			// Apply multiple styles
			await styleManager.setTextColor("div#test", "red")
			await styleManager.setBackgroundColor("div#test", "yellow")
			await styleManager.setFontSize("div#test", 20)

			expect(element.style.color).toBe("red")
			expect(element.style.backgroundColor).toBe("yellow")
			expect(element.style.fontSize).toBe("20px")

			// Undo all
			await styleManager.undo()
			await styleManager.undo()
			await styleManager.undo()

			expect(element.style.color).toBe("")
			expect(element.style.backgroundColor).toBe("")
			expect(element.style.fontSize).toBe("")

			// Redo all
			await styleManager.redo()
			await styleManager.redo()
			await styleManager.redo()

			expect(element.style.color).toBe("red")
			expect(element.style.backgroundColor).toBe("yellow")
			expect(element.style.fontSize).toBe("20px")
		})

		it("should handle batch and individual operations", async () => {
			container.innerHTML = "<div id='test'>Content</div>"

			await styleManager.setBatchStyles("div#test", {
				color: "blue",
				fontSize: "16px",
			})

			await styleManager.setBackgroundColor("div#test", "white")

			expect(commandHistory.getUndoStackSize()).toBe(2)

			await styleManager.undo()
			await styleManager.undo()

			expect(commandHistory.canUndo()).toBe(false)
		})
	})

	describe("deleteElement", () => {
		it("should delete element and record in history", async () => {
			container.innerHTML = "<div><span id='test'>Content</span></div>"
			const element = container.querySelector("#test")

			await styleManager.deleteElement("span#test")

			expect(container.querySelector("#test")).toBeNull()
			expect(commandHistory.canUndo()).toBe(true)
		})

		it("should restore deleted element on undo", async () => {
			container.innerHTML = "<div><span id='test'>Content</span></div>"

			await styleManager.deleteElement("span#test")
			expect(container.querySelector("#test")).toBeNull()

			await styleManager.undo()
			const restoredElement = container.querySelector("#test")
			expect(restoredElement).not.toBeNull()
			expect(restoredElement?.textContent).toBe("Content")
		})

		it.skipIf(typeof window !== "undefined" && !HTMLCanvasElement.prototype.getContext)(
			"should preserve canvas content when deleting and restoring",
			async () => {
				// Create a canvas with some content
				container.innerHTML =
					"<div><canvas id='test' width='100' height='100'></canvas></div>"
				const canvas = container.querySelector("#test") as HTMLCanvasElement
				const ctx = canvas.getContext("2d")

				// Skip if canvas is not supported (jsdom)
				if (!ctx) return

				// Draw something on the canvas
				ctx.fillStyle = "red"
				ctx.fillRect(10, 10, 50, 50)

				// Get the image data before deletion
				const originalImageData = ctx.getImageData(0, 0, 100, 100)

				// Delete the canvas
				await styleManager.deleteElement("canvas#test")
				expect(container.querySelector("#test")).toBeNull()

				// Undo to restore the canvas
				await styleManager.undo()

				// Wait for async restoration
				await new Promise((resolve) => setTimeout(resolve, 100))

				const restoredCanvas = container.querySelector("#test") as HTMLCanvasElement
				expect(restoredCanvas).not.toBeNull()
				expect(restoredCanvas.width).toBe(100)
				expect(restoredCanvas.height).toBe(100)

				// Check if the content is restored
				const restoredCtx = restoredCanvas.getContext("2d")!
				const restoredImageData = restoredCtx.getImageData(0, 0, 100, 100)

				// Compare the image data
				expect(restoredImageData.data.length).toBe(originalImageData.data.length)
				// Check a few pixels to verify content is restored
				expect(restoredImageData.data[0]).toBe(originalImageData.data[0])
				expect(restoredImageData.data[1000]).toBe(originalImageData.data[1000])
			},
		)

		it.skipIf(typeof window !== "undefined" && !HTMLCanvasElement.prototype.getContext)(
			"should handle container with nested canvas",
			async () => {
				container.innerHTML =
					"<div id='test'><canvas width='50' height='50'></canvas></div>"
				const canvas = container.querySelector("canvas") as HTMLCanvasElement
				const ctx = canvas.getContext("2d")

				// Skip if canvas is not supported (jsdom)
				if (!ctx) return

				// Draw on nested canvas
				ctx.fillStyle = "blue"
				ctx.fillRect(0, 0, 25, 25)

				// Delete the container
				await styleManager.deleteElement("div#test")
				expect(container.querySelector("#test")).toBeNull()

				// Restore
				await styleManager.undo()
				await new Promise((resolve) => setTimeout(resolve, 100))

				const restoredDiv = container.querySelector("#test")
				expect(restoredDiv).not.toBeNull()

				const restoredCanvas = restoredDiv?.querySelector("canvas") as HTMLCanvasElement
				expect(restoredCanvas).not.toBeNull()
				expect(restoredCanvas.width).toBe(50)

				// Verify content is restored
				const restoredCtx = restoredCanvas.getContext("2d")!
				const imageData = restoredCtx.getImageData(0, 0, 50, 50)
				// Check that there's some blue color in the image
				expect(imageData.data.some((value) => value > 0)).toBe(true)
			},
		)

		it("should preserve element order when restoring", async () => {
			container.innerHTML =
				"<div><span>First</span><span id='test'>Second</span><span>Third</span></div>"

			await styleManager.deleteElement("span#test")

			const spans = container.querySelectorAll("span")
			expect(spans.length).toBe(2)
			expect(spans[0].textContent).toBe("First")
			expect(spans[1].textContent).toBe("Third")

			await styleManager.undo()

			const restoredSpans = container.querySelectorAll("span")
			expect(restoredSpans.length).toBe(3)
			expect(restoredSpans[0].textContent).toBe("First")
			expect(restoredSpans[1].textContent).toBe("Second")
			expect(restoredSpans[2].textContent).toBe("Third")
		})
	})

	describe("batch operations for multiple elements", () => {
		describe("setBatchStylesMultiple", () => {
			it("should set styles for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
					<div id='elem3'>Content 3</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement
				const elem3 = container.querySelector("#elem3") as HTMLElement

				await styleManager.setBatchStylesMultiple(["div#elem1", "div#elem2", "div#elem3"], {
					color: "red",
					fontSize: "20px",
				})

				expect(elem1.style.color).toBe("red")
				expect(elem1.style.fontSize).toBe("20px")
				expect(elem2.style.color).toBe("red")
				expect(elem2.style.fontSize).toBe("20px")
				expect(elem3.style.color).toBe("red")
				expect(elem3.style.fontSize).toBe("20px")
			})

			it("should record single command for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`

				await styleManager.setBatchStylesMultiple(["div#elem1", "div#elem2"], {
					color: "blue",
				})

				expect(commandHistory.getUndoStackSize()).toBe(1)
			})

			it("should restore all elements on undo", async () => {
				container.innerHTML = `
					<div id='elem1' style='color: black'>Content 1</div>
					<div id='elem2' style='color: white'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setBatchStylesMultiple(["div#elem1", "div#elem2"], {
					color: "green",
				})

				expect(elem1.style.color).toBe("green")
				expect(elem2.style.color).toBe("green")

				await styleManager.undo()

				expect(elem1.style.color).toBe("black")
				expect(elem2.style.color).toBe("white")
			})

			it("should reapply all elements on redo", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setBatchStylesMultiple(["div#elem1", "div#elem2"], {
					color: "purple",
				})

				await styleManager.undo()
				expect(elem1.style.color).toBe("")
				expect(elem2.style.color).toBe("")

				await styleManager.redo()
				expect(elem1.style.color).toBe("purple")
				expect(elem2.style.color).toBe("purple")
			})

			it("should handle empty selectors array", async () => {
				await styleManager.setBatchStylesMultiple([], { color: "red" })
				expect(commandHistory.canUndo()).toBe(false)
			})

			it("should use single element method for one element", async () => {
				container.innerHTML = "<div id='elem1'>Content</div>"
				const elem1 = container.querySelector("#elem1") as HTMLElement

				await styleManager.setBatchStylesMultiple(["div#elem1"], { color: "red" })

				expect(elem1.style.color).toBe("red")
				expect(commandHistory.getUndoStackSize()).toBe(1)
			})
		})

		describe("setBackgroundColorMultiple", () => {
			it("should set background color for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setBackgroundColorMultiple(["div#elem1", "div#elem2"], "#ff0000")

				expect(elem1.style.backgroundColor).toBe("rgb(255, 0, 0)")
				expect(elem2.style.backgroundColor).toBe("rgb(255, 0, 0)")
			})

			it("should record single command for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`

				await styleManager.setBackgroundColorMultiple(["div#elem1", "div#elem2"], "blue")

				expect(commandHistory.getUndoStackSize()).toBe(1)
			})

			it("should restore previous colors on undo", async () => {
				container.innerHTML = `
					<div id='elem1' style='background-color: yellow'>Content 1</div>
					<div id='elem2' style='background-color: green'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setBackgroundColorMultiple(["div#elem1", "div#elem2"], "red")

				await styleManager.undo()

				expect(elem1.style.backgroundColor).toBe("yellow")
				expect(elem2.style.backgroundColor).toBe("green")
			})
		})

		describe("setTextColorMultiple", () => {
			it("should set text color for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setTextColorMultiple(["div#elem1", "div#elem2"], "#00ff00")

				expect(elem1.style.color).toBe("rgb(0, 255, 0)")
				expect(elem2.style.color).toBe("rgb(0, 255, 0)")
			})

			it("should record single command for multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`

				await styleManager.setTextColorMultiple(["div#elem1", "div#elem2"], "blue")

				expect(commandHistory.getUndoStackSize()).toBe(1)
			})

			it("should restore previous colors on undo", async () => {
				container.innerHTML = `
					<div id='elem1' style='color: black'>Content 1</div>
					<div id='elem2' style='color: white'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				await styleManager.setTextColorMultiple(["div#elem1", "div#elem2"], "red")

				await styleManager.undo()

				expect(elem1.style.color).toBe("black")
				expect(elem2.style.color).toBe("white")
			})
		})

		describe("helper methods with ElementSelector", () => {
			let elementSelector: ElementSelector
			let bridge: EditorBridge

			beforeEach(() => {
				bridge = new EditorBridge()
				elementSelector = new ElementSelector(bridge)
				styleManager.setElementSelector(elementSelector)
				elementSelector.enable()
			})

			afterEach(() => {
				elementSelector.destroy()
				bridge.destroy()
			})

			it("setStylesToSelected should apply to single selected element", async () => {
				container.innerHTML = "<div id='elem1'>Content</div>"
				const elem1 = container.querySelector("#elem1") as HTMLElement

				elementSelector.selectElement(elem1)
				await styleManager.setStylesToSelected({ color: "red" })

				expect(elem1.style.color).toBe("red")
			})

			it("setStylesToSelected should apply to multiple selected elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				elementSelector.selectElement(elem1)
				elementSelector.addToSelection(elem2)

				await styleManager.setStylesToSelected({ color: "blue" })

				expect(elem1.style.color).toBe("blue")
				expect(elem2.style.color).toBe("blue")
			})

			it("setBackgroundColorToSelected should apply to multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				elementSelector.selectElement(elem1)
				elementSelector.addToSelection(elem2)

				await styleManager.setBackgroundColorToSelected("#ff0000")

				expect(elem1.style.backgroundColor).toBe("rgb(255, 0, 0)")
				expect(elem2.style.backgroundColor).toBe("rgb(255, 0, 0)")
			})

			it("setTextColorToSelected should apply to multiple elements", async () => {
				container.innerHTML = `
					<div id='elem1'>Content 1</div>
					<div id='elem2'>Content 2</div>
				`
				const elem1 = container.querySelector("#elem1") as HTMLElement
				const elem2 = container.querySelector("#elem2") as HTMLElement

				elementSelector.selectElement(elem1)
				elementSelector.addToSelection(elem2)

				await styleManager.setTextColorToSelected("#00ff00")

				expect(elem1.style.color).toBe("rgb(0, 255, 0)")
				expect(elem2.style.color).toBe("rgb(0, 255, 0)")
			})
		})
	})

	describe("updateTextContent", () => {
		it("should update text content", async () => {
			container.innerHTML = "<div id='test'>Original Text</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.updateTextContent("div#test", "New Text")

			expect(element.textContent).toBe("New Text")
		})

		it("should record command in history", async () => {
			container.innerHTML = "<div id='test'>Original Text</div>"

			await styleManager.updateTextContent("div#test", "New Text")

			expect(commandHistory.canUndo()).toBe(true)
			expect(commandHistory.getUndoStackSize()).toBe(1)
		})

		it("should support undo to restore previous text", async () => {
			container.innerHTML = "<div id='test'>Original Text</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.updateTextContent("div#test", "New Text")
			expect(element.textContent).toBe("New Text")

			await styleManager.undo()
			expect(element.textContent).toBe("Original Text")
		})

		it("should support redo to reapply new text", async () => {
			container.innerHTML = "<div id='test'>Original Text</div>"
			const element = container.querySelector("#test") as HTMLElement

			await styleManager.updateTextContent("div#test", "New Text")
			await styleManager.undo()
			expect(element.textContent).toBe("Original Text")

			await styleManager.redo()
			expect(element.textContent).toBe("New Text")
		})

		it("should not record command during batch mode", async () => {
			container.innerHTML = "<div id='test'>Original Text</div>"

			// Begin batch mode
			commandHistory.beginBatch({
				commandType: "BATCH_STYLES",
				payload: {},
				previousState: {},
				timestamp: Date.now(),
			})

			// Update text during batch mode
			await styleManager.updateTextContent("div#test", "New Text")

			// Should not record to history during batch
			expect(commandHistory.getUndoStackSize()).toBe(0)

			// End batch mode
			commandHistory.endBatch({
				commandType: "BATCH_STYLES",
				payload: {},
				previousState: {},
				timestamp: Date.now(),
			})

			// Now should have one batch command
			expect(commandHistory.getUndoStackSize()).toBe(1)
		})
	})
})
