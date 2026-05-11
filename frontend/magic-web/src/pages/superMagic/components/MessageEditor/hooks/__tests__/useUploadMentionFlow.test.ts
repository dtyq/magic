import type { ReactNode } from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { FileUploadStore } from "../../stores/FileUploadStore"
import useUploadMentionFlow from "../useUploadMentionFlow"

const { confirmMock, deleteProjectFileMock, removeUploadMentionNodesMock } = vi.hoisted(() => ({
	confirmMock: vi.fn(),
	deleteProjectFileMock: vi.fn(),
	removeUploadMentionNodesMock: vi.fn(),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: confirmMock.mockImplementation(() => ({
			destroy: vi.fn(),
		})),
	},
}))

vi.mock("../../services/uploadMentionService", () => ({
	collectMentionItemsFromContent: vi.fn(() => []),
	collectMentionItemsFromEditor: vi.fn(() => []),
	deleteProjectFile: deleteProjectFileMock,
	insertUploadMentionNodes: vi.fn(),
	removeUploadMentionNodes: removeUploadMentionNodesMock,
	replaceUploadMentionNode: vi.fn(),
	updateUploadMentionProgress: vi.fn(),
}))

function createFileUploadStore() {
	return {
		updateOptions: vi.fn(),
		files: [],
		getUploadMentionItems: vi.fn(() => []),
		addFiles: vi.fn(),
		removeFile: vi.fn(),
		removeUploadedFile: vi.fn(),
		clearFiles: vi.fn(),
		clearFilesLocalOnly: vi.fn(),
		isAllFilesUploaded: true,
		validateFileSize: vi.fn(),
		validateFileCount: vi.fn(),
		isCurrentSessionUploadFile: vi.fn(),
		isCurrentSessionProjectFile: vi.fn(),
	}
}

function createProjectFileMention() {
	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: "project-file-1",
			file_name: "demo.txt",
			file_extension: "txt",
		},
	}
}

function renderRemoveOnlyButton(
	footer: (
		originNode: ReactNode,
		buttons: { CancelBtn: () => ReactNode; OkBtn: () => ReactNode },
	) => ReactNode,
) {
	const footerNode = footer(null, {
		CancelBtn: () => null,
		OkBtn: () => null,
	}) as {
		props?: {
			children?: ReactNode[]
		}
	}

	return footerNode.props?.children?.[1] as {
		props?: {
			onClick?: () => void
		}
	}
}

