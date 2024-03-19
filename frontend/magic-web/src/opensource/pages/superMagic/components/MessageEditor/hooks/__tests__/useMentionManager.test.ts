import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useMentionManager } from "../useMentionManager"
import { MentionItemType } from "@/opensource/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"

// Mock the store
vi.mock("@/opensource/components/business/MentionPanel/store", () => ({
	default: {
		setUploadFiles: vi.fn(),
	},
}))

// Mock Editor
const mockEditor = {
	view: {
		state: {
			doc: {
				descendants: vi.fn(),
			},
			tr: {
				delete: vi.fn().mockReturnThis(),
			},
		},
		dispatch: vi.fn(),
	},
}

describe("useMentionManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should initialize with empty mention items", () => {
		const { result } = renderHook(() => useMentionManager())

		expect(result.current.mentionItems).toEqual([])
	})

	it("should insert single mention item", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItem: TiptapMentionAttributes = {
			type: MentionItemType.AGENT,
			data: {
				agent_id: "test-agent",
				agent_name: "Test Agent",
				agent_description: "Test Description",
			},
		}

		act(() => {
			result.current.insertMentionItem(mentionItem)
		})

		expect(result.current.mentionItems).toHaveLength(1)
		expect(result.current.mentionItems[0].attrs).toEqual(mentionItem)
	})

	it("should insert multiple mention items", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItems: TiptapMentionAttributes[] = [
			{
				type: MentionItemType.AGENT,
				data: {
					agent_id: "agent-1",
					agent_name: "Agent 1",
					agent_description: "Agent 1 Description",
				},
			},
			{
				type: MentionItemType.AGENT,
				data: {
					agent_id: "agent-2",
					agent_name: "Agent 2",
					agent_description: "Agent 2 Description",
				},
			},
		]

		act(() => {
			result.current.insertMentionItems(mentionItems)
		})

		expect(result.current.mentionItems).toHaveLength(2)
	})

	it("should not insert duplicate mention items", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItem: TiptapMentionAttributes = {
			type: MentionItemType.AGENT,
			data: {
				agent_id: "test-agent",
				agent_name: "Test Agent",
				agent_description: "Test Description",
			},
		}

		act(() => {
			result.current.insertMentionItem(mentionItem)
		})

		act(() => {
			result.current.insertMentionItem(mentionItem)
		})

		expect(result.current.mentionItems).toHaveLength(1)
	})

	it("should remove single mention item when stillExists is false", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItem: TiptapMentionAttributes = {
			type: MentionItemType.AGENT,
			data: {
				agent_id: "test-agent",
				agent_name: "Test Agent",
				agent_description: "Test Description",
			},
		}

		act(() => {
			result.current.insertMentionItem(mentionItem)
		})

		expect(result.current.mentionItems).toHaveLength(1)

		act(() => {
			result.current.removeMentionItem(mentionItem, false)
		})

		expect(result.current.mentionItems).toHaveLength(0)
	})

	it("should not remove mention item when stillExists is true", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItem: TiptapMentionAttributes = {
			type: MentionItemType.AGENT,
			data: {
				agent_id: "test-agent",
				agent_name: "Test Agent",
				agent_description: "Test Description",
			},
		}

		act(() => {
			result.current.insertMentionItem(mentionItem)
		})

		act(() => {
			result.current.removeMentionItem(mentionItem, true)
		})

		expect(result.current.mentionItems).toHaveLength(1)
	})

	it("should remove multiple mention items in batch", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItems: TiptapMentionAttributes[] = [
			{
				type: MentionItemType.AGENT,
				data: {
					agent_id: "agent-1",
					agent_name: "Agent 1",
					agent_description: "Agent 1 Description",
				},
			},
			{
				type: MentionItemType.AGENT,
				data: {
					agent_id: "agent-2",
					agent_name: "Agent 2",
					agent_description: "Agent 2 Description",
				},
			},
		]

		act(() => {
			result.current.insertMentionItems(mentionItems)
		})

		expect(result.current.mentionItems).toHaveLength(2)

		act(() => {
			result.current.removeMentionItems([
				{ item: mentionItems[0], stillExists: false },
				{ item: mentionItems[1], stillExists: true },
			])
		})

		expect(result.current.mentionItems).toHaveLength(1)
		expect(result.current.mentionItems[0].attrs).toEqual(mentionItems[1])
	})

	it("should set editor reference", () => {
		const { result } = renderHook(() => useMentionManager())

		act(() => {
			result.current.setEditor(mockEditor as any)
		})

		// Editor reference is internal, so we test its effect through other methods
		expect(() => result.current.setEditor(mockEditor as any)).not.toThrow()
	})

	it("should add files to mentions", () => {
		const { result } = renderHook(() => useMentionManager())

		const mockFile = new File(["test content"], "test.pdf", { type: "application/pdf" })
		const fileDatas = [
			{
				id: "file-1",
				name: "test.pdf",
				file: mockFile,
				status: "init" as const,
			},
		]

		act(() => {
			result.current.addFilesToMentions(fileDatas)
		})

		expect(result.current.mentionItems).toHaveLength(1)
		expect(result.current.mentionItems[0].attrs.type).toBe(MentionItemType.UPLOAD_FILE)
	})

	it("should update file progress", () => {
		const { result } = renderHook(() => useMentionManager())

		const mockFile = new File(["test content"], "test.pdf", { type: "application/pdf" })
		const fileDatas = [
			{
				id: "file-1",
				name: "test.pdf",
				file: mockFile,
				status: "init" as const,
			},
		]

		act(() => {
			result.current.addFilesToMentions(fileDatas)
		})

		act(() => {
			result.current.updateFileProgress("file-1", 50, "uploading", undefined)
		})

		const uploadFileData = result.current.mentionItems[0].attrs.data as any
		expect(uploadFileData.upload_progress).toBe(50)
		expect(uploadFileData.upload_status).toBe("uploading")
	})

	it("should remove file by id", () => {
		const { result } = renderHook(() => useMentionManager())

		const mockFile = new File(["test content"], "test.pdf", { type: "application/pdf" })
		const fileDatas = [
			{
				id: "file-1",
				name: "test.pdf",
				file: mockFile,
				status: "init" as const,
			},
		]

		act(() => {
			result.current.addFilesToMentions(fileDatas)
		})

		expect(result.current.mentionItems).toHaveLength(1)

		act(() => {
			result.current.removeFile("file-1")
		})

		expect(result.current.mentionItems).toHaveLength(0)
	})

	it("should clear all mention items", () => {
		const { result } = renderHook(() => useMentionManager())

		const mentionItems: TiptapMentionAttributes[] = [
			{
				type: MentionItemType.AGENT,
				data: {
					agent_id: "agent-1",
					agent_name: "Agent 1",
					agent_description: "Agent 1 Description",
				},
			},
		]

		act(() => {
			result.current.insertMentionItems(mentionItems)
		})

		expect(result.current.mentionItems).toHaveLength(1)

		act(() => {
			result.current.clearAll()
		})

		expect(result.current.mentionItems).toHaveLength(0)
	})
})
