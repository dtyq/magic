import { describe, expect, it } from "vitest"
import { getAccountSettingMenuItems } from "../config"
import { AccountSettingPage } from "../types"

describe("account setting config", () => {
	it("includes data export page in the settings group", () => {
		const items = getAccountSettingMenuItems((key) => key)
		const dataExportItem = items.find((item) => item.key === AccountSettingPage.DATA_EXPORT)

		expect(dataExportItem).toBeDefined()
		expect(dataExportItem?.label).toBe("dataExport")
		expect(dataExportItem?.subtitle).toBe("dataExportSubtitle")
	})
})
