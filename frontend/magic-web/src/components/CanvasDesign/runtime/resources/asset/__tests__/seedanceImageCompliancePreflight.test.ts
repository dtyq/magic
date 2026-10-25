import { afterEach, describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import type { CanvasDesignMethods, GenerateVideoRequest } from "../../../../public/magic-types"
import { assetDetailStore } from "../AssetDetailStore"
import {
	collectSeedanceImageUris,
	isSeedanceModelName,
	resolveSeedanceImageAssetReferences,
	runSeedanceImageCompliancePreflight,
} from "../seedanceImageCompliancePreflight"

function createCanvas(
	methods: Partial<CanvasDesignMethods> = {},
	options?: {
		pollingStatus?: string
		cachedStatus?: string
		elementData?: Map<string, LayerElement>
		upstreamConnections?: Record<string, Array<{ id: string; sourceElementId: string }>>
	},
) {
	const startLibraryAssetCompliance = vi.fn().mockResolvedValue("asset-1")
	const startWorkspaceFileCompliance = vi.fn().mockResolvedValue("asset-workspace")
	const defaultVideo = {
		id: "video-1",
		type: ElementTypeEnum.Video,
		activeContentId: "video-content",
		mainContentId: "video-content",
		contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
	} as unknown as LayerElement
	const getAssetComplianceStatus =
		methods.getAssetComplianceStatus ??
		vi.fn().mockResolvedValue({
			assetId: "asset-1",
			status: options?.pollingStatus ?? "UNVERIFIED",
			failedReason: null,
		})
	const canvas = {
		isSeedanceComplianceEnabled: () => true,
		magicConfigManager: { config: { methods: { ...methods, getAssetComplianceStatus } } },
		assetComplianceTaskManager: {
			startLibraryAssetCompliance,
			startWorkspaceFileCompliance,
			watchCheck: vi.fn(
				(
					assetId: string,
					watchOptions: {
						onUpdate?: (state: unknown) => void
						onSettled?: (state: unknown) => void
						onError?: (error: unknown) => void
					},
				) => {
					let active = true
					void Promise.resolve().then(async () => {
						if (!active) return
						try {
							const state = await getAssetComplianceStatus(assetId)
							if (!active) return
							watchOptions.onUpdate?.(state)
							if ((state as { status?: string }).status !== "PROCESSING") {
								watchOptions.onSettled?.(state)
							}
						} catch (error) {
							watchOptions.onError?.(error)
						}
					})
					return () => {
						active = false
					}
				},
			),
			watchLibraryComplianceChecks: vi.fn(),
		},
		assetCompliancePollingManager: {
			getState: vi.fn(() =>
				options?.pollingStatus
					? { assetId: "asset-1", status: options.pollingStatus, failedReason: null }
					: undefined,
			),
		},
		assetResourceManager: {
			getCachedResource: vi.fn(() =>
				options?.cachedStatus ? { complianceStatus: options.cachedStatus } : undefined,
			),
		},
		connectionManager: {
			getUpstreamConnections: vi.fn(
				(elementId: string) => options?.upstreamConnections?.[elementId] ?? [],
			),
		},
		permissionManager: {
			can: vi.fn(() => true),
		},
		elementManager: {
			getElementData: vi.fn(
				(elementId: string) =>
					options?.elementData?.get(elementId) ??
					(elementId === "video-1" ? defaultVideo : undefined),
			),
		},
	} as unknown as Canvas

	return { canvas, startLibraryAssetCompliance, startWorkspaceFileCompliance }
}

function request(inputs: GenerateVideoRequest["inputs"]): GenerateVideoRequest {
	return { model_id: "model-1", inputs }
}

afterEach(() => {
	assetDetailStore.clearAll()
	vi.restoreAllMocks()
})

describe("Seedance image compliance preflight", () => {
	it.each(["Seedance", "seedance 2.0", "ByteDance/SEEDANCE-2-5", "seedance2.5-pro"])(
		"matches %s",
		(modelName) => {
			expect(isSeedanceModelName(modelName)).toBe(true)
		},
	)

	it.each(["Seedream", "notseedance", "", undefined])("does not match %s", (modelName) => {
		expect(isSeedanceModelName(modelName)).toBe(false)
	})

	it("collects frames and reference images but ignores other inputs and composition", () => {
		expect(
			collectSeedanceImageUris(
				request({
					frames: [{ role: "start", uri: "./images/start.png" }],
					reference_images: [{ uri: "asset://asset-1" }],
					reference_videos: [{ uri: "./videos/ref.mp4" }],
					reference_audios: [{ uri: "./audios/ref.mp3" }],
					mask: { uri: "./images/mask.png" },
				}),
			),
		).toEqual(["./images/start.png", "asset://asset-1"])

		expect(
			collectSeedanceImageUris({
				...request({ reference_images: [{ uri: "asset://asset-1" }] }),
				generation_type: "canvas_composition",
			}),
		).toEqual([])
	})

	it("resolves direct asset references and deduplicates IDs", () => {
		const { canvas } = createCanvas()
		expect(
			resolveSeedanceImageAssetReferences(canvas, "video-1", [
				"asset://asset-1",
				"asset://asset-1",
			]),
		).toEqual([
			{
				uri: "asset://asset-1",
				assetId: "asset-1",
			},
		])
	})

	it("resolves an assetId from a nested Frame source when the child is not top-level", () => {
		const image = {
			id: "nested-image",
			type: ElementTypeEnum.Image,
			activeContentId: "nested-image-content",
			mainContentId: "nested-image-content",
			contents: [
				{
					contentId: "nested-image-content",
					src: "./images/portrait.png",
					assetId: "asset-nested",
				},
			],
		} as unknown as LayerElement
		const frame = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			activeContentId: null,
			mainContentId: null,
			contents: [],
			children: [image],
		} as unknown as LayerElement
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content",
			mainContentId: "video-content",
			contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
		} as unknown as LayerElement
		const { canvas } = createCanvas(
			{},
			{
				elementData: new Map([
					["video-1", video],
					["frame-1", frame],
				]),
				upstreamConnections: {
					"video-1": [{ id: "connection-1", sourceElementId: "frame-1" }],
				},
			},
		)

		expect(
			resolveSeedanceImageAssetReferences(canvas, "video-1", ["./images/portrait.png"]),
		).toEqual([
			{
				uri: "./images/portrait.png",
				assetId: "asset-nested",
				elementId: "nested-image",
				contentId: "nested-image-content",
				sourcePath: "./images/portrait.png",
				name: "portrait",
			},
		])
	})

	it("retains the Canvas target for a connected image without an assetId", () => {
		const image = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content", src: "./images/portrait.png" }],
		} as unknown as LayerElement
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content",
			mainContentId: "video-content",
			contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
		} as unknown as LayerElement
		const { canvas } = createCanvas(
			{},
			{
				elementData: new Map([
					["video-1", video],
					["image-1", image],
				]),
				upstreamConnections: {
					"video-1": [{ id: "connection-1", sourceElementId: "image-1" }],
				},
			},
		)

		expect(
			resolveSeedanceImageAssetReferences(canvas, "video-1", ["./images/portrait.png"]),
		).toEqual([
			{
				uri: "./images/portrait.png",
				elementId: "image-1",
				contentId: "image-content",
				sourcePath: "./images/portrait.png",
				name: "portrait",
			},
		])
	})

	it("starts workspace compliance and binds an unbound connected image before submit", async () => {
		const image = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content", src: "./images/portrait.png" }],
		} as unknown as LayerElement
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content",
			mainContentId: "video-content",
			contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
		} as unknown as LayerElement
		const startWorkspaceMediaCompliance = vi.fn()
		const { canvas, startWorkspaceFileCompliance } = createCanvas(
			{
				ensureAssetAgreementSigned: vi.fn().mockResolvedValue(true),
				startWorkspaceMediaCompliance,
				getAssetComplianceStatus: vi
					.fn()
					.mockResolvedValueOnce({
						assetId: "asset-workspace",
						status: "PROCESSING",
						failedReason: null,
					})
					.mockResolvedValueOnce({
						assetId: "asset-workspace",
						status: "PASS",
						failedReason: null,
					}),
			},
			{
				elementData: new Map([
					["video-1", video],
					["image-1", image],
				]),
				upstreamConnections: {
					"video-1": [{ id: "connection-1", sourceElementId: "image-1" }],
				},
			},
		)
		startWorkspaceFileCompliance.mockImplementation(
			async (params: {
				path: string
				name: string
				persistTarget: { elementId: string; contentId: string; sourcePath: string }
				startWorkspaceMediaCompliance: (input: {
					path: string
					name: string
				}) => Promise<unknown>
			}) => {
				await params.startWorkspaceMediaCompliance({ path: params.path, name: params.name })
				;(image.contents[0] as { assetId?: string }).assetId = "asset-workspace"
				expect(params.persistTarget).toEqual({
					elementId: "image-1",
					contentId: "image-content",
					sourcePath: "./images/portrait.png",
				})
				return "asset-workspace"
			},
		)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "./images/portrait.png" }] }),
				modelName: "Seedance",
			}),
		).resolves.toEqual({ proceed: true })
		expect(startWorkspaceMediaCompliance).toHaveBeenCalledWith({
			path: "./images/portrait.png",
			name: "portrait",
		})
		expect(startWorkspaceFileCompliance).toHaveBeenCalledTimes(1)
		expect((image.contents[0] as { assetId?: string }).assetId).toBe("asset-workspace")
	})

	it("does not restart an unbound workspace image that already FAILED", async () => {
		const image = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [
				{
					contentId: "image-content",
					src: "./images/portrait.png",
					complianceStatus: "FAILED",
					complianceFailedReason: "blocked",
				},
			],
		} as unknown as LayerElement
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content",
			mainContentId: "video-content",
			contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
		} as unknown as LayerElement
		const startWorkspaceMediaCompliance = vi.fn()
		const { canvas, startWorkspaceFileCompliance } = createCanvas(
			{
				ensureAssetAgreementSigned: vi.fn(),
				startWorkspaceMediaCompliance,
			},
			{
				elementData: new Map([
					["video-1", video],
					["image-1", image],
				]),
				upstreamConnections: {
					"video-1": [{ id: "connection-1", sourceElementId: "image-1" }],
				},
			},
		)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "./images/portrait.png" }] }),
				modelName: "Seedance",
			}),
		).resolves.toMatchObject({
			proceed: false,
			reason: "compliance-failed",
			status: "FAILED",
		})
		expect(startWorkspaceFileCompliance).not.toHaveBeenCalled()
		expect(startWorkspaceMediaCompliance).not.toHaveBeenCalled()
	})

	it("does not start compliance when the asset is already PASS", async () => {
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			status: "PASS",
			failedReason: null,
		})
		const methods: Partial<CanvasDesignMethods> = {
			getAssetComplianceStatus,
			startExistingAssetCompliance: vi.fn(),
			ensureAssetAgreementSigned: vi.fn(),
		}
		const { canvas, startLibraryAssetCompliance } = createCanvas(methods)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance 2.5",
			}),
		).resolves.toEqual({ proceed: true })
		expect(getAssetComplianceStatus).toHaveBeenCalledWith("asset-1")
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("waits for an existing PROCESSING asset to pass without restarting it", async () => {
		const getAssetComplianceStatus = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				status: "PROCESSING",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				status: "PASS",
				failedReason: null,
			})
		const ensureAssetAgreementSigned = vi.fn()
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus,
			ensureAssetAgreementSigned,
			startExistingAssetCompliance: vi.fn(),
		})

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance 2.5",
			}),
		).resolves.toEqual({ proceed: true })
		expect(ensureAssetAgreementSigned).not.toHaveBeenCalled()
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("blocks an asset that is already FAILED without restarting it", async () => {
		const getAssetComplianceStatus = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			status: "FAILED",
			failedReason: "blocked",
		})
		const ensureAssetAgreementSigned = vi.fn()
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus,
			ensureAssetAgreementSigned,
			startExistingAssetCompliance: vi.fn(),
		})

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance 2.5",
			}),
		).resolves.toMatchObject({
			proceed: false,
			reason: "compliance-failed",
			status: "FAILED",
		})
		expect(ensureAssetAgreementSigned).not.toHaveBeenCalled()
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("blocks a status response that belongs to another asset", async () => {
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus: vi.fn().mockResolvedValue({
				assetId: "asset-2",
				status: "PASS",
				failedReason: null,
			}),
			startExistingAssetCompliance: vi.fn(),
		})

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance 2.5",
			}),
		).resolves.toEqual({ proceed: false, reason: "compliance-unavailable" })
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("starts unverified assets and waits for PASS before continuing", async () => {
		const getAssetComplianceStatus = vi
			.fn()
			.mockResolvedValueOnce({
				assetId: "asset-1",
				status: "UNVERIFIED",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				status: "PROCESSING",
				failedReason: null,
			})
			.mockResolvedValueOnce({
				assetId: "asset-1",
				status: "PASS",
				failedReason: null,
			})
		const ensureAssetAgreementSigned = vi.fn().mockResolvedValue(true)
		const startExistingAssetCompliance = vi.fn().mockResolvedValue({
			assetId: "different-response-id",
			mediaType: "image",
			fileUrl: null,
		})
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus,
			ensureAssetAgreementSigned,
			startExistingAssetCompliance,
		})
		vi.spyOn(assetDetailStore, "getWithFileKey").mockResolvedValue({
			asset_id: "asset-1",
			file_key: "private/portrait.png",
			name: "Portrait",
			compliance_status: "UNVERIFIED",
		} as never)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "seedance-2-5",
				timeoutMs: 100,
				waitTimeoutMs: 100,
			}),
		).resolves.toEqual({ proceed: true })
		expect(ensureAssetAgreementSigned).toHaveBeenCalledTimes(1)
		expect(startLibraryAssetCompliance).toHaveBeenCalledWith({
			assetId: "asset-1",
			fileKey: "private/portrait.png",
			name: "Portrait",
			startExistingAssetCompliance,
		})
	})

	it("starts when detail is available but has no prior compliance status", async () => {
		const ensureAssetAgreementSigned = vi.fn().mockResolvedValue(true)
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus: vi
				.fn()
				.mockResolvedValueOnce({
					assetId: "asset-1",
					status: "UNVERIFIED",
					failedReason: null,
				})
				.mockResolvedValueOnce({
					assetId: "asset-1",
					status: "PROCESSING",
					failedReason: null,
				})
				.mockResolvedValueOnce({
					assetId: "asset-1",
					status: "PASS",
					failedReason: null,
				}),
			ensureAssetAgreementSigned,
			startExistingAssetCompliance: vi.fn(),
		})
		vi.spyOn(assetDetailStore, "getWithFileKey").mockResolvedValue({
			asset_id: "asset-1",
			file_key: "private/portrait.png",
			name: "Portrait",
		} as never)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance",
				waitTimeoutMs: 100,
			}),
		).resolves.toEqual({ proceed: true })
		expect(ensureAssetAgreementSigned).toHaveBeenCalledTimes(1)
		expect(startLibraryAssetCompliance).toHaveBeenCalledTimes(1)
	})

	it("deduplicates repeated image asset IDs and starts each unique asset in parallel", async () => {
		const startLibraryAssetCompliance = vi.fn().mockResolvedValue("asset")
		const complianceCalls = new Map<string, number>()
		const getAssetComplianceStatus = vi.fn((assetId: string) => {
			const callIndex = complianceCalls.get(assetId) ?? 0
			complianceCalls.set(assetId, callIndex + 1)
			const states = ["UNVERIFIED", "PROCESSING", "PASS"] as const
			return Promise.resolve({
				assetId,
				status: states[Math.min(callIndex, states.length - 1)],
				failedReason: null,
			})
		})
		const ensureAssetAgreementSigned = vi.fn().mockResolvedValue(true)
		const { canvas } = createCanvas({
			getAssetComplianceStatus,
			ensureAssetAgreementSigned,
			startExistingAssetCompliance: vi.fn(),
		})
		canvas.assetComplianceTaskManager.startLibraryAssetCompliance =
			startLibraryAssetCompliance as never
		vi.spyOn(assetDetailStore, "getWithFileKey").mockImplementation(
			async (assetId) =>
				({
					asset_id: assetId,
					file_key: `private/${assetId}.png`,
					compliance_status: "UNVERIFIED",
				}) as never,
		)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({
					reference_images: [
						{ uri: "asset://asset-1" },
						{ uri: "asset://asset-2" },
						{ uri: "asset://asset-1" },
					],
				}),
				modelName: "Seedance",
				waitTimeoutMs: 100,
			}),
		).resolves.toEqual({ proceed: true })
		expect(startLibraryAssetCompliance).toHaveBeenCalledTimes(2)
		expect(
			startLibraryAssetCompliance.mock.calls.map(([params]) => params.assetId).sort(),
		).toEqual(["asset-1", "asset-2"])
	})

	it("cancels submission when the user declines the agreement", async () => {
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus: vi.fn().mockResolvedValue({
				assetId: "asset-1",
				status: "UNVERIFIED",
				failedReason: null,
			}),
			ensureAssetAgreementSigned: vi.fn().mockResolvedValue(false),
			startExistingAssetCompliance: vi.fn(),
		})
		vi.spyOn(assetDetailStore, "getWithFileKey").mockResolvedValue({
			asset_id: "asset-1",
			file_key: "private/portrait.png",
			compliance_status: "UNVERIFIED",
		} as never)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance",
			}),
		).resolves.toEqual({ proceed: false, reason: "agreement-cancelled" })
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("cancels when the agreement gate is unavailable", async () => {
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus: vi.fn().mockResolvedValue({
				assetId: "asset-1",
				status: "UNVERIFIED",
				failedReason: null,
			}),
			startExistingAssetCompliance: vi.fn(),
		})
		vi.spyOn(assetDetailStore, "getWithFileKey").mockResolvedValue({
			asset_id: "asset-1",
			file_key: "private/portrait.png",
			compliance_status: "UNVERIFIED",
		} as never)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance",
			}),
		).resolves.toEqual({ proceed: false, reason: "agreement-error" })
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("cancels after agreement if the source video Content changes while waiting", async () => {
		let resolveAgreement!: (signed: boolean) => void
		const ensureAssetAgreementSigned = vi.fn(
			() => new Promise<boolean>((resolve) => (resolveAgreement = resolve)),
		)
		const video = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			activeContentId: "video-content",
			mainContentId: "video-content",
			contents: [{ contentId: "video-content", src: "./videos/source.mp4" }],
		} as unknown as LayerElement
		const { canvas, startLibraryAssetCompliance } = createCanvas(
			{
				getAssetComplianceStatus: vi.fn().mockResolvedValue({
					assetId: "asset-1",
					status: "UNVERIFIED",
					failedReason: null,
				}),
				ensureAssetAgreementSigned,
				startExistingAssetCompliance: vi.fn(),
			},
			{
				elementData: new Map([["video-1", video]]),
			},
		)
		vi.spyOn(assetDetailStore, "getWithFileKey").mockResolvedValue({
			asset_id: "asset-1",
			file_key: "private/portrait.png",
			compliance_status: "UNVERIFIED",
		} as never)

		const pending = runSeedanceImageCompliancePreflight({
			canvas,
			sourceVideoElementId: "video-1",
			request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
			modelName: "Seedance",
		})
		await vi.waitFor(() => expect(ensureAssetAgreementSigned).toHaveBeenCalledTimes(1))
		;(video as { contents: Array<{ contentId: string; src: string }> }).contents[0].src =
			"./videos/replaced.mp4"
		resolveAgreement(true)

		await expect(pending).resolves.toEqual({ proceed: false, reason: "source-changed" })
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("blocks when status lookup fails", async () => {
		const { canvas, startLibraryAssetCompliance } = createCanvas({
			getAssetComplianceStatus: vi.fn().mockRejectedValue(new Error("offline")),
			ensureAssetAgreementSigned: vi.fn(),
			startExistingAssetCompliance: vi.fn(),
		})

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "asset://asset-1" }] }),
				modelName: "Seedance",
			}),
		).resolves.toEqual({ proceed: false, reason: "compliance-unavailable" })
		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})

	it("does not trigger for a non-Seedance model and blocks unresolved workspace images", async () => {
		const methods: Partial<CanvasDesignMethods> = {
			getAssetComplianceStatus: vi.fn(),
			ensureAssetAgreementSigned: vi.fn(),
			startExistingAssetCompliance: vi.fn(),
		}
		const { canvas, startLibraryAssetCompliance } = createCanvas(methods)

		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "./images/portrait.png" }] }),
				modelName: "Seedream",
			}),
		).resolves.toEqual({ proceed: true })
		await expect(
			runSeedanceImageCompliancePreflight({
				canvas,
				sourceVideoElementId: "video-1",
				request: request({ reference_images: [{ uri: "./images/portrait.png" }] }),
				modelName: "Seedance",
			}),
		).resolves.toEqual({ proceed: false, reason: "compliance-unavailable" })

		expect(startLibraryAssetCompliance).not.toHaveBeenCalled()
	})
})
