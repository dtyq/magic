/**
 * ElementSelector tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ElementSelector } from "../ElementSelector"
import { EditorBridge } from "../../core/EditorBridge"

describe("ElementSelector", () => {
	let selector: ElementSelector
	let bridge: EditorBridge
	let container: HTMLElement
	let sendEventSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		bridge = new EditorBridge()
		sendEventSpy = vi.spyOn(bridge, "sendEvent")
		selector = new ElementSelector(bridge)

		container = document.createElement("div")
		container.id = "test-container"
		document.body.appendChild(container)
	})

	afterEach(() => {
		selector.destroy()
		bridge.destroy()
		document.body.removeChild(container)
		sendEventSpy.mockRestore()
	})

	describe("enable/disable", () => {
		it("should enable selection mode", () => {
			selector.enable()
			expect(() => selector.selectElement(document.createElement("div"))).not.toThrow()
		})

		it("should disable selection mode", () => {
			selector.enable()
			selector.disable()
			expect(() => selector.disable()).not.toThrow()
		})

		it("should deselect element on disable", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.enable()
			selector.selectElement(element)
			selector.disable()

			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENT_HOVER_END", {})
		})

		it("should not mutate global cursor style", () => {
			expect(document.body.style.cursor).toBe("")
			selector.enable()
			expect(document.body.style.cursor).toBe("")
			selector.disable()
			expect(document.body.style.cursor).toBe("")
		})
	})

	describe("selectElement", () => {
		it("should select valid element", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("div#test"),
					tagName: "div",
				}),
			)
		})

		it("should ignore body element", () => {
			selector.selectElement(document.body)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENT_SELECTED", expect.anything())
		})

		it("should ignore documentElement", () => {
			selector.selectElement(document.documentElement)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENT_SELECTED", expect.anything())
		})

		it("should ignore injected elements", () => {
			container.innerHTML = '<div data-injected="true">Content</div>'
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENT_SELECTED", expect.anything())
		})

		it("should include computed styles", () => {
			container.innerHTML = '<div id="styled" style="color: red;">Content</div>'
			const element = container.querySelector("#styled") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					computedStyles: expect.objectContaining({
						color: expect.any(String),
					}),
				}),
			)
		})

		it("should include element rect", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					rect: expect.objectContaining({
						top: expect.any(Number),
						left: expect.any(Number),
						width: expect.any(Number),
						height: expect.any(Number),
					}),
				}),
			)
		})

		it("should detect text elements", () => {
			container.innerHTML = "<p>Text content</p>"
			const element = container.querySelector("p") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isTextElement: true,
					textContent: "Text content",
				}),
			)
		})

		it("should detect non-text elements", () => {
			container.innerHTML = "<div><img src='test.jpg' /></div>"
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isTextElement: false,
				}),
			)
		})

		it("should handle rotated elements", () => {
			container.innerHTML = '<div style="transform: rotate(45deg);">Rotated</div>'
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					rotation: expect.any(Number),
				}),
			)
		})
	})

	describe("deselectElement", () => {
		it("should clear selection", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.selectElement(element)
			sendEventSpy.mockClear()

			selector.deselectElement()

			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})

		it("should handle deselect when nothing selected", () => {
			selector.deselectElement()
			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})
	})

	describe("clearSelection", () => {
		it("should be alias for deselectElement", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.selectElement(element)
			sendEventSpy.mockClear()

			selector.clearSelection()

			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})
	})

	describe("text editing callback", () => {
		it("should call callback when set", () => {
			const callback = vi.fn()
			selector.setTextEditingCallback(callback)

			container.innerHTML = "<p>Text</p>"
			const element = container.querySelector("p") as HTMLElement

			selector.enable()
			selector.selectElement(element)

			// Simulate second click
			sendEventSpy.mockClear()
			element.click()

			// Need to wait for event handler
			setTimeout(() => {
				expect(callback).toHaveBeenCalledWith(expect.stringContaining("p"))
			}, 0)
		})
	})

	describe("event handling", () => {
		it("should emit hover event on mousemove", () => {
			container.innerHTML = "<div id='hover-test'>Content</div>"
			const element = container.querySelector("#hover-test") as HTMLElement

			selector.enable()

			const event = new MouseEvent("mousemove", {
				bubbles: true,
				cancelable: true,
			})
			Object.defineProperty(event, "target", { value: element, enumerable: true })

			document.dispatchEvent(event)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_HOVERED",
				expect.objectContaining({
					rect: expect.any(Object),
				}),
			)
		})

		it("should not emit hover when disabled", () => {
			container.innerHTML = "<div id='hover-test'>Content</div>"
			const element = container.querySelector("#hover-test") as HTMLElement

			selector.disable()

			const event = new MouseEvent("mousemove", {
				bubbles: true,
				cancelable: true,
			})
			Object.defineProperty(event, "target", { value: element, enumerable: true })

			document.dispatchEvent(event)

			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENT_HOVERED", expect.anything())
		})

		it("should select element on click", () => {
			container.innerHTML = "<div id='click-test'>Content</div>"
			const element = container.querySelector("#click-test") as HTMLElement

			selector.enable()

			const event = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			})
			Object.defineProperty(event, "target", { value: element, enumerable: true })

			document.dispatchEvent(event)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("div#click-test"),
				}),
			)
		})

		it("should not select element on click when text is selected", () => {
			container.innerHTML =
				'<div id="text-element" contenteditable="true">Some text content</div><div id="other-element">Other element</div>'
			const textElement = container.querySelector("#text-element") as HTMLElement
			const otherElement = container.querySelector("#other-element") as HTMLElement

			selector.enable()

			// Create a text selection
			const range = document.createRange()
			const textNode = textElement.firstChild as Node
			range.setStart(textNode, 0)
			range.setEnd(textNode, 9) // Select "Some text"

			const selection = window.getSelection()
			selection?.removeAllRanges()
			selection?.addRange(range)

			// Verify text is selected
			expect(selection?.toString()).toBe("Some text")

			// Try to click on other element while text is selected
			sendEventSpy.mockClear()
			const event = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			})
			Object.defineProperty(event, "target", { value: otherElement, enumerable: true })

			document.dispatchEvent(event)

			// Should NOT select the other element
			expect(sendEventSpy).not.toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("div#other-element"),
				}),
			)
		})

		it("should deselect on Escape key", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.enable()
			selector.selectElement(element)
			sendEventSpy.mockClear()

			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			})

			document.dispatchEvent(event)

			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})
	})

	describe("destroy", () => {
		it("should cleanup on destroy", () => {
			container.innerHTML = "<div id='test'>Content</div>"
			const element = container.querySelector("#test") as HTMLElement

			selector.enable()
			selector.selectElement(element)
			selector.destroy()

			expect(document.body.style.cursor).toBe("")
		})

		it("should remove scroll listeners", () => {
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

			selector.destroy()

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"scroll",
				expect.any(Function),
				true,
			)
			expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function))

			removeEventListenerSpy.mockRestore()
		})
	})

	describe("edge cases", () => {
		it("should handle null element gracefully", () => {
			expect(() => {
				selector.selectElement(null as unknown as HTMLElement)
			}).not.toThrow()
		})

		it("should handle element without classes", () => {
			container.innerHTML = "<div>No classes</div>"
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.any(String),
				}),
			)
		})

		it("should handle elements with transform", () => {
			container.innerHTML =
				'<div style="transform: matrix(1, 0, 0, 1, 10, 20);">Transformed</div>'
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					rotation: expect.any(Number),
				}),
			)
		})

		it("should handle text elements with multiple children", () => {
			container.innerHTML = `
				<div>
					<span>Child 1</span>
					<span>Child 2</span>
					<span>Child 3</span>
				</div>
			`
			const element = container.querySelector("div") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isTextElement: false, // Has multiple children
				}),
			)
		})
	})

	describe("Multi-select functionality", () => {
		it("should select multiple elements in multi-select mode", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			sendEventSpy.mockClear()

			// First element - single select
			selector.selectElement(element1, false)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("element1"),
				}),
			)

			sendEventSpy.mockClear()

			// Second element - multi-select
			selector.selectElement(element2, true)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENTS_SELECTED",
				expect.objectContaining({
					elements: expect.arrayContaining([
						expect.objectContaining({
							selector: expect.stringContaining("element1"),
						}),
						expect.objectContaining({
							selector: expect.stringContaining("element2"),
						}),
					]),
				}),
			)
		})

		it("should check if element is selected", () => {
			container.innerHTML = '<div id="test">Content</div>'
			const element = container.querySelector("#test") as HTMLElement

			expect(selector.isSelected(element)).toBe(false)

			selector.selectElement(element)

			expect(selector.isSelected(element)).toBe(true)
		})

		it("should add element to selection", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			sendEventSpy.mockClear()

			selector.selectElement(element1, false)
			expect(selector.isSelected(element1)).toBe(true)

			sendEventSpy.mockClear()
			selector.addToSelection(element2)

			expect(selector.isSelected(element2)).toBe(true)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENTS_SELECTED",
				expect.objectContaining({
					elements: expect.arrayContaining([
						expect.objectContaining({
							selector: expect.stringContaining("element1"),
						}),
						expect.objectContaining({
							selector: expect.stringContaining("element2"),
						}),
					]),
				}),
			)
		})

		it("should remove element from selection", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			// Select both elements
			selector.selectElement(element1, false)
			selector.selectElement(element2, true)

			expect(selector.isSelected(element1)).toBe(true)
			expect(selector.isSelected(element2)).toBe(true)

			sendEventSpy.mockClear()

			// Remove element1
			selector.removeFromSelection(element1)

			expect(selector.isSelected(element1)).toBe(false)
			expect(selector.isSelected(element2)).toBe(true)

			// Should send ELEMENT_SELECTED (single element remaining)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("element2"),
				}),
			)
		})

		it("should clear all selections", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			// Select both elements
			selector.selectElement(element1, false)
			selector.selectElement(element2, true)

			expect(selector.isSelected(element1)).toBe(true)
			expect(selector.isSelected(element2)).toBe(true)

			sendEventSpy.mockClear()

			// Clear selection
			selector.clearSelection()

			expect(selector.isSelected(element1)).toBe(false)
			expect(selector.isSelected(element2)).toBe(false)

			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})

		it("should get all selected elements info", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			selector.selectElement(element1, false)
			selector.selectElement(element2, true)

			const infos = selector.getSelectedElementsInfo()

			expect(infos).toHaveLength(2)
			expect(infos[0]).toMatchObject({
				tagName: "div",
				selector: expect.stringContaining("element"),
			})
			expect(infos[1]).toMatchObject({
				tagName: "div",
				selector: expect.stringContaining("element"),
			})
		})

		it("should not enable text editing in multi-select mode", () => {
			container.innerHTML = `
				<p id="text1">Text 1</p>
				<p id="text2">Text 2</p>
			`
			const text1 = container.querySelector("#text1") as HTMLElement
			const text2 = container.querySelector("#text2") as HTMLElement

			// Single select - should enable text editing
			selector.selectElement(text1, false)
			expect(text1.contentEditable).toBe("true")

			// Multi-select - should not enable text editing
			selector.selectElement(text2, true)
			// contentEditable should NOT be "true" in multi-select mode
			expect(text2.contentEditable).not.toBe("true")
			expect(text2.getAttribute("data-text-editing")).not.toBe("true")
		})

		it("should send ELEMENT_SELECTED when only one element remains", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
				<div id="element3">Element 3</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement
			const element3 = container.querySelector("#element3") as HTMLElement

			// Select three elements
			selector.selectElement(element1, false)
			selector.selectElement(element2, true)
			selector.selectElement(element3, true)

			sendEventSpy.mockClear()

			// Remove two elements, leaving one
			selector.removeFromSelection(element2)
			selector.removeFromSelection(element3)

			// Should send ELEMENT_SELECTED (single element)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					selector: expect.stringContaining("element1"),
				}),
			)
		})

		it("should clear previous selections in single-select mode", () => {
			container.innerHTML = `
				<div id="element1">Element 1</div>
				<div id="element2">Element 2</div>
			`
			const element1 = container.querySelector("#element1") as HTMLElement
			const element2 = container.querySelector("#element2") as HTMLElement

			// Select first element
			selector.selectElement(element1, false)
			expect(selector.isSelected(element1)).toBe(true)

			// Select second element without multi-select - should clear first
			selector.selectElement(element2, false)

			expect(selector.isSelected(element1)).toBe(false)
			expect(selector.isSelected(element2)).toBe(true)
		})
	})
})
