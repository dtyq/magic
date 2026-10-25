import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { useAttachments } from "../useAttachments"

function attachment(fileId: string): FileItem {
	return {
		file_id: fileId,
		file_name: `${fileId}.png`,
		relative_file_path: `images/${fileId}.png`,
		is_directory: false,
	} as FileItem
}

describe("useAttachments", () => {
	it("becomes ready after observing a non-empty snapshot", () => {
		const { result } = renderHook(() =>
			useAttachments({
				attachments: [attachment("a")],
				projectId: "project-a",
			}),
		)

		expect(result.current.attachmentsReady).toBe(true)
	})

	it("resets readiness immediately when the project changes", () => {
		const { result, rerender } = renderHook(
			(options: { projectId: string; attachments?: FileItem[] }) => useAttachments(options),
			{
				initialProps: {
					projectId: "project-a",
					attachments: [attachment("a")],
				},
			},
		)

		expect(result.current.attachmentsReady).toBe(true)
		rerender({ projectId: "project-b", attachments: undefined })
		expect(result.current.attachmentsReady).toBe(false)
	})

	it("does not reuse readiness when returning to a previous project", () => {
		const { result, rerender } = renderHook(
			(options: { projectId: string; attachments?: FileItem[] }) => useAttachments(options),
			{
				initialProps: {
					projectId: "project-a",
					attachments: [attachment("a")],
				},
			},
		)

		rerender({ projectId: "project-b", attachments: undefined })
		rerender({ projectId: "project-a", attachments: undefined })

		expect(result.current.attachmentsReady).toBe(false)
	})

	it("uses an explicit empty flat list instead of stale tree attachments", () => {
		const { result } = renderHook(() =>
			useAttachments({
				attachments: [attachment("stale")],
				attachmentList: [],
				projectId: "project-a",
			}),
		)

		expect(result.current.attachmentsReady).toBe(false)
		expect(result.current.flatAttachments).toEqual([])
		expect(result.current.attachmentIndex.byFileId.size).toBe(0)
	})

	it("remains ready when the same project's snapshot becomes empty", () => {
		const { result, rerender } = renderHook(
			(options: { attachments: FileItem[] }) =>
				useAttachments({ ...options, projectId: "project-a" }),
			{
				initialProps: { attachments: [attachment("a")] },
			},
		)

		expect(result.current.attachmentsReady).toBe(true)
		rerender({ attachments: [] })
		expect(result.current.attachmentsReady).toBe(true)
	})
})
