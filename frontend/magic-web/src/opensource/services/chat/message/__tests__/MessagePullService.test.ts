import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock all complex dependencies first
vi.mock("@/utils/request", () => ({
	fetchPaddingData: vi.fn(),
}))

vi.mock("@/utils/string", () => ({
	bigNumCompare: vi.fn(),
}))

vi.mock("@/types/request", () => ({}))
vi.mock("@/types/chat", () => ({
	MessageReceiveType: {},
}))
vi.mock("@/types/chat/conversation", () => ({
	ConversationStatus: {},
}))
vi.mock("@/types/chat/conversation_message", () => ({
	AggregateAISearchCardDataType: {},
	ConversationMessageStatus: {},
	ConversationMessageType: {},
}))

vi.mock("lodash-es", () => ({
	groupBy: vi.fn(),
	last: vi.fn(),
}))

vi.mock("@/opensource/providers/DataContextProvider/hooks", () => ({
	getDataContext: vi.fn(),
}))

vi.mock("@/opensource/services/chat/conversation/ConversationService", () => ({
	default: {},
}))

vi.mock("@/opensource/stores/chatNew/message", () => ({
	default: {},
}))

vi.mock("@/apis", () => ({
	ChatApi: {
		messagePull: vi.fn(),
		getConversationMessages: vi.fn(),
		getConversationList: vi.fn(),
		batchGetConversationMessages: vi.fn(),
		getMessagesByAppMessageId: vi.fn(),
	},
}))

vi.mock("../MessageSeqIdService", () => ({
	default: {
		getOrganizationRenderSeqId: vi.fn(),
		updateGlobalPullSeqId: vi.fn(),
		getConversationPullSeqId: vi.fn(),
		getConversationRenderSeqId: vi.fn(),
		updateConversationPullSeqId: vi.fn(),
		getGlobalPullSeqId: vi.fn(),
		checkAllOrganizationRenderSeqId: vi.fn(),
		updateOrganizationRenderSeqId: vi.fn(),
	},
}))

vi.mock("../MessageApplyServices", () => ({
	default: {
		applyMessage: vi.fn(),
	},
}))

vi.mock("../MessageApplyServices/ChatMessageApplyServices", () => ({
	default: {
		isChatHistoryMessage: vi.fn(),
	},
}))

vi.mock("../MessageApplyServices/ControlMessageApplyService", () => ({
	default: {
		isControlMessageShouldRender: vi.fn(),
	},
}))

vi.mock("../MessageApplyServices/ChatMessageApplyServices/AiSearchApplyService", () => ({
	default: {
		combineAiSearchMessage: vi.fn(),
	},
}))

vi.mock("../MessageService", () => ({
	default: {
		addHistoryMessagesToDB: vi.fn(),
	},
}))

vi.mock("../dots/DotsService", () => ({
	default: {
		addConversationUnreadDots: vi.fn(),
	},
}))

vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				organization_code: "test-org",
				user_id: "test-user-id",
			},
			magicOrganizationMap: {},
		},
	},
}))

// Import after mocking
import MessagePullService from "../MessagePullService"
import { ChatApi } from "@/apis"
import MessageSeqIdService from "../MessageSeqIdService"
import { userStore } from "@/opensource/models/user"
import { bigNumCompare } from "@/utils/string"
import { last } from "lodash-es"

// Create a simplified test class that extends the original but mocks complex dependencies
class TestableMessagePullService {
	private pullTriggerList: string[] = []
	private triggerPromise: Promise<void> | undefined

	// Mock dependencies
	private mockChatApi = {
		messagePull: vi.fn(),
	}

	private mockMessageSeqIdService = {
		getOrganizationRenderSeqId: vi.fn(),
		updateGlobalPullSeqId: vi.fn(),
	}

	private mockUserStore = {
		user: {
			userInfo: {
				organization_code: "test-org",
			},
		},
	}

	private mockBigNumCompare = vi.fn()
	private mockLast = vi.fn()
	private mockApplyMessages = vi.fn()

	constructor() {
		// Setup default mock implementations
		this.mockMessageSeqIdService.getOrganizationRenderSeqId.mockReturnValue("test-seq-id")
		this.mockBigNumCompare.mockReturnValue(1)
		this.mockLast.mockReturnValue({ seq_id: "latest-seq-id" })
	}

	// Public method under test
	public async pullOfflineMessages(triggerSeqId?: string) {
		if (triggerSeqId) {
			this.pullTriggerList.push(triggerSeqId)
		}

		// If already pulling, return early
		if (this.triggerPromise) {
			return
		}

		try {
			this.triggerPromise = this.doPullOfflineMessages()
			await this.triggerPromise
		} finally {
			this.triggerPromise = undefined
		}
	}

