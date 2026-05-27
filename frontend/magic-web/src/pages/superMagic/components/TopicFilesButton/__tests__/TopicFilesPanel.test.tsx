import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TopicFilesPanel from "../TopicFilesPanel"

const selectDirectoryModalSpy = vi.fn()
const executeMoveOperationSpy = vi.fn()

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

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string }) =>
		project?.workspace_id === "chat-workspace",
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

vi.mock("../../../hooks/useShareRoute", () => ({
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

vi.mock("../hooks/useMobileProjectFilesDownload", () => ({
	useMobileProjectFilesDownload: () => ({
		allowDownload: true,
		agreementModal: null,
		getSingleFileDownloadMenuItems: () => [],
		preloadWaterMarkFreeModal: vi.fn(),
	}),
}))

vi.mock("../hooks/useBatchDownload", () => ({
	useBatchDownload: () => ({
		handleBatchDownload: vi.fn(),
		batchLoading: false,
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
			onSubmit: vi.fn(),
			pendingMoveFileIds: ["file-1", "file-2"],
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
		batchShare: vi.fn(),
		batchMove: vi.fn(),
		batchDelete: vi.fn(),
		resetMobileSelection: vi.fn(),
	}),
}))

vi.mock("../hooks/useCrossProjectFileOperation", () => ({
	useCrossProjectFileOperation: () => ({
		executeMoveOperation: executeMoveOperationSpy,
		duplicateModalVisible: false,
		currentDuplicateFileName: "",
		totalDuplicates: 0,
		handleDuplicateCancel: vi.fn(),
		handleDuplicateReplace: vi.fn(),
		handleDuplicateKeepBoth: vi.fn(),
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

vi.mock("../../MessageEditor/components/UploadModal", () => ({
	UploadModal: () => null,
}))

vi.mock("../../SelectPathModal", () => ({
	SelectDirectoryModal: (props: Record<string, unknown>) => {
		selectDirectoryModalSpy(props)
		return null
	},
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
	it("在项目详情移动端跨项目确认时带上待移动文件 ID 执行移动", async () => {
		selectDirectoryModalSpy.mockClear()
		executeMoveOperationSpy.mockClear()

		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				selectedProject={{
					id: "project-1",
					project_name: "测试项目",
					workspace_id: "workspace-1",
				}}
				selectedWorkspace={{ id: "workspace-1", name: "测试工作区" }}
				mobileViewVariant="project-detail"
			/>,
		)

		const modalProps = selectDirectoryModalSpy.mock.calls.at(-1)?.[0] as {
			onSubmit?: (params: {
				path: unknown[]
				targetProjectId?: string
				targetAttachments?: unknown[]
				sourceAttachments?: unknown[]
			}) => Promise<void>
		}

		await modalProps.onSubmit?.({
			path: [],
			targetProjectId: "project-2",
			targetAttachments: [],
			sourceAttachments: [],
		})

		expect(executeMoveOperationSpy).toHaveBeenCalledWith({
			fileIds: ["file-1", "file-2"],
			targetProjectId: "project-2",
			targetPath: [],
			targetAttachments: [],
			sourceAttachments: [],
		})
	})

	it("在项目详情移动端默认开启跨工作区项目移动配置", () => {
		selectDirectoryModalSpy.mockClear()

		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				selectedProject={{
					id: "project-1",
					project_name: "测试项目",
					workspace_id: "workspace-1",
				}}
				selectedWorkspace={{ id: "workspace-1", name: "测试工作区" }}
				mobileViewVariant="project-detail"
			/>,
		)

		const modalProps = selectDirectoryModalSpy.mock.calls.at(-1)?.[0]
		expect(modalProps).toMatchObject({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "测试项目",
					workspace_id: "workspace-1",
				},
				currentWorkspace: { id: "workspace-1", name: "测试工作区" },
				sourceAttachments: [],
				isChatProject: false,
			},
		})
	})

	it("在项目详情移动端对话项目也开启跨工作区项目移动配置", () => {
		selectDirectoryModalSpy.mockClear()

		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				selectedProject={{
					id: "project-1",
					project_name: "对话项目",
					workspace_id: "chat-workspace",
				}}
				selectedWorkspace={{ id: "chat-workspace", name: "对话工作区" }}
				mobileViewVariant="project-detail"
			/>,
		)

		const modalProps = selectDirectoryModalSpy.mock.calls.at(-1)?.[0]
		expect(modalProps).toMatchObject({
			mobileCrossProjectConfig: {
				currentProject: {
					id: "project-1",
					project_name: "对话项目",
					workspace_id: "chat-workspace",
				},
				currentWorkspace: { id: "chat-workspace", name: "对话工作区" },
				sourceAttachments: [],
				isChatProject: true,
			},
		})
	})

	it("在项目详情移动端多选分享时使用新的文件分享 Sheet", () => {
		selectDirectoryModalSpy.mockClear()

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
