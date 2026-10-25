import { afterEach, describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type ImageElement } from "../../../document/types"
import { CanvasAssetComplianceTaskManager } from "../CanvasAssetComplianceTaskManager"
import { CanvasAssetCompliancePollingManager } from "../CanvasAssetCompliancePollingManager"

function createTaskManager(options?: {
	getAssetComplianceStatus?: ReturnType<typeof vi.fn>
	canWrite?: boolean
}) {
	const getAssetComplianceStatus =
		options?.getAssetComplianceStatus ??
		vi.fn().mockResolvedValue({
			assetId: "check-1",
			status: "PASS",
			failedReason: null,
		})

	let element = {
		id: "image-1",
		type: ElementTypeEnum.Image,
		contents: [
			{
				contentId: "content-1",
				src: "workspace://images/demo.png",
			},
		],
	} as ImageElement
	const canvas = {
		isSeedanceComplianceEnabled: () => true,
		magicConfigManager: {
			config: {
				methods: { getAssetComplianceStatus },
			},
		},
		permissionManager: {
			can: () => options?.canWrite ?? true,
		},
		elementManager: {
			getElementData: (_elementId?: string) => {
				void _elementId
				return element
			},
			update: vi.fn((_elementId: string, patch: { contents?: ImageElement["contents"] }) => {
				if (patch.contents) element = { ...element, contents: patch.contents }
			}),
			getAllElements: () => [],
		},
		assetResourceManager: {
			getCachedResource: () => undefined,
			refreshResources: vi.fn().mockResolvedValue(new Map()),
		},
	}
	const pollingManager = new CanvasAssetCompliancePollingManager(canvas as never)
	const taskManager = new CanvasAssetComplianceTaskManager({
		assetCompliancePollingManager: pollingManager,
		assetResourceManager: canvas.assetResourceManager as never,
		elementManager: canvas.elementManager as never,
		permissionManager: canvas.permissionManager as never,
		isSeedanceComplianceEnabled: canvas.isSeedanceComplianceEnabled,
	})

	return { taskManager, getAssetComplianceStatus, canvas }
}

afterEach(() => {
	vi.useRealTimers()
})

