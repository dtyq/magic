import { renderHook, waitFor } from "@testing-library/react"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DraftStore } from "../../stores"
import useMessageEditorPubSub from "../useMessageEditorPubSub"
import {
	INSPECTOR_DETAIL_MARKER,
	INSPECTOR_DETAIL_TYPE,
} from "../../extensions/inspector-detail/const"
import { transformInspectorContent } from "../../extensions/inspector-detail/transform"
import {
	getHtmlScreenshotMention,
	resetHtmlScreenshotTargetStore,
} from "../../services/HtmlScreenshotTargetStore"

vi.mock("@/pages/superMagic/components/MessageEditor/utils/drag", () => ({
	DRAG_TYPE: {
		Tab: "tab",
		ProjectFile: "project-file",
		ProjectDirectory: "project-directory",
		MultipleFiles: "multiple-files",
		PPTSlide: "ppt-slide",
	},
	insertMentionFromDroppedData: vi.fn(),
}))

const storeScreenshot = vi.hoisted(() => vi.fn())
const uploadStoredScreenshot = vi.hoisted(() => vi.fn())
const uploadStoredScreenshots = vi.hoisted(() => vi.fn())
const collectUploadItems = vi.hoisted(() => vi.fn())

vi.mock("../../services/HtmlScreenshotUploadService", () => ({
	htmlScreenshotUploadService: {
		storeScreenshot,
		uploadStoredScreenshot,
		uploadStoredScreenshots,
		collectUploadItems,
	},
}))

/** Creates the minimum active editor surface required by the PubSub adapter. */
function createMockEditor(initialContent: JSONContent) {
	let content = initialContent
	const editor = {
		isDestroyed: false,
		commands: {
			focus: vi.fn(),
			insertContent: vi.fn(),
			setNodeSelection: vi.fn(),
			setTextSelection: vi.fn(),
		},
		state: { selection: { from: 1 } },
		getJSON: vi.fn(() => content),
		getText: vi.fn(() =>
			(content.content ?? [])
				.flatMap((node) => node.content ?? [])
				.map((node) => node.text ?? "")
				.join(""),
		),
	} as unknown as Editor

	return {
		editor,
		getContent: () => content,
		setContent: (nextContent: JSONContent | undefined) => {
			content = nextContent ?? { type: "doc", content: [{ type: "paragraph" }] }
		},
	}
}

