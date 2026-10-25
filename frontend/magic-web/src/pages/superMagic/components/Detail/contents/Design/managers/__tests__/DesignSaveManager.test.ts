import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { DesignSaveManager, type DesignSaveLifecycleHandlers } from "../DesignSaveManager"
import {
	getDesignRequestIdentity,
	type DesignProjectManagerOptions,
	type DesignProjectStateBag,
} from "../types"
import type { DesignData } from "../../types"
import { hashDesignDataComparable } from "../../utils/designContentHash"
import type {
	CanvasConnection,
	CanvasDocument,
	LayerElement,
} from "@/components/CanvasDesign/runtime/document/types"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import { decompressCanvasData, isCompressedCanvas } from "../../utils/magicProjectCompression"
import {
	getElementDetailsSidecarStatus,
	writeUserElementDetails,
} from "../../utils/elementDetailsIo"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getFileInfo: vi.fn(),
		saveFileContent: vi.fn(),
	},
}))

vi.mock("../../utils/elementDetailsIo", () => ({
	getElementDetailsSidecarStatus: vi.fn(),
	getHydratedElementDetailsProvenance: vi.fn(() => ({})),
	writeUserElementDetails: vi.fn(),
}))

function createDesignData(
	name: string,
	elements: LayerElement[] = [],
	connections?: CanvasConnection[],
): DesignData {
	return {
		type: "design",
		name,
		version: "2.0.0",
		canvas: { elements, ...(connections ? { connections } : {}) },
	}
}

function createSaveManager(
	initialData = createDesignData("local"),
	handlers?: DesignSaveLifecycleHandlers,
) {
	let designData = initialData
	let magicProjectJsFileId: string | null = "file-1"
	let prevDesignDataFingerprint = hashDesignDataComparable(initialData)
	let accessMode: CanvasAccessMode = "edit"

	const stateBag: DesignProjectStateBag = {
		getDesignData: () => designData,
		getConflictState: () => null,
		getMagicProjectJsFileId: () => magicProjectJsFileId,
		getPrevDesignDataFingerprint: () => prevDesignDataFingerprint,
		setPrevDesignDataFingerprint: (v) => {
			prevDesignDataFingerprint = v
		},
		getAccessMode: () => accessMode,
		setters: {
			setMagicProjectJsFileId: vi.fn((v: string | null) => {
				magicProjectJsFileId = v
			}),
			setDesignData: vi.fn((data: DesignData) => {
				designData = data
			}),
			setIsInitialLoading: vi.fn(),
			setIsSaving: vi.fn(),
			setAccessMode: vi.fn((v: CanvasAccessMode) => {
				accessMode = v
			}),
			setFileVersionsList: vi.fn(),
			setFileVersion: vi.fn(),
			setIsProcessingRevoke: vi.fn(),
			setRevokeType: vi.fn(),
			setConflictState: vi.fn(),
		},
	}

	const options: DesignProjectManagerOptions = {
		allowEdit: true,
		isPlaybackMode: false,
		isShareRoute: false,
		isMobile: false,
		projectId: "project-1",
		designProjectId: "design-1",
		designProjectName: "design",
		attachments: [],
		flatAttachments: [],
	}

	return new DesignSaveManager(
		stateBag,
		options,
		vi.fn().mockResolvedValue([]),
		async (fileId, requestOptions) => ({
			fileId,
			accessIdentity: getDesignRequestIdentity(requestOptions),
			data: initialData,
		}),
		{
			...handlers,
			onSaveCommitted: (result) => {
				if (prevDesignDataFingerprint === result.baseFingerprint && result.fullyPersisted)
					prevDesignDataFingerprint = result.savedFingerprint
				handlers?.onSaveCommitted?.(result)
			},
		},
	)
}

