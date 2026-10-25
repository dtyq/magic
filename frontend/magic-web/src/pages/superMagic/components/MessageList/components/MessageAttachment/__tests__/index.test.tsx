import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Attachment } from "../index"

const getTemporaryDownloadUrlMock = vi.fn()
const downloadFileWithAnchorMock = vi.fn()
const resolveSingleDocumentStaticDependenciesMock = vi.fn()
const supportsStaticDependenciesMock = vi.fn()
const startDownloadMock = vi.fn()
const warningMock = vi.fn()
const openMessageFileMock = vi.fn()
const publishMock = vi.fn()
const getFileTypeMock = vi.fn()
const useCanvasAttachmentLocationIndexMock = vi.fn()
const requestCanvasElementFocusMock = vi.fn()
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false))

const projectFilesStoreMock = {
	workspaceFilesList: [] as Array<Record<string, unknown>>,
	workspaceFileTree: [] as Array<Record<string, unknown>>,
	currentSelectedProject: { id: "project-1" },
	filePresentationContext: { kind: "project", projectId: "project-1" },
	filePresentationIndex: undefined,
}

const messageListContextMock = {
	projectFilesStore: projectFilesStoreMock,
	activeFileId: null as string | null,
	activeDetailTabType: null as null | "file" | "playback",
	detailPanelVisible: false,
}

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: (...args: unknown[]) => getTemporaryDownloadUrlMock(...args),
}))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: (...args: unknown[]) => downloadFileWithAnchorMock(...args),
	getFileType: (...args: unknown[]) => getFileTypeMock(...args),
}))

vi.mock("@/pages/superMagic/utils/staticDependencies", () => ({
	mergeStaticDependencyFileIds: (
		fileIds: string[],
		dependencyFileIds: string[],
		includeDependencies: boolean,
	) => (includeDependencies ? [...new Set([...fileIds, ...dependencyFileIds])] : fileIds),
	resolveSingleDocumentStaticDependencies: (...args: unknown[]) =>
		resolveSingleDocumentStaticDependenciesMock(...args),
	supportsStaticDependencies: (...args: unknown[]) => supportsStaticDependenciesMock(...args),
}))

vi.mock("@/pages/superMagic/hooks/useDownloadProgress", () => ({
	useDownloadProgress: () => ({ startDownload: startDownloadMock }),
}))

vi.mock("@/pages/superMagic/components/MessageList/context", () => ({
	useMessageListContext: () => messageListContextMock,
	useMessageListProjectFilesStore: () => projectFilesStoreMock,
}))

vi.mock(
	"@/pages/superMagic/components/Detail/contents/Design/utils/canvasAttachmentLocationIndex",
	() => ({
		useCanvasAttachmentLocationIndex: (...args: unknown[]) =>
			useCanvasAttachmentLocationIndexMock(...args),
	}),
)

vi.mock("@/pages/superMagic/components/Detail/contents/Design/hooks/useDesignFocusElement", () => ({
	requestCanvasElementFocus: (...args: unknown[]) => requestCanvasElementFocusMock(...args),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: (...args: unknown[]) => publishMock(...args),
	},
	PubSubEvents: {
		Open_File_Tab: "Open_File_Tab",
		Super_Magic_Focus_Canvas_Element: "Super_Magic_Focus_Canvas_Element",
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: (...args: unknown[]) => warningMock(...args),
	},
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: () => <div />,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick} type="button" />,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => useIsMobileMock(),
}))

vi.mock("@/pages/superMagic/components/MessageList/utils/openMessageFile", () => ({
	openMessageFile: (...args: unknown[]) => openMessageFileMock(...args),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
}))

/**
 * The new-user guide's entry, as this block sees it. Held in a flag rather than stubbed per test
 * because the block reads it inside the click, and because "the guide is due" is the only thing
 * about it the block knows.
 */
const guideState = vi.hoisted(() => ({ deliverableRunDue: false }))

vi.mock("@/pages/superMagic/components/LazyGuideTour/GuideTourManager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/pages/superMagic/components/LazyGuideTour/GuideTourManager")
		>()
	return {
		...actual,
		startHomeOnboardingDeliverableRunIfDue: () => guideState.deliverableRunDue,
	}
})

