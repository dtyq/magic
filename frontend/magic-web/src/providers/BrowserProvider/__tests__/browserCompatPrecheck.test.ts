import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

/**
 * Early pre-check script served from `public/`. Keep this file name in sync with the
 * `<script src="/browser-compat.vN.js">` reference in the edition `index.html` files.
 */
const precheckScript = readFileSync(resolve(process.cwd(), "public/browser-compat.v3.js"), "utf8")

const MODAL_SELECTOR = "#__browser_compat_modal__"
const CONTINUE_BUTTON_SELECTOR = "#__btn_browser_continue__"
const SUPPRESS_CHECKBOX_SELECTOR = "#__chk_browser_14d__"
const SUPPRESSED_UNTIL_KEY = "MAGIC_BROWSER_WARN_SUPPRESSED_UNTIL"
const DINGTALK_TIP_SELECTOR = "#__dingtalk_browser_tip__"

/** DingTalk on Android, which cannot switch to an external browser by itself. */
const DINGTALK_ANDROID_USER_AGENT =
	"Mozilla/5.0 (Linux; Android 12; SampleDevice Build/SAMPLE) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Mobile Safari/537.36 " +
	"AliApp(DingTalk/1.0.0) com.alibaba.android.rimet/10000000"

/** DingTalk on iOS: guidance targets the Android webview only. */
const DINGTALK_IOS_USER_AGENT =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 " +
	"(KHTML, like Gecko) Mobile/15E148 DingTalk/1.0.0"

const originalAddEventListener = document.addEventListener.bind(document)
const ORIGINAL_USER_AGENT = navigator.userAgent
const ORIGINAL_LANGUAGE = navigator.language

/** Listeners the script registers for `DOMContentLoaded`. */
let domContentLoadedListeners: Array<() => void> = []
let addEventListenerSpy: MockInstance

function setUserAgent(userAgent: string) {
	Object.defineProperty(navigator, "userAgent", {
		configurable: true,
		value: userAgent,
	})
}

/** Overrides the document language that selects the localized copy. */
function setLanguage(language: string) {
	Object.defineProperty(navigator, "language", {
		configurable: true,
		value: language,
	})
}

function setOutdatedUserAgent() {
	setUserAgent(
		"Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 " +
			"(KHTML, like Gecko) Chrome/100.0.4896.58 Mobile Safari/537.36",
	)
}

/** Removes the overlay and the suppression state so every test starts from a clean page. */
function resetPageState() {
	document.querySelectorAll(MODAL_SELECTOR).forEach((element) => element.remove())
	window.localStorage.clear()
	window.sessionStorage.clear()
}

/**
 * Evaluates the pre-check script the way the browser does, with the document still
 * parsing so the script registers its `DOMContentLoaded` listener.
 */
function runPrecheckScript() {
	const readyStateDescriptor = Object.getOwnPropertyDescriptor(document, "readyState")
	Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" })

	try {
		new Function(precheckScript)()
	} finally {
		if (readyStateDescriptor) {
			Object.defineProperty(document, "readyState", readyStateDescriptor)
		} else {
			delete (document as unknown as Record<string, unknown>).readyState
		}
	}
}

/**
 * Delivers `DOMContentLoaded` to the listeners registered by the last script evaluation.
 * Legacy browsers load es-module-shims in shim mode, which re-dispatches the event before
 * the browser delivers its own, so the same listener receives it twice.
 */
function deliverDomContentLoaded(dispatches = 1) {
	for (let dispatch = 0; dispatch < dispatches; dispatch += 1) {
		domContentLoadedListeners.forEach((listener) => listener())
	}
}

function continueButton() {
	return document.querySelector<HTMLButtonElement>(CONTINUE_BUTTON_SELECTOR)
}

/** Guidance block that should only show up inside DingTalk on Android. */
function dingtalkTip() {
	return document.querySelector<HTMLElement>(DINGTALK_TIP_SELECTOR)
}

/** Download links rendered inside the overlay, in document order. */
function downloadLinks() {
	return [...document.querySelectorAll<HTMLAnchorElement>(`${MODAL_SELECTOR} a`)].map((link) => ({
		text: link.textContent?.trim() ?? "",
		href: link.getAttribute("href") ?? "",
	}))
}

beforeEach(() => {
	setOutdatedUserAgent()
	resetPageState()
	domContentLoadedListeners = []
	// Capture ready-callbacks instead of dispatching on the shared document, so an earlier
	// evaluation cannot deliver events into a later test.
	addEventListenerSpy = vi.spyOn(document, "addEventListener").mockImplementation(((
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	) => {
		if (type === "DOMContentLoaded" && typeof listener === "function") {
			domContentLoadedListeners.push(listener as () => void)
			return
		}
		originalAddEventListener(type, listener as EventListener, options)
	}) as typeof document.addEventListener)
})