describe("useUploadMentionFlow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should do nothing for non-session project files", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(false)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleRemoveFile(createProjectFileMention() as TiptapMentionAttributes)
		})

		expect(confirmMock).not.toHaveBeenCalled()
		expect(fileUploadStore.removeUploadedFile).not.toHaveBeenCalled()
		expect(deleteProjectFileMock).not.toHaveBeenCalled()
	})

	it("should sync upload mention items to mention panel store", () => {
		const syncedItems = [
			{
				id: "uploaded-file-1",
				type: MentionItemType.UPLOAD_FILE,
				name: "demo.txt",
				data: {
					file_id: "uploaded-file-1",
					file_name: "demo.txt",
					file_path: "uploads/demo.txt",
					file_extension: "txt",
				},
			},
		]
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.getUploadMentionItems.mockReturnValue(syncedItems)
		const mentionPanelStore = {
			setUploadFiles: vi.fn(),
		}

		renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				mentionPanelStore,
				getEditor: () => null,
				isProjectContext: false,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		expect(fileUploadStore.getUploadMentionItems).toHaveBeenCalledTimes(1)
		expect(mentionPanelStore.setUploadFiles).toHaveBeenCalledWith(syncedItems)
	})

	it("should confirm before deleting current session project files", async () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string, options?: Record<string, unknown>) =>
					options?.fileName ? `${key}:${options.fileName}` : key,
			}),
		)

		act(() => {
			result.current.handleRemoveFile(createProjectFileMention() as TiptapMentionAttributes)
		})

		expect(confirmMock).toHaveBeenCalledTimes(1)

		const confirmOptions = confirmMock.mock.calls[0][0]

		await act(async () => {
			await confirmOptions.onOk?.()
		})

		expect(fileUploadStore.removeUploadedFile).toHaveBeenCalledWith("project-file-1")
		expect(deleteProjectFileMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fileId: "project-file-1",
			}),
		)
	})

	it("should delete immediately when upload delete confirmation is disabled", async () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				confirmDelete: false,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		await act(async () => {
			result.current.handleRemoveFile(createProjectFileMention() as TiptapMentionAttributes)
		})

		expect(confirmMock).not.toHaveBeenCalled()
		expect(fileUploadStore.removeUploadedFile).toHaveBeenCalledWith("project-file-1")
		expect(deleteProjectFileMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fileId: "project-file-1",
			}),
		)
	})

	it("should restore removed current-session mentions before confirmation", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				false,
				{ deletionInput: "forward-delete" },
			),
		).toBe(true)
		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				true,
				{ deletionInput: "forward-delete" },
			),
		).toBe(false)
		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				false,
				{ deletionInput: "other" },
			),
		).toBe(false)
		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				false,
				{ deletionInput: "backspace" },
			),
		).toBe(true)
	})

	it("should not restore removed mentions when delete confirmation is disabled", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				confirmDelete: false,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				false,
				{ deletionInput: "forward-delete" },
			),
		).toBe(false)
	})

	it("should remove only when in queue draft mode", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				isQueueDraftMode: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleRemoveFile(createProjectFileMention() as TiptapMentionAttributes)
		})

		expect(confirmMock).not.toHaveBeenCalled()
		expect(fileUploadStore.removeUploadedFile).toHaveBeenCalledWith("project-file-1")
		expect(deleteProjectFileMock).not.toHaveBeenCalled()
		expect(
			result.current.shouldRestoreRemovedMention(
				createProjectFileMention() as TiptapMentionAttributes,
				false,
				{ deletionInput: "forward-delete" },
			),
		).toBe(false)
	})

	it("should remove only without modal when editor deletion is non-keyboard (other)", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleMentionRemoveItems([
				{
					item: createProjectFileMention() as TiptapMentionAttributes,
					stillExists: false,
					deletionInput: "other",
				},
			])
		})

		expect(confirmMock).not.toHaveBeenCalled()
		expect(fileUploadStore.removeUploadedFile).toHaveBeenCalledWith("project-file-1")
		expect(deleteProjectFileMock).not.toHaveBeenCalled()
	})

	it("should confirm when editor reports forward-delete removal", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleMentionRemoveItems([
				{
					item: createProjectFileMention() as TiptapMentionAttributes,
					stillExists: false,
					deletionInput: "forward-delete",
				},
			])
		})

		expect(confirmMock).toHaveBeenCalledTimes(1)
	})

	it("should confirm when editor reports backspace removal", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleMentionRemoveItems([
				{
					item: createProjectFileMention() as TiptapMentionAttributes,
					stillExists: false,
					deletionInput: "backspace",
				},
			])
		})

		expect(confirmMock).toHaveBeenCalledTimes(1)
	})

	it("should remove only the mention when choosing remove only", () => {
		const fileUploadStore = createFileUploadStore()
		fileUploadStore.isCurrentSessionProjectFile.mockReturnValue(true)

		const { result } = renderHook(() =>
			useUploadMentionFlow({
				fileUploadStore: fileUploadStore as unknown as FileUploadStore,
				getEditor: () => null,
				isProjectContext: true,
				runWithoutMentionRemoveSync: (callback) => callback(),
				selectedProjectId: "project-1",
				selectedTopicId: "topic-1",
				t: (key: string) => key,
			}),
		)

		act(() => {
			result.current.handleRemoveFile(createProjectFileMention() as TiptapMentionAttributes)
		})

		const confirmOptions = confirmMock.mock.calls[0][0]
		const removeOnlyButton = renderRemoveOnlyButton(confirmOptions.footer)

		act(() => {
			removeOnlyButton.props?.onClick?.()
		})

		expect(fileUploadStore.removeUploadedFile).toHaveBeenCalledWith("project-file-1")
		expect(deleteProjectFileMock).not.toHaveBeenCalled()
	})
})
