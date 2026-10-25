import { describe, expect, it } from "vitest"
import {
	getInspectableTextContent,
	INSPECTABLE_TEXT_CONTENT_SCRIPT,
	isNonTextualElementTag,
	NON_TEXTUAL_ELEMENT_TAGS,
} from "../inspectableTextContent"

describe("isNonTextualElementTag", () => {
	it("matches media and replaced-element tags case-insensitively", () => {
		expect(isNonTextualElementTag("VIDEO")).toBe(true)
		expect(isNonTextualElementTag("iframe")).toBe(true)
		expect(isNonTextualElementTag("div")).toBe(false)
		expect(NON_TEXTUAL_ELEMENT_TAGS.has("canvas")).toBe(true)
	})
})

describe("getInspectableTextContent", () => {
	it("ignores video fallback copy on the media element itself", () => {
		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		expect(getInspectableTextContent(video)).toBe("")
	})

	it("ignores audio fallback copy on the media element itself", () => {
		const audio = document.createElement("audio")
		audio.textContent = "您的浏览器不支持音频播放"
		expect(getInspectableTextContent(audio)).toBe("")
	})

	it("ignores iframe fallback copy", () => {
		const iframe = document.createElement("iframe")
		iframe.textContent = "Your browser does not support iframes."
		expect(getInspectableTextContent(iframe)).toBe("")
	})

	it("ignores canvas fallback copy", () => {
		const canvas = document.createElement("canvas")
		canvas.textContent = "Your browser does not support HTML canvas."
		expect(getInspectableTextContent(canvas)).toBe("")
	})

	it("excludes fallback text nested inside media descendants", () => {
		const container = document.createElement("div")
		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		container.appendChild(video)
		document.body.appendChild(container)

		expect(getInspectableTextContent(container)).toBe("")

		container.remove()
	})

	it("keeps sibling text while excluding nested media fallback", () => {
		const container = document.createElement("section")
		const title = document.createElement("h2")
		title.textContent = "产品演示"
		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		container.append(title, video)
		document.body.appendChild(container)

		expect(getInspectableTextContent(container)).toBe("产品演示")

		container.remove()
	})

	it("keeps meaningful svg text content", () => {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		const label = document.createElementNS("http://www.w3.org/2000/svg", "text")
		label.textContent = "Play"
		svg.appendChild(label)

		expect(getInspectableTextContent(svg)).toBe("Play")
	})

	it("does not insert spaces between adjacent inline nodes", () => {
		const price = document.createElement("p")
		const symbol = document.createElement("span")
		symbol.textContent = "￥"
		const amount = document.createElement("strong")
		amount.textContent = "100"
		price.append(symbol, amount)

		expect(getInspectableTextContent(price)).toBe("￥100")
	})

	it("keeps Chinese words intact when inline tags split them", () => {
		const heading = document.createElement("h2")
		const first = document.createElement("span")
		first.textContent = "产品"
		const second = document.createElement("em")
		second.textContent = "演示"
		heading.append(first, second)

		expect(getInspectableTextContent(heading)).toBe("产品演示")
	})

	it("matches the inlined browser script on the same fixtures", () => {
		const getFromScript = new Function(
			`${INSPECTABLE_TEXT_CONTENT_SCRIPT}; return getInspectableTextContent;`,
		)() as (element: Element) => string

		const video = document.createElement("video")
		video.textContent = "您的浏览器不支持视频播放，请升级浏览器。"
		const container = document.createElement("section")
		const title = document.createElement("h2")
		title.textContent = "产品演示"
		container.append(title, video)
		document.body.appendChild(container)

		const price = document.createElement("p")
		const symbol = document.createElement("span")
		symbol.textContent = "￥"
		const amount = document.createElement("strong")
		amount.textContent = "100"
		price.append(symbol, amount)

		expect(getFromScript(video)).toBe(getInspectableTextContent(video))
		expect(getFromScript(container)).toBe(getInspectableTextContent(container))
		expect(getFromScript(price)).toBe(getInspectableTextContent(price))

		container.remove()
	})
})
