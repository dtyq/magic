import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { buildMessageKeysAndTurnGroups } from "../message-turn-groups"
import { MessageTurnGroupList } from "../MessageTurnGroupList"
import type { SuperMagicMessageItem } from "../type"

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		getMessageNode: () => ({ status: "completed" }),
	},
}))

function msg(role: "user" | "assistant", appId: string): SuperMagicMessageItem {
	return { role, app_message_id: appId } as SuperMagicMessageItem
}

/** Minimal renderNode for turn-group list tests */
function renderNodeLabel({ node }: { node: SuperMagicMessageItem; index: number }) {
	return <span data-testid={`msg-${node.app_message_id}`}>{node.app_message_id}</span>
}

describe("MessageTurnGroupList", () => {
	const messages = [msg("user", "u1"), msg("assistant", "a1")]
	const { messageTurnGroups } = buildMessageKeysAndTurnGroups(messages)

	it("renders flat list on mobile without sticky wrapper", () => {
		const { container } = render(
			<MessageTurnGroupList
				groups={messageTurnGroups}
				isMobile
				renderNode={renderNodeLabel}
			/>,
		)

		expect(container.querySelector("[data-sticky-message-id]")).toBeNull()
		expect(container.querySelector(".sticky")).toBeNull()
		expect(container.querySelector('[data-testid="msg-u1"]')).not.toBeNull()
		expect(container.querySelector('[data-testid="msg-a1"]')).not.toBeNull()
	})

	it("keeps sticky wrapper on desktop for user turns", () => {
		const { container } = render(
			<MessageTurnGroupList
				groups={messageTurnGroups}
				isMobile={false}
				renderNode={renderNodeLabel}
			/>,
		)

		expect(container.querySelector('[data-sticky-message-id="u1"]')).not.toBeNull()
		expect(container.querySelector(".sticky")).not.toBeNull()
	})
})
