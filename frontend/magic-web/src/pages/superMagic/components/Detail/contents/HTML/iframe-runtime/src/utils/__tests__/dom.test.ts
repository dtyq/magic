/**
 * DOM utility functions tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getElementSelector, isInjectedElement } from "../dom"

describe("dom utils", () => {
	let container: HTMLElement

	beforeEach(() => {
		container = document.createElement("div")
		document.body.appendChild(container)
	})

	afterEach(() => {
		document.body.removeChild(container)
	})

	describe("getElementSelector", () => {
		it("should return 'html' for documentElement", () => {
			expect(getElementSelector(document.documentElement)).toBe("html")
		})

		it("should return 'body' for body element", () => {
			expect(getElementSelector(document.body)).toBe("body")
		})

		it("should return empty string for invalid input", () => {
			expect(getElementSelector(null as unknown as HTMLElement)).toBe("")
			expect(
				getElementSelector(document.createTextNode("text") as unknown as HTMLElement),
			).toBe("")
		})

		it("should generate selector with tag name", () => {
			container.innerHTML = '<div><span id="test"></span></div>'
			const span = container.querySelector("span")!
			const selector = getElementSelector(span)
			expect(selector).toContain("span")
		})

		it("should use ID when available", () => {
			container.innerHTML = '<div id="unique-id"></div>'
			const div = container.querySelector("div")!
			const selector = getElementSelector(div)
			expect(selector).toContain("#unique-id")
		})

		it("should escape special characters in ID", () => {
			container.innerHTML = '<div id="my.special:id"></div>'
			const div = container.querySelector("div")!
			const selector = getElementSelector(div)
			// CSS.escape should escape special characters
			expect(selector).toContain("div#")
		})

		it("should include classes when no ID", () => {
			container.innerHTML = '<div class="foo bar"></div>'
			const div = container.querySelector("div")!
			const selector = getElementSelector(div)
			expect(selector).toContain(".foo")
			expect(selector).toContain(".bar")
		})

		it("should exclude editor classes", () => {
			container.innerHTML = '<div class="foo __editor-selected __editor-hover"></div>'
			const div = container.querySelector("div")!
			const selector = getElementSelector(div)
			expect(selector).toContain(".foo")
			expect(selector).not.toContain("__editor-selected")
			expect(selector).not.toContain("__editor-hover")
		})

		it("should add nth-of-type when siblings have same tag", () => {
			container.innerHTML = `
				<div>
					<span class="item"></span>
					<span class="item"></span>
					<span class="item"></span>
				</div>
			`
			const spans = container.querySelectorAll("span")
			const selector2 = getElementSelector(spans[1] as HTMLElement)
			expect(selector2).toContain(":nth-of-type(2)")
		})

		it("should avoid class-subset collisions by adding nth-of-type", () => {
			container.innerHTML = `
				<div class="wrapper">
					<div class="card rounded p-6 mb-8 animate">
						<h3 class="title">A</h3>
					</div>
					<div class="card rounded p-6 animate">
						<h3 class="title">B</h3>
					</div>
				</div>
			`
			const cards = container.querySelectorAll(".card")
			const target = cards[1] as HTMLElement
			const selector = getElementSelector(target)

			expect(selector).toContain(":nth-of-type(2)")
			expect(container.querySelector(selector)).toBe(target)
			expect(container.querySelectorAll(selector)).toHaveLength(1)
		})

		it("should generate a unique selector for nested title elements with class-subset siblings", () => {
			container.innerHTML = `
				<div class="wrapper">
					<div class="card rounded p-6 mb-8 animate">
						<h3 class="title text-lg">A</h3>
					</div>
					<div class="card rounded p-6 animate">
						<h3 class="title text-lg">B</h3>
					</div>
				</div>
			`
			const titles = container.querySelectorAll("h3")
			const target = titles[1] as HTMLElement
			const selector = getElementSelector(target)

			expect(selector).toContain("div.card.rounded.p-6.animate:nth-of-type(2)")
			expect(container.querySelector(selector)).toBe(target)
			expect(container.querySelectorAll(selector)).toHaveLength(1)
		})

		it("should handle nested elements", () => {
			container.innerHTML = `
				<div class="parent">
					<div class="child">
						<span class="grandchild"></span>
					</div>
				</div>
			`
			const span = container.querySelector(".grandchild")!
			const selector = getElementSelector(span)
			expect(selector).toContain("span.grandchild")
		})

		it("should handle elements without classes", () => {
			container.innerHTML = "<div><p><span></span></p></div>"
			const span = container.querySelector("span")!
			const selector = getElementSelector(span)
			// The selector includes the test container div
			expect(selector).toContain("p > span")
		})

		it("should stop at ID and not traverse further", () => {
			container.innerHTML = `
				<div class="outer">
					<div id="middle">
						<span class="inner"></span>
					</div>
				</div>
			`
			const span = container.querySelector(".inner")!
			const selector = getElementSelector(span)
			// Should stop at #middle
			expect(selector).toContain("#middle")
			expect(selector).not.toContain(".outer")
		})

		it("should handle element without parent", () => {
			const orphan = document.createElement("div")
			orphan.className = "orphan"
			const selector = getElementSelector(orphan)
			expect(selector).toBe("div.orphan")
		})

		it("should handle empty className", () => {
			container.innerHTML = "<div></div>"
			const div = container.querySelector("div")!
			const selector = getElementSelector(div)
			expect(selector).toContain("div")
			expect(selector).not.toContain(".")
		})
	})

	describe("isInjectedElement", () => {
		it("should return true for element with data-injected attribute", () => {
			container.innerHTML = '<div data-injected="true"></div>'
			const div = container.querySelector("div")!
			expect(isInjectedElement(div)).toBe(true)
		})

		it("should return true for child of injected element", () => {
			container.innerHTML = `
				<div data-injected="true">
					<span></span>
				</div>
			`
			const span = container.querySelector("span")!
			expect(isInjectedElement(span)).toBe(true)
		})

		it("should return false for normal element", () => {
			container.innerHTML = "<div></div>"
			const div = container.querySelector("div")!
			expect(isInjectedElement(div)).toBe(false)
		})

		it("should return false for element with different data attribute", () => {
			container.innerHTML = '<div data-other="true"></div>'
			const div = container.querySelector("div")!
			expect(isInjectedElement(div)).toBe(false)
		})

		it("should handle nested injected elements", () => {
			container.innerHTML = `
				<div>
					<div data-injected="true">
						<div>
							<span></span>
						</div>
					</div>
				</div>
			`
			const span = container.querySelector("span")!
			expect(isInjectedElement(span)).toBe(true)
		})
	})
})
