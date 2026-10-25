import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import VideoSecondEdit from "../VideoSecondEdit"
import { MediaEditRecoveryManager } from "../../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"
import type { VideoElement } from "../../../../../runtime/document/types"
import { VideoElement as VideoElementClass } from "../../../../../runtime/elements/video/VideoElement"
import type { MediaEditorSubmissionController } from "../../shared/useMediaEditorSubmission"

const submissionController: MediaEditorSubmissionController = {
	hidden: false,
	busy: false,
	activeSubmission: null,
	begin: vi.fn(() => "submission-1"),
	setPhase: vi.fn(),
	finish: vi.fn(),
	reveal: vi.fn(),
	run: vi.fn(async ({ execute }) => execute({ submissionId: "submission-1", setPhase: vi.fn() })),
}

const mocks = vi.hoisted(() => ({
	commands: {} as Record<string, { execute: (command?: unknown) => void; state?: unknown }>,
	renderProps: null as null | Record<string, unknown>,
	isReplacing: false,
	canvas: null as null | {
		mediaEditRecoveryManager: MediaEditRecoveryManager
		isSeedanceComplianceEnabled: () => boolean
	},
	videoModelList: [{ model_id: "video-model" }] as Array<Record<string, unknown>>,
	estimateVideoPoints: vi.fn(),
	getCachedVideoPointsEstimate: vi.fn(() => ({ points: 3190 })),
	getVideoPointsEstimate: vi.fn(async () => ({ points: 3190 })),
	confirmVideoGeneration: vi.fn(
		async (options: { points: number | null; onConfirm: () => void | Promise<void> }) =>
			options.onConfirm(),
	),
}))

vi.mock("../../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasUI: () => ({ selectedElements: [{ type: "video", id: "video-1" }] }),
}))

vi.mock("../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({
		methods: { estimateVideoPoints: mocks.estimateVideoPoints },
		videoModelList: mocks.videoModelList,
		getCachedVideoPointsEstimate: mocks.getCachedVideoPointsEstimate,
		getVideoPointsEstimate: mocks.getVideoPointsEstimate,
	}),
}))

