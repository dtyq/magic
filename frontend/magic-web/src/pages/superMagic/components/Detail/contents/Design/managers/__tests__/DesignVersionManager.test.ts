import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DesignProjectManagerOptions, DesignProjectStateBag } from "../types"
import { DesignVersionManager } from "../DesignVersionManager"
import { loadDesignDataToRuntime } from "../../utils/designDataLoader"
import { loadMagicProjectJsContent } from "../../utils/utils"

vi.mock("../../utils/utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../utils/utils")>()
	return {
		...actual,
		loadMagicProjectJsContent: vi.fn(),
		resolveDesignProjectBasePathFromAttachments: vi.fn(() => "design"),
	}
})

vi.mock("../../utils/designDataLoader", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../utils/designDataLoader")>()
	return { ...actual, loadDesignDataToRuntime: vi.fn() }
})

function stateBag(): DesignProjectStateBag {
	return {
		getDesignData: () => ({
			type: "design",
			name: "design",
			version: "3.0.0",
			canvas: { elements: [] },
		}),
		getConflictState: () => null,
		getMagicProjectJsFileId: () => "main-file",
		getPrevDesignDataFingerprint: () => "",
		setPrevDesignDataFingerprint: vi.fn(),
		getAccessMode: () => "edit",
		setters: {
			setMagicProjectJsFileId: vi.fn(),
			setDesignData: vi.fn(),
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
}

describe("DesignVersionManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(loadMagicProjectJsContent).mockResolvedValue("history-content")
		vi.mocked(loadDesignDataToRuntime).mockResolvedValue({
			data: {
				type: "design",
				name: "history",
				version: "3.0.0",
				canvas: { elements: [] },
			},
			sourceVersion: "2.0.0",
			didUpgrade: true,
			needsPersist: true,
			sidecarStatus: "skipped-history",
		})
	})

	it("loads history without hydrating the current sidecar", async () => {
		const options: DesignProjectManagerOptions = {
			allowEdit: true,
			isPlaybackMode: false,
			isShareRoute: false,
			isMobile: false,
			projectId: "project-1",
			attachments: [],
			flatAttachments: [],
		}
		const manager = new DesignVersionManager(
			stateBag(),
			options,
			{ cancelAutoSave: vi.fn(), clearRemoteConflict: vi.fn() } as never,
			() => undefined,
			vi.fn(),
		)

		await manager.loadWithVersion(7)

		expect(loadMagicProjectJsContent).toHaveBeenCalledWith("main-file", {
			file_versions: { "main-file": 7 },
		})
		expect(loadDesignDataToRuntime).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "history-content",
				sidecarMode: "none",
				fileId: "main-file",
			}),
		)
		expect(vi.mocked(loadDesignDataToRuntime).mock.calls[0][0]).not.toHaveProperty(
			"elementDetailsContext",
		)
	})

	it("reloads the current history version instead of loading latest", async () => {
		const bag = stateBag()
		const manager = new DesignVersionManager(
			bag,
			{
				allowEdit: true,
				isPlaybackMode: false,
				isShareRoute: false,
				isMobile: false,
				projectId: "project-1",
				attachments: [],
				flatAttachments: [],
			},
			{ cancelAutoSave: vi.fn(), clearRemoteConflict: vi.fn() } as never,
			() => 7,
			vi.fn(),
		)

		await manager.reloadCurrentVersion()

		expect(loadMagicProjectJsContent).toHaveBeenCalledWith("main-file", {
			file_versions: { "main-file": 7 },
		})
		expect(bag.setters.setFileVersion).toHaveBeenCalledWith(7)
		expect(bag.setters.setDesignData).toHaveBeenCalledWith(
			expect.objectContaining({ name: "history" }),
		)
		expect(bag.setters.setAccessMode).toHaveBeenCalledWith("history")
	})

	it("restores the stable edit mode after returning from history to latest", async () => {
		const bag = stateBag()
		const manager = new DesignVersionManager(
			bag,
			{
				allowEdit: true,
				isPlaybackMode: false,
				isShareRoute: false,
				isMobile: false,
				projectId: "project-1",
				attachments: [],
				flatAttachments: [],
			},
			{ cancelAutoSave: vi.fn(), clearRemoteConflict: vi.fn() } as never,
			() => undefined,
			vi.fn(),
		)

		manager.applyVersionData(
			{
				type: "design",
				name: "history",
				version: "3.0.0",
				canvas: { elements: [] },
			},
			true,
		)
		manager.applyVersionData(
			{
				type: "design",
				name: "latest",
				version: "3.0.0",
				canvas: { elements: [] },
			},
			false,
		)

		expect(bag.setters.setAccessMode).toHaveBeenLastCalledWith("edit")
	})
})
