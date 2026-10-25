import { describe, expect, test } from "vitest"

import { getMobileSettingsRootItemAction } from "../actions"

describe("getMobileSettingsRootItemAction", () => {
	test("团队积分入口打开只读团队积分面板", () => {
		expect(getMobileSettingsRootItemAction("teamPoints")).toEqual({
			type: "panel",
			panel: "teamPoints",
		})
	})

	test("个人额度入口打开个人额度面板", () => {
		expect(getMobileSettingsRootItemAction("personalQuota")).toEqual({
			type: "panel",
			panel: "personalQuota",
		})
	})
})