vi.mock("../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

vi.mock("../../../../../app/hooks/canvas", () => ({
	useIsMediaReplacing: () => mocks.isReplacing,
}))

vi.mock("../useVideoPointsConfirm", () => ({
	useVideoPointsConfirm: () => mocks.confirmVideoGeneration,
}))

vi.mock("../model-config/video-editor-config.model", async () => {
	const actual = await vi.importActual<
		typeof import("../model-config/video-editor-config.model")
	>("../model-config/video-editor-config.model")
	return {
		...actual,
		resolveVideoReferenceVideoModel: vi.fn(() => ({
			model: { model_id: "video-model" },
			inputMode: "standard",
		})),
	}
})

vi.mock("../../../model/useElementToolCommand", () => ({
	useElementToolCommand: (
		registration: {
			toolId: string
			execute: (command?: unknown) => void
			state?: unknown
		} | null,
	) => {
		if (registration) mocks.commands[registration.toolId] = registration
	},
}))

vi.mock("../VideoGenerateEditorRender", () => ({
	default: (props: Record<string, unknown>) => {
		mocks.renderProps = props
		return null
	},
}))

const videoElement = {
	id: "video-1",
	type: "video",
	contents: [
		{
			contentId: "video-content-1",
			src: "/videos/current.mp4",
			status: "completed",
			generateVideoRequest: { model_id: "video-model", prompt: "saved" },
		},
	],
	activeContentId: "video-content-1",
	mainContentId: "video-content-1",
} as VideoElement

describe("VideoSecondEdit session routing", () => {
	beforeEach(() => {
		mocks.commands = {}
		mocks.renderProps = null
		mocks.isReplacing = false
		mocks.videoModelList = [{ model_id: "video-model" }]
		mocks.estimateVideoPoints.mockClear()
		mocks.getCachedVideoPointsEstimate.mockReset()
		mocks.getCachedVideoPointsEstimate.mockReturnValue({ points: 3190 })
		mocks.getVideoPointsEstimate.mockReset()
		mocks.getVideoPointsEstimate.mockResolvedValue({ points: 3190 })
		mocks.confirmVideoGeneration.mockClear()
		mocks.canvas = {
			mediaEditRecoveryManager: new MediaEditRecoveryManager(),
			isSeedanceComplianceEnabled: () => false,
			mediaReplaceController: { isReplacing: () => mocks.isReplacing },
			canvasFileUploadManager: { shouldDeferRemoteResourceLoad: () => false },
			videoDraftFinalManager: {
				start: vi.fn(async () => true),
			},
			elementManager: {
				getElementInstance: vi.fn(),
				getElementData: vi.fn(() => videoElement),
			},
		} as typeof mocks.canvas
	})

	it("restores the session for the selected intent without crossing quick-edit and re-edit", async () => {
		const store = mocks.canvas?.mediaEditRecoveryManager as MediaEditRecoveryManager | undefined
		if (!store) return
		const sourceFingerprint = "video-content-1:/videos/current.mp4"
		const quickSnapshot = {
			request: { model_id: "video-model", prompt: "quick" },
			modeDrafts: {
				first_last_frame: {
					prompt: "quick frame prompt",
					activeInputTab: "frame",
					frameImageInfos: [{ path: "/images/start.png" }],
					referenceImageInfos: [],
				},
			},
		}
		const reEditSnapshot = {
			request: { model_id: "video-model", prompt: "saved edit" },
			modeDrafts: {},
		}
		store.set(
			{ elementId: "video-1", contentId: "video-content-1", intent: "quick-edit" },
			sourceFingerprint,
			quickSnapshot,
			quickSnapshot,
		)
		store.set(
			{ elementId: "video-1", contentId: "video-content-1", intent: "re-edit" },
			sourceFingerprint,
			reEditSnapshot,
			reEditSnapshot,
		)

		render(
			<VideoSecondEdit
				videoElement={videoElement}
				submissionController={submissionController}
			/>,
		)
		const quickAction = mocks.commands["generation.quick-edit"]
		act(() => quickAction?.execute())
		await waitFor(() => expect(mocks.renderProps?.sessionSnapshot).toEqual(quickSnapshot))
		expect(mocks.renderProps?.sessionIntent).toBe("quick-edit")

		const reEditAction = mocks.commands["generation.re-edit"]
		act(() => reEditAction?.execute())
		await waitFor(() => expect(mocks.renderProps?.sessionSnapshot).toEqual(reEditSnapshot))
		expect(mocks.renderProps?.sessionIntent).toBe("re-edit")
	})

	it("does not restore an interrupted session after the active media source changes", async () => {
		mocks.canvas?.mediaEditRecoveryManager.set(
			{ elementId: "video-1", contentId: "video-content-1", intent: "quick-edit" },
			"video-content-1:/videos/current.mp4",
			{ request: { model_id: "video-model", prompt: "old" }, modeDrafts: {} },
		)

		const view = render(
			<VideoSecondEdit
				videoElement={videoElement}
				submissionController={submissionController}
			/>,
		)
		const changedVideoElement = {
			...videoElement,
			contents: [{ ...videoElement.contents[0], src: "/videos/replaced.mp4" }],
		} as never
		view.rerender(
			<VideoSecondEdit
				videoElement={changedVideoElement}
				submissionController={submissionController}
			/>,
		)

		await waitFor(() => {
			expect(
				mocks.canvas?.mediaEditRecoveryManager.get(
					{ elementId: "video-1", contentId: "video-content-1", intent: "quick-edit" },
					"video-content-1:/videos/replaced.mp4",
				),
			).toBeNull()
		})
	})

	it("keeps current-version generation actions while a sibling version is generating", () => {
		const elementWithGeneratingSibling = {
			...videoElement,
			contents: [
				videoElement.contents[0],
				{ contentId: "video-content-2", status: "processing" },
			],
		} as never

		render(
			<VideoSecondEdit
				videoElement={elementWithGeneratingSibling}
				submissionController={submissionController}
			/>,
		)

		const itemIds = Object.keys(mocks.commands)
		expect(itemIds).toContain("generation.quick-edit")
		expect(itemIds).toContain("generation.re-edit")
		expect(itemIds).toContain("generation.generate-again")
	})

	it("hides all editor actions while the active version is generating", () => {
		const elementWithGeneratingActive = {
			...videoElement,
			contents: [
				{
					...videoElement.contents[0],
					status: "processing",
				},
			],
		} as never

		render(
			<VideoSecondEdit
				videoElement={elementWithGeneratingActive}
				submissionController={submissionController}
			/>,
		)

		expect(mocks.commands["generation.quick-edit"]?.state).toMatchObject({ available: true })
		expect(mocks.commands["generation.re-edit"]?.state).toMatchObject({ available: true })
		expect(mocks.commands["generation.generate-again"]?.state).toMatchObject({
			available: true,
		})
	})

	it("hides re-edit but keeps quick edit and generate-again for a final result", () => {
		const finalVideo = {
			...videoElement,
			contents: [
				{
					...videoElement.contents[0],
					generateVideoRequest: {
						video_id: "final-task",
						model_id: "video-model",
						input_mode: "draft_task",
						task: "generate",
						inputs: { draft_task: { video_id: "draft-task" } },
						generation: { resolution: "1080p" },
					},
				},
			],
		} as never

		render(
			<VideoSecondEdit
				videoElement={finalVideo}
				submissionController={submissionController}
			/>,
		)

		expect(mocks.commands["generation.quick-edit"]?.state).toMatchObject({ available: true })
		expect(mocks.commands["generation.re-edit"]?.state).toMatchObject({ available: false })
		expect(mocks.commands["generation.generate-again"]?.state).toMatchObject({
			available: true,
		})
	})

	it("submits a final generate-again with the same task id that was confirmed", async () => {
		const finalVideo = {
			...videoElement,
			contents: [
				{
					...videoElement.contents[0],
					generateVideoRequest: {
						video_id: "previous-final-task",
						model_id: "video-model",
						input_mode: "draft_task",
						task: "generate",
						inputs: { draft_task: { video_id: "draft-task" } },
						generation: { resolution: "1080p" },
					},
				},
			],
		} as VideoElement
		const instance = Object.create(VideoElementClass.prototype) as VideoElementClass
		const submitContentGeneration = vi
			.fn<VideoElementClass["submitContentGeneration"]>()
			.mockResolvedValue(true)
		instance.submitContentGeneration = submitContentGeneration
		const elementManager = (
			mocks.canvas as typeof mocks.canvas & {
				elementManager: { getElementInstance: ReturnType<typeof vi.fn> }
			}
		)?.elementManager
		elementManager?.getElementInstance.mockReturnValue(instance)

		render(
			<VideoSecondEdit
				videoElement={finalVideo}
				submissionController={submissionController}
			/>,
		)
		await act(async () => mocks.commands["generation.generate-again"]?.execute())

		await waitFor(() => expect(submitContentGeneration).toHaveBeenCalledOnce())
		expect(submitContentGeneration).toHaveBeenCalledWith(
			{
				video_id: expect.any(String),
				model_id: "video-model",
				input_mode: "draft_task",
				task: "generate",
				inputs: { draft_task: { video_id: "draft-task" } },
				generation: { resolution: "1080p" },
			},
			{ preserveVideoId: true },
		)
		expect(submitContentGeneration.mock.calls[0]?.[0].video_id).not.toBe("previous-final-task")
	})

	it("submits the exact confirmed draft-task request through the final manager", async () => {
		mocks.videoModelList = [
			{
				model_id: "video-model",
				video_generation_config: {
					generation: { resolutions: ["480p", "1080p"] },
					input_modes: {
						draft_task: {
							supported_fields: ["draft_task"],
							generation_constraints: { resolutions: ["1080p"] },
						},
					},
				},
			},
		]
		const draftVideo = {
			...videoElement,
			contents: [
				{
					...videoElement.contents[0],
					generateVideoRequest: {
						video_id: "draft-task",
						model_id: "video-model",
						prompt: "server inherits this",
						generation: {
							draft: true,
							resolution: "480p",
							duration_seconds: 5,
						},
					},
				},
			],
		} as never

		render(
			<VideoSecondEdit
				videoElement={draftVideo}
				submissionController={submissionController}
			/>,
		)
		await waitFor(() =>
			expect(mocks.commands["generation.generate-final"]?.state).toMatchObject({
				available: true,
				data: {
					videoGenerationEstimate: {
						resolution: "1080P",
						points: 3190,
					},
				},
			}),
		)
		const generateFinal = mocks.commands["generation.generate-final"]
		await act(async () => generateFinal?.execute())

		await waitFor(() =>
			expect(
				(
					mocks.canvas as typeof mocks.canvas & {
						videoDraftFinalManager: { start: ReturnType<typeof vi.fn> }
					}
				)?.videoDraftFinalManager.start,
			).toHaveBeenCalledOnce(),
		)
		const start = (
			mocks.canvas as typeof mocks.canvas & {
				videoDraftFinalManager: { start: ReturnType<typeof vi.fn> }
			}
		)?.videoDraftFinalManager.start
		expect(mocks.confirmVideoGeneration).toHaveBeenCalledWith({
			points: 3190,
			onConfirm: expect.any(Function),
		})
		expect(start?.mock.calls[0]?.[0]).toEqual({
			sourceElementId: "video-1",
			sourceContentId: "video-content-1",
			request: {
				video_id: expect.any(String),
				model_id: "video-model",
				input_mode: "draft_task",
				task: "generate",
				inputs: { draft_task: { video_id: "draft-task" } },
				generation: { resolution: "1080p" },
			},
		})
	})

	it("allows repeated final generation and uses a new task id for every node", async () => {
		mocks.videoModelList = [
			{
				model_id: "video-model",
				video_generation_config: {
					generation: { resolutions: ["480p", "1080p"] },
					input_modes: {
						draft_task: {
							supported_fields: ["draft_task"],
							generation_constraints: { resolutions: ["1080p"] },
						},
					},
				},
			},
		]
		const draftVideo = {
			...videoElement,
			contents: [
				{
					...videoElement.contents[0],
					generateVideoRequest: {
						video_id: "draft-task",
						model_id: "video-model",
						generation: { draft: true, resolution: "480p" },
					},
				},
			],
		} as never

		render(
			<VideoSecondEdit
				videoElement={draftVideo}
				submissionController={submissionController}
			/>,
		)
		await waitFor(() =>
			expect(mocks.commands["generation.generate-final"]?.state).toMatchObject({
				available: true,
				disabled: false,
			}),
		)
		const start = (
			mocks.canvas as typeof mocks.canvas & {
				videoDraftFinalManager: { start: ReturnType<typeof vi.fn> }
			}
		)?.videoDraftFinalManager.start

		await act(async () => mocks.commands["generation.generate-final"]?.execute())
		await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
		await waitFor(() =>
			expect(mocks.commands["generation.generate-final"]?.state).toMatchObject({
				available: true,
				disabled: false,
			}),
		)
		await act(async () => mocks.commands["generation.generate-final"]?.execute())
		await waitFor(() => expect(start).toHaveBeenCalledTimes(2))

		const firstRequestId = start?.mock.calls[0]?.[0].request.video_id
		const secondRequestId = start?.mock.calls[1]?.[0].request.video_id
		expect(firstRequestId).toEqual(expect.any(String))
		expect(secondRequestId).toEqual(expect.any(String))
		expect(secondRequestId).not.toBe(firstRequestId)
	})
})
