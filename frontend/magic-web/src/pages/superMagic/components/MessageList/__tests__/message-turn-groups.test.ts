import { describe, expect, it } from "vitest"
import { buildMessageKeysAndTurnGroups, isUserRoleMessage } from "../message-turn-groups"
import type { SuperMagicMessageItem } from "../type"

function msg(role: "user" | "assistant", appId: string): SuperMagicMessageItem {
	return { role, app_message_id: appId } as SuperMagicMessageItem
}

describe("message-turn-groups", () => {
	it("isUserRoleMessage treats only assistant as non-user", () => {
		expect(isUserRoleMessage(undefined)).toBe(true)
		expect(isUserRoleMessage(msg("user", "1"))).toBe(true)
		expect(isUserRoleMessage(msg("assistant", "2"))).toBe(false)
	})

	it("groups assistant lines under preceding user turn", () => {
		const { messageTurnGroups, messageKeys } = buildMessageKeysAndTurnGroups([
			msg("user", "u1"),
			msg("assistant", "a1"),
			msg("user", "u2"),
			msg("assistant", "a2"),
		])

		expect(messageKeys).toEqual(["u1", "a1", "u2", "a2"])
		expect(messageTurnGroups).toHaveLength(2)
		expect(messageTurnGroups[0].stickyItem?.node.app_message_id).toBe("u1")
		expect(messageTurnGroups[0].items).toHaveLength(2)
		expect(messageTurnGroups[1].items).toHaveLength(2)
	})

	it("leading assistant-only messages share one non-sticky group", () => {
		const { messageTurnGroups } = buildMessageKeysAndTurnGroups([
			msg("assistant", "a0"),
			msg("user", "u1"),
		])

		expect(messageTurnGroups[0].stickyItem).toBeNull()
		expect(messageTurnGroups[0].items).toHaveLength(1)
		expect(messageTurnGroups[1].stickyItem).toBeTruthy()
	})
})
