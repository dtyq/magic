import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import type { CanvasDocument } from "@/components/CanvasDesign/runtime/document/types"
import { ElementTypeEnum } from "@/components/CanvasDesign/runtime/document/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useCanvasSelectionMentionPublisher } from "../useCanvasSelectionMentionPublisher"

const document = {
	elements: [
		{
			id: "image-1",
			type: ElementTypeEnum.Image,
			name: "image.png",
			contents: [{ contentId: "main", src: "folder/image.png" }],
			activeContentId: "main",
			mainContentId: "main",
		},
	],
} as unknown as CanvasDocument

describe("useCanvasSelectionMentionPublisher", () => {
	it("re-publishes the retained Canvas selection when a cached tab becomes active", () => {
		const selectedIds = ["image-1"]
		const canvasDesignRef = {
			current: {
				exportCurrentDocument: () => document,
				getCanvasInstance: () => ({
					selectionManager: { getSelectedIds: () => selectedIds },
				}),
			} as unknown as CanvasDesignRef,
		}
		const payloads: Array<{ active: boolean; items: unknown[] }> = []
		const listener = (payload: { active: boolean; items: unknown[] }) => payloads.push(payload)
		pubsub.subscribe(PubSubEvents.Super_Magic_Canvas_Selection_Mentions, listener)

		const commonOptions = {
			canvasDesignRef,
			designProjectId: "canvas-1",
			scope: {
				workspaceId: "workspace-1",
				projectId: "project-1",
				topicId: "topic-1",
				designProjectId: "canvas-1",
			},
			getFallbackDocument: () => document,
			resolveFileBySrc: vi.fn(() => ({
				file_id: "file-1",
				file_name: "image.png",
				relative_file_path: "folder/image.png",
				file_extension: "png",
			})),
		}
		const { rerender, unmount } = renderHook(
			({ enabled }) => useCanvasSelectionMentionPublisher({ ...commonOptions, enabled }),
			{ initialProps: { enabled: false } },
		)

		act(() => rerender({ enabled: true }))
		expect(payloads.at(-1)).toMatchObject({
			active: true,
			items: [
				{
					data: expect.objectContaining({ file_id: "file-1" }),
				},
			],
		})

		act(() => rerender({ enabled: false }))
		expect(payloads.at(-1)).toEqual(expect.objectContaining({ active: false, items: [] }))

		unmount()
		pubsub.unsubscribe(PubSubEvents.Super_Magic_Canvas_Selection_Mentions, listener)
	})
})
