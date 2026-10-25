import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import zhCN from "@/assets/locales/zh_CN/message.json"
import enUS from "@/assets/locales/en_US/message.json"
import Fallback from ".."
import LegacyFallback from "../../MessageFactory/components/Fallback"

describe("unsupported chat message fallback", () => {
	it.each([
		{ language: "zh_CN", messages: zhCN, expected: "暂不支持" },
		{ language: "en_US", messages: enUS, expected: "Not supported yet" },
	])("renders both fallback paths in $language", async ({ language, messages, expected }) => {
		const i18n = createInstance()
		await i18n.init({
			lng: language,
			fallbackLng: false,
			defaultNS: "common",
			ns: ["message"],
			resources: { [language]: { message: messages } },
		})

		for (const Component of [Fallback, LegacyFallback]) {
			const html = renderToStaticMarkup(
				<I18nextProvider i18n={i18n}>
					<Component />
				</I18nextProvider>,
			)

			expect(html).toContain(expected)
			expect(html).not.toContain("chat.NotSupport")
		}
	})
})
