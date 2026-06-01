import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useBatchDownload } from "../useBatchDownload"
import type { AttachmentItem } from "../types"

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

vi.mock("@/pages/superMagic/providers/file-action-visibility-provider", () => ({
	useFileActionVisibility: () => ({
		hideCopyTo: false,
		hideMoveTo: false,
		hideShareFile: false,
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
		exportPdfOrPpt: vi.fn(),
		checkExportPdfOrPptStatus: vi.fn(),
	},
}))

vi.mock("../../MessageList/components/MessageAttachment/utils", () => ({
	getAppEntryFile: vi.fn(),
}))

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
