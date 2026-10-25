import { beforeEach, describe, expect, it, vi } from "vitest"
import { DesignLoadManager } from "../DesignLoadManager"
import type {
	DesignCurrentFileLoadResult,
	DesignProjectManagerOptions,
	DesignProjectStateBag,
} from "../types"
import type { DesignData } from "../../types"
import type { RectangleElement } from "@/components/CanvasDesign/runtime/document/types"
import {
	findMagicProjectJsFile,
	normalizeDesignDataPathsAfterLoad,
	parseMagicProjectJsContentWithDiagnostics,
	resolveActualDesignCurrentFile,
	resolveDesignDirectoryNameFromAttachments,
	resolveDesignProjectBasePathFromAttachments,
} from "../../utils/utils"
import { hydrateDesignDataDetails } from "../../utils/elementDetailsIo"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getFileInfo: vi.fn(),
	},
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({ error: vi.fn() }),
	},
}))

vi.mock("../../utils/utils", () => ({
	findMagicProjectJsFile: vi.fn(),
	parseMagicProjectJsContentWithDiagnostics: vi.fn(),
	resolveActualDesignCurrentFile: vi.fn(),
	resolveDesignDirectoryNameFromAttachments: vi.fn(),
	resolveDesignProjectBasePathFromAttachments: vi.fn(),
	normalizeDesignDataPathsAfterLoad: vi.fn(),
}))

vi.mock("../../utils/elementDetailsIo", () => ({
	hydrateDesignDataDetails: vi.fn(),
}))

function createDesignData(name: string): DesignData {
	return {
		type: "design",
		name,
		version: "2.0.0",
		canvas: {
			elements: [
				{
					id: name,
					type: "rectangle",
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					zIndex: 1,
					activeContentId: `${name}-content`,
					mainContentId: `${name}-content`,
					contents: [{ contentId: `${name}-content` }],
				} satisfies RectangleElement,
			],
		},
	}
}

function snapshot(name: string, fileId = "magic-a"): DesignCurrentFileLoadResult {
	const data = createDesignData(name)
	return {
		fileId,
		accessIdentity: "test",
		data,
		loadResult: {
			data,
			sourceVersion: "2.0.0",
			didUpgrade: false,
			needsPersist: false,
			sidecarStatus: "missing",
		},
	}
}
const readCurrentSnapshot =
	vi.fn<
		(
			fileId: string,
			options: DesignProjectManagerOptions,
		) => Promise<DesignCurrentFileLoadResult>
	>()

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

function createOptions(
	projectId: string | undefined,
	currentFile: { id: string; name: string },
): DesignProjectManagerOptions {
	return {
		projectId,
		currentFile,
		attachments: [],
		flatAttachments: [],
		attachmentsReady: true,
		allowEdit: true,
		isPlaybackMode: false,
		isShareRoute: true,
		isMobile: false,
	}
}

function createStateBag() {
	let designData = createDesignData("initial")
	let magicProjectJsFileId: string | null = null
	let previousFingerprint = ""
	const stateBag: DesignProjectStateBag = {
		getDesignData: () => designData,
		getConflictState: () => null,
		getMagicProjectJsFileId: () => magicProjectJsFileId,
		getPrevDesignDataFingerprint: () => previousFingerprint,
		setPrevDesignDataFingerprint: (fingerprint) => {
			previousFingerprint = fingerprint
		},
		getAccessMode: () => "edit",
		setters: {
			setMagicProjectJsFileId: vi.fn((fileId: string | null) => {
				magicProjectJsFileId = fileId
			}),
			setDesignData: vi.fn((data: DesignData) => {
				designData = data
			}),
			setElementDetailsProvenance: vi.fn(),
			setIsInitialLoading: vi.fn(),
			setIsSaving: vi.fn(),
			setAccessMode: vi.fn(),
			setFileVersionsList: vi.fn(),
			setFileVersion: vi.fn(),
			setIsProcessingRevoke: vi.fn(),
			setRevokeType: vi.fn(),
			setConflictState: vi.fn(),
		},
	}
	return {
		stateBag,
		getDesignData: () => designData,
	}
}

