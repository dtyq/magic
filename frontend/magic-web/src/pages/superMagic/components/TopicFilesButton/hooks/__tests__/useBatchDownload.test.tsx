import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useBatchDownload } from "../useBatchDownload"
import type { AttachmentItem } from "../types"
import type { PropsWithChildren } from "react"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { SuperMagicApi } from "@/apis"
import { runClientBatchDocumentExport } from "../../modules/client-batch-export"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@tabler/icons-react", () => {
	// Provide stable icon placeholders so the hook can build menu items in tests.
	function IconStub() {
		return null
	}

	return {
		IconDownload: IconStub,
		IconFileTypePdf: IconStub,
		IconFileTypePpt: IconStub,
		IconTrash: IconStub,
		IconFolderSymlink: IconStub,
		IconShare3: IconStub,
		IconCopy: IconStub,
	}
})

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
		loading: vi.fn(),
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Update_Attachments: "Update_Attachments",
		Cancel_File_Selection: "Cancel_File_Selection",
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../../../hooks/useShareRoute", () => ({
	default: () => ({
		isShareRoute: false,
		isFileShare: false,
	}),
}))

vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({
		isShareRoute: false,
		isFileShare: false,
	}),
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: () => null,
}))

vi.mock("../components/MagicSystemFolderIcon", () => ({
	MagicSystemFolderIcon: () => null,
}))

vi.mock("./useMobileDeleteConfirmSheet", () => ({
	useMobileDeleteConfirmSheet: () => ({
		deleteConfirmNode: null,
		openDeleteConfirm: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: () => false,
}))

vi.mock("../utils/menu-items", () => ({
	normalizeMenuItems: (items: unknown) => items,
}))

vi.mock("../../../utils/handleFIle", () => ({
	downloadFileWithAnchor: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		deleteFiles: vi.fn(),
		createBatchDownload: vi.fn(),
		checkBatchDownloadStatus: vi.fn(),
	},
}))

vi.mock("../../modules/client-batch-export", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../modules/client-batch-export")>()),
	runClientBatchDocumentExport: vi.fn(),
}))

vi.mock("../../MessageList/components/MessageAttachment/utils", () => ({
	getAppEntryFile: vi.fn(),
}))

// Selection traversal is real; chat and drag actions are unrelated to batch file operations.
vi.mock("@/pages/superMagic/utils/topics", () => ({}))
vi.mock("@/pages/superMagic/components/MessageEditor/utils/drag", () => ({}))

function makeFolderWithFile(): AttachmentItem[] {
	// Build a non-empty folder because the PC regression happens on folder rows with children.
	return [
		{
			file_id: "folder-1",
			name: "Folder 1",
			file_name: "Folder 1",
			is_directory: true,
			children: [
				{
					file_id: "file-1",
					name: "child.txt",
					file_name: "child.txt",
					is_directory: false,
				},
			],
		},
	]
}

describe("useBatchDownload", () => {
	it.each([true, false])(
		"honors download permission %s for personal files without a project",
		async (download) => {
			const onDownloadSelected = vi.fn().mockResolvedValue(undefined)
			const wrapper = ({ children }: PropsWithChildren) => (
				<FileAccessProvider permissions={{ download }}>{children}</FileAccessProvider>
			)
			const { result } = renderHook(
				() =>
					useBatchDownload({
						fileScope: "user",
						onDownloadSelected,
						getItemId: (item) => item.file_id || "",
						selectedItems: new Set(["file-1"]),
						setSelectedItems: vi.fn(),
						filteredFiles: makeFolderWithFile(),
						removeFile: vi.fn(),
						allowEdit: true,
						isInProject: false,
						allowCopyTo: true,
						allowCopy: false,
					}),
				{ wrapper },
			)
			await act(async () => {
				await result.current.handleBatchDownload()
			})
			expect(onDownloadSelected).toHaveBeenCalledTimes(download ? 1 : 0)
			if (download) {
				expect(onDownloadSelected).toHaveBeenCalledWith([
					expect.objectContaining({ file_id: "file-1" }),
				])
			}
			const menuKeys = result.current.batchMenuItems?.map((item) => item?.key)
			expect(menuKeys).toContain("move")
			expect(menuKeys).not.toContain("copy")
			expect(menuKeys).not.toContain("export-pdf")
			expect(menuKeys).not.toContain("export-ppt")
		},
	)
	it("blocks batch download, export and sharing even when callbacks are invoked directly", async () => {
		const onBatchShareClick = vi.fn()
		const wrapper = ({ children }: PropsWithChildren) => (
			<FileAccessProvider permissions={{ download: false, export: false, share: false }}>
				{children}
			</FileAccessProvider>
		)
		const { result } = renderHook(
			() =>
				useBatchDownload({
					projectId: "project-1",
					getItemId: (item) => item.file_id || "",
					selectedItems: new Set(["file-1"]),
					setSelectedItems: vi.fn(),
					filteredFiles: makeFolderWithFile(),
					removeFile: vi.fn(),
					onBatchShareClick,
					allowEdit: true,
					isInProject: true,
				}),
			{ wrapper },
		)
		await act(async () => {
			await result.current.handleBatchDownload()
			await result.current.handleExportDocument("pdf")
			await result.current.handleExportDocument("pptx")
			result.current.handleBatchShare()
		})
		expect(SuperMagicApi.createBatchDownload).not.toHaveBeenCalled()
		expect(runClientBatchDocumentExport).not.toHaveBeenCalled()
		expect(onBatchShareClick).not.toHaveBeenCalled()
		expect(
			result.current.batchMenuItems?.some(
				(item) => item?.key === "download" || item?.key === "share",
			),
		).toBe(false)
	})
	it("opens the cross-project selector before the project list is loaded", () => {
		const openMoveModal = vi.fn()
		const openBatchMove = vi.fn()

		const { result } = renderHook(() =>
			useBatchDownload({
				projectId: "project-1",
				getItemId: (item) => item.file_id || "",
				selectedItems: new Set(["file-1"]),
				setSelectedItems: vi.fn(),
				filteredFiles: [],
				removeFile: vi.fn(),
				selectedProject: { workspace_id: "workspace-1" },
				allowEdit: true,
				isInProject: true,
				crossProjectOperation: {
					openMoveModal,
					openCopyModal: vi.fn(),
				},
				moveFileHook: { openBatchMove },
			}),
		)
		const moveItem = result.current.batchMenuItems?.find(
			(item) => item && "key" in item && item.key === "move",
		) as { onClick?: () => void } | undefined

		act(() => {
			moveItem?.onClick?.()
		})

		expect(openMoveModal).toHaveBeenCalledWith(["file-1"], [])
		expect(openBatchMove).not.toHaveBeenCalled()
	})

	it("PC 批量分享选中文件夹时应保留文件夹自身 ID", () => {
		const attachments = makeFolderWithFile()
		const handleBatchShareClick = vi.fn()
		const setSelectedItems = vi.fn()
		const onSelectModeChange = vi.fn()

		const { result } = renderHook(() =>
			useBatchDownload({
				projectId: "project-1",
				getItemId: (item) => item.file_id || "",
				selectedItems: new Set(["folder-1"]),
				setSelectedItems,
				filteredFiles: attachments,
				onSelectModeChange,
				removeFile: vi.fn(),
				onBatchShareClick: handleBatchShareClick,
				allowEdit: true,
				isInProject: true,
			}),
		)

		act(() => {
			result.current.handleBatchShare()
		})

		expect(handleBatchShareClick).toHaveBeenCalledWith(["folder-1"])
	})
})
