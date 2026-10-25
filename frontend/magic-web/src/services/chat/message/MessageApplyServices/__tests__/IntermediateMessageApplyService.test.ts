import { beforeEach, describe, expect, it, vi } from "vitest"
import { IntermediateMessageType } from "@/types/chat/intermediate_message"
import { PubSubEvents } from "@/utils/pubsub"
import IntermediateMessageApplyService from "../IntermediateMessageApplyService"

const mocks = vi.hoisted(() => ({
	publish: vi.fn(),
}))

vi.mock("@/utils/pubsub", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/utils/pubsub")>()
	return {
		...actual,
		default: { publish: mocks.publish },
	}
})

vi.mock("@/services/chat/conversation/ConversationService", () => ({
	default: {
		startConversationInput: vi.fn(),
		endConversationInput: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/utils/projectAttachments/changeLogReporter", () => ({
	projectAttachmentsChangeLog: {
		intermediateReceived: vi.fn(),
		intermediatePublished: vi.fn(),
	},
}))

describe("IntermediateMessageApplyService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("publishes the complete checkpoint rollback seq without converting its event id into a message", () => {
		const seq = {
			seq_id: "rollback-domain-event-900",
			conversation_id: "conversation-1",
			organization_code: "org-1",
			message: {
				type: IntermediateMessageType.SuperMagicCheckpointRollback,
				action: "undo" as const,
				project_id: "project-1",
				topic_id: "topic-1",
				chat_topic_id: "chat-topic-1",
				target_seq_id: "10",
				affected_seq_ids: ["10"],
				affected_count: 1,
				truncated: false,
				refresh_required: true as const,
				timestamp: "2026-08-04T12:00:00Z",
			},
		}

		IntermediateMessageApplyService.apply({ type: "seq", seq } as never)

		expect(mocks.publish).toHaveBeenCalledWith(
			PubSubEvents.Super_Magic_Checkpoint_Rollback,
			seq,
		)
	})

	it.each([
		["payload without seq", { type: "notification_update" }],
		["seq without message", { type: "seq", seq: {} }],
		["undefined payload", undefined],
	])("ignores %s without throwing", (_name, payload) => {
		expect(() => IntermediateMessageApplyService.apply(payload as never)).not.toThrow()
		expect(mocks.publish).not.toHaveBeenCalled()
	})
})
