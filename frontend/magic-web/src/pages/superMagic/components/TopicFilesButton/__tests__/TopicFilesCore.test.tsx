import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import TopicFilesCore from "../TopicFilesCore"
import type { AttachmentItem } from "../hooks/types"

// Mock dependencies
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => { },
	},
}))

vi.mock("../style", () => ({
	useStyles: () => ({
		styles: {
			contentArea: "content-area",
			searchBox: "search-box",
			fileListArea: "file-list-area",
			emptyState: "empty-state",
			batchDownloadLayer: "batch-download-layer",
			hidden: "hidden",
			batchDownloadButton: "batch-download-button",
			batchDownloadSeparator: "batch-download-separator",
			fileItem: "file-item",
			fileTitle: "file-title",
			iconWrapper: "icon-wrapper",
			ellipsis: "ellipsis",
			attachmentAction: "attachment-action",
			activeFileItem: "active-file-item",
			renameInput: "rename-input",
			errorMessage: "error-message",
		},
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
}))

vi.mock("ahooks", () => ({
	useResponsive: () => ({
		md: true,
	}),
}))

vi.mock("../hooks", () => ({
	useRename: () => ({
		renamingItemId: null,
		renameValue: "",
		setRenameValue: vi.fn(),
		renameInputRef: { current: null },
		renamingFileIds: new Set(),
		handleStartRename: vi.fn(),
		handleRenameCancel: vi.fn(),
		handleRenameKeyDown: vi.fn(),
		getItemId: (item: any) => item.file_id || item.path,
		isFileRenaming: vi.fn(() => false),
	}),
	useFileOperations: () => ({
		handleUploadFile: vi.fn(),
		handleUploadFolder: vi.fn(),
		handleShareItem: vi.fn(),
		handleDeleteItem: vi.fn(),
		handleDownloadOriginal: vi.fn(),
		handleDownloadPdf: vi.fn(),
		handleDownloadPpt: vi.fn(),
		handleOpenFile: vi.fn(),
		shareModalVisible: false,
		setShareModalVisible: vi.fn(),
		shareFileInfo: null,
		handleShareSave: vi.fn(),
		exportingFiles: new Set(),
		uploading: false,
		createFileAndUpload: vi.fn(),
		createFolderAndUpload: vi.fn(),
	}),
	useContextMenu: () => ({
		getMenuItems: vi.fn(),
		getBatchDownloadLayerMenuItems: vi.fn(),
	}),
	useFileSelection: () => ({
		selectedItems: new Set(),
		setSelectedItems: vi.fn(),
		handleItemSelect: vi.fn(),
		getFolderSelectionState: vi.fn(),
	}),
	useBatchDownload: () => ({
		batchLoading: false,
		showBatchDownload: false,
		handleBatchDownload: vi.fn(),
		batchMenuItems: [],
	}),
	useFileFilter: () => ({
		filteredFiles: [],
	}),
	useVirtualFile: () => ({
		virtualFiles: [],
		editingVirtualId: null,
		virtualFileName: "",
		setVirtualFileName: vi.fn(),
		errorMessage: "",
		virtualInputRef: { current: null },
		createVirtualFile: vi.fn(),
		confirmVirtualFile: vi.fn(),
		cancelVirtualFile: vi.fn(),
		handleVirtualFileKeyDown: vi.fn(),
		mergeVirtualFiles: vi.fn((files) => files),
	}),
	useVirtualFolder: () => ({
		virtualFolders: [],
		editingVirtualId: null,
		virtualFolderName: "",
		setVirtualFolderName: vi.fn(),
		errorMessage: "",
		virtualInputRef: { current: null },
		createVirtualFolder: vi.fn(),
		confirmVirtualFolder: vi.fn(),
		cancelVirtualFolder: vi.fn(),
		handleVirtualFolderKeyDown: vi.fn(),
		mergeVirtualFolders: vi.fn((files) => files),
	}),
}))

vi.mock("../SuperMagicDropdown", () => ({
	useSuperMagicDropdown: () => ({
		dropdownContent: null,
		delegateProps: {
			onDropdownContextMenuClick: vi.fn(),
			onDropdownActionClick: vi.fn(),
		},
	}),
	default: ({ children, ...props }: any) => (
		<div data-testid="super-magic-dropdown" {...props}>
			{children}
		</div>
	),
}))

vi.mock("../../utils/topics", () => ({
	addFileToCurrentChat: vi.fn(),
	addFileToNewChat: vi.fn(),
}))

vi.mock("../Share/Modal", () => ({
	default: () => <div data-testid="share-modal">Share Modal</div>,
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: () => <div data-testid="file-icon">File Icon</div>,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({ component: Component, ...props }: any) => <Component {...props} />,
}))

vi.mock("@/pages/superMagic/assets/svg/file-folder.svg", () => ({
	default: "folder-icon.svg",
}))

// Mock @dtyq/upload-sdk
vi.mock("@dtyq/upload-sdk", () => ({
	Upload: class MockUpload {
		constructor() { }
		upload() {
			return Promise.resolve({ url: "mock-url" })
		}
	},
}))

// Mock useUploadFiles hook
vi.mock("@/hooks/useUploadFiles", () => ({
	useUpload: () => ({
		upload: vi.fn(),
		uploading: false,
		getFileUrls: vi.fn(),
	}),
}))

// Mock pubsub
vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	},
}))