describe("DesignLoadManager request identity", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(DesignLoadManager.prototype, "readCurrentFile").mockImplementation(
			readCurrentSnapshot,
		)
		readCurrentSnapshot
			.mockReset()
			.mockImplementation(async (fileId) =>
				snapshot(fileId === "magic-b" ? "B" : "A", fileId),
			)
		vi.mocked(resolveActualDesignCurrentFile).mockImplementation(({ currentFile }) => {
			if (!currentFile?.id || !currentFile.name) return null
			return { id: currentFile.id, name: currentFile.name }
		})
		vi.mocked(resolveDesignDirectoryNameFromAttachments).mockReturnValue(undefined)
		vi.mocked(resolveDesignProjectBasePathFromAttachments).mockReturnValue(undefined)
		vi.mocked(normalizeDesignDataPathsAfterLoad).mockImplementation(() => undefined)
		vi.mocked(hydrateDesignDataDetails).mockResolvedValue({
			provenance: {},
			status: "missing",
		})
		vi.mocked(parseMagicProjectJsContentWithDiagnostics).mockImplementation((content) => ({
			data: createDesignData(content),
			canvasStatus: "valid-non-empty",
		}))
	})

	it("discards a stale file response and loads the current file independently", async () => {
		const loadA = createDeferred<{ fileId: string } | null>()
		const loadB = createDeferred<{ fileId: string } | null>()
		vi.mocked(findMagicProjectJsFile).mockImplementation(({ currentFileId }) =>
			currentFileId === "file-a" ? loadA.promise : loadB.promise,
		)
		const { stateBag, getDesignData } = createStateBag()
		const loadManager = new DesignLoadManager(
			stateBag,
			createOptions("project-a", { id: "file-a", name: "A" }),
		)

		const firstLoad = loadManager.loadFromRemote()
		loadManager.updateOptions(createOptions("project-b", { id: "file-b", name: "B" }))
		const secondLoad = loadManager.loadFromRemote()

		expect(findMagicProjectJsFile).toHaveBeenCalledTimes(2)
		loadA.resolve({ fileId: "magic-a" })
		expect(await firstLoad).toBe(false)
		expect(stateBag.setters.setDesignData).not.toHaveBeenCalled()

		loadB.resolve({ fileId: "magic-b" })
		expect(await secondLoad).toBe(true)
		expect(getDesignData().name).toBe("B")
		expect(stateBag.setters.setMagicProjectJsFileId).toHaveBeenCalledTimes(1)
		expect(stateBag.setters.setMagicProjectJsFileId).toHaveBeenLastCalledWith("magic-b")
	})

	it("coalesces concurrent loads for the same project and file", async () => {
		const load = createDeferred<{ fileId: string } | null>()
		vi.mocked(findMagicProjectJsFile).mockReturnValue(load.promise)
		const { stateBag } = createStateBag()
		const loadManager = new DesignLoadManager(
			stateBag,
			createOptions("project-a", { id: "file-a", name: "A" }),
		)

		const firstLoad = loadManager.loadFromRemote()
		const secondLoad = loadManager.loadFromRemote()

		expect(findMagicProjectJsFile).toHaveBeenCalledTimes(1)
		load.resolve({ fileId: "magic-a" })
		expect(await firstLoad).toBe(true)
		expect(await secondLoad).toBe(true)
		expect(stateBag.setters.setDesignData).toHaveBeenCalledTimes(1)
	})

	it("does not reuse a file cache entry after its project identity becomes available", async () => {
		readCurrentSnapshot
			.mockResolvedValueOnce(snapshot("A"))
			.mockResolvedValueOnce(snapshot("B"))
			.mockResolvedValueOnce(snapshot("A-again"))
		vi.mocked(findMagicProjectJsFile)
			.mockResolvedValueOnce({ fileId: "magic-a" })
			.mockResolvedValueOnce({ fileId: "magic-a" })
			.mockResolvedValueOnce({ fileId: "magic-a" })
		const { stateBag, getDesignData } = createStateBag()
		const loadManager = new DesignLoadManager(
			stateBag,
			createOptions(undefined, { id: "file-a", name: "A" }),
		)

		expect(await loadManager.loadFromRemote()).toBe(true)
		loadManager.updateOptions(createOptions("project-a", { id: "file-a", name: "A" }))

		expect(await loadManager.loadFromRemote()).toBe(true)
		expect(findMagicProjectJsFile).toHaveBeenCalledTimes(2)
		expect(getDesignData().name).toBe("B")

		loadManager.updateOptions(createOptions(undefined, { id: "file-a", name: "A" }))
		expect(await loadManager.loadFromRemote()).toBe(true)
		expect(findMagicProjectJsFile).toHaveBeenCalledTimes(3)
		expect(getDesignData().name).toBe("A-again")
	})
})
