import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TopicFilesPanel from "../TopicFilesPanel"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", () => ({
	useUpdateEffect: vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		Update_Attachments_Loading: "update_attachments_loading",
		Cancel_File_Selection: "cancel_file_selection",
		Deselect_All_Files: "deselect_all_files",
		Select_All_Files: "select_all_files",
		Update_Attachments: "update_attachments",
	},
}))

vi.mock("../../hooks/useShareRoute", () => ({
	default: () => ({
		isShareRoute: false,
	}),
}))

vi.mock("../useDownloadAll", () => ({
	useDownloadAll: () => ({
		handleDownloadAll: vi.fn(),
		allLoading: false,
	}),
}))

vi.mock("../hooks/useUploadWithModal", () => ({
	useUploadWithModal: () => ({
		uploadModalVisible: false,
		selectedUploadFiles: [],
		isUploadingFolder: false,
		handleCustomUploadFile: vi.fn(),
		handleCustomUploadFolder: vi.fn(),
		handleUploadModalSubmit: vi.fn(),
		handleUploadModalClose: vi.fn(),
	}),
}))

vi.mock("../hooks/useDuplicateFileHandler", () => ({
	useDuplicateFileHandler: () => ({
		modalVisible: false,
		currentFileName: "",
		totalDuplicates: 0,
		handleCancel: vi.fn(),
		handleReplace: vi.fn(),
		handleKeepBoth: vi.fn(),
	}),
}))

vi.mock("../hooks/useFileReplace", () => ({
	useFileReplace: () => ({
		handleReplaceFile: vi.fn(),
	}),
}))

vi.mock("../hooks/useProjectDetailFilesController", () => ({
	useProjectDetailFilesController: () => ({
		selectionResetKey: 0,
		shareModalVisible: true,
		shareFileIds: ["file-1", "file-2"],
		closeShareModal: vi.fn(),
		moveSelectorProps: {
			open: false,
			onClose: vi.fn(),
		},
		sharedDuplicateHandler: {
			modalVisible: false,
			currentFileName: "",
			totalDuplicates: 0,
			handleCancel: vi.fn(),
			handleReplace: vi.fn(),
			handleKeepBoth: vi.fn(),
		},
		uploadModalVisible: false,
		selectedUploadFiles: [],
		isUploadingFolder: false,
		handleCustomUploadFile: vi.fn(),
		handleCustomUploadFolder: vi.fn(),
		handleUploadModalSubmit: vi.fn(),
		handleUploadModalClose: vi.fn(),
		deleteConfirmNode: null,
		createFile: vi.fn(),
		createFolder: vi.fn(),
		batchDownload: vi.fn(),
		batchExport: vi.fn(),
		batchShare: vi.fn(),
		batchMove: vi.fn(),
		batchDelete: vi.fn(),
	}),
}))

vi.mock("../components/MobileProjectDetailFilesView", () => ({
	default: () => <div data-testid="mobile-project-detail-files-view" />,
}))

vi.mock("../components", () => ({
	DuplicateFileModal: () => null,
	SelectModeHeader: () => <div />,
	NormalModeHeader: () => <div />,
	SearchModeHeader: () => <div />,
}))

vi.mock("../MessageEditor/components/UploadModal", () => ({
	UploadModal: () => null,
}))

vi.mock("../SelectPathModal", () => ({
	SelectDirectoryModal: () => null,
}))

vi.mock("../TopicFilesCore", () => ({
	default: () => <div data-testid="topic-files-core" />,
}))

vi.mock("@/pages/superMagicMobile/components/ProjectShareSheet", () => ({
	default: (props: { defaultSelectedFileIds?: string[]; mode?: string }) => (
		<div
			data-testid="project-share-sheet"
			data-mode={props.mode}
			data-file-ids={props.defaultSelectedFileIds?.join(",")}
		/>
	),
}))

describe("TopicFilesPanel", () => {
	it("在项目详情移动端多选分享时使用新的文件分享 Sheet", () => {
		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				selectedProject={{ project_name: "测试项目" }}
				mobileViewVariant="project-detail"
			/>,
		)

		const shareSheet = screen.getByTestId("project-share-sheet")
		expect(shareSheet).toHaveAttribute("data-mode", "file")
		expect(shareSheet).toHaveAttribute("data-file-ids", "file-1,file-2")
	})
})
