import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { ToolCallSettledEvent } from "@/pages/superMagic/stores/events"
import type { MagicProjectAttachmentFile } from "../../components/MessageList/components/MessageAttachment/utils"
import {
	resolveCreatedCanvasDirectory,
	useAutoOpenCreatedCanvasTool,
} from "../useAutoOpenCreatedCanvasTool"

const mockState = vi.hoisted(() => ({
	subscribe: vi.fn(),
	waitForRefresh: vi.fn(),
	settledCallback: undefined as undefined | ((event: ToolCallSettledEvent) => void),
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: { subscribe: mockState.subscribe },
}))

vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	waitForNextAttachmentsRefreshForProject: mockState.waitForRefresh,
}))

const canvasDirectory: MagicProjectAttachmentFile = {
	file_id: "canvas-directory",
	file_name: "画布",
	relative_file_path: "Canvas",
	parent_id: null,
	is_directory: true,
	display_config: { type: "design" },
}

const nestedCanvasDirectory: MagicProjectAttachmentFile = {
	...canvasDirectory,
	file_id: "nested-canvas-directory",
	relative_file_path: "主题/Canvas.v1",
	display_config: { type: "design", name: "Canvas.v1" },
}

const canvasConfig: MagicProjectAttachmentFile = {
	file_id: "canvas-config",
	file_name: "magic.project.js",
	relative_file_path: "Canvas/magic.project.js",
	parent_id: canvasDirectory.file_id,
	is_directory: false,
}

type AutoOpenHookParams = Parameters<typeof useAutoOpenCreatedCanvasTool>[0]

function createHookParams(overrides: Partial<AutoOpenHookParams> = {}): AutoOpenHookParams {
	return {
		topicId: "topic-1",
		projectId: "project-1",
		activeFileId: null,
		hasActiveDetailTab: false,
		attachmentList: [canvasDirectory, canvasConfig],
		scheduleWhenTabsCacheReady: (callback) => callback(),
		...overrides,
	}
}

interface SettledEventOptions {
	source?: ToolCallSettledEvent["meta"]["source"]
	topicId?: string
	toolCallId?: string
	toolName?: string
	status?: ToolCallSettledEvent["payload"]["response"]["status"]
	strength?: ToolCallSettledEvent["payload"]["strength"]
	replaceable?: boolean
	remark?: string
	detail?: unknown
}

function settledEvent(options: SettledEventOptions = {}): ToolCallSettledEvent {
	return {
		type: "toolCall.settled",
		meta: {
			sequence: 1,
			revision: 1,
			occurredAt: Date.now(),
			source: options.source ?? "im",
			topicId: options.topicId ?? "topic-1",
			toolCallId: options.toolCallId ?? "tool-1",
		},
		payload: {
			toolCall: {
				id: options.toolCallId ?? "tool-1",
				name: options.toolName ?? "create_canvas",
			},
			response: {
				status: options.status ?? "finished",
				remark: options.remark,
				detail:
					options.detail === undefined
						? {
								type: "design",
								data: { type: "canvas", project_path: "Canvas" },
							}
						: options.detail,
			},
			strength: options.strength ?? "strong",
			replaceable: options.replaceable ?? false,
		},
	}
}

describe("resolveCreatedCanvasDirectory", () => {
	it("matches a Canvas directory by project path without reading its files", () => {
		expect(
			resolveCreatedCanvasDirectory({
				projectPath: "/Canvas/",
				attachmentList: [canvasConfig, canvasDirectory],
			}),
		).toEqual({ status: "ready", canvasDirectory })
	})

	it("finds a nested Canvas directory from the attachment tree", () => {
		const parent = { ...canvasDirectory, file_id: "parent", relative_file_path: "主题" }
		expect(
			resolveCreatedCanvasDirectory({
				projectPath: "主题/Canvas.v1",
				attachments: [{ ...parent, children: [nestedCanvasDirectory] }],
			}),
		).toEqual({ status: "ready", canvasDirectory: nestedCanvasDirectory })
	})

	it("accepts a legacy project path ending in magic.project.js", () => {
		expect(
			resolveCreatedCanvasDirectory({
				projectPath: "Canvas/magic.project.js",
				attachmentList: [canvasDirectory],
			}),
		).toEqual({ status: "ready", canvasDirectory })
	})

	it("does not classify a same-path non-design directory as Canvas", () => {
		expect(
			resolveCreatedCanvasDirectory({
				projectPath: "Canvas",
				attachmentList: [{ ...canvasDirectory, display_config: { type: "slide" } }],
			}),
		).toEqual({ status: "not-canvas" })
	})

	it("keeps a missing directory in the unresolved state", () => {
		expect(
			resolveCreatedCanvasDirectory({ projectPath: "Canvas", attachmentList: [] }),
		).toEqual({ status: "unresolved" })
	})
})

