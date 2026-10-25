import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicLocateFileContext } from "@/pages/superMagic/events/files"
import { buildAttachmentIndex } from "../../utils/attachmentIndex"
import type { AttachmentItem } from "../types"
import { useLocateFile } from "../useLocateFile"

// The organization is only read for the PPT branch, which these cases do not reach.
vi.mock("@/models/user/hooks/useOrganization", () => ({
	useOrganization: () => ({ organizationCode: "mock-org-code" }),
}))

// Keep the located-file cases off the project state repository cache.
vi.mock("@/models/config/repositories/SuperProjectStateRepository", () => ({
	ProjectStateRepository: class {
		getProjectState = vi.fn()
	},
}))

/** A single file at the tree root, so locating it has no folder to expand first. */
function createTreeIndex(fileId: string) {
	const item: AttachmentItem = {
		file_id: fileId,
		name: "Mock File",
		is_directory: false,
		relative_file_path: "/Mock File",
	}
	return buildAttachmentIndex([item])
}

/**
 * Mirror the markup TopicFilesCore renders: the scroll container carries the file-list test id
 * and every row carries its file id.
 */
function mountFileListArea(fileId: string) {
	const container = document.createElement("div")
	container.setAttribute("data-testid", "topic-files-list-area")
	const row = document.createElement("div")
	row.setAttribute("data-file-id", fileId)
	container.appendChild(row)
	document.body.appendChild(container)
	return { container, row }
}

/** Give the list a real viewport so the located row counts as visible. */
function stubVisibleLayout(container: HTMLElement, row: HTMLElement) {
	container.getBoundingClientRect = () => new DOMRect(0, 0, 240, 120)
	row.getBoundingClientRect = () => new DOMRect(0, 44, 240, 28)
}

/** Emit the upload locate event the same way the upload toast does. */
function publishLocate(
	fileId: string,
	onResult: NonNullable<SuperMagicLocateFileContext["onResult"]>,
) {
	return act(() => {
		pubsub.publish(PubSubEvents.Locate_File_In_Tree, fileId, {
			projectId: "project-1",
			exact: true,
			onResult,
		})
	})
}

function renderLocateFileHook(fileId: string) {
	return renderHook(() =>
		useLocateFile({
			treeIndex: createTreeIndex(fileId),
			expandedKeys: [],
			setExpandedKeys: vi.fn(),
			selectedProjectId: "project-1",
		}),
	)
}

describe("useLocateFile scoped upload locate", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})

	it("reports located for a row that is already inside the file list", async () => {
		const fileId = "file-visible"
		const { container, row } = mountFileListArea(fileId)
		stubVisibleLayout(container, row)
		const onResult = vi.fn()

		const { result } = renderLocateFileHook(fileId)
		publishLocate(fileId, onResult)

		await waitFor(() => expect(onResult).toHaveBeenCalledWith("located"))
		expect(onResult).toHaveBeenCalledTimes(1)
		// The blinking highlight stays on the located row.
		expect(result.current.locatingFileId).toBe(fileId)
	})

	it("reports located once when the row never becomes visible", async () => {
		const fileId = "file-unscrollable"
		// jsdom reports zero-sized rects, so the row stays unmeasurable and reveal keeps failing.
		mountFileListArea(fileId)
		const onResult = vi.fn()

		const { result } = renderLocateFileHook(fileId)
		publishLocate(fileId, onResult)

		// Without the bounded retry the callback is never called, and the caller waits for its
		// 15s timeout before reporting an existing file as unavailable.
		await waitFor(() => expect(onResult).toHaveBeenCalledWith("located"))
		expect(onResult).toHaveBeenCalledTimes(1)
		expect(result.current.locatingFileId).toBe(fileId)
	})
})