afterEach(() => {
	addEventListenerSpy.mockRestore()
	resetPageState()
	setUserAgent(ORIGINAL_USER_AGENT)
	setLanguage(ORIGINAL_LANGUAGE)
})

describe("browser compatibility pre-check script", () => {
	it("renders a single, dismissible warning when DOMContentLoaded is delivered twice", () => {
		runPrecheckScript()
		deliverDomContentLoaded(2)

		expect(document.querySelectorAll(MODAL_SELECTOR)).toHaveLength(1)

		// The visible overlay must own the handler: clicking it dismisses the warning.
		continueButton()?.click()

		expect(document.querySelector(MODAL_SELECTOR)).toBeNull()
		expect(window.sessionStorage.length).toBeGreaterThan(0)
	})

	it("keeps the warning dismissed when DOMContentLoaded arrives again", () => {
		runPrecheckScript()
		deliverDomContentLoaded(2)

		continueButton()?.click()
		deliverDomContentLoaded(1)

		expect(document.querySelector(MODAL_SELECTOR)).toBeNull()
	})

	it("reads the 14-day suppression checkbox of its own overlay", () => {
		runPrecheckScript()
		deliverDomContentLoaded(1)

		const checkbox = document.querySelector<HTMLInputElement>(SUPPRESS_CHECKBOX_SELECTOR)
		expect(checkbox).not.toBeNull()
		if (checkbox) checkbox.checked = true

		continueButton()?.click()

		expect(Number(window.localStorage.getItem(SUPPRESSED_UNTIL_KEY))).toBeGreaterThan(
			Date.now(),
		)
		expect(document.querySelector(MODAL_SELECTOR)).toBeNull()
	})

	it("recommends Edge first with the mainland Chrome mirror for zh locales", () => {
		setLanguage("zh-CN")
		runPrecheckScript()
		deliverDomContentLoaded(1)

		const links = downloadLinks()
		expect(links.map((link) => link.href)).toEqual([
			"https://www.microsoft.com/zh-cn/edge/download",
			"https://www.google.cn/chrome/",
		])
		expect(links[0].text).toContain("Edge")
		expect(links[1].text).toContain("Chrome")
	})

	it("recommends Chrome first for other locales", () => {
		setLanguage("en-US")
		runPrecheckScript()
		deliverDomContentLoaded(1)

		const links = downloadLinks()
		expect(links.map((link) => link.href)).toEqual([
			"https://www.google.com/chrome/",
			"https://www.microsoft.com/edge/download",
		])
		expect(links[0].text).toContain("Chrome")
		expect(links[1].text).toContain("Edge")
	})

	it("guides DingTalk Android users to the top-right browser menu", () => {
		setUserAgent(DINGTALK_ANDROID_USER_AGENT)
		setLanguage("zh-CN")
		runPrecheckScript()
		deliverDomContentLoaded(1)

		const tip = dingtalkTip()
		expect(tip).not.toBeNull()
		expect(tip?.textContent ?? "").toContain("钉钉")
		expect(tip?.textContent ?? "").toContain("右上角")
	})

	it("guides DingTalk Android users in English locales too", () => {
		setUserAgent(DINGTALK_ANDROID_USER_AGENT)
		setLanguage("en-US")
		runPrecheckScript()
		deliverDomContentLoaded(1)

		expect(dingtalkTip()?.textContent ?? "").toContain("top-right")
	})

	it("omits the DingTalk guidance elsewhere", () => {
		// Plain Android Chrome and DingTalk on iOS keep the regular copy only.
		runPrecheckScript()
		deliverDomContentLoaded(1)
		expect(dingtalkTip()).toBeNull()

		resetPageState()
		setUserAgent(DINGTALK_IOS_USER_AGENT)
		runPrecheckScript()
		deliverDomContentLoaded(1)
		expect(dingtalkTip()).toBeNull()
		expect(document.querySelector(MODAL_SELECTOR)).not.toBeNull()
	})

	it("does not render the warning for a supported browser", () => {
		setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
				"(KHTML, like Gecko) Chrome/111.0.5563.64 Safari/537.36",
		)

		runPrecheckScript()
		deliverDomContentLoaded(2)

		expect(document.querySelector(MODAL_SELECTOR)).toBeNull()
	})
})