describe("useAutoOpenCreatedCanvasTool", () => {
	let publishSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		mockState.subscribe.mockReset()
		mockState.waitForRefresh.mockReset()
		mockState.waitForRefresh.mockResolvedValue(true)
		mockState.settledCallback = undefined
		mockState.subscribe.mockImplementation((_type, callback) => {
			mockState.settledCallback = callback
			return vi.fn()
		})
		publishSpy = vi.spyOn(pubsub, "publish")
		publishSpy.mockClear()
	})

	afterEach(() => {
		cleanup()
		publishSpy.mockRestore()
		vi.useRealTimers()
	})

	it("opens the created Canvas after its tool call settles", () => {
		renderHook(() => useAutoOpenCreatedCanvasTool(createHookParams()))

		act(() => mockState.settledCallback?.(settledEvent()))

		expect(mockState.subscribe).toHaveBeenCalledWith("toolCall.settled", expect.any(Function), {
			scope: { topicId: "topic-1" },
		})
		expect(publishSpy).toHaveBeenNthCalledWith(1, PubSubEvents.Switch_Detail_Mode, "files")
		expect(publishSpy).toHaveBeenNthCalledWith(2, PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it("accepts the legacy tool name and a live HTTP settlement", () => {
		renderHook(() => useAutoOpenCreatedCanvasTool(createHookParams()))

		act(() =>
			mockState.settledCallback?.(
				settledEvent({ source: "http", toolName: "create_design_project" }),
			),
		)

		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it("opens initialize_canvas after the attachment tree receives its project", () => {
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ attachmentList: [] }) },
		)

		rerender(createHookParams({ attachmentList: [canvasDirectory, canvasConfig] }))
		act(() =>
			mockState.settledCallback?.(
				settledEvent({
					toolName: "initialize_canvas",
					remark: "Canvas · Canvas project created",
					detail: {
						type: "md",
						data: {
							file_name: "initialize_canvas.md",
							content: "Canvas project created",
						},
					},
				}),
			),
		)

		expect(mockState.waitForRefresh).not.toHaveBeenCalled()
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it.each([
		["failed tool", settledEvent({ status: "error" })],
		["weak settlement", settledEvent({ strength: "weak", replaceable: true })],
		["shared settlement", settledEvent({ source: "shared" })],
		["recovery settlement", settledEvent({ source: "recovery" })],
		["unrelated tool", settledEvent({ toolName: "generate_canvas_images" })],
		["missing project path", settledEvent({ detail: { type: "design", data: {} } })],
	])("ignores %s", (_case, event) => {
		renderHook(() => useAutoOpenCreatedCanvasTool(createHookParams()))

		act(() => mockState.settledCallback?.(event))

		expect(publishSpy).not.toHaveBeenCalled()
		expect(mockState.waitForRefresh).not.toHaveBeenCalled()
	})

	it("does not create an intent while a file or another detail tab is active", () => {
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ activeFileId: "existing-file" }) },
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		rerender(createHookParams({ hasActiveDetailTab: true }))
		act(() => mockState.settledCallback?.(settledEvent({ toolCallId: "tool-2" })))

		expect(publishSpy).not.toHaveBeenCalled()
		expect(mockState.waitForRefresh).not.toHaveBeenCalled()
	})

	it("waits for Tab cache readiness before opening", () => {
		let deferredOpen: (() => void) | undefined
		const scheduleWhenTabsCacheReady = vi.fn((callback: () => void) => {
			deferredOpen = callback
		})
		renderHook(() =>
			useAutoOpenCreatedCanvasTool(createHookParams({ scheduleWhenTabsCacheReady })),
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		expect(scheduleWhenTabsCacheReady).toHaveBeenCalledWith(
			expect.any(Function),
			"auto-open-created-canvas-topic-1:tool-1",
		)
		expect(publishSpy).not.toHaveBeenCalled()

		act(() => deferredOpen?.())
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it("opens when a later attachment snapshot contains the target", () => {
		let resolveRefresh: (didLoad: boolean) => void = () => undefined
		mockState.waitForRefresh.mockImplementation(
			() => new Promise<boolean>((resolve) => (resolveRefresh = resolve)),
		)
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ attachmentList: [] }) },
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		expect(mockState.waitForRefresh).toHaveBeenCalledTimes(1)
		expect(publishSpy).not.toHaveBeenCalled()

		rerender(createHookParams({ attachmentList: [canvasDirectory, canvasConfig] }))
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})

		return act(async () => resolveRefresh(true))
	})

	it("opens from the latest attachment tree when it updates before the tool settles", () => {
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ attachmentList: [] }) },
		)

		rerender(createHookParams({ attachmentList: [canvasDirectory, canvasConfig] }))
		act(() => mockState.settledCallback?.(settledEvent()))

		expect(mockState.waitForRefresh).not.toHaveBeenCalled()
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it("retries the attachment refresh before accepting a later realtime update", async () => {
		vi.useFakeTimers()
		mockState.waitForRefresh
			.mockResolvedValueOnce(true)
			.mockImplementationOnce(() => new Promise<boolean>(() => undefined))
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ attachmentList: [] }) },
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		expect(mockState.waitForRefresh).toHaveBeenCalledTimes(1)

		await act(async () => {
			await Promise.resolve()
			await vi.advanceTimersByTimeAsync(1_000)
		})
		expect(mockState.waitForRefresh).toHaveBeenCalledTimes(2)

		rerender(createHookParams({ attachmentList: [canvasDirectory, canvasConfig] }))
		expect(publishSpy).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "canvas-directory",
			fileData: canvasDirectory,
		})
	})

	it("does not open from a deferred callback after the intent expires", () => {
		vi.useFakeTimers()
		let deferredOpen: (() => void) | undefined
		const scheduleWhenTabsCacheReady = vi.fn((callback: () => void) => {
			deferredOpen = callback
		})
		renderHook(() =>
			useAutoOpenCreatedCanvasTool(createHookParams({ scheduleWhenTabsCacheReady })),
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		act(() => vi.advanceTimersByTime(60_000))
		act(() => deferredOpen?.())

		expect(publishSpy).not.toHaveBeenCalled()
	})

	it("cancels the intent when the user opens a file while waiting", () => {
		let deferredOpen: (() => void) | undefined
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{
				initialProps: createHookParams({
					scheduleWhenTabsCacheReady: (callback) => {
						deferredOpen = callback
					},
				}),
			},
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		rerender(
			createHookParams({
				activeFileId: "user-opened-file",
				scheduleWhenTabsCacheReady: () => undefined,
			}),
		)
		act(() => deferredOpen?.())

		expect(publishSpy).not.toHaveBeenCalled()
	})

	it("rechecks the latest active file immediately before opening", () => {
		let latestActiveFileId: string | null = null
		let deferredOpen: (() => void) | undefined
		renderHook(() =>
			useAutoOpenCreatedCanvasTool(
				createHookParams({
					getActiveFileId: () => latestActiveFileId,
					scheduleWhenTabsCacheReady: (callback) => {
						deferredOpen = callback
					},
				}),
			),
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		latestActiveFileId = "user-opened-file"
		act(() => deferredOpen?.())

		expect(publishSpy).not.toHaveBeenCalled()
	})

	it("clears an old intent when the topic changes", () => {
		let deferredOpen: (() => void) | undefined
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{
				initialProps: createHookParams({
					scheduleWhenTabsCacheReady: (callback) => {
						deferredOpen = callback
					},
				}),
			},
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		rerender(
			createHookParams({
				topicId: "topic-2",
				scheduleWhenTabsCacheReady: (callback) => callback(),
			}),
		)
		act(() => deferredOpen?.())

		expect(publishSpy).not.toHaveBeenCalled()
	})

	it("deduplicates repeated settlements for the same tool call", () => {
		renderHook(() => useAutoOpenCreatedCanvasTool(createHookParams()))

		act(() => {
			mockState.settledCallback?.(settledEvent())
			mockState.settledCallback?.(settledEvent())
		})

		expect(publishSpy).toHaveBeenCalledTimes(2)
	})

	it("coalesces multiple Canvas creations to the latest pending intent", () => {
		const { rerender } = renderHook(
			(params: AutoOpenHookParams) => useAutoOpenCreatedCanvasTool(params),
			{ initialProps: createHookParams({ attachmentList: [] }) },
		)

		act(() => mockState.settledCallback?.(settledEvent()))
		act(() =>
			mockState.settledCallback?.(
				settledEvent({
					toolCallId: "tool-2",
					detail: { type: "design", data: { project_path: "Canvas/New" } },
				}),
			),
		)
		rerender(
			createHookParams({
				attachmentList: [
					canvasDirectory,
					canvasConfig,
					{
						...canvasDirectory,
						file_id: "new-canvas-directory",
						relative_file_path: "Canvas/New",
					},
				],
			}),
		)

		expect(pubsub.publish).toHaveBeenCalledWith(PubSubEvents.Open_File_Tab, {
			fileId: "new-canvas-directory",
			fileData: expect.objectContaining({ relative_file_path: "Canvas/New" }),
		})
	})
})