describe("CanvasAssetComplianceTaskManager", () => {
	it("binds the created asset before polling and does not persist compliance snapshots", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-created",
				status: "PROCESSING",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-created",
				status: "PASS",
				failedReason: null,
			})
		const startWorkspaceMediaCompliance = vi.fn().mockResolvedValue({
			assetId: "asset-created",
			mediaType: "image",
			fileUrl: null,
		})
		const onSettled = vi.fn()
		const { taskManager, canvas } = createTaskManager({ getAssetComplianceStatus })

		const assetId = await taskManager.startWorkspaceFileCompliance(
			{
				path: "workspace://images/demo.png",
				name: "Demo",
				persistTarget: {
					elementId: "image-1",
					contentId: "content-1",
					sourcePath: "workspace://images/demo.png",
				},
				startWorkspaceMediaCompliance,
			},
			{ onSettled },
		)

		expect(assetId).toBe("asset-created")
		expect(startWorkspaceMediaCompliance).toHaveBeenCalledWith({
			path: "workspace://images/demo.png",
			name: "Demo",
		})
		expect(canvas.elementManager.update).toHaveBeenCalledTimes(1)
		expect(canvas.elementManager.getElementData("image-1")?.contents[0]).toMatchObject({
			assetId: "asset-created",
		})
		expect(canvas.elementManager.getElementData("image-1")?.contents[0]).not.toHaveProperty(
			"complianceStatus",
		)
		expect(canvas.elementManager.getElementData("image-1")?.contents[0]).not.toHaveProperty(
			"complianceCheckId",
		)

		await vi.advanceTimersByTimeAsync(0)
		await vi.advanceTimersByTimeAsync(2500)
		expect(getAssetComplianceStatus).toHaveBeenCalledWith("asset-created")
		expect(onSettled).toHaveBeenCalledWith({
			assetId: "asset-created",
			status: "PASS",
			failedReason: null,
		})
		// Polling status belongs to the asset service; it must not add a second
		// workspace-Dsl update after the initial asset binding.
		expect(canvas.elementManager.update).toHaveBeenCalledTimes(1)
	})

	it("resumes document compliance without creating a new asset", () => {
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "check-resume",
			status: "PROCESSING",
			failedReason: null,
		})
		const { taskManager, canvas } = createTaskManager({ getAssetComplianceStatus })
		canvas.elementManager.getAllElements = () =>
			[
				{
					id: "image-1",
					type: ElementTypeEnum.Image,
					contents: [
						{
							contentId: "content-1",
							src: "workspace://images/demo.png",
							complianceStatus: "PROCESSING",
							complianceCheckId: "check-resume",
						},
					],
				},
			] as never

		taskManager.resumeDocumentCompliancePolling()

		expect(getAssetComplianceStatus).toHaveBeenCalledWith("check-resume")
	})

	it("does not poll when the workspace source changed before the asset was bound", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "asset-created",
			status: "PROCESSING",
			failedReason: null,
		})
		const startWorkspaceMediaCompliance = vi.fn().mockResolvedValue({
			assetId: "asset-created",
			mediaType: "image",
			fileUrl: null,
		})
		const { taskManager, canvas } = createTaskManager({ getAssetComplianceStatus })
		canvas.elementManager.getElementData = () =>
			({
				id: "image-1",
				type: ElementTypeEnum.Image,
				contents: [
					{
						contentId: "content-1",
						src: "workspace://images/replaced.png",
					},
				],
			}) as ImageElement

		const assetId = await taskManager.startWorkspaceFileCompliance({
			path: "workspace://images/demo.png",
			name: "Demo",
			persistTarget: {
				elementId: "image-1",
				contentId: "content-1",
				sourcePath: "workspace://images/demo.png",
			},
			startWorkspaceMediaCompliance,
		})

		expect(assetId).toBeNull()
		await vi.advanceTimersByTimeAsync(0)
		expect(getAssetComplianceStatus).not.toHaveBeenCalled()
	})

	it("starts library compliance without persisting to document", async () => {
		vi.useFakeTimers()
		const getAssetComplianceStatus = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-lib",
				status: "PROCESSING",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-lib",
				status: "PASS",
				failedReason: null,
			})
		const startExistingAssetCompliance = vi.fn().mockResolvedValue({
			assetId: "unexpected-response-id",
			mediaType: "image",
			fileUrl: null,
		})
		const onSettled = vi.fn()
		const { taskManager, canvas } = createTaskManager({ getAssetComplianceStatus })

		const pollAssetId = await taskManager.startLibraryAssetCompliance(
			{
				assetId: "asset-lib",
				fileKey: "private/demo.png",
				name: "Demo",
				startExistingAssetCompliance,
			},
			onSettled,
		)

		expect(pollAssetId).toBe("asset-lib")
		expect(startExistingAssetCompliance).toHaveBeenCalledWith({
			assetId: "asset-lib",
			fileKey: "private/demo.png",
			name: "Demo",
		})
		expect(canvas.elementManager.update).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(0)
		await vi.advanceTimersByTimeAsync(2500)
		expect(onSettled).toHaveBeenCalledWith({
			assetId: "asset-lib",
			status: "PASS",
			failedReason: null,
		})
	})

	it("deduplicates concurrent existing-asset compliance starts", async () => {
		let resolveStart!: (value: { assetId: string; mediaType: "image"; fileUrl: null }) => void
		const startExistingAssetCompliance = vi.fn(
			() =>
				new Promise<{
					assetId: string
					mediaType: "image"
					fileUrl: null
				}>((resolve) => {
					resolveStart = resolve
				}),
		)
		const { taskManager } = createTaskManager()

		const first = taskManager.startLibraryAssetCompliance({
			assetId: "asset-concurrent",
			fileKey: "private/concurrent.png",
			startExistingAssetCompliance,
		})
		const second = taskManager.startLibraryAssetCompliance({
			assetId: "asset-concurrent",
			fileKey: "private/concurrent.png",
			startExistingAssetCompliance,
		})

		expect(startExistingAssetCompliance).toHaveBeenCalledTimes(1)
		resolveStart({
			assetId: "response-id-must-not-be-used",
			mediaType: "image",
			fileUrl: null,
		})
		await expect(Promise.all([first, second])).resolves.toEqual([
			"asset-concurrent",
			"asset-concurrent",
		])
	})
})