describe("MessageAttachment", () => {
	beforeEach(() => {
		getTemporaryDownloadUrlMock.mockReset()
		downloadFileWithAnchorMock.mockReset()
		resolveSingleDocumentStaticDependenciesMock.mockReset()
		supportsStaticDependenciesMock.mockReset()
		startDownloadMock.mockReset()
		warningMock.mockReset()
		openMessageFileMock.mockReset()
		publishMock.mockReset()
		getFileTypeMock.mockReset()
		useCanvasAttachmentLocationIndexMock.mockReset()
		requestCanvasElementFocusMock.mockReset()
		getFileTypeMock.mockImplementation((extension: unknown) => {
			if (extension === "png" || extension === "jpg") return "image"
			if (extension === "mp4") return "video"
			if (extension === "mp3") return "audio"
			return "notSupport"
		})
		useIsMobileMock.mockReturnValue(false)
		guideState.deliverableRunDue = false
		projectFilesStoreMock.workspaceFilesList = []
		projectFilesStoreMock.workspaceFileTree = []
		messageListContextMock.activeFileId = null
		messageListContextMock.activeDetailTabType = null
		messageListContextMock.detailPanelVisible = false
		useCanvasAttachmentLocationIndexMock.mockReturnValue(new Map())
		supportsStaticDependenciesMock.mockReturnValue(false)
	})

	it("lets the host open desktop attachments instead of publishing a file tab", () => {
		const onFileClick = vi.fn()
		const file = {
			file_id: "file-1",
			file_extension: "md",
			file_name: "random_content.md",
			filename: "random_content.md",
			contentLength: 0,
			url: "",
		}

		render(
			<Attachment attachments={[file]} onSelectDetail={vi.fn()} onFileClick={onFileClick} />,
		)

		fireEvent.click(screen.getByTestId("handle-open-file"))

		expect(onFileClick).toHaveBeenCalledWith(file)
		expect(openMessageFileMock).not.toHaveBeenCalled()
	})

	it("opens the resolved project directory for magic.project.js attachments", () => {
		const projectDirectory = {
			file_id: "project-directory",
			file_name: "generated-project",
			file_extension: "",
			is_directory: true,
			display_config: { type: "slide", name: "项目演示" },
		}
		const magicProjectFile = {
			file_id: "magic-project-file",
			file_name: "magic.project.js",
			file_extension: "js",
			parent_id: "project-directory",
		}
		projectFilesStoreMock.workspaceFilesList = [magicProjectFile, projectDirectory]
		projectFilesStoreMock.workspaceFileTree = [
			{
				...projectDirectory,
				children: [magicProjectFile],
			},
		]

		render(
			<Attachment
				attachments={[
					{
						...magicProjectFile,
						filename: "magic.project.js",
						contentLength: 0,
						url: "",
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		expect(screen.getByText("项目演示")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("handle-open-file"))
		expect(openMessageFileMock).toHaveBeenCalledWith(projectDirectory)
	})

	it("falls back to opening the original magic.project.js when its parent is unavailable", () => {
		const magicProjectFile = {
			file_id: "magic-project-file",
			file_name: "magic.project.js",
			file_extension: "js",
			parent_id: "missing-project-directory",
			filename: "magic.project.js",
			contentLength: 0,
			url: "",
		}
		projectFilesStoreMock.workspaceFilesList = [magicProjectFile]

		render(<Attachment attachments={[magicProjectFile]} onSelectDetail={vi.fn()} />)

		fireEvent.click(screen.getByTestId("handle-open-file"))
		expect(openMessageFileMock).toHaveBeenCalledWith(magicProjectFile)
	})

	it("uses the resolved project directory when mobile preview falls back to onSelectDetail", () => {
		const projectDirectory = {
			file_id: "project-directory",
			file_name: "generated-project",
			file_extension: "",
			is_directory: true,
			display_config: { type: "slide", name: "项目演示" },
		}
		const magicProjectFile = {
			file_id: "magic-project-file",
			file_name: "magic.project.js",
			file_extension: "js",
			parent_id: "project-directory",
			filename: "magic.project.js",
			contentLength: 0,
			url: "",
		}
		const onSelectDetail = vi.fn()
		projectFilesStoreMock.workspaceFilesList = [magicProjectFile, projectDirectory]
		useIsMobileMock.mockReturnValue(true)

		render(<Attachment attachments={[magicProjectFile]} onSelectDetail={onSelectDetail} />)

		fireEvent.click(screen.getByTestId("handle-open-file"))
		expect(onSelectDetail).toHaveBeenCalledWith(
			expect.objectContaining({
				currentFileId: "project-directory",
				data: expect.objectContaining({
					file_id: "project-directory",
					display_config: { type: "slide", name: "项目演示" },
				}),
			}),
		)
	})

	it("requests download mode when the download button is clicked", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([{ url: "https://example.invalid/file.pdf" }])

		render(
			<Attachment
				attachments={[
					{
						file_id: "file-1",
						file_extension: "pdf",
						file_name: "file.pdf",
						filename: "file.pdf",
						contentLength: 0,
						url: "",
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getAllByRole("button")[1])

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			is_download: true,
			download_mode: "download",
		})
		await waitFor(() => {
			expect(downloadFileWithAnchorMock).toHaveBeenCalledWith(
				"https://example.invalid/file.pdf",
			)
		})
	})

	it("downloads linked resources for supported message attachments", async () => {
		projectFilesStoreMock.workspaceFilesList = [
			{
				file_id: "page-html",
				file_name: "page.html",
				file_extension: "html",
				relative_file_path: "site/page.html",
			},
			{
				file_id: "cover-image",
				file_name: "cover.png",
				relative_file_path: "site/cover.png",
			},
		]
		supportsStaticDependenciesMock.mockReturnValue(true)
		resolveSingleDocumentStaticDependenciesMock.mockResolvedValue({
			fileType: "html",
			dependencyFileIds: ["cover-image"],
			dependencyTransferFileIds: ["cover-image"],
			missingResourcePaths: [],
		})
		startDownloadMock.mockResolvedValue(true)

		render(
			<Attachment
				attachments={[
					{
						file_id: "page-html",
						file_extension: "html",
						file_name: "page.html",
						filename: "page.html",
						contentLength: 0,
						url: "",
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getAllByRole("button")[1])

		await waitFor(() => {
			expect(startDownloadMock).toHaveBeenCalledWith(
				expect.objectContaining({
					projectId: "project-1",
					fileIds: ["page-html", "cover-image"],
					fileName: "page-with-assets.zip",
				}),
			)
		})
		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
	})

	it("falls back to the original file when dependency resolution fails", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([
			{ url: "https://example.invalid/page.html" },
		])
		supportsStaticDependenciesMock.mockReturnValue(true)
		resolveSingleDocumentStaticDependenciesMock.mockRejectedValue(
			new Error("dependency resolution failed"),
		)

		render(
			<Attachment
				attachments={[
					{
						file_id: "page-html",
						file_extension: "html",
						file_name: "page.html",
						filename: "page.html",
						contentLength: 0,
						url: "",
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getAllByRole("button")[1])

		await waitFor(() => {
			expect(downloadFileWithAnchorMock).toHaveBeenCalledWith(
				"https://example.invalid/page.html",
			)
		})
		expect(warningMock).toHaveBeenCalledWith("share.documentDependenciesAnalysisFailed")
	})

	/**
	 * The one click a new account's guide is allowed to take: the first attachment such an account
	 * ever opens. The guide explains what these files are, so the file stays shut while it is on
	 * screen and the user opens it by clicking again — the path every other test in this file
	 * covers, since the guide is not due in them.
	 */
	it("spends the first click on the guide, opens nothing, and marks the block it frames", () => {
		guideState.deliverableRunDue = true
		const onFileClick = vi.fn()
		const onSelectDetail = vi.fn()
		const file = {
			file_id: "file-1",
			file_extension: "md",
			file_name: "report.md",
			filename: "report.md",
			contentLength: 0,
			url: "",
		}

		render(
			<Attachment
				attachments={[file]}
				onSelectDetail={onSelectDetail}
				onFileClick={onFileClick}
			/>,
		)

		fireEvent.click(screen.getByTestId("handle-open-file"))

		// Nothing is opened by any of the three routes a click could take.
		expect(onFileClick).not.toHaveBeenCalled()
		expect(onSelectDetail).not.toHaveBeenCalled()
		expect(openMessageFileMock).not.toHaveBeenCalled()
		// The guide's first step has nothing else to point at: this mark is the only record of which
		// of the page's blocks the click belonged to.
		expect(
			document.querySelector('[data-guide-anchor="deliverable-attachment"]'),
		).not.toBeNull()
	})

	it.each([
		["image", "png"],
		["video", "mp4"],
		["audio", "mp3"],
	])(
		"shows a %s locator from the project Canvas index even when the Canvas is not open",
		(_case, extension) => {
			const fileId = `generated-${_case}`
			useCanvasAttachmentLocationIndexMock.mockReturnValue(
				new Map([[fileId, [{ canvasDesignId: "canvas-project", mediaFileId: fileId }]]]),
			)
			const file = {
				file_id: fileId,
				file_extension: extension,
				file_name: `generated.${extension}`,
				filename: `generated.${extension}`,
				contentLength: 0,
				url: "",
				file_tag: "final" as const,
			}

			render(<Attachment attachments={[file]} onSelectDetail={vi.fn()} />)
			fireEvent.click(
				screen.getByRole("button", { name: "operationResultList.viewInCanvas" }),
			)

			expect(useCanvasAttachmentLocationIndexMock).toHaveBeenCalledWith({
				attachments: projectFilesStoreMock.workspaceFileTree,
				flatAttachments: projectFilesStoreMock.workspaceFilesList,
				candidateFileIds: [fileId],
			})
			expect(publishMock).toHaveBeenCalledWith("Open_File_Tab", {
				fileId: "canvas-project",
			})
			expect(requestCanvasElementFocusMock).toHaveBeenCalledWith({
				canvasDesignId: "canvas-project",
				mediaFileId: fileId,
				selectElement: true,
				animated: true,
				padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
			})
			expect(publishMock).not.toHaveBeenCalledWith(
				"Super_Magic_Focus_Canvas_Element",
				expect.anything(),
			)
			expect(openMessageFileMock).not.toHaveBeenCalled()
		},
	)

	it.each([
		["process attachment", { file_tag: "process" as const }],
		["non-media attachment", { file_extension: "txt" }],
		["display project attachment", { display_config: { type: "design", name: "Canvas" } }],
	])("hides the locator for a %s", (_case, overrides) => {
		const fileId = `attachment-${_case}`
		useCanvasAttachmentLocationIndexMock.mockReturnValue(
			new Map([[fileId, [{ canvasDesignId: "canvas-project", mediaFileId: fileId }]]]),
		)
		render(
			<Attachment
				attachments={[
					{
						file_id: fileId,
						file_extension: "png",
						file_name: "generated.png",
						filename: "generated.png",
						contentLength: 0,
						url: "",
						file_tag: "final",
						...overrides,
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		expect(
			screen.queryByRole("button", { name: "operationResultList.viewInCanvas" }),
		).not.toBeInTheDocument()
	})

	it("hides the locator when the media has no unique Canvas directory", () => {
		const missingFileId = "missing-canvas-image"
		const ambiguousFileId = "shared-canvas-image"
		useCanvasAttachmentLocationIndexMock.mockReturnValue(
			new Map([
				[
					ambiguousFileId,
					[
						{ canvasDesignId: "canvas-one", mediaFileId: ambiguousFileId },
						{ canvasDesignId: "canvas-two", mediaFileId: ambiguousFileId },
					],
				],
			]),
		)
		render(
			<Attachment
				attachments={[missingFileId, ambiguousFileId].map((fileId) => ({
					file_id: fileId,
					file_extension: "png",
					file_name: `${fileId}.png`,
					filename: `${fileId}.png`,
					contentLength: 0,
					url: "",
					file_tag: "final" as const,
				}))}
				onSelectDetail={vi.fn()}
			/>,
		)

		expect(
			screen.queryByRole("button", { name: "operationResultList.viewInCanvas" }),
		).not.toBeInTheDocument()
	})

	it("shows the locator for a matching historical final attachment only", () => {
		useCanvasAttachmentLocationIndexMock.mockReturnValue(
			new Map([
				[
					"historical-image",
					[{ canvasDesignId: "canvas-project", mediaFileId: "historical-image" }],
				],
				[
					"processing-image",
					[{ canvasDesignId: "canvas-project", mediaFileId: "processing-image" }],
				],
			]),
		)
		render(
			<Attachment
				attachments={[
					{
						file_id: "historical-image",
						file_extension: "png",
						file_name: "historical.png",
						filename: "historical.png",
						contentLength: 0,
						url: "",
						file_tag: "final",
					},
					{
						file_id: "processing-image",
						file_extension: "png",
						file_name: "processing.png",
						filename: "processing.png",
						contentLength: 0,
						url: "",
						file_tag: "process",
					},
				]}
				onSelectDetail={vi.fn()}
			/>,
		)

		expect(
			screen.getAllByRole("button", { name: "operationResultList.viewInCanvas" }),
		).toHaveLength(1)
		fireEvent.click(screen.getAllByTestId("handle-open-file")[0])
		expect(openMessageFileMock).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "historical-image" }),
		)
	})

	it("requests localization for each batch attachment through its own media file", () => {
		useCanvasAttachmentLocationIndexMock.mockReturnValue(
			new Map([
				["generated-0", [{ canvasDesignId: "canvas-project", mediaFileId: "generated-0" }]],
				["generated-1", [{ canvasDesignId: "canvas-project", mediaFileId: "generated-1" }]],
			]),
		)
		const attachments = [0, 1].map((index) => ({
			file_id: `generated-${index}`,
			file_extension: "png",
			file_name: `generated-${index}.png`,
			filename: `generated-${index}.png`,
			contentLength: 0,
			url: "",
			file_tag: "final" as const,
		}))

		render(<Attachment attachments={attachments} onSelectDetail={vi.fn()} />)
		fireEvent.click(
			screen.getAllByRole("button", { name: "operationResultList.viewInCanvas" })[1],
		)

		expect(requestCanvasElementFocusMock).toHaveBeenLastCalledWith({
			canvasDesignId: "canvas-project",
			mediaFileId: "generated-1",
			selectElement: true,
			animated: true,
			padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
		})
	})
})