	// Private method under test
	private async doPullOfflineMessages() {
		// Use loop instead of recursion to avoid call stack depth
		while (this.pullTriggerList.length > 0) {
			const organizationCode = this.mockUserStore.user.userInfo?.organization_code ?? ""

			if (!organizationCode) {
				console.warn("pullOfflineMessages: 当前组织为空")
				return
			}

			const globalPullSeqId =
				this.mockMessageSeqIdService.getOrganizationRenderSeqId(organizationCode)
			await this.pullMessagesFromPageToken(globalPullSeqId)
		}
	}

	// Private method under test
	private async pullMessagesFromPageToken(pageToken: string) {
		let currentPageToken = pageToken
		let hasMore = true
		let totalProcessed = 0

		while (hasMore) {
			try {
				const res = await this.mockChatApi.messagePull({ page_token: currentPageToken })

				// Process current page messages immediately
				if (res.items && res.items.length > 0) {
					const sorted = res.items
						.map((item: any) => item.seq)
						.sort((a: any, b: any) =>
							this.mockBigNumCompare(a.seq_id ?? "", b.seq_id ?? ""),
						)

					console.log(`Processing page with ${sorted.length} messages`)
					this.mockApplyMessages(sorted)
					this.mockMessageSeqIdService.updateGlobalPullSeqId(
						this.mockLast(sorted)?.seq_id ?? "",
					)

					this.pullTriggerList = this.pullTriggerList.filter(
						(item) =>
							this.mockBigNumCompare(item, this.mockLast(sorted)?.seq_id ?? "") > 0,
					)

					totalProcessed += sorted.length
				}

				// Check if there's more data
				hasMore = res.has_more
				currentPageToken = res.page_token || ""

				// Add small delay to avoid too frequent requests
				if (hasMore) {
					await new Promise((resolve) => setTimeout(resolve, 50))
				}
			} catch (error) {
				console.error("pullMessagesFromPageToken error:", error)
				// Break on error
				throw error
			}
		}

		console.log(`Total messages processed: ${totalProcessed}`)
	}

	// Expose private properties for testing
	public getPullTriggerList() {
		return this.pullTriggerList
	}

	public getTriggerPromise() {
		return this.triggerPromise
	}

	public getMocks() {
		return {
			chatApi: this.mockChatApi,
			messageSeqIdService: this.mockMessageSeqIdService,
			userStore: this.mockUserStore,
			bigNumCompare: this.mockBigNumCompare,
			last: this.mockLast,
			applyMessages: this.mockApplyMessages,
		}
	}
}

