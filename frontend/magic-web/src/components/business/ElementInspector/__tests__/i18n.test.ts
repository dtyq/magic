import { describe, expect, it } from "vitest"
import enUS from "@/assets/locales/en_US/super.json"
import zhCN from "@/assets/locales/zh_CN/super.json"

describe("Element inspector translations", () => {
	it.each([
		["en_US", enUS],
		["zh_CN", zhCN],
	])("uses i18next interpolation syntax for %s target counts", (_locale, messages) => {
		expect(messages.stylePanel.inspector.exitConfirmContent).toContain("{{count}}")
		expect(messages.stylePanel.inspector.pendingTargetCount).toContain("{{count}}")
	})
})
