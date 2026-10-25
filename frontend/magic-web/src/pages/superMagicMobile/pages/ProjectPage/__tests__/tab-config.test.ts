import { describe, expect, it } from "vitest"

import { getProjectDetailTabs, shouldKeepScheduledTasksPanelMounted } from "../tab-config"

/** Returns deterministic translation keys for tab configuration tests. */
function translate(key: string) {
	return key
}

describe("getProjectDetailTabs", () => {
	it("places scheduled tasks after files for editable projects", () => {
		expect(getProjectDetailTabs(translate, false).map((tab) => tab.value)).toEqual([
			"topics",
			"topicFiles",
			"scheduledTasks",
		])
	})

	it("hides scheduled tasks for read-only projects", () => {
		expect(getProjectDetailTabs(translate, true).map((tab) => tab.value)).toEqual([
			"topics",
			"topicFiles",
		])
	})

	it("shows only topics and canvas for AI canvas projects", () => {
		expect(getProjectDetailTabs(translate, false, true).map((tab) => tab.value)).toEqual([
			"topics",
			"canvas",
		])
		expect(getProjectDetailTabs(translate, true, true).map((tab) => tab.value)).toEqual([
			"topics",
			"canvas",
		])
	})

	it("keeps the scheduled-tasks panel mounted after the tab has been opened", () => {
		expect(shouldKeepScheduledTasksPanelMounted("topics", false)).toBe(false)
		expect(shouldKeepScheduledTasksPanelMounted("scheduledTasks", false)).toBe(true)
		expect(shouldKeepScheduledTasksPanelMounted("topics", true)).toBe(true)
		expect(shouldKeepScheduledTasksPanelMounted("topicFiles", true)).toBe(true)
	})
})
