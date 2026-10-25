import { afterEach, describe, expect, it } from "vitest"
import { getBrowserInfo } from "../browser"

const originalUserAgent = navigator.userAgent

function setUserAgent(userAgent: string) {
	Object.defineProperty(navigator, "userAgent", {
		configurable: true,
		value: userAgent,
	})
}

afterEach(() => {
	setUserAgent(originalUserAgent)
})

describe("getBrowserInfo", () => {
	it("identifies Chromium Edge before the Chrome token", () => {
		setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
				"Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0",
		)

		expect(getBrowserInfo()).toMatchObject({
			name: "Edge",
			version: 152,
			isOutdated: false,
		})
	})

	it("detects Chrome 100 as outdated and Chrome 111 as supported", () => {
		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
				"(KHTML, like Gecko) Chrome/100.0.4892.0 Safari/537.36",
		)
		expect(getBrowserInfo()).toMatchObject({
			name: "Chrome",
			version: 100,
			isOutdated: true,
		})

		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
				"(KHTML, like Gecko) Chrome/111.0.5563.64 Safari/537.36",
		)
		expect(getBrowserInfo()).toMatchObject({
			name: "Chrome",
			version: 111,
			isOutdated: false,
		})
	})

	it("detects Safari 16.3 as outdated and Safari 16.4 as supported", () => {
		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
				"(KHTML, like Gecko) Version/16.3 Safari/605.1.15",
		)
		expect(getBrowserInfo()).toMatchObject({
			name: "Safari",
			version: 16.3,
			isOutdated: true,
		})

		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
				"(KHTML, like Gecko) Version/16.4 Safari/605.1.15",
		)
		expect(getBrowserInfo()).toMatchObject({
			name: "Safari",
			version: 16.4,
			isOutdated: false,
		})
	})
})
