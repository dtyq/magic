import { act, renderHook, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MessageEditorRef } from "../../message/MessageEditor"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"

const mocks = vi.hoisted(() => ({
	useCanvas: vi.fn(),
	useLinkedEditorInputs: vi.fn(),
	useLinkedMediaMentionSelection: vi.fn(),
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: mocks.useCanvas,
}))

vi.mock("../useLinkedEditorInputs", () => ({
	useLinkedEditorInputs: mocks.useLinkedEditorInputs,
}))

vi.mock("../useLinkedMediaMentionSelection", () => ({
	useLinkedMediaMentionSelection: mocks.useLinkedMediaMentionSelection,
}))

import { useLinkedMediaAssociationController } from "../useLinkedMediaAssociationController"

describe("useLinkedMediaAssociationController", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.useCanvas.mockReturnValue({ canvas: null })
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: [],
			textConnections: [],
			mediaItems: [],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected: vi.fn(),
		})
		mocks.useLinkedMediaMentionSelection.mockReturnValue(vi.fn(() => true))
	})

	it("consumes a connection-menu seed after applying text and media associations", async () => {
		const seed = {
			id: "seed-1",
			targetElementId: "target-image",
			targetKind: "image-generator" as const,
			rootElementIds: ["root-1"],
			orderedSources: [
				{ elementId: "text-1", kind: "text" },
				{ elementId: "image-1", kind: "image" },
			],
			originRevision: "root-1",
			createdBy: "connection-menu" as const,
			mediaRole: "reference" as const,
		}
		const consume = vi.fn()
		mocks.useCanvas.mockReturnValue({
			canvas: {
				connectionAssociationSeedManager: {
					peek: vi.fn(() => seed),
					consume,
				},
			},
		})
		const setTextConnectionSelected = vi.fn()
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: ["text-1", "image-1"],
			textConnections: [
				{ connectionId: "text-connection", sourceElementId: "text-1", text: "prompt" },
			],
			mediaItems: [
				{
					connectionId: "image-connection",
					sourceElementId: "image-1",
					kind: "image",
					path: "/image.png",
					status: "inactive",
					selected: false,
				},
			],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected,
		})
		const selectMedia = vi.fn(() => true)
		mocks.useLinkedMediaMentionSelection.mockReturnValue(selectMedia)
		const editorRef = createRef<MessageEditorRef>()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
				mediaPolicyStatus: "ready",
				editorRef,
			}),
		)

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})

		await waitFor(() => {
			expect(setTextConnectionSelected).toHaveBeenCalledWith("text-connection", true)
			expect(selectMedia).toHaveBeenCalledWith("image-connection", true)
			expect(consume).toHaveBeenCalledWith("target-image", "seed-1")
		})
	})

	it("retains a media seed until the target policy becomes ready", async () => {
		const seed = {
			id: "seed-image",
			targetElementId: "target-image",
			targetKind: "image-generator" as const,
			rootElementIds: ["image-1"],
			orderedSources: [{ elementId: "image-1", kind: "image" as const }],
			originRevision: "image-1",
			createdBy: "connection-menu" as const,
			mediaRole: "reference" as const,
		}
		const consume = vi.fn()
		mocks.useCanvas.mockReturnValue({
			canvas: {
				connectionAssociationSeedManager: {
					peek: vi.fn(() => seed),
					consume,
				},
			},
		})
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: ["image-1"],
			textConnections: [],
			mediaItems: [
				{
					connectionId: "image-connection",
					sourceElementId: "image-1",
					kind: "image",
					path: "/image.png",
					status: "inactive",
					selected: false,
				},
			],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected: vi.fn(),
		})
		const selectMedia = vi.fn(() => true)
		mocks.useLinkedMediaMentionSelection.mockReturnValue(selectMedia)
		const editorRef = createRef<MessageEditorRef>()
		const { result, rerender } = renderHook(
			({ mediaPolicyStatus }: { mediaPolicyStatus: "loading" | "ready" }) =>
				useLinkedMediaAssociationController({
					targetElementId: "target-image",
					targetKind: "image",
					mediaPolicy: {
						supportedKinds: mediaPolicyStatus === "ready" ? ["image"] : [],
						maxTotalCount: mediaPolicyStatus === "ready" ? 1 : 0,
					},
					mediaPolicyStatus,
					editorRef,
				}),
			{ initialProps: { mediaPolicyStatus: "loading" as const } },
		)

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "sync",
				status: "pending",
				revision: 1,
			})
			result.current.handleMentionChange([], "", {
				source: "sync",
				status: "ready",
				revision: 1,
			})
		})

		expect(selectMedia).not.toHaveBeenCalled()
		expect(consume).not.toHaveBeenCalled()

		rerender({ mediaPolicyStatus: "ready" })

		await waitFor(() => {
			expect(selectMedia).toHaveBeenCalledWith("image-connection", true)
			expect(consume).toHaveBeenCalledWith("target-image", "seed-image")
		})
	})

	it("retains the seed until every source has entered the linked input resolution", () => {
		const seed = {
			id: "seed-pending-inputs",
			targetElementId: "target-image",
			targetKind: "image-generator" as const,
			rootElementIds: ["image-1"],
			orderedSources: [{ elementId: "image-1", kind: "image" as const }],
			originRevision: "image-1",
			createdBy: "connection-menu" as const,
			mediaRole: "reference" as const,
		}
		const consume = vi.fn()
		mocks.useCanvas.mockReturnValue({
			canvas: {
				connectionAssociationSeedManager: {
					peek: vi.fn(() => seed),
					consume,
				},
			},
		})
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: [],
			textConnections: [],
			mediaItems: [],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected: vi.fn(),
		})
		const selectMedia = vi.fn(() => true)
		mocks.useLinkedMediaMentionSelection.mockReturnValue(selectMedia)
		const editorRef = createRef<MessageEditorRef>()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
				mediaPolicyStatus: "ready",
				editorRef,
			}),
		)

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})

		expect(selectMedia).not.toHaveBeenCalled()
		expect(consume).not.toHaveBeenCalled()
	})

	it("retains the seed when inserting a media mention fails", () => {
		const seed = {
			id: "seed-insert-failed",
			targetElementId: "target-image",
			targetKind: "image-generator" as const,
			rootElementIds: ["image-1"],
			orderedSources: [{ elementId: "image-1", kind: "image" as const }],
			originRevision: "image-1",
			createdBy: "connection-menu" as const,
			mediaRole: "reference" as const,
		}
		const consume = vi.fn()
		mocks.useCanvas.mockReturnValue({
			canvas: {
				connectionAssociationSeedManager: {
					peek: vi.fn(() => seed),
					consume,
				},
			},
		})
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: ["image-1"],
			textConnections: [],
			mediaItems: [
				{
					connectionId: "image-connection",
					sourceElementId: "image-1",
					kind: "image",
					path: "/image.png",
					status: "inactive",
					selected: false,
				},
			],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected: vi.fn(),
		})
		const selectMedia = vi.fn(() => false)
		mocks.useLinkedMediaMentionSelection.mockReturnValue(selectMedia)
		const editorRef = createRef<MessageEditorRef>()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"], maxTotalCount: 1 },
				mediaPolicyStatus: "ready",
				editorRef,
			}),
		)

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})

		expect(selectMedia).toHaveBeenCalledWith("image-connection", true)
		expect(consume).not.toHaveBeenCalled()
	})

	it("waits for the reused editor to become ready for the new target before consuming its seed", async () => {
		const seed = {
			id: "seed-video",
			targetElementId: "target-video",
			targetKind: "video-generator" as const,
			rootElementIds: ["root-1"],
			orderedSources: [{ elementId: "text-1", kind: "text" }],
			originRevision: "root-1",
			createdBy: "connection-menu" as const,
			mediaRole: "reference" as const,
		}
		const consume = vi.fn()
		mocks.useCanvas.mockReturnValue({
			canvas: {
				connectionAssociationSeedManager: {
					peek: vi.fn((targetElementId: string) =>
						targetElementId === seed.targetElementId ? seed : null,
					),
					consume,
				},
			},
		})
		const setTextConnectionSelected = vi.fn()
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: ["text-1"],
			textConnections: [
				{ connectionId: "text-connection", sourceElementId: "text-1", text: "prompt" },
			],
			mediaItems: [],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected,
		})
		const editorRef = createRef<MessageEditorRef>()
		const { result, rerender } = renderHook(
			({
				targetElementId,
				targetKind,
			}: {
				targetElementId: string
				targetKind: "image" | "video"
			}) =>
				useLinkedMediaAssociationController({
					targetElementId,
					targetKind,
					mediaPolicy: { supportedKinds: [] },
					mediaPolicyStatus: "ready",
					editorRef,
				}),
			{ initialProps: { targetElementId: "target-image", targetKind: "image" as const } },
		)

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})
		rerender({ targetElementId: "target-video", targetKind: "video" })

		expect(consume).not.toHaveBeenCalled()

		act(() => {
			result.current.handleMentionChange([], "", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})

		await waitFor(() => {
			expect(setTextConnectionSelected).toHaveBeenCalledWith("text-connection", true)
			expect(consume).toHaveBeenCalledWith("target-video", "seed-video")
		})
	})

	it("accepts only the latest pending sync and supports editor revision resets", () => {
		const onReadyMentionChange = vi.fn()
		const editorRef = createRef<MessageEditorRef>()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: { supportedKinds: ["image"] },
				mediaPolicyStatus: "ready",
				editorRef,
				onReadyMentionChange,
			}),
		)

		act(() => {
			expect(
				result.current.handleMentionChange(["./images/pending.png"], "@pending.png", {
					source: "sync",
					status: "pending",
					revision: 1,
				}),
			).toBe(false)
		})
		expect(result.current.mentionedReferencePaths).toEqual([])
		expect(onReadyMentionChange).not.toHaveBeenCalled()

		act(() => {
			expect(
				result.current.handleMentionChange(["./images/ready.png"], "@ready.png", {
					source: "sync",
					status: "ready",
					revision: 1,
				}),
			).toBe(true)
		})
		// sync 只更新 linked mention 快照，不驱动 protected/参考图回调。
		expect(result.current.mentionedReferencePaths).toEqual(["./images/ready.png"])
		expect(onReadyMentionChange).not.toHaveBeenCalled()

		act(() => {
			expect(
				result.current.handleMentionChange(["./images/next.png"], "@next.png", {
					source: "sync",
					status: "pending",
					revision: 2,
				}),
			).toBe(false)
			expect(
				result.current.handleMentionChange(["./images/stale.png"], "@stale.png", {
					source: "sync",
					status: "ready",
					revision: 1,
				}),
			).toBe(false)
		})
		expect(result.current.mentionedReferencePaths).toEqual(["./images/ready.png"])

		act(() => {
			expect(
				result.current.handleMentionChange(["./images/next.png"], "@next.png", {
					source: "sync",
					status: "ready",
					revision: 2,
				}),
			).toBe(true)
		})
		expect(result.current.mentionedReferencePaths).toEqual(["./images/next.png"])
		expect(onReadyMentionChange).not.toHaveBeenCalled()

		act(() => {
			result.current.handleMentionChange(["./images/remounted.png"], "@remounted.png", {
				source: "sync",
				status: "pending",
				revision: 1,
			})
			expect(
				result.current.handleMentionChange(["./images/remounted.png"], "@remounted.png", {
					source: "sync",
					status: "ready",
					revision: 1,
				}),
			).toBe(true)
		})
		expect(result.current.mentionedReferencePaths).toEqual(["./images/remounted.png"])
		expect(onReadyMentionChange).not.toHaveBeenCalled()
	})

	it("keeps the persisted same-name path during sync but allows an explicit user switch", () => {
		const onReadyMentionChange = vi.fn()
		const editorRef = createRef<MessageEditorRef>()
		const resolveResourceReference = createTestResourceReferenceResolver()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					manualReferences: [{ kind: "image", path: "/images/x.png" }],
				},
				mediaPolicyStatus: "ready",
				editorRef,
				onReadyMentionChange,
				resolveResourceReference,
			}),
		)

		act(() => {
			result.current.handleMentionChange(["./images/x.png"], "@x.png", {
				source: "sync",
				status: "pending",
				revision: 1,
			})
			result.current.handleMentionChange(["./images/x.png"], "@x.png", {
				source: "sync",
				status: "ready",
				revision: 1,
			})
		})

		expect(result.current.mentionedReferencePaths).toEqual(["/images/x.png"])
		expect(onReadyMentionChange).not.toHaveBeenCalled()

		act(() => {
			result.current.handleMentionChange(["./images/x.png"], "@x.png", {
				source: "user",
				status: "ready",
				revision: 2,
			})
		})

		expect(result.current.mentionedReferencePaths).toEqual(["./images/x.png"])
		// user 回调必须传编辑器真实 paths，不能用 sync reconcile 后的持久化拼写。
		expect(onReadyMentionChange).toHaveBeenLastCalledWith(["./images/x.png"], "@x.png", {
			source: "user",
			status: "ready",
			revision: 2,
		})
	})

	it("does not treat sync-filled empty mentions as prompt bindings", () => {
		const onReadyMentionChange = vi.fn()
		const editorRef = createRef<MessageEditorRef>()
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-image",
				targetKind: "image",
				mediaPolicy: {
					supportedKinds: ["image"],
					manualReferences: [
						{ kind: "image", path: "/images/a.png" },
						{ kind: "image", path: "/images/b.png" },
					],
				},
				mediaPolicyStatus: "ready",
				editorRef,
				onReadyMentionChange,
			}),
		)

		act(() => {
			result.current.handleMentionChange([], "改成卡通风格", {
				source: "sync",
				status: "pending",
				revision: 1,
			})
			expect(
				result.current.handleMentionChange([], "改成卡通风格", {
					source: "sync",
					status: "ready",
					revision: 1,
				}),
			).toBe(true)
		})

		expect(result.current.mentionedReferencePaths).toEqual(["/images/a.png", "/images/b.png"])
		expect(onReadyMentionChange).not.toHaveBeenCalled()

		act(() => {
			result.current.handleMentionChange([], "改成卡通风格，再亮一点", {
				source: "user",
				status: "ready",
				revision: 2,
			})
		})

		expect(onReadyMentionChange).toHaveBeenCalledTimes(1)
		expect(onReadyMentionChange).toHaveBeenCalledWith([], "改成卡通风格，再亮一点", {
			source: "user",
			status: "ready",
			revision: 2,
		})
	})

	it("passes linked opaque asset types to the ready mention callback", () => {
		const onReadyMentionChange = vi.fn()
		mocks.useLinkedEditorInputs.mockReturnValue({
			connectedSourceElementIds: ["video-source"],
			textConnections: [],
			mediaItems: [],
			activeMediaReferences: [{ kind: "video", path: "asset://linked-video" }],
			canSelectMediaConnection: vi.fn(() => true),
			setTextConnectionSelected: vi.fn(),
		})
		const { result } = renderHook(() =>
			useLinkedMediaAssociationController({
				targetElementId: "target-video",
				targetKind: "video",
				mediaPolicy: { supportedKinds: ["video"] },
				mediaPolicyStatus: "ready",
				editorRef: createRef<MessageEditorRef>(),
				onReadyMentionChange,
			}),
		)

		act(() => {
			result.current.handleMentionChange(["asset://linked-video"], "@asset://linked-video", {
				source: "user",
				status: "ready",
				revision: 1,
			})
		})

		expect(onReadyMentionChange).toHaveBeenCalledWith(
			["asset://linked-video"],
			"@asset://linked-video",
			{ source: "user", status: "ready", revision: 1 },
			[{ path: "asset://linked-video", assetType: "video" }],
		)
	})
})
