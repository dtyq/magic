import { createInstance, type BackendModule, type ReadCallback } from "i18next"
import { afterEach, describe, expect, it, vi } from "vitest"
import zhCN from "@/assets/locales/zh_CN/login.json"
import enUS from "@/assets/locales/en_US/login.json"
import { getDeviceInfo } from "../devices"

const parsedSignals = vi.hoisted(() => ({
	vendor: "",
	model: "",
	browserName: "Test Browser",
	browserVersion: "1",
}))

vi.mock("@/enhance/magicElectron", () => ({ magic: undefined }))
vi.mock("@/platform/native", () => ({ getNativePort: vi.fn() }))
vi.mock("@/utils/crypto", () => ({ default: { MD5encryption: () => "device-id" } }))
vi.mock("ua-parser-js", () => ({
	default: class {
		getResult() {
			return {
				device: {
					type: "mobile",
					vendor: parsedSignals.vendor,
					model: parsedSignals.model,
				},
				browser: { name: parsedSignals.browserName, version: parsedSignals.browserVersion },
				os: { name: "Test OS", version: "1" },
			}
		}
	},
}))

const originalNavigator = globalThis.navigator

function setUserAgent(userAgent: string) {
	vi.stubGlobal("navigator", { userAgent })
}

afterEach(() => {
	vi.stubGlobal("navigator", originalNavigator)
	Object.assign(parsedSignals, {
		vendor: "",
		model: "",
		browserName: "Test Browser",
		browserVersion: "1",
	})
})

describe("getDeviceInfo translations", () => {
	it.each([
		{ language: "zh_CN", messages: zhCN },
		{ language: "en_US", messages: enUS },
	])(
		"uses login labels independently of the default namespace in $language",
		async ({ language, messages }) => {
			const i18n = createInstance()
			await i18n.init({
				lng: language,
				fallbackLng: false,
				defaultNS: "common",
				ns: ["common"],
				resources: {
					[language]: {
						common: { device: { app: "wrong", dingTalk: "wrong", unknown: "wrong" } },
						interface: { device: { dingTalk: "wrong" } },
						login: messages,
					},
				},
			})

			for (const [userAgent, name] of [
				["DingTalk", messages.device.dingTalk],
				["DingTalkAvoid", messages.device.dingTalk],
				["TeamshareWebAPP", `Teamshare {${messages.device.app}}`],
				["UnknownMobile", messages.device.unknown],
			]) {
				setUserAgent(userAgent)
				await expect(getDeviceInfo(i18n)).resolves.toMatchObject({ id: "device-id", name })
			}
		},
	)

	it("waits for initialization and the asynchronously loaded login namespace", async () => {
		setUserAgent("DingTalk")
		const reads = new Map<string, ReadCallback[]>()
		const backend: BackendModule = {
			type: "backend",
			init() {
				return undefined
			},
			read(_language, namespace, callback) {
				const callbacks = reads.get(namespace) ?? []
				callbacks.push(callback)
				reads.set(namespace, callbacks)
			},
		}
		const i18n = createInstance().use(backend)
		const initialized = i18n.init({
			lng: "zh_CN",
			fallbackLng: false,
			defaultNS: "common",
			ns: ["common"],
			initImmediate: false,
		})
		const completed = vi.fn()
		const result = getDeviceInfo(i18n)
		void result.then(completed)

		expect(reads.has("login")).toBe(false)
		expect(completed).not.toHaveBeenCalled()
		reads.get("common")?.forEach((callback) => callback(null, {}))
		await initialized
		await vi.waitFor(() => expect(reads.has("login")).toBe(true))
		expect(completed).not.toHaveBeenCalled()

		reads.get("login")?.forEach((callback) => callback(null, zhCN))
		await expect(result).resolves.toMatchObject({ name: "钉钉" })
	})

	it.each([
		{ userAgent: "DingTalk", expectedName: "Test Browser 1" },
		{ userAgent: "TeamshareWebAPP", expectedName: "Test Browser 1" },
		{ userAgent: "UnknownMobile", expectedName: "Test Browser 1" },
		{
			userAgent: "DingTalk",
			expectedName: "PhoneCo Model1",
			vendor: "PhoneCo",
			model: "Model1",
		},
		{
			userAgent: "UnknownMobile/1.0",
			expectedName: "UnknownMobile/1.0",
			browserName: "",
			browserVersion: "",
		},
	])(
		"preserves device information on namespace failure for $expectedName",
		async ({ userAgent, expectedName, ...signals }) => {
			setUserAgent(userAgent)
			Object.assign(parsedSignals, signals)
			const loadError = new Error("login resource unavailable")
			const backend: BackendModule = {
				type: "backend",
				init() {
					return undefined
				},
				read(_language, _namespace, callback) {
					callback(loadError, false)
				},
			}
			const i18n = createInstance().use(backend)
			await i18n.init({
				lng: "en_US",
				fallbackLng: false,
				defaultNS: "common",
				ns: ["common"],
				partialBundledLanguages: true,
				resources: { en_US: { common: {} } },
			})

			await expect(getDeviceInfo(i18n)).resolves.toMatchObject({
				id: "device-id",
				name: expectedName,
				os: "Test OS",
				os_version: "1",
			})
		},
	)
})
