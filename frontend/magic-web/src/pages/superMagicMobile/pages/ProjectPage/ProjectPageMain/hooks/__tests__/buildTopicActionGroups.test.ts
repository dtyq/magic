import { describe, expect, it, vi } from "vitest"
import { buildTopicActionGroups } from "../buildTopicActionGroups"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"

function createAction(
	overrides: Partial<ActionsPopup.ActionButtonConfig> & { key: string },
): ActionsPopup.ActionButtonConfig {
	return {
		label: overrides.key,
		onClick: vi.fn(),
		variant: "default",
		...overrides,
	}
}

describe("buildTopicActionGroups", () => {
	it("groups rename and share in the first card", () => {
		const groups = buildTopicActionGroups([
			createAction({ key: "rename", label: "Rename" }),
			createAction({ key: "share", label: "Share" }),
		])

		expect(groups).toHaveLength(1)
		expect(groups[0].actions.map((action) => action.key)).toEqual(["rename", "share"])
	})

	it("puts delete in a separate danger group when present", () => {
		const groups = buildTopicActionGroups([
			createAction({ key: "rename", label: "Rename" }),
			createAction({ key: "share", label: "Share" }),
			createAction({ key: "delete", label: "Delete", variant: "danger" }),
		])

		expect(groups).toHaveLength(2)
		expect(groups[1].actions).toHaveLength(1)
		expect(groups[1].actions[0]).toMatchObject({ key: "delete", variant: "danger" })
	})

	it("omits delete group when delete action is not provided", () => {
		const groups = buildTopicActionGroups([
			createAction({ key: "rename", label: "Rename" }),
			createAction({ key: "share", label: "Share" }),
		])

		expect(
			groups.some((group) => group.actions.some((action) => action.key === "delete")),
		).toBe(false)
	})
})
