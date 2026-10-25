import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

const mocks = vi.hoisted(() => ({
	createDesignProjectFiles: vi.fn(),
	requestProjectAttachmentsFullRefresh: vi.fn(),
	renameFile: vi.fn(),
}))

vi.mock("i18next", () => ({
	default: {
		loadNamespaces: vi.fn(() => Promise.resolve()),
		t: vi.fn(() => "Untitled canvas"),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { renameFile: mocks.renameFile },
}))

vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	requestProjectAttachmentsFullRefresh: mocks.requestProjectAttachmentsFullRefresh,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/Design/utils/designProjectCreation", () => ({
	createDesignProjectFiles: mocks.createDesignProjectFiles,
	DesignProjectCreationError: class extends Error {},
}))

import { createAiCanvasDocument } from "../../utils/aiCanvas"
import { useAiCanvasDocument } from "../useAiCanvasDocument"

function plainFolder(id: string): AttachmentItem {
	// What the attachments API returns before the backend writes display_config.
	return { file_id: id, file_name: "Untitled canvas", is_directory: true, display_config: null }
}

function renderDocument(projectId: string, attachments: AttachmentItem[]) {
	const projectFilesStore = { registerCreatedDesignProject: vi.fn() }
	renderHook(() =>
		useAiCanvasDocument({
			enabled: true,
			projectId,
			projectName: "Untitled canvas",
			isReadOnly: false,
			attachments,
			attachmentLoadState: { projectId, status: "ready" },
			projectFilesStore,
			openCanvas: vi.fn(),
		}),
	)
	return projectFilesStore
}

describe("useAiCanvasDocument", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.createDesignProjectFiles.mockResolvedValue({
			folder: { file_id: "folder-1" },
			magicProjectFile: { file_id: "config-1" },
			outcome: "confirmed",
		})
	})

	it("registers a just-created canvas the backend has not marked yet instead of creating it again", async () => {
		await createAiCanvasDocument("project-recent")
		mocks.createDesignProjectFiles.mockClear()

		const store = renderDocument("project-recent", [plainFolder("folder-1")])

		await waitFor(() =>
			expect(store.registerCreatedDesignProject).toHaveBeenCalledWith({
				projectId: "project-recent",
				folderId: "folder-1",
				configFileId: "config-1",
				folderName: "Untitled canvas",
				status: "confirmed",
			}),
		)
		expect(mocks.createDesignProjectFiles).not.toHaveBeenCalled()
	})

	it("creates the canvas again when the recorded folder is no longer in the project", async () => {
		await createAiCanvasDocument("project-deleted")
		mocks.createDesignProjectFiles.mockClear()

		renderDocument("project-deleted", [])

		await waitFor(() => expect(mocks.createDesignProjectFiles).toHaveBeenCalledTimes(1))
	})

	it("creates the canvas for a project without one", async () => {
		renderDocument("project-empty", [])

		await waitFor(() => expect(mocks.createDesignProjectFiles).toHaveBeenCalledTimes(1))
	})
})
