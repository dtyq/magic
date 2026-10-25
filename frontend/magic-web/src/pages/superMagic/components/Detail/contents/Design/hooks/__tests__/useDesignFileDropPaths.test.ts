import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DRAG_TYPE } from "@/pages/superMagic/components/MessageEditor/utils/drag"
import { SuperMagicApi } from "@/apis"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { buildDesignAttachmentIndex } from "../../utils/designAttachmentIndex"
import { resolveDesignDropResourcePaths, useDesignFileDropPaths } from "../useDesignFileDropPaths"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		copyFile: vi.fn(),
	},
}))

const DESIGN_A = "新建画布A"
const DESIGN_B = "新建画布B"

function createDataTransfer(payload: unknown): DataTransfer {
	return {
		getData: (type: string) => (type === "text/plain" ? JSON.stringify(payload) : ""),
		types: ["text/plain"],
	} as unknown as DataTransfer
}

function projectFile(
	relativeFilePath: string | undefined,
	fileName = "asset.png",
	options?: { fileId?: string; projectId?: string },
) {
	return createDataTransfer({
		type: DRAG_TYPE.ProjectFile,
		data: {
			file_id: options?.fileId ?? "938499924873998337",
			project_id: options?.projectId,
			file_name: fileName,
			relative_file_path: relativeFilePath,
			is_directory: false,
		},
	})
}

function fileItem(fileId: string, relativeFilePath: string): FileItem {
	return {
		file_id: fileId,
		file_name: relativeFilePath.split("/").pop() || "asset.png",
		relative_file_path: relativeFilePath,
		is_directory: false,
	}
}

describe("resolveDesignDropResourcePaths", () => {
	it("keeps a project-root media file absolute instead of copying it", () => {
		expect(resolveDesignDropResourcePaths(projectFile("/错误样本.png"), DESIGN_A)).toEqual([
			"/错误样本.png",
		])
	})

	it("uses a relative DSL path only for media inside the current canvas", () => {
		expect(
			resolveDesignDropResourcePaths(
				projectFile(`/${DESIGN_A}/images/cat.png`, "cat.png"),
				DESIGN_A,
			),
		).toEqual(["./images/cat.png"])
	})

	it("keeps media from another canvas absolute even without a legacy leading slash", () => {
		expect(
			resolveDesignDropResourcePaths(
				projectFile(`${DESIGN_B}/images/cat.png`, "cat.png"),
				DESIGN_A,
			),
		).toEqual([`/${DESIGN_B}/images/cat.png`])
	})

	it("treats attachment-tree images paths as workspace-root absolute", () => {
		expect(
			resolveDesignDropResourcePaths(projectFile("images/cat.png", "cat.png"), DESIGN_A),
		).toEqual(["/images/cat.png"])
	})

	it("filters unsupported project files without starting a copy flow", () => {
		expect(
			resolveDesignDropResourcePaths(
				projectFile("/notes/readme.txt", "readme.txt"),
				DESIGN_A,
			),
		).toEqual([])
	})

	it("keeps a canonical asset reference without treating the id as a file name", () => {
		expect(
			resolveDesignDropResourcePaths(
				projectFile(" asset://asset-video-1 ", "clip.mp4"),
				DESIGN_A,
			),
		).toEqual(["asset://asset-video-1"])
	})

	it("rejects malformed asset references even when the payload has a media file name", () => {
		expect(
			resolveDesignDropResourcePaths(
				projectFile("asset://asset-video-1/child", "clip.mp4"),
				DESIGN_A,
			),
		).toEqual([])
	})
})

