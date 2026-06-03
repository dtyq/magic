import { describe, expect, it } from "vitest"
import {
	buildMobileProjectActionGroups,
	MOBILE_CHAT_DETAIL_ACTION_KEYS,
	MOBILE_CHAT_PIN_ENABLED,
	MOBILE_PROJECT_ACTION_ORDER,
	sortFilteredProjectActions,
} from "../mobileProjectActionOrder"
import type { ProjectActionKey } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"

function action(key: ProjectActionKey) {
	return { key, label: key }
}

describe("mobileProjectActionOrder", () => {
	it("MOBILE_CHAT_DETAIL_ACTION_KEYS omits pin while chat pin is disabled", () => {
		expect(MOBILE_CHAT_PIN_ENABLED).toBe(false)
		expect(MOBILE_CHAT_DETAIL_ACTION_KEYS).toEqual(["rename", "saveAsProject", "delete"])
		expect(MOBILE_CHAT_DETAIL_ACTION_KEYS).not.toContain("pinProject")
	})

	it("MOBILE_PROJECT_ACTION_ORDER matches prototype six items", () => {
		expect(MOBILE_PROJECT_ACTION_ORDER).toEqual([
			"rename",
			"move",
			"enterWorkspace",
			"setCollaborators",
			"transfer",
			"delete",
		])
	})

	it("sortFilteredProjectActions orders prototype keys for default project menus", () => {
		const shuffled = [
			action("delete"),
			action("rename"),
			action("transfer"),
			action("move"),
			action("enterWorkspace"),
			action("setCollaborators"),
		]

		const sorted = sortFilteredProjectActions(shuffled, { isChatMode: false })

		expect(sorted.map((item) => item.key)).toEqual([
			"rename",
			"move",
			"enterWorkspace",
			"setCollaborators",
			"transfer",
			"delete",
		])
	})

	it("buildMobileProjectActionGroups uses four prototype cards for full project actions", () => {
		const actions = MOBILE_PROJECT_ACTION_ORDER.map((key) => action(key))

		const groups = buildMobileProjectActionGroups(actions, { shouldShowSaveAsProject: false })

		expect(groups.map((group) => group.map((item) => item.key))).toEqual([
			["rename", "move", "enterWorkspace"],
			["setCollaborators"],
			["transfer"],
			["delete"],
		])
	})

	it("buildMobileProjectActionGroups inserts copyCollaborationLink between collaborators and transfer", () => {
		const actions = [
			...MOBILE_PROJECT_ACTION_ORDER.map((key) => action(key)),
			action("copyCollaborationLink"),
		]

		const groups = buildMobileProjectActionGroups(actions, { shouldShowSaveAsProject: false })

		expect(groups.map((group) => group.map((item) => item.key))).toEqual([
			["rename", "move", "enterWorkspace"],
			["setCollaborators"],
			["copyCollaborationLink"],
			["transfer"],
			["delete"],
		])
	})
})