describe("useMessageEditorPubSub", () => {
	beforeEach(() => {
		resetHtmlScreenshotTargetStore()
		storeScreenshot.mockReset()
		uploadStoredScreenshot.mockReset()
		uploadStoredScreenshots.mockReset()
		collectUploadItems.mockReset()
		storeScreenshot.mockResolvedValue({
			storageId: "screenshot-storage-id",
			fileName: "screenshot.png",
			fileSize: 3,
			file: new File(["png"], "screenshot.png", { type: "image/png" }),
		})
		uploadStoredScreenshot.mockResolvedValue({
			file_id: "saved-id",
			file_key: "temporary/snowflake-1",
			file_name: "screenshot.png",
			is_hidden: true,
		})
		uploadStoredScreenshots.mockResolvedValue([
			{
				storageId: "screenshot-storage-id",
				result: {
					file_id: "saved-id",
					file_key: "temporary/snowflake-1",
					file_name: "screenshot.png",
					is_hidden: true,
				},
			},
		])
		collectUploadItems.mockImplementation(
			(mentions: Array<{ data?: { storage_id?: string; file_name?: string } }>) =>
				mentions
					.filter((mention) => mention.data?.storage_id)
					.map((mention) => ({
						storageId: mention.data?.storage_id,
						fileName: mention.data?.file_name ?? "screenshot.png",
					})),
		)
	})

	it("submits HTML selections through the current conversation", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const onSendMessageByContent = vi.fn().mockResolvedValue(undefined)
		const onSuccess = vi.fn()
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent,
			}),
		)

		pubsub.publish(PubSubEvents.Submit_Html_Multi_Selection, {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
			instruction: "",
			targets: [
				{
					kind: "element",
					selector: "#hero",
					elementLabel: "section#hero",
					instruction: "Increase the title size",
				},
			],
			onSuccess,
		})
		await vi.waitFor(() => expect(onSendMessageByContent).toHaveBeenCalledTimes(1))

		const payload = onSendMessageByContent.mock.calls[0][0]
		expect(payload.shouldClearEditorAfterSend).toBe(true)
		expect(JSON.stringify(payload.jsonContent)).toContain("Increase the title size")
		expect(JSON.stringify(payload.jsonContent)).toContain(INSPECTOR_DETAIL_MARKER)
		expect(JSON.stringify(payload.jsonContent)).not.toContain(INSPECTOR_DETAIL_TYPE)
		expect(JSON.stringify(transformInspectorContent(payload.jsonContent))).toContain(
			INSPECTOR_DETAIL_TYPE,
		)
		expect(onSuccess).toHaveBeenCalledTimes(1)

		unmount()
	})

	it("stores a new screenshot when the same target is captured again", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent: vi.fn(),
			}),
		)

		storeScreenshot.mockResolvedValueOnce({
			storageId: "old-storage-id",
			fileName: "old.png",
			fileSize: 3,
			file: new File(["old"], "old.png", { type: "image/png" }),
		})
		pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
			captureId: "div.cover-surface",
			dataUrl: "data:image/png;base64,OLD",
			fileName: "html-screenshot-a2296b4a.png",
		})
		await vi.waitFor(() => expect(storeScreenshot).toHaveBeenCalledTimes(1))
		expect(uploadStoredScreenshot).not.toHaveBeenCalled()
		expect(getHtmlScreenshotMention("div.cover-surface")?.data).toMatchObject({
			storage_id: "old-storage-id",
		})

		storeScreenshot.mockResolvedValueOnce({
			storageId: "new-storage-id",
			fileName: "new.png",
			fileSize: 3,
			file: new File(["new"], "new.png", { type: "image/png" }),
		})
		pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
			captureId: "div.cover-surface",
			dataUrl: "data:image/png;base64,NEW",
			fileName: "html-screenshot-a2296b4a.png",
		})
		await vi.waitFor(() => expect(storeScreenshot).toHaveBeenCalledTimes(2))
		expect(getHtmlScreenshotMention("div.cover-surface")?.data).toMatchObject({
			storage_id: "new-storage-id",
		})

		unmount()
	})

	it("reuses a screenshot uploaded after target confirmation", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const onSendMessageByContent = vi.fn().mockResolvedValue(undefined)
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent,
				projectId: "project-1",
				topicId: "topic-1",
			}),
		)

		const captureId = "screenshot:1"
		pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
			captureId,
			dataUrl: "data:image/png;base64,AA==",
			stageUpload: true,
		})
		await vi.waitFor(() => expect(storeScreenshot).toHaveBeenCalledTimes(1))
		await vi.waitFor(() => expect(uploadStoredScreenshot).toHaveBeenCalledTimes(1))
		expect(uploadStoredScreenshot).toHaveBeenCalledWith({
			storageId: "screenshot-storage-id",
			fileName: "screenshot.png",
			projectId: "project-1",
			topicId: "topic-1",
		})

		pubsub.publish(PubSubEvents.Submit_Html_Multi_Selection, {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
			instruction: "",
			targets: [
				{
					id: captureId,
					kind: "screenshot",
					selector: "",
					elementLabel: "Screenshot",
					screenshot: {
						dataUrl: "data:image/png;base64,AA==",
						rect: { left: 0, top: 0, width: 100, height: 80 },
					},
					instruction: "Move this area",
				},
			],
		})

		await vi.waitFor(() => expect(onSendMessageByContent).toHaveBeenCalledTimes(1))
		expect(storeScreenshot).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(onSendMessageByContent.mock.calls[0][0].jsonContent)).toContain(
			"screenshot-storage-id",
		)
		expect(JSON.stringify(onSendMessageByContent.mock.calls[0][0].jsonContent)).not.toContain(
			'"file":',
		)

		unmount()
	})

	it("waits for an in-flight region upload before submitting AI edits", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const onSendMessageByContent = vi.fn().mockResolvedValue(undefined)
		let resolveUpload: ((value: unknown) => void) | undefined
		uploadStoredScreenshots.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveUpload = resolve
				}),
		)
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent,
				projectId: "project-1",
				topicId: "topic-1",
			}),
		)

		const captureId = "screenshot:1"
		pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
			captureId,
			dataUrl: "data:image/png;base64,AA==",
			stageUpload: true,
		})
		await vi.waitFor(() => expect(storeScreenshot).toHaveBeenCalledTimes(1))

		pubsub.publish(PubSubEvents.Submit_Html_Multi_Selection, {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
			instruction: "",
			targets: [
				{
					id: captureId,
					kind: "screenshot",
					selector: "",
					elementLabel: "Screenshot",
					screenshot: {
						dataUrl: "data:image/png;base64,AA==",
						rect: { left: 0, top: 0, width: 100, height: 80 },
					},
					instruction: "Move this area",
				},
			],
		})

		await vi.waitFor(() => expect(uploadStoredScreenshots).toHaveBeenCalledTimes(1))
		expect(onSendMessageByContent).not.toHaveBeenCalled()
		resolveUpload?.([
			{
				storageId: "screenshot-storage-id",
				result: { file_id: "saved-id", is_hidden: true },
			},
		])
		await vi.waitFor(() => expect(onSendMessageByContent).toHaveBeenCalledTimes(1))

		unmount()
	})

	it("sends element selections without uploading their local screenshots", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const onSendMessageByContent = vi.fn().mockResolvedValue(undefined)
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent,
				projectId: "project-1",
				topicId: "topic-1",
			}),
		)

		pubsub.publish(PubSubEvents.Submit_Html_Multi_Selection, {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "index.html",
			instruction: "",
			targets: [
				{
					id: "#hero",
					kind: "element",
					selector: "#hero",
					elementLabel: "section#hero",
					textContent: "Hero",
					screenshot: {
						dataUrl: "data:image/png;base64,AA==",
						rect: { left: 0, top: 0, width: 100, height: 80 },
					},
					instruction: "Keep this visual style",
				},
			],
		})

		await vi.waitFor(() => expect(onSendMessageByContent).toHaveBeenCalledTimes(1))
		expect(storeScreenshot).not.toHaveBeenCalled()
		expect(JSON.stringify(onSendMessageByContent.mock.calls[0][0].jsonContent)).not.toContain(
			"screenshot.png",
		)
		expect(JSON.stringify(onSendMessageByContent.mock.calls[0][0].jsonContent)).toContain(
			"Keep this visual style",
		)

		unmount()
	})

	it("stores a screenshot mention by target id without rewriting the editor", () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const dispatch = vi.fn()
		const editor = {
			isDestroyed: false,
			commands: { focus: vi.fn(), insertContent: vi.fn() },
			state: { selection: { from: 1 } },
			view: { dispatch },
		} as unknown as Editor
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent: vi.fn(),
			}),
		)
		const screenshotMention = {
			type: "upload_file",
			data: { file_id: "screenshot-1", storage_id: "screenshot-1" },
		}

		pubsub.publish(PubSubEvents.Update_Html_Inspector_Screenshot, {
			captureId: "element:#hero:1:1",
			screenshotMention,
		})

		expect(getHtmlScreenshotMention("element:#hero:1:1")).toEqual(screenshotMention)
		expect(dispatch).not.toHaveBeenCalled()

		unmount()
	})

	it("keeps a prepared screenshot after the active editor changes", async () => {
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const firstEditor = createMockEditor({ type: "doc", content: [{ type: "paragraph" }] })
		const { rerender, unmount } = renderHook(
			({ editor }) =>
				useMessageEditorPubSub({
					editor,
					isMobile: false,
					draftStore,
					updateContent: vi.fn(),
					enableMessageSendByContent: false,
					onSendMessageByContent: vi.fn(),
				}),
			{ initialProps: { editor: firstEditor.editor } },
		)

		pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
			captureId: "element:#hero:1:1",
			dataUrl: "data:image/png;base64,AA==",
		})
		await vi.waitFor(() => expect(storeScreenshot).toHaveBeenCalledTimes(1))

		const secondEditor = createMockEditor({ type: "doc", content: [{ type: "paragraph" }] })
		rerender({ editor: secondEditor.editor })

		await vi.waitFor(() =>
			expect(getHtmlScreenshotMention("element:#hero:1:1")?.data).toMatchObject({
				storage_id: "screenshot-storage-id",
			}),
		)

		unmount()
	})

	it("places the caret after an inspector node after appending it", async () => {
		const mockEditor = createMockEditor({
			type: "doc",
			content: [{ type: "paragraph" }],
		})
		const insertContent = mockEditor.editor.commands.insertContent as ReturnType<typeof vi.fn>
		const setNodeSelection = mockEditor.editor.commands.setNodeSelection as ReturnType<
			typeof vi.fn
		>
		const setTextSelection = mockEditor.editor.commands.setTextSelection as ReturnType<
			typeof vi.fn
		>
		insertContent.mockReturnValue(true)
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: mockEditor.editor,
				isMobile: false,
				draftStore,
				updateContent: vi.fn(),
				enableMessageSendByContent: false,
				onSendMessageByContent: vi.fn(),
			}),
		)

		pubsub.publish(PubSubEvents.Append_Content_To_Editor, {
			type: "paragraph",
			content: [{ type: INSPECTOR_DETAIL_TYPE, attrs: { selector: "#hero" } }],
		})

		await vi.waitFor(() => expect(insertContent).toHaveBeenCalledTimes(1))
		expect(setNodeSelection).not.toHaveBeenCalled()
		expect(setTextSelection).toHaveBeenCalledWith(2)

		unmount()
	})

	it("maintains plain-text input through Widget commands", async () => {
		const mockEditor = createMockEditor({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "mock" }] }],
		})
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const updateContent = vi.fn((content: JSONContent | undefined) => {
			mockEditor.setContent(content)
		})
		const onSendCurrentContent = vi.fn()
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: mockEditor.editor,
				isMobile: false,
				draftStore,
				updateContent,
				enableMessageSendByContent: true,
				onSendMessageByContent: vi.fn(),
				onSendCurrentContent,
			}),
		)

		const setRespond = vi.fn()
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "setInput",
			content: "replacement",
			respond: setRespond,
		})
		expect(mockEditor.getContent()).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "replacement" }],
				},
			],
		})
		const sendRespond = vi.fn()
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "sendMessage",
			respond: sendRespond,
		})
		expect(onSendCurrentContent).toHaveBeenCalledTimes(1)
		await waitFor(() => expect(sendRespond).toHaveBeenCalledTimes(1))
		expect(setRespond).toHaveBeenCalledTimes(1)
		expect(updateContent.mock.invocationCallOrder.at(-1)).toBeLessThan(
			setRespond.mock.invocationCallOrder[0],
		)

		const appendRespond = vi.fn()
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "appendInput",
			content: " suffix",
			respond: appendRespond,
		})
		expect(appendRespond).toHaveBeenCalledTimes(1)
		expect(mockEditor.getContent()).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "replacement" },
						{ type: "text", text: " suffix" },
					],
				},
			],
		})

		const getRespond = vi.fn()
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "getInput",
			respond: getRespond,
		})
		expect(getRespond).toHaveBeenCalledWith("replacement suffix")

		const clearRespond = vi.fn()
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "clearInput",
			respond: clearRespond,
		})
		expect(clearRespond).toHaveBeenCalledTimes(1)
		expect(mockEditor.getContent()).toEqual({
			type: "doc",
			content: [{ type: "paragraph" }],
		})

		unmount()
	})

	it("sets and appends structured Widget mention content", () => {
		const mockEditor = createMockEditor({ type: "doc", content: [{ type: "paragraph" }] })
		const draftStore = {
			waitForLoadDraft: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftStore
		const updateContent = vi.fn((content: JSONContent | undefined) => {
			mockEditor.setContent(content)
		})
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: mockEditor.editor,
				isMobile: false,
				draftStore,
				updateContent,
				enableMessageSendByContent: true,
				onSendMessageByContent: vi.fn(),
				onSendCurrentContent: vi.fn(),
			}),
		)
		const agentMention = {
			type: "mention",
			attrs: {
				type: "agent",
				data: { agent_id: "agent-mock-001", agent_name: "Agent Mock" },
			},
		}

		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "setInput",
			content: {
				type: "doc",
				content: [
					{ type: "paragraph", content: [{ type: "text", text: "Ask " }, agentMention] },
				],
			},
			respond: vi.fn(),
		})
		pubsub.publish(PubSubEvents.Magic_Widget_Editor_Command, {
			command: "appendInput",
			content: {
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: " now" }] }],
			},
			respond: vi.fn(),
		})

		expect(mockEditor.getContent()).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Ask " },
						agentMention,
						{ type: "text", text: " now" },
					],
				},
			],
		})
		expect(updateContent.mock.calls[0]?.[1]).toEqual({ preserveMentionValidation: true })
		expect(updateContent.mock.calls[1]?.[1]).toEqual({ preserveMentionValidation: true })

		unmount()
	})

	it("waits for draft load before applying Add_Content_To_Chat", async () => {
		let resolveDraftLoad: (() => void) | undefined
		const draftLoadPromise = new Promise<void>((resolve) => {
			resolveDraftLoad = resolve
		})
		const draftStore = {
			waitForLoadDraft: vi.fn(() => draftLoadPromise),
		} as unknown as DraftStore
		const updateContent = vi.fn()
		const { unmount } = renderHook(() =>
			useMessageEditorPubSub({
				editor: null,
				isMobile: true,
				draftStore,
				updateContent,
				enableMessageSendByContent: true,
				onSendMessageByContent: vi.fn(),
				onSendCurrentContent: vi.fn(),
			}),
		)

		const scheduledContent: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "scheduled task" }] }],
		}

		pubsub.publish(PubSubEvents.Add_Content_To_Chat, { content: scheduledContent })
		expect(draftStore.waitForLoadDraft).toHaveBeenCalledTimes(1)
		expect(updateContent).not.toHaveBeenCalled()

		resolveDraftLoad?.()
		await draftLoadPromise
		await Promise.resolve()

		expect(updateContent).toHaveBeenCalledWith(scheduledContent)

		unmount()
	})
})
