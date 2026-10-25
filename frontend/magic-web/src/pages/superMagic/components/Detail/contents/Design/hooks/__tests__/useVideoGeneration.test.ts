import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MODEL_TYPE_VIDEO } from "@/apis/modules/org-ai-model-provider"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import superMagicCustomModelService from "@/services/superMagic/SuperMagicCustomModelService"
import { useVideoGeneration } from "../useVideoGeneration"

const { generateVideo } = vi.hoisted(() => ({
	generateVideo: vi.fn(async (request: unknown) => request),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		generateVideo,
	},
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		fetchModeList: vi.fn(async () => []),
		fetchDefaultModeModelList: vi.fn(async () => undefined),
		getAllVideoModelGroups: vi.fn(),
	},
}))

vi.mock("@/services/superMagic/SuperMagicCustomModelService", () => ({
	default: {
		getMyModelsByType: vi.fn(async () => []),
	},
}))

function createGroup(id: string, name: string, modelId: string) {
	return {
		group: { id, name, icon: `${id}-icon`, sort: 1 },
		models: [
			{
				model_id: modelId,
				model_name: modelId,
				group_id: id,
			},
		],
	}
}

describe("useVideoGeneration model grouping", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("submits a self-contained composition request with project-absolute paths", async () => {
		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				topicId: "topic-1",
				designProjectBasePath: "新建画布",
				currentFile: { id: "design-1", name: "新建画布.magic" },
				flatAttachments: [
					{
						file_id: "design-1",
						file_name: "新建画布.magic",
						relative_file_path: "新建画布/新建画布.magic",
					},
				],
				updateAttachments: vi.fn(),
			}),
		)

		await result.current.generateVideo({
			generation_type: "canvas_composition",
			topic_id: "topic-1",
			generation: {
				aspect_ratio: "9:16",
				resolution: "480p",
				duration_seconds: 4,
			},
			composition: {
				videos: [{ path: "./videos/a.mp4" }, { path: "./videos/b.mp4" }],
				audios: [{ path: "./audios/b.mp3" }],
			},
		})

		expect(generateVideo).toHaveBeenCalledWith({
			project_id: "project-1",
			generation_type: "canvas_composition",
			file_dir: "/新建画布/videos/",
			generation: {
				aspect_ratio: "9:16",
				resolution: "480p",
				duration_seconds: 4,
			},
			composition: {
				videos: [{ path: "/新建画布/videos/a.mp4" }, { path: "/新建画布/videos/b.mp4" }],
				audios: [{ path: "/新建画布/audios/b.mp3" }],
			},
		})
	})

	it("keeps the draft flag nested under generation", async () => {
		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				updateAttachments: vi.fn(),
			}),
		)

		await result.current.generateVideo({
			model_id: "doubao-seedance-2-5-260xxx",
			prompt: "make a draft video",
			generation: { draft: true },
		})

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				project_id: "project-1",
				generation: { draft: true },
			}),
		)
	})

	it("preserves a draft task id and normalizes only its uri fallback", async () => {
		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				topicId: "topic-1",
				designProjectBasePath: "新建画布",
				updateAttachments: vi.fn(),
			}),
		)

		await result.current.generateVideo({
			video_id: "final-video-id",
			model_id: "seedance-model",
			input_mode: "draft_task",
			task: "generate",
			inputs: {
				draft_task: {
					video_id: "draft-video-id",
					uri: "./videos/draft.mp4",
				},
			},
			generation: { resolution: "1080p" },
		})

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				video_id: "final-video-id",
				input_mode: "draft_task",
				inputs: {
					draft_task: {
						video_id: "draft-video-id",
						uri: "/新建画布/videos/draft.mp4",
					},
				},
				generation: { resolution: "1080p" },
			}),
		)
	})

	it("preserves a canonical asset path in a composition request", async () => {
		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				designProjectBasePath: "新建画布",
				currentFile: { id: "design-1", name: "新建画布.magic" },
				flatAttachments: [
					{
						file_id: "design-1",
						file_name: "新建画布.magic",
						relative_file_path: "新建画布/新建画布.magic",
					},
				],
				updateAttachments: vi.fn(),
			}),
		)

		await result.current.generateVideo({
			generation_type: "canvas_composition",
			composition: {
				videos: [{ path: " ASSET://video-id " }],
			},
		})

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				composition: {
					videos: [{ path: "asset://video-id" }],
				},
			}),
		)
	})

	it.each(["asset:/video-id", "asset://", "asset://video/id"])(
		"rejects malformed asset path %s before submitting",
		async (path) => {
			const { result } = renderHook(() =>
				useVideoGeneration({
					projectId: "project-1",
					designProjectBasePath: "新建画布",
					currentFile: { id: "design-1", name: "新建画布.magic" },
					flatAttachments: [
						{
							file_id: "design-1",
							file_name: "新建画布.magic",
							relative_file_path: "新建画布/新建画布.magic",
						},
					],
					updateAttachments: vi.fn(),
				}),
			)

			await expect(
				result.current.generateVideo({
					generation_type: "canvas_composition",
					composition: { videos: [{ path }] },
				}),
			).rejects.toThrow("design.errors.designResourcePathUnresolved")
			expect(generateVideo).not.toHaveBeenCalled()
		},
	)

	it("loads all supported models independently of the active topic", async () => {
		vi.mocked(superMagicModeService.getAllVideoModelGroups).mockReturnValue([
			createGroup("claude-video", "claude-video", "seedance-2-fast"),
			createGroup("video", "视频", "ke"),
		] as never)

		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				updateAttachments: vi.fn(),
			}),
		)

		await expect(result.current.getVideoModelList()).resolves.toEqual([
			expect.objectContaining({
				model_id: "seedance-2-fast",
				model_group: expect.objectContaining({ id: "claude-video", name: "claude" }),
			}),
			expect.objectContaining({
				model_id: "ke",
				model_group: expect.objectContaining({ id: "video", name: "视频" }),
			}),
		])
		expect(superMagicModeService.fetchModeList).toHaveBeenCalledWith({ force: false })
		expect(superMagicModeService.fetchDefaultModeModelList).toHaveBeenCalledWith({
			force: false,
		})
		expect(superMagicModeService.getAllVideoModelGroups).toHaveBeenCalledTimes(1)
	})

	it("includes personal video models in the canvas model list", async () => {
		vi.mocked(superMagicModeService.getAllVideoModelGroups).mockReturnValue([])
		const videoGenerationConfig = {
			supported_inputs: ["text_prompt", "image", "reference_images"],
			generation: {
				aspect_ratios: ["16:9"],
				resolutions: ["720p"],
				durations: [5],
			},
			input_modes: {
				standard: { supported_fields: [] },
			},
		}
		vi.mocked(superMagicCustomModelService.getMyModelsByType).mockResolvedValue([
			{
				id: "custom-video-1",
				name: "MiniMax-H3",
				model_id: "minimax-h3",
				model_type: MODEL_TYPE_VIDEO,
				category: "vgmm",
				service_provider_config_id: "provider-1",
				service_provider_config: { id: "provider-1", name: "自定义服务商" },
				video_generation_config: videoGenerationConfig,
			},
		])

		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				updateAttachments: vi.fn(),
			}),
		)

		await expect(result.current.getVideoModelList()).resolves.toEqual([
			expect.objectContaining({
				model_id: "minimax-h3",
				model_name: "MiniMax-H3",
				model_source: "custom",
				model_group: expect.objectContaining({ source: "custom" }),
				video_generation_config: videoGenerationConfig,
			}),
		])
		expect(superMagicCustomModelService.getMyModelsByType).toHaveBeenCalledWith(
			MODEL_TYPE_VIDEO,
		)
	})

	it("prefers the provider entry with video generation config for duplicate model ids", async () => {
		vi.mocked(superMagicModeService.getAllVideoModelGroups).mockReturnValue([])
		const videoGenerationConfig = {
			supported_inputs: ["text_prompt", "image"],
			generation: {
				aspect_ratios: ["16:9"],
				resolutions: ["768p"],
				durations: { min: 4, max: 15, step: 1 },
			},
			input_modes: {
				standard: { supported_fields: [] },
			},
		}
		vi.mocked(superMagicCustomModelService.getMyModelsByType).mockResolvedValue([
			{
				id: "custom-video-without-config",
				name: "MiniMax-H3",
				model_id: "minimax-h3",
				model_type: MODEL_TYPE_VIDEO,
				category: "vgmm",
				service_provider_config_id: "provider-without-config",
				service_provider_config: {
					id: "provider-without-config",
					name: "空配置服务商",
				},
				video_generation_config: null,
			},
			{
				id: "custom-video-with-config",
				name: "MiniMax-H3",
				model_id: "minimax-h3",
				model_type: MODEL_TYPE_VIDEO,
				category: "vgmm",
				service_provider_config_id: "provider-with-config",
				service_provider_config: {
					id: "provider-with-config",
					name: "完整配置服务商",
				},
				video_generation_config: videoGenerationConfig,
			},
		])

		const { result } = renderHook(() =>
			useVideoGeneration({
				projectId: "project-1",
				updateAttachments: vi.fn(),
			}),
		)

		await expect(result.current.getVideoModelList()).resolves.toEqual([
			expect.objectContaining({
				id: "custom-video-with-config",
				model_id: "minimax-h3",
				video_generation_config: videoGenerationConfig,
			}),
		])
	})
})