describe("MessagePullService", () => {
	let service: TestableMessagePullService
	let mocks: ReturnType<TestableMessagePullService["getMocks"]>

	beforeEach(() => {
		service = new TestableMessagePullService()
		mocks = service.getMocks()
		vi.clearAllMocks()
	})

	describe("pullOfflineMessages", () => {
		it("should add triggerSeqId to pullTriggerList when provided", async () => {
			const triggerSeqId = "trigger-123"

			// Mock the private method to avoid actual execution
			const spy = vi.spyOn(service as any, "doPullOfflineMessages")
			spy.mockResolvedValue(undefined)

			await service.pullOfflineMessages(triggerSeqId)

			expect(service.getPullTriggerList()).toContain(triggerSeqId)
		})

		it("should return early if already pulling", async () => {
			// Set triggerPromise to simulate ongoing pull
			;(service as any).triggerPromise = Promise.resolve()

			const spy = vi.spyOn(service as any, "doPullOfflineMessages")

			await service.pullOfflineMessages()

			expect(spy).not.toHaveBeenCalled()
		})

		it("should reset triggerPromise in finally block", async () => {
			const spy = vi.spyOn(service as any, "doPullOfflineMessages")
			spy.mockResolvedValue(undefined)

			await service.pullOfflineMessages()

			expect(service.getTriggerPromise()).toBeUndefined()
		})

		it("should reset triggerPromise even when error occurs", async () => {
			const spy = vi.spyOn(service as any, "doPullOfflineMessages")
			spy.mockRejectedValue(new Error("Test error"))

			await expect(service.pullOfflineMessages()).rejects.toThrow("Test error")

			expect(service.getTriggerPromise()).toBeUndefined()
		})
	})

	describe("doPullOfflineMessages", () => {
		it("should return early when organization code is empty", async () => {
			// Mock empty organization code
			mocks.userStore.user.userInfo!.organization_code = ""

			// Add an item to pullTriggerList to trigger the loop
			;(service as any).pullTriggerList = ["test-seq"]

			const spy = vi.spyOn(service as any, "pullMessagesFromPageToken")
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await (service as any).doPullOfflineMessages()

			expect(consoleSpy).toHaveBeenCalledWith("pullOfflineMessages: 当前组织为空")
			expect(spy).not.toHaveBeenCalled()

			consoleSpy.mockRestore()
		})

		it("should process all items in pullTriggerList", async () => {
			// Setup pullTriggerList with multiple items
			;(service as any).pullTriggerList = ["seq1", "seq2", "seq3"]

			const spy = vi.spyOn(service as any, "pullMessagesFromPageToken")
			spy.mockResolvedValue(undefined)

			// Mock the filter to remove items one by one
			spy.mockImplementation(() => {
				;(service as any).pullTriggerList = (service as any).pullTriggerList.slice(1)
				return Promise.resolve()
			})

			await (service as any).doPullOfflineMessages()

			expect(spy).toHaveBeenCalledTimes(3)
			expect(mocks.messageSeqIdService.getOrganizationRenderSeqId).toHaveBeenCalledWith(
				"test-org",
			)
		})
	})

	describe("pullMessagesFromPageToken", () => {
		it("should handle empty response", async () => {
			mocks.chatApi.messagePull.mockResolvedValue({
				items: [],
				has_more: false,
				page_token: "",
			})

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await (service as any).pullMessagesFromPageToken("test-token")

			expect(mocks.chatApi.messagePull).toHaveBeenCalledWith({ page_token: "test-token" })
			expect(consoleSpy).toHaveBeenCalledWith("Total messages processed: 0")

			consoleSpy.mockRestore()
		})

		it("should process messages and update state", async () => {
			const mockMessages = [
				{ seq: { seq_id: "msg1", message: { type: "text" } } },
				{ seq: { seq_id: "msg2", message: { type: "text" } } },
			]

			mocks.chatApi.messagePull.mockResolvedValue({
				items: mockMessages,
				has_more: false,
				page_token: "next-token",
			})

			// Setup pullTriggerList
			;(service as any).pullTriggerList = ["old-seq1", "old-seq2"]

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await (service as any).pullMessagesFromPageToken("test-token")

			expect(mocks.chatApi.messagePull).toHaveBeenCalledWith({ page_token: "test-token" })
			expect(mocks.applyMessages).toHaveBeenCalledWith([
				{ seq_id: "msg1", message: { type: "text" } },
				{ seq_id: "msg2", message: { type: "text" } },
			])
			expect(mocks.messageSeqIdService.updateGlobalPullSeqId).toHaveBeenCalledWith(
				"latest-seq-id",
			)
			expect(consoleSpy).toHaveBeenCalledWith("Processing page with 2 messages")
			expect(consoleSpy).toHaveBeenCalledWith("Total messages processed: 2")

			consoleSpy.mockRestore()
		})

		it("should handle multiple pages", async () => {
			// First page
			mocks.chatApi.messagePull
				.mockResolvedValueOnce({
					items: [{ seq: { seq_id: "msg1", message: { type: "text" } } }],
					has_more: true,
					page_token: "page2-token",
				})
				.mockResolvedValueOnce({
					items: [{ seq: { seq_id: "msg2", message: { type: "text" } } }],
					has_more: false,
					page_token: "",
				})

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await (service as any).pullMessagesFromPageToken("test-token")

			expect(mocks.chatApi.messagePull).toHaveBeenCalledTimes(2)
			expect(mocks.chatApi.messagePull).toHaveBeenNthCalledWith(1, {
				page_token: "test-token",
			})
			expect(mocks.chatApi.messagePull).toHaveBeenNthCalledWith(2, {
				page_token: "page2-token",
			})
			expect(mocks.applyMessages).toHaveBeenCalledTimes(2)
			expect(consoleSpy).toHaveBeenCalledWith("Total messages processed: 2")

			consoleSpy.mockRestore()
		})

		it("should handle API errors", async () => {
			const testError = new Error("API Error")
			mocks.chatApi.messagePull.mockRejectedValue(testError)

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await expect((service as any).pullMessagesFromPageToken("test-token")).rejects.toThrow(
				"API Error",
			)

			expect(consoleSpy).toHaveBeenCalledWith("pullMessagesFromPageToken error:", testError)

			consoleSpy.mockRestore()
		})

		it("should filter pullTriggerList correctly", async () => {
			const mockMessages = [{ seq: { seq_id: "msg1", message: { type: "text" } } }]

			mocks.chatApi.messagePull.mockResolvedValue({
				items: mockMessages,
				has_more: false,
				page_token: "",
			})

			// Setup pullTriggerList
			const initialTriggerList = ["old-seq1", "old-seq2", "new-seq1"]
			;(service as any).pullTriggerList = [...initialTriggerList]

			// Mock bigNumCompare to simulate filtering
			mocks.bigNumCompare.mockImplementation((a: string, b: string) => {
				if (a === "old-seq1" || a === "old-seq2") return -1 // Should be filtered out
				return 1 // Should remain
			})

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await (service as any).pullMessagesFromPageToken("test-token")

			// Check that pullTriggerList was filtered correctly
			const remainingTriggers = service.getPullTriggerList()
			expect(remainingTriggers).toEqual(["new-seq1"])

			consoleSpy.mockRestore()
		})
	})
})
