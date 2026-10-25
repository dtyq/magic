import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import { useDragUpload } from "../useDragUpload"
import type { useDuplicateFileHandler } from "../useDuplicateFileHandler"
import { useUploadWithModal } from "../useUploadWithModal"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		warning: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/stores/folderUpload", () => ({
	multiFolderUploadStore: {
		createUploadTask: vi.fn().mockResolvedValue("task-id"),
	},
}))

vi.mock("../useDuplicateFileHandler", () => ({
	useDuplicateFileHandler: () => ({
		handleFilesWithDuplicateCheck: vi.fn(),
	}),
}))

vi.mock("../../utils/uploadRefreshController", () => ({
	createUploadRefreshCoordinator: () => ({
		handleFileTaskComplete: vi.fn(),
		handleFileTaskError: vi.fn(),
		flushDeferredRefresh: vi.fn(),
		handleBatchSaveComplete: vi.fn(),
		markTaskCreated: vi.fn(),
		markTaskCreateFailed: vi.fn(),
	}),
}))

const EXISTING_FOLDER_ID = "existing-folder-id"

function createDuplicateHandler() {
	return {
		handleFilesWithDuplicateCheck: vi.fn(
			async (
				files: File[],
				path: string,
				processor: (
					files: File[],
					path: string,
					parentIdOverride?: string,
				) => Promise<void>,
			) => processor(files, path, EXISTING_FOLDER_ID),
		),
	} as unknown as ReturnType<typeof useDuplicateFileHandler>
}

describe("folder merge upload parent override", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("keeps the existing folder id when submitting through the upload modal", async () => {
		const duplicateFileHandler = createDuplicateHandler()
		const files = [new File(["content"], "new.md")]
		const { result } = renderHook(() =>
			useUploadWithModal({
				projectId: "project-id",
				duplicateFileHandler,
			}),
		)

		act(() => {
			result.current.handleFilesSelected(files, true)
		})

		await act(async () => {
			await result.current.handleUploadModalSubmit({ path: [], files })
		})

		expect(multiFolderUploadStore.createUploadTask).toHaveBeenCalledWith(
			files,
			EXISTING_FOLDER_ID,
			expect.any(Object),
		)
	})

	it("keeps the existing folder id when merging a dragged folder", async () => {
		const duplicateFileHandler = createDuplicateHandler()
		const files = [new File(["content"], "new.md")]
		const { result } = renderHook(() =>
			useDragUpload({
				projectId: "project-id",
				duplicateFileHandler,
			}),
		)

		await act(async () => {
			await result.current.handleUploadFiles(files, undefined, true)
		})

		expect(multiFolderUploadStore.createUploadTask).toHaveBeenCalledWith(
			files,
			EXISTING_FOLDER_ID,
			expect.any(Object),
		)
	})
})