describe("DesignSaveManager remote checks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue({
			success_files: [
				{ file_id: "file-1", data: { version: 3, updated_at: "2026-10-12 00:00:00 UTC" } },
			],
			error_files: [],
		} as never)
		vi.mocked(getElementDetailsSidecarStatus).mockResolvedValue("missing")
		vi.mocked(writeUserElementDetails).mockResolvedValue("skipped")
	})

	it("blocks the main file save when the current sidecar is unsupported", async () => {
		const data = createDesignData("unsupported")
		data.version = "3.0.0"
		const saveManager = createSaveManager(data)
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: false,
			currentFingerprint: null,
			isCheckReliable: true,
		})
		vi.mocked(getElementDetailsSidecarStatus).mockResolvedValue("unsupported")

		await expect(saveManager.commitSave()).resolves.toEqual({
			ok: false,
			reason: "unsupported-sidecar",
		})
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
		expect(writeUserElementDetails).not.toHaveBeenCalled()
	})

	it("stops before writing when the remote version has advanced", async () => {
		const saveManager = createSaveManager()
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: true,
			currentFingerprint: null,
			isCheckReliable: true,
		})

		const result = await saveManager.commitSave()

		expect(result).toEqual({
			ok: false,
			reason: "remote-updated",
			currentFile: undefined,
			isCheckReliable: true,
		})
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
		expect(saveManager.hasRemoteConflict()).toBe(true)
	})

	it("stops before writing when the remote version check is unreliable", async () => {
		const saveManager = createSaveManager()
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: false,
			currentFingerprint: null,
			isCheckReliable: false,
		})

		const result = await saveManager.commitSave()

		expect(result).toEqual({
			ok: false,
			reason: "remote-check-unreliable",
			isCheckReliable: false,
		})
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
		expect(saveManager.hasRemoteConflict()).toBe(false)
	})

	it("can save an explicit payload without replacing the current design state", async () => {
		const localData = createDesignData("local-display")
		const remoteSaveData = createDesignData("remote-save")
		remoteSaveData.version = "1.0.0"
		const saveManager = createSaveManager(localData)
		const stateBag = (saveManager as unknown as { stateBag: DesignProjectStateBag }).stateBag
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: false,
			currentFingerprint: null,
			isCheckReliable: true,
		})
		vi.mocked(SuperMagicApi.getFileInfo).mockResolvedValue({ version: 3 } as never)

		const result = await saveManager.commitSave({
			designData: remoteSaveData,
			updateCurrentDesignData: false,
		})

		expect(result).toEqual(
			expect.objectContaining({
				ok: true,
				savedDesignData: remoteSaveData,
				savedFingerprint: hashDesignDataComparable(remoteSaveData),
			}),
		)
		expect(stateBag.getDesignData()).toBe(localData)
		expect(stateBag.setters.setDesignData).not.toHaveBeenCalled()
		expect(stateBag.getPrevDesignDataFingerprint()).toBe(
			hashDesignDataComparable(remoteSaveData),
		)
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledTimes(1)
	})

	it("writes canvas connections into the saved magic.project.js content", async () => {
		const sourceElement: LayerElement = {
			id: "source",
			type: "text",
			activeContentId: "source-content-1",
			mainContentId: "source-content-1",
			contents: [{ contentId: "source-content-1" }],
			x: 0,
			y: 0,
			width: 100,
			height: 40,
		}
		const targetElement: LayerElement = {
			id: "target",
			type: "text",
			activeContentId: "target-content-1",
			mainContentId: "target-content-1",
			contents: [{ contentId: "target-content-1" }],
			x: 200,
			y: 0,
			width: 100,
			height: 40,
		}
		const connection: CanvasConnection = {
			id: "connection-1",
			sourceElementId: "source",
			targetElementId: "target",
		}
		const saveManager = createSaveManager(
			createDesignData("local", [sourceElement, targetElement], [connection]),
		)
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: false,
			currentFingerprint: null,
			isCheckReliable: true,
		})

		const result = await saveManager.commitSave()

		expect(result).toEqual(expect.objectContaining({ ok: true }))
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledTimes(1)
		const savedContent = vi.mocked(SuperMagicApi.saveFileContent).mock.calls[0][0][0]
			.content as string
		const config = parseMagicProjectConfigContent(savedContent)
		const canvasField = (config as { canvas?: unknown }).canvas
		expect(isCompressedCanvas(canvasField)).toBe(true)
		if (!isCompressedCanvas(canvasField)) return

		const canvas = decompressCanvasData(canvasField) as CanvasDocument
		expect(canvas.connections).toEqual([connection])
	})

	it("stops before writing when the empty canvas save guard blocks the payload", async () => {
		const shouldBlockEmptyCanvasSave = vi.fn(() => true)
		const saveManager = createSaveManager(createDesignData("local"), {
			shouldBlockEmptyCanvasSave,
		})
		vi.spyOn(saveManager, "checkRemoteUpdate").mockResolvedValue({
			hasUpdate: false,
			currentFingerprint: null,
			isCheckReliable: true,
		})

		const result = await saveManager.commitSave({
			source: "draft-restore",
			beforeElementCount: 2,
			deletedElementIds: ["a", "a"],
		})

		expect(result).toEqual({ ok: false, reason: "unsafe-empty-canvas" })
		expect(shouldBlockEmptyCanvasSave).toHaveBeenCalledWith(
			expect.objectContaining({
				source: "draft-restore",
				beforeElementCount: 2,
				nextElementCount: 0,
				deletedElementIds: ["a"],
				fromDraft: true,
			}),
		)
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})
})
