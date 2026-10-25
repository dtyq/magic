import { act, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TopicFilesPanel, { type TopicFilesPanelRef } from "../TopicFilesPanel"

const selectDirectoryModalSpy = vi.fn()
const executeMoveOperationSpy = vi.fn()
const crossProjectOperationOptionsSpy = vi.fn()
const executeCopyOperationSpy = vi.fn()
const uploadFileSpy = vi.fn()
const uploadFolderSpy = vi.fn()
const batchMoveByFileIdsSpy = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: (...args: any[]) => any) => fn,
	useUpdateEffect: vi.fn(),
	useDebounceFn: (fn: (...args: any[]) => any) => ({
		run: fn,
		cancel: vi.fn(),
	}),
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

const shareRouteMocks = vi.hoisted(() => ({
	isShareRoute: false,
}))

vi.mock("../../../hooks/useShareRoute", () => ({
	default: () => ({
		isShareRoute: shareRouteMocks.isShareRoute,
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
		handleCustomUploadFile: uploadFileSpy,
		handleCustomUploadFolder: uploadFolderSpy,
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
		copySelectorProps: {
			open: false,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			pendingCopyFileIds: ["file-copy-1", "file-copy-2"],
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
		batchCopy: vi.fn(),
		batchDelete: vi.fn(),
		batchMoveByFileIds: batchMoveByFileIdsSpy,
		resetMobileSelection: vi.fn(),
	}),
}))

vi.mock("../hooks/useCrossProjectFileOperation", () => ({
	useCrossProjectFileOperation: (options: Record<string, unknown>) => {
		crossProjectOperationOptionsSpy(options)
		return {
			executeMoveOperation: executeMoveOperationSpy,
			executeCopyOperation: executeCopyOperationSpy,
			duplicateModalVisible: false,
			currentDuplicateFileName: "",
			totalDuplicates: 0,
			handleDuplicateCancel: vi.fn(),
			handleDuplicateReplace: vi.fn(),
			handleDuplicateKeepBoth: vi.fn(),
		}
	},
}))

const mobileProjectDetailFilesViewPropsSpy = vi.fn()

vi.mock("../components/MobileProjectDetailFilesView", () => ({
	default: (props: Record<string, unknown>) => {
		mobileProjectDetailFilesViewPropsSpy(props)
		return <div data-testid="mobile-project-detail-files-view" />
	},
}))

vi.mock("../components", () => ({
	DuplicateFileModal: () => null,
	FolderConflictModal: () => null,
	SelectModeHeader: () => <div />,
	NormalModeHeader: (props: { showRefresh?: boolean; isShareRoute?: boolean }) => (
		<div
			data-testid="normal-mode-header"
			data-show-refresh={String(props.showRefresh)}
			data-is-share-route={String(props.isShareRoute)}
		/>
	),
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
	beforeEach(() => {
		shareRouteMocks.isShareRoute = false
	})

	it("shows refresh on share-like routes when showRefresh is enabled", () => {
		shareRouteMocks.isShareRoute = true

		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				allowEdit={false}
				showRefresh
			/>,
		)

		expect(screen.getByTestId("normal-mode-header")).toHaveAttribute(
			"data-show-refresh",
			"true",
		)
	})

	it("hides refresh on share routes when showRefresh is omitted", () => {
		shareRouteMocks.isShareRoute = true

		render(<TopicFilesPanel attachments={[]} projectId="project-1" allowEdit={false} />)

		expect(screen.getByTestId("normal-mode-header")).toHaveAttribute(
			"data-show-refresh",
			"false",
		)
	})

	it("只读场景下命令式 API 不触发上传或移动写操作", () => {
		uploadFileSpy.mockClear()
		uploadFolderSpy.mockClear()
		batchMoveByFileIdsSpy.mockClear()
		const ref = createRef<TopicFilesPanelRef>()

		render(
			<TopicFilesPanel
				ref={ref}
				attachments={[]}
				projectId="project-1"
				allowEdit={false}
				mobileViewVariant="project-detail"
			/>,
		)

		act(() => {
			ref.current?.uploadFile()
			ref.current?.uploadFolder()
			ref.current?.openBatchMoveByFileIds(["file-1"])
		})

		expect(uploadFileSpy).not.toHaveBeenCalled()
		expect(uploadFolderSpy).not.toHaveBeenCalled()
		expect(batchMoveByFileIdsSpy).not.toHaveBeenCalled()
	})

	it("在项目详情移动端跨项目确认时带上待移动文件 ID 执行移动", async () => {
		selectDirectoryModalSpy.mockClear()
		executeMoveOperationSpy.mockClear()
		crossProjectOperationOptionsSpy.mockClear()

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

		const modalProps = selectDirectoryModalSpy.mock.calls[0]?.[0] as {
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

	it("在项目详情移动端跨项目确认时带上待复制文件 ID 执行复制", async () => {
		selectDirectoryModalSpy.mockClear()
		executeCopyOperationSpy.mockClear()

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

		const copyModalProps = selectDirectoryModalSpy.mock.calls[1]?.[0] as {
			onSubmit?: (params: {
				path: unknown[]
				targetProjectId?: string
				targetAttachments?: unknown[]
				sourceAttachments?: unknown[]
			}) => Promise<void>
		}

		await copyModalProps.onSubmit?.({
			path: [],
			targetProjectId: "project-2",
			targetAttachments: [],
			sourceAttachments: [],
		})

		expect(executeCopyOperationSpy).toHaveBeenCalledWith({
			fileIds: ["file-copy-1", "file-copy-2"],
			targetProjectId: "project-2",
			targetPath: [],
			targetAttachments: [],
			sourceAttachments: [],
		})
	})

	it("在项目详情移动端默认开启跨工作区项目移动配置", () => {
		selectDirectoryModalSpy.mockClear()
		crossProjectOperationOptionsSpy.mockClear()

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
		crossProjectOperationOptionsSpy.mockClear()

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

	it("只读场景下仍提供批量复制，但不提供移动和删除", () => {
		mobileProjectDetailFilesViewPropsSpy.mockClear()

		render(
			<TopicFilesPanel
				attachments={[]}
				projectId="project-1"
				allowEdit={false}
				selectedProject={{
					id: "project-1",
					project_name: "测试项目",
					workspace_id: "workspace-1",
				}}
				selectedWorkspace={{ id: "workspace-1", name: "测试工作区" }}
				mobileViewVariant="project-detail"
			/>,
		)

		const viewProps = mobileProjectDetailFilesViewPropsSpy.mock.calls.at(-1)?.[0] as {
			onBatchCopy?: unknown
			onBatchMove?: unknown
			onBatchDelete?: unknown
		}

		expect(viewProps.onBatchCopy).toEqual(expect.any(Function))
		expect(viewProps.onBatchMove).toBeUndefined()
		expect(viewProps.onBatchDelete).toBeUndefined()
	})

	it("在项目详情移动端多选分享时使用新的文件分享 Sheet", () => {
		selectDirectoryModalSpy.mockClear()
		crossProjectOperationOptionsSpy.mockClear()

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

	it("在项目详情移动端跨项目移动成功后立即移除源项目文件并刷新附件", () => {
		selectDirectoryModalSpy.mockClear()
		executeMoveOperationSpy.mockClear()
		crossProjectOperationOptionsSpy.mockClear()
		const onAttachmentsChange = vi.fn()
		const refreshAttachments = vi.fn()

		render(
			<TopicFilesPanel
				attachments={[
					{ file_id: "file-1", type: "file", file_name: "a.txt" },
					{ file_id: "file-2", type: "file", file_name: "b.txt" },
				]}
				projectId="project-1"
				selectedProject={{
					id: "project-1",
					project_name: "测试项目",
					workspace_id: "workspace-1",
				}}
				selectedWorkspace={{ id: "workspace-1", name: "测试工作区" }}
				mobileViewVariant="project-detail"
				onAttachmentsChange={onAttachmentsChange}
				refreshAttachments={refreshAttachments}
			/>,
		)

		const hookOptions = crossProjectOperationOptionsSpy.mock.calls.at(-1)?.[0] as {
			onSuccess?: (result: { operationType: "move" | "copy"; fileIds: string[] }) => void
		}

		hookOptions.onSuccess?.({ operationType: "move", fileIds: ["file-1"] })

		expect(onAttachmentsChange).toHaveBeenCalledWith([
			{ file_id: "file-2", type: "file", file_name: "b.txt" },
		])
		expect(refreshAttachments).toHaveBeenCalled()
	})
})