describe("useDesignFileDropPaths", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses the backend-selected name and primes file info before returning", async () => {
		const copyFile = vi.mocked(SuperMagicApi.copyFile)
		copyFile.mockResolvedValue({
			status: "success",
			files: {
				file_id: "911343142164795394",
				file_name: "a(1).png",
				relative_file_path: `${DESIGN_A}/images/a(1).png`,
			},
		} as never)
		const getFileInfoById = vi.fn(async () => ({
			file_id: "911343142164795394",
			src: "https://example.test/a(1).png",
			fileName: "a(1).png",
		}))
		const setFileInfoCache = vi.fn()
		const updateAttachments = vi.fn()

		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments,
				getOrCreateImagesDir: vi.fn(async () => ({
					imagesDirFileId: "images-dir-1",
					suffixDir: `${DESIGN_A}/images`,
				})),
				getFileInfoById,
				setFileInfoCache,
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile("/source/a.png", "a.png", { projectId: "source-project" }),
			)
		})

		expect(copyFile).toHaveBeenCalledWith({
			file_id: "938499924873998337",
			target_parent_id: "images-dir-1",
			target_project_id: "project-1",
			pre_file_id: "-1",
			keep_both_file_ids: ["938499924873998337"],
		})
		expect(getFileInfoById).toHaveBeenCalledWith("911343142164795394", "a(1).png")
		expect(setFileInfoCache).toHaveBeenCalledWith(
			"./images/a(1).png",
			expect.objectContaining({ src: "https://example.test/a(1).png" }),
			{ allowMissingAttachment: true },
		)
		expect(paths).toEqual(["./images/a(1).png"])
		expect(updateAttachments).toHaveBeenCalledTimes(1)
	})

	it("does not copy a resource already inside the current canvas", async () => {
		const copyFile = vi.mocked(SuperMagicApi.copyFile)
		const flatAttachments = [fileItem("938499924873998337", `${DESIGN_A}/images/a.png`)]
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				flatAttachments,
				attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
				updateAttachments: vi.fn(),
				getOrCreateImagesDir: vi.fn(),
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile(`/${DESIGN_A}/images/a.png`),
			)
		})

		expect(paths).toEqual(["./images/a.png"])
		expect(copyFile).not.toHaveBeenCalled()
	})

	it("keeps a dropped asset reference without copying it into the workspace", async () => {
		const updateAttachments = vi.fn()
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments,
			}),
		)

		await expect(
			result.current.getDataTransferFileInfo(
				projectFile(" asset://shared-image-1 ", "portrait.png", {
					projectId: "project-2",
				}),
			),
		).resolves.toEqual(["asset://shared-image-1"])
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
		expect(updateAttachments).not.toHaveBeenCalled()
	})

	it("infers current-canvas ownership for a project mention without sourceCanvasId", async () => {
		const flatAttachments = [fileItem("mention-file", `${DESIGN_A}/images/mention.png`)]
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				flatAttachments,
				attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
				updateAttachments: vi.fn(),
			}),
		)

		await expect(
			result.current.resolveCanvasClipboardReference({
				sourceProjectId: "project-1",
				sourceFileId: "mention-file",
				resourceIdentity: "mention-file",
				projectPath: `/${DESIGN_A}/images/mention.png`,
				targetProjectId: "project-1",
				targetCanvasId: "canvas-1",
				target: "canvas-editor",
				fileName: "mention.png",
			}),
		).resolves.toMatchObject({
			kind: "current-canvas",
			path: "./images/mention.png",
			fileId: "mention-file",
		})
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
	})

	it("returns the copied path when file-info preload fails", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		vi.mocked(SuperMagicApi.copyFile).mockResolvedValue({
			status: "success",
			files: {
				file_id: "911343142164795394",
				file_name: "a.png",
			},
		} as never)
		const updateAttachments = vi.fn()
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments,
				getOrCreateImagesDir: vi.fn(async () => ({
					imagesDirFileId: "images-dir-1",
					suffixDir: `${DESIGN_A}/images`,
				})),
				getFileInfoById: vi.fn(async () => {
					throw new Error("preload failed")
				}),
				setFileInfoCache: vi.fn(),
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile("/source/a.png", "a.png", { projectId: "source-project" }),
			)
		})

		expect(paths).toEqual(["./images/a.png"])
		expect(updateAttachments).toHaveBeenCalledTimes(1)
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"[useDesignFileDropPaths] 复制文件信息预热失败:",
			expect.objectContaining({ message: "preload failed" }),
		)
		consoleWarnSpy.mockRestore()
	})

	it("uses the attachment node path when the payload path disagrees", async () => {
		const flatAttachments = [fileItem("current-file", `${DESIGN_A}/images/actual.png`)]
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				flatAttachments,
				attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
				updateAttachments: vi.fn(),
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile("/wrong/location.png", "payload.png", {
					fileId: "current-file",
					projectId: "project-1",
				}),
			)
		})

		expect(paths).toEqual(["./images/actual.png"])
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
	})

	it("uses the selected fileId when two attachment nodes share one path", async () => {
		const flatAttachments = [
			fileItem("duplicate-1", "shared/duplicate.png"),
			fileItem("duplicate-2", "shared/duplicate.png"),
		]
		vi.mocked(SuperMagicApi.copyFile).mockResolvedValue({
			status: "success",
			files: {
				file_id: "copied-file",
				file_name: "duplicate.png",
				relative_file_path: `${DESIGN_A}/images/duplicate.png`,
			},
		} as never)
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				flatAttachments,
				attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
				updateAttachments: vi.fn(),
				getOrCreateImagesDir: vi.fn(async () => ({
					imagesDirFileId: "images-dir-1",
					suffixDir: `${DESIGN_A}/images`,
				})),
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile("/shared/duplicate.png", "duplicate.png", {
					fileId: "duplicate-2",
					projectId: "project-1",
				}),
			)
		})

		expect(SuperMagicApi.copyFile).toHaveBeenCalledWith(
			expect.objectContaining({
				file_id: "duplicate-2",
				keep_both_file_ids: ["duplicate-2"],
			}),
		)
		expect(paths).toEqual(["./images/duplicate.png"])
	})

	it("fails closed when a current-project fileId is absent from the attachment snapshot", async () => {
		const flatAttachments = [fileItem("different-file", `${DESIGN_A}/images/same-name.png`)]
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				flatAttachments,
				attachmentIndex: buildDesignAttachmentIndex(flatAttachments),
				updateAttachments: vi.fn(),
			}),
		)

		await expect(
			result.current.getDataTransferFileInfo(
				projectFile(`/${DESIGN_A}/images/same-name.png`, "same-name.png", {
					fileId: "missing-file",
					projectId: "project-1",
				}),
			),
		).rejects.toThrow("无法通过文件ID定位待拖入资源")
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
	})

	it("copies an external-project file even when its payload path looks current-canvas local", async () => {
		vi.mocked(SuperMagicApi.copyFile).mockResolvedValue({
			status: "success",
			files: {
				file_id: "copied-external",
				file_name: "external.png",
				relative_file_path: `${DESIGN_A}/images/external.png`,
			},
		} as never)
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments: vi.fn(),
				getOrCreateImagesDir: vi.fn(async () => ({
					imagesDirFileId: "images-dir-1",
					suffixDir: `${DESIGN_A}/images`,
				})),
			}),
		)

		let paths: string[] = []
		await act(async () => {
			paths = await result.current.getDataTransferFileInfo(
				projectFile(`/${DESIGN_A}/images/external.png`, "external.png", {
					fileId: "external-file",
					projectId: "project-2",
				}),
			)
		})

		expect(SuperMagicApi.copyFile).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "external-file" }),
		)
		expect(paths).toEqual(["./images/external.png"])
	})

	it("reuses an in-flight same-project cross-canvas copy", async () => {
		const copyFile = vi.mocked(SuperMagicApi.copyFile)
		copyFile.mockResolvedValue({
			status: "success",
			files: {
				file_id: "copied-shared",
				file_name: "shared.png",
				relative_file_path: `${DESIGN_A}/images/shared.png`,
			},
		} as never)
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments: vi.fn(),
				getOrCreateImagesDir: vi.fn(async () => ({
					imagesDirFileId: "images-dir-1",
					suffixDir: `${DESIGN_A}/images`,
				})),
			}),
		)

		const input = {
			sourceProjectId: "project-1",
			sourceCanvasId: "canvas-2",
			sourceFileId: "source-shared",
			resourceIdentity: "workspace:/CanvasB/images/shared.png",
			projectPath: `/${DESIGN_B}/images/shared.png`,
			targetProjectId: "project-1",
			targetCanvasId: "canvas-1",
			target: "canvas-editor" as const,
			fileName: "shared.png",
		}

		const [first, second] = await Promise.all([
			result.current.resolveCanvasClipboardReference(input),
			result.current.resolveCanvasClipboardReference(input),
		])

		expect(first).toEqual(second)
		expect(first).toMatchObject({
			kind: "current-canvas",
			path: "./images/shared.png",
			awaitingAttachmentConfirmation: true,
		})
		expect(copyFile).toHaveBeenCalledTimes(1)
	})

	it("normalizes legacy bare paths from the current canvas without uploading", async () => {
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments: vi.fn(),
			}),
		)

		await expect(
			result.current.resolveCanvasClipboardReference({
				sourceProjectId: "project-1",
				sourceCanvasId: "canvas-1",
				resourceIdentity: "workspace:/新建画布A/images/a.png",
				sourcePath: "images/a.png",
				targetProjectId: "project-1",
				targetCanvasId: "canvas-1",
				target: "canvas-editor",
				fileName: "a.png",
			}),
		).resolves.toEqual({
			kind: "current-canvas",
			path: "./images/a.png",
			resourceIdentity: "workspace:/新建画布A/images/a.png",
			fileName: "a.png",
		})
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
	})

	it("keeps an asset clipboard reference across canvases without copying", async () => {
		const { result } = renderHook(() =>
			useDesignFileDropPaths({
				projectId: "project-1",
				currentFile: { id: "canvas-1", name: DESIGN_A },
				designProjectBasePath: DESIGN_A,
				updateAttachments: vi.fn(),
			}),
		)

		await expect(
			result.current.resolveCanvasClipboardReference({
				sourceProjectId: "project-2",
				sourceCanvasId: "canvas-2",
				resourceIdentity: "opaque-asset:asset://shared-video-1",
				sourcePath: " asset://shared-video-1 ",
				targetProjectId: "project-1",
				targetCanvasId: "canvas-1",
				target: "canvas-editor",
				fileName: "shared-video.mp4",
			}),
		).resolves.toEqual({
			kind: "current-canvas",
			path: "asset://shared-video-1",
			resourceIdentity: "opaque-asset:asset://shared-video-1",
			fileName: "shared-video.mp4",
		})
		expect(SuperMagicApi.copyFile).not.toHaveBeenCalled()
	})
})