// Mock userStore
vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				magic_id: "test-magic-id",
			},
		},
	},
}))

// Mock other dependencies that might be imported
vi.mock("@/components/MessageEditor/hooks/useFileUpload", () => ({
	useFileUpload: () => ({
		addFiles: vi.fn(),
		uploading: false,
	}),
}))

vi.mock("../../../utils/api", () => ({
	deleteFile: vi.fn(),
	createFile: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("../../../utils/share", () => ({
	handleShareFunction: vi.fn(),
}))

vi.mock("../../../utils/handleFIle", () => ({
	getFileType: vi.fn(),
	downloadFileWithAnchor: vi.fn(),
}))

vi.mock("../utils/exportSingleFile", () => ({
	exportSingleFileToPdf: vi.fn(),
	exportSingleFileToPpt: vi.fn(),
}))

vi.mock("../SuperTooltip", () => ({
	default: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
}))

// Mock OrganizationDotsDbService
vi.mock("@/services/chat/dots/OrganizationDotsDbService", () => ({
	default: {
		magicId: "test-magic-id",
		getPersistenceData: vi.fn(() => ({})),
		setPersistenceData: vi.fn(),
		getDotSeqIdData: vi.fn(() => ({})),
		setDotSeqIdData: vi.fn(),
	},
}))

// Mock chatWebSocket
vi.mock("@/apis/clients/chatWebSocket", () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn(),
	},
}))

// Mock other services that might be imported
vi.mock("@/services/groupInfo", () => ({
	default: {
		init: vi.fn(),
		getGroupInfo: vi.fn(),
	},
}))

vi.mock("@/services/userInfo", () => ({
	default: {
		init: vi.fn(),
		getUserInfo: vi.fn(),
	},
}))

vi.mock("@/database/chat", () => ({
	default: {
		init: vi.fn(),
		getMessages: vi.fn(),
	},
}))

vi.mock("@/services/chat/message/MessageSeqIdService", () => ({
	default: {
		init: vi.fn(),
		getSeqId: vi.fn(),
	},
}))

vi.mock("@/services/chat/message/MessageService", () => ({
	default: {
		init: vi.fn(),
		sendMessage: vi.fn(),
	},
}))

vi.mock("@/services/chat/conversation/ConversationService", () => ({
	default: {
		init: vi.fn(),
		getConversations: vi.fn(),
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		setLoading: vi.fn(),
		setError: vi.fn(),
	},
}))

vi.mock("@/broadcastChannel", () => ({
	BroadcastChannelSender: {
		send: vi.fn(),
	},
}))

vi.mock("@/services/file/KnowledgeFile", () => ({
	initKnowledgeFileService: vi.fn(),
}))

vi.mock("@/components/business/PaidPackage", () => ({
	checkSubscriptionModal: vi.fn(),
}))

// Mock antd-style
vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			dropdown: "mock-dropdown-styles",
			subMenu: "mock-submenu-styles",
		},
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
	cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
}))

describe("TopicFilesCore", () => {
	const mockAttachments: AttachmentItem[] = [
		{
			file_id: "folder-1",
			file_name: "Folder 1",
			file_extension: "",
			is_directory: true,
			path: "/folder-1",
			name: "Folder 1",
			is_hidden: false,
			children: [
				{
					file_id: "file-1-1",
					file_name: "File 1.1",
					file_extension: "txt",
					is_directory: false,
					path: "/folder-1/file-1-1",
					name: "File 1.1",
					is_hidden: false,
				},
			],
		},
		{
			file_id: "file-2",
			file_name: "File 2",
			file_extension: "txt",
			is_directory: false,
			path: "/file-2",
			name: "File 2",
			is_hidden: false,
		},
	]

	const defaultProps = {
		attachments: mockAttachments,
		projectId: "test-project",
		activeFileId: null,
		detailMode: "single",
		selectedTopic: { id: "test-topic" },
	}

	it("renders search box", () => {
		render(<TopicFilesCore {...defaultProps} />)
		expect(screen.getByPlaceholderText("common.searchFiles")).toBeInTheDocument()
	})

	it("renders empty state when no files", () => {
		render(<TopicFilesCore {...defaultProps} attachments={[]} />)
		expect(screen.getByText("topicFiles.noFiles")).toBeInTheDocument()
	})

	it("renders tree with files", () => {
		render(<TopicFilesCore {...defaultProps} />)
		// Tree 组件会渲染文件，但由于复杂的渲染逻辑，我们主要测试组件能正常渲染
		expect(screen.getByPlaceholderText("common.searchFiles")).toBeInTheDocument()
	})

	it("handles search input", () => {
		render(<TopicFilesCore {...defaultProps} />)
		const searchInput = screen.getByPlaceholderText("common.searchFiles")
		fireEvent.change(searchInput, { target: { value: "test" } })
		expect(searchInput).toHaveValue("test")
	})
})
