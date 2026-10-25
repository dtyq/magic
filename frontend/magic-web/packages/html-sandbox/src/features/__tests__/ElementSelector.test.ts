/**
 * ElementSelector tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ElementSelector } from "../ElementSelector"
import { EditorBridge } from "../../core/EditorBridge"
import { markSourceNode, markSourceNodes } from "../../utils/sourceNodes"

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
		document.documentElement.removeAttribute("data-magic-source-node")
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

		it("should inject editor-only text editing styles", () => {
			const style = document.getElementById("magic-editor-text-editing-style")

			expect(style?.getAttribute("data-injected")).toBe("true")
			expect(style?.textContent).toContain('[data-text-editing="true"]')
		})
	})

	describe("selectElement", () => {
		it("rejects JavaScript-created descendants and reports clicks without selecting them", () => {
			container.innerHTML = '<p id="fixed">Fixed</p>'
			markSourceNodes(document)
			const fixed = container.querySelector("#fixed") as HTMLElement
			const dynamic = document.createElement("p")
			dynamic.textContent = "Dynamic"
			container.appendChild(dynamic)

			selector.selectElement(fixed)
			sendEventSpy.mockClear()
			selector.selectElement(dynamic)
			expect(selector.getSelectedCount()).toBe(1)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENT_SELECTED", expect.anything())

			selector.enable()
			dynamic.click()
			expect(sendEventSpy).toHaveBeenCalledWith("DYNAMIC_ELEMENT_CLICKED", {})
			expect(selector.getSelectedCount()).toBe(0)
		})

		it("allows editor-inserted nodes after they receive source provenance", () => {
			container.innerHTML = "<section id='fixed'>Fixed</section>"
			markSourceNodes(document)
			const inserted = document.createElement("p")
			inserted.textContent = "Inserted"
			container.appendChild(inserted)
			markSourceNode(inserted)

			selector.selectElement(inserted)

			expect(selector.getSelectedCount()).toBe(1)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({ tagName: "p" }),
			)
		})

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

		it("should refresh an already selected image without emitting deselection", () => {
			container.innerHTML = '<img id="image" src="test.jpg" />'
			const element = container.querySelector("#image") as HTMLElement

			selector.selectElement(element)
			sendEventSpy.mockClear()
			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledTimes(1)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isImageElement: true,
				}),
			)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
		})

		it("should reduce a multi-selection to the clicked element in single-select mode", () => {
			container.innerHTML = '<div id="first">First</div><div id="second">Second</div>'
			const first = container.querySelector("#first") as HTMLElement
			const second = container.querySelector("#second") as HTMLElement

			selector.selectElement(first)
			selector.selectElement(second, true)
			sendEventSpy.mockClear()
			selector.selectElement(second)

			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
			expect(sendEventSpy).toHaveBeenCalledTimes(1)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({ selector: expect.stringContaining("div#second") }),
			)
			expect(selector.getSelectedCount()).toBe(1)
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

		it("includes ancestor path for parent selection", () => {
			container.innerHTML =
				'<section id="group"><article id="card"><h2 id="title">春季特惠</h2></article></section>'
			const element = container.querySelector("#title") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					ancestors: expect.arrayContaining([
						expect.objectContaining({
							tagName: "article",
							textContent: expect.stringContaining("春季特惠"),
						}),
						expect.objectContaining({
							tagName: "section",
						}),
					]),
				}),
			)
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

		it("omits computed offsets when the element has no inline position", () => {
			container.innerHTML = '<div id="static">Content</div>'
			const element = container.querySelector("#static") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					computedStyles: expect.not.objectContaining({
						top: expect.anything(),
						left: expect.anything(),
						right: expect.anything(),
						bottom: expect.anything(),
					}),
				}),
			)
		})

		it("keeps used offsets for class-positioned absolute elements", () => {
			const style = document.createElement("style")
			style.textContent = ".pinned { position: absolute; }"
			document.head.appendChild(style)
			container.innerHTML = '<div id="pinned" class="pinned">Content</div>'
			const element = container.querySelector("#pinned") as HTMLElement
			const originalGetComputedStyle = window.getComputedStyle
			const usedOffsets: Record<string, string> = {
				position: "absolute",
				top: "48px",
				left: "24px",
				right: "16px",
				bottom: "8px",
			}
			window.getComputedStyle = ((target: Element) => {
				const computed = originalGetComputedStyle(target)
				if (target !== element) return computed
				return new Proxy(computed, {
					get(style, prop) {
						if (typeof prop === "string" && prop in usedOffsets) {
							return usedOffsets[prop]
						}
						return Reflect.get(style, prop)
					},
				})
			}) as typeof window.getComputedStyle

			try {
				selector.selectElement(element)

				expect(sendEventSpy).toHaveBeenCalledWith(
					"ELEMENT_SELECTED",
					expect.objectContaining({
						computedStyles: expect.objectContaining({
							position: "absolute",
							top: "48px",
							left: "24px",
							right: "16px",
							bottom: "8px",
						}),
					}),
				)
			} finally {
				window.getComputedStyle = originalGetComputedStyle
				style.remove()
			}
		})

		it("should ignore inactive media-query line-height rules", () => {
			const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation((query) => {
				return {
					matches: !String(query).includes("max-width"),
					media: String(query),
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				} as MediaQueryList
			})
			const style = document.createElement("style")
			style.textContent = `
				#title { font-size: 24px; line-height: 1.5; }
				@media (max-width: 400px) { #title { line-height: 1.1; } }
			`
			document.head.appendChild(style)
			container.innerHTML = '<h1 id="title">Title</h1>'
			const element = container.querySelector("#title") as HTMLElement

			try {
				selector.selectElement(element)

				expect(sendEventSpy).toHaveBeenCalledWith(
					"ELEMENT_SELECTED",
					expect.objectContaining({
						computedStyles: expect.objectContaining({
							lineHeight: "1.5",
						}),
					}),
				)
			} finally {
				matchMediaSpy.mockRestore()
				style.remove()
			}
		})

		it("should keep a specified unitless line-height instead of used pixels", () => {
			const style = document.createElement("style")
			style.textContent = "#ratio-title { font-size: 92px; line-height: 1.04; }"
			document.head.appendChild(style)
			container.innerHTML = '<h1 id="ratio-title">Title</h1>'
			const element = container.querySelector("#ratio-title") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					computedStyles: expect.objectContaining({
						lineHeight: "1.04",
					}),
				}),
			)
			style.remove()
		})

		it("should keep authored inline width available for the editor", () => {
			container.innerHTML = '<div id="full-width" style="width: 100%;">Content</div>'
			const element = container.querySelector("#full-width") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					inlineStyles: expect.objectContaining({
						width: "100%",
					}),
				}),
			)
		})

		it("should include editable inline styles", () => {
			container.innerHTML =
				'<div id="inline-styled" style="color: red; --card-gap: 12px;">Content</div>'
			const element = container.querySelector("#inline-styled") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					inlineStyles: {
						color: "red",
						"--card-gap": "12px",
					},
				}),
			)
		})

		it("recognizes configured click links on non-anchor elements", () => {
			container.innerHTML = '<div id="linked" data-magic-href="slide-2.html">Go</div>'
			selector.selectElement(container.querySelector("#linked") as HTMLElement)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					attributes: expect.objectContaining({ dataMagicHref: "slide-2.html" }),
				}),
			)
		})

		it("should include flex item and parent flex context in computed styles", () => {
			container.innerHTML = `
				<div id="layout" style="display: flex; flex-direction: row; justify-content: flex-start; align-items: stretch;">
					<main id="content" style="flex: 1 1 0%; min-width: 0;">Content</main>
				</div>
			`
			const element = container.querySelector("#content") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					computedStyles: expect.objectContaining({
						parentSelector: expect.stringContaining("div#layout"),
						parentDisplay: "flex",
						parentFlexDirection: "row",
						parentJustifyContent: "flex-start",
						parentAlignItems: "stretch",
						flexGrow: "1",
						flexShrink: "1",
						flexBasis: "0%",
						minWidth: expect.any(String),
						alignSelf: expect.any(String),
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

		it("includes in-flow child rects for a flex container", () => {
			container.innerHTML = `
				<div id="cards" style="display:flex;gap:20px">
					<div id="a" style="width:80px;height:40px"></div>
					<div id="b" style="width:80px;height:40px"></div>
				</div>
			`
			selector.selectElement(container.querySelector("#cards") as HTMLElement)
			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					childRects: expect.arrayContaining([
						expect.objectContaining({
							width: expect.any(Number),
							height: expect.any(Number),
						}),
					]),
				}),
			)
			const payload = sendEventSpy.mock.calls.find(
				(call) => call[0] === "ELEMENT_SELECTED",
			)?.[1] as {
				childRects: unknown[]
			}
			expect(payload.childRects).toHaveLength(2)
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

		it("should include intrinsic image metadata when selecting an image", () => {
			container.innerHTML = '<img id="image" src="test.jpg" width="320" height="180" />'
			const element = container.querySelector("#image") as HTMLImageElement

			Object.defineProperty(element, "naturalWidth", {
				configurable: true,
				value: 640,
			})
			Object.defineProperty(element, "naturalHeight", {
				configurable: true,
				value: 360,
			})

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					tagName: "img",
					isImageElement: true,
					intrinsicWidth: 640,
					intrinsicHeight: 360,
					intrinsicAspectRatio: 640 / 360,
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

		it("should emit a host-requested hover without changing selection", () => {
			container.innerHTML = "<div id='tree-hover-test'>Content</div>"
			const element = container.querySelector("#tree-hover-test") as HTMLElement

			selector.enable()
			selector.hoverElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_HOVERED",
				expect.objectContaining({ rect: expect.any(Object) }),
			)
			expect(selector.getSelectedCount()).toBe(0)

			sendEventSpy.mockClear()
			selector.clearHoveredElement()
			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENT_HOVER_END", {})
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

		it.each([
			["body", () => document.body],
			["html", () => document.documentElement],
		])("should deselect the current element when clicking %s", (_label, getTarget) => {
			container.innerHTML = "<div id='selected-block'>Content</div>"
			const element = container.querySelector("#selected-block") as HTMLElement

			selector.enable()
			selector.selectElement(element)
			sendEventSpy.mockClear()

			const event = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			})
			Object.defineProperty(event, "target", { value: getTarget(), enumerable: true })
			document.dispatchEvent(event)

			expect(selector.getSelectedCount()).toBe(0)
			expect(sendEventSpy).toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
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

		it("should keep selection when Escape was already consumed by the host", () => {
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
			event.preventDefault()
			document.dispatchEvent(event)

			expect(selector.getSelectedCount()).toBe(1)
			expect(sendEventSpy).not.toHaveBeenCalledWith("ELEMENTS_DESELECTED", {})
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

		it("should report visual rect dimensions for scaled elements", () => {
			container.innerHTML =
				'<div style="transform: matrix(0.5, 0, 0, 0.5, 10, 20);">Scaled</div>'
			const element = container.querySelector("div") as HTMLElement

			Object.defineProperties(element, {
				offsetWidth: { configurable: true, value: 400 },
				offsetHeight: { configurable: true, value: 200 },
			})
			element.getBoundingClientRect = vi.fn(
				() =>
					({
						top: 120,
						left: 80,
						width: 200,
						height: 100,
						right: 280,
						bottom: 220,
						x: 80,
						y: 120,
						toJSON: () => ({}),
					}) as DOMRect,
			)

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					rect: {
						top: 120,
						left: 80,
						width: 200,
						height: 100,
					},
					rotation: 0,
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
					isTextElement: true,
					hasDirectTextContent: false,
				}),
			)
		})

		it("should report direct text separately from descendant text", () => {
			container.innerHTML = `
				<div id="mixed">
					Direct text
					<span>Descendant text</span>
				</div>
			`
			const element = container.querySelector("#mixed") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					hasDirectTextContent: true,
				}),
			)
		})

		it("reports only the container's own text when it also has an image", () => {
			container.innerHTML = `
				<div id="card">
					<img src="icon.png" alt="" />
					从低渗透率盆地读向高增长脊线
					<p>Subtitle</p>
				</div>
			`
			const element = container.querySelector("#card") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isTextElement: true,
					hasDirectTextContent: true,
					textContent: "从低渗透率盆地读向高增长脊线",
				}),
			)
		})

		it("excludes inline child text from a selected block text container", () => {
			container.innerHTML = `
				<span id="metric" style="display: block">
					中国 ·<span style="text-decoration: line-through"> 55%渗透率</span>
				</span>
			`
			const element = container.querySelector("#metric") as HTMLElement

			selector.selectElement(element)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENT_SELECTED",
				expect.objectContaining({
					isTextElement: true,
					hasDirectTextContent: true,
					textContent: "中国 ·",
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

		it("keeps shift-clicks from extending a browser text range and still adds to the selection", () => {
			container.innerHTML = '<p id="one">One</p><p id="two">Two</p>'
			const one = container.querySelector("#one") as HTMLElement
			const two = container.querySelector("#two") as HTMLElement
			markSourceNodes(document)
			selector.enable()
			selector.selectElement(one)
			const range = document.createRange()
			range.selectNodeContents(one)
			window.getSelection()?.addRange(range)

			const plain = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
			two.dispatchEvent(plain)
			expect(plain.defaultPrevented).toBe(false)

			const shifted = new MouseEvent("mousedown", {
				bubbles: true,
				cancelable: true,
				shiftKey: true,
			})
			two.dispatchEvent(shifted)
			expect(shifted.defaultPrevented).toBe(true)
			expect(window.getSelection()?.isCollapsed).toBe(true)

			sendEventSpy.mockClear()
			two.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }),
			)
			expect(selector.isSelected(one)).toBe(true)
			expect(selector.isSelected(two)).toBe(true)
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

		it("should include intrinsic image metadata in multi-select payloads", () => {
			container.innerHTML = `
				<img id="image-1" src="one.jpg" />
				<img id="image-2" src="two.jpg" />
			`
			const image1 = container.querySelector("#image-1") as HTMLImageElement
			const image2 = container.querySelector("#image-2") as HTMLImageElement

			Object.defineProperty(image1, "naturalWidth", {
				configurable: true,
				value: 800,
			})
			Object.defineProperty(image1, "naturalHeight", {
				configurable: true,
				value: 400,
			})
			Object.defineProperty(image2, "naturalWidth", {
				configurable: true,
				value: 300,
			})
			Object.defineProperty(image2, "naturalHeight", {
				configurable: true,
				value: 200,
			})

			selector.selectElement(image1, false)
			sendEventSpy.mockClear()
			selector.selectElement(image2, true)

			expect(sendEventSpy).toHaveBeenCalledWith(
				"ELEMENTS_SELECTED",
				expect.objectContaining({
					elements: expect.arrayContaining([
						expect.objectContaining({
							selector: expect.stringContaining("image-1"),
							isImageElement: true,
							intrinsicWidth: 800,
							intrinsicHeight: 400,
							intrinsicAspectRatio: 2,
						}),
						expect.objectContaining({
							selector: expect.stringContaining("image-2"),
							isImageElement: true,
							intrinsicWidth: 300,
							intrinsicHeight: 200,
							intrinsicAspectRatio: 1.5,
						}),
					]),
				}),
			)
		})

		it("should not enable text editing in multi-select mode", () => {
			container.innerHTML = `
				<p id="text1" style="COLOR:red; margin:0  8px!important">Text 1</p>
				<p id="text2">Text 2</p>
			`
			const text1 = container.querySelector("#text1") as HTMLElement
			const text2 = container.querySelector("#text2") as HTMLElement
			const originalStyle = text1.getAttribute("style")

			// Single selection keeps the existing pre-editing DOM state.
			selector.selectElement(text1, false)
			expect(text1.contentEditable).toBe("true")
			expect(text1.getAttribute("data-text-editing")).toBe("true")
			expect(text1.getAttribute("style")).toBe(originalStyle)

			selector.selectElement(text2, true)
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
