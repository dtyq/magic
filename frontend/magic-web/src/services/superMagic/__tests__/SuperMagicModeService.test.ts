import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import {
	MODEL_TYPE_IMAGE,
	MODEL_TYPE_LLM,
	MODEL_TYPE_VIDEO,
} from "@/apis/modules/org-ai-model-provider"
import type { ModeItem } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				user_id: "test-user",
			},
		},
	},
}))

vi.mock("@/utils/storage", () => ({
	platformKey: (value: string) => value,
}))

// In-memory stand-in for the IndexedDB-backed mode list repository so we
// can assert persistence behavior without spinning up fake-indexeddb.
const mockModeListStore = new Map<string, ModeItem[]>()

vi.mock("../repositories/SuperMagicModeListRepository", () => ({
	default: {
		getByKey: vi.fn(async (key: string) => mockModeListStore.get(key)),
		saveByKey: vi.fn((key: string, data: ModeItem[]) => {
			mockModeListStore.set(key, data)
			return Promise.resolve()
		}),
	},
	LEGACY_MODE_LIST_LS_PREFIX: "super_magic/mode_list/",
}))

vi.mock("@/models/config", () => ({
	configStore: {
		i18n: {
			displayLanguage: "zh_CN",
		},
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		isMobile: false,
	},
}))

vi.mock("@/utils/waitPublicConfigInit", () => ({
	waitForLanguageReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getCrewList: vi.fn(),
		getDefaultModeModelList: vi.fn(),
	},
}))

vi.mock("../SuperMagicCustomModelService", () => ({
	default: {
		findMyModelById: vi.fn(async () => null),
		toModelItem: vi.fn((model) => ({
			id: model.id,
			group_id: "",
			model_id: model.model_id,
			model_name: model.name,
			provider_model_id: model.model_id,
			model_description: model.description ?? "",
			model_icon: model.icon ?? "",
			model_status: ModelStatusEnum.Normal,
			sort: 0,
			...(model.video_generation_config
				? { video_generation_config: model.video_generation_config }
				: {}),
		})),
	},
}))

import superMagicModeService from "../SuperMagicModeService"
import superMagicModeListRepository from "../repositories/SuperMagicModeListRepository"
import superMagicCustomModelService from "../SuperMagicCustomModelService"
import { SuperMagicApi } from "@/apis"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"

function createModelItem({
	id,
	modelId,
	name,
}: {
	id: string
	modelId: string
	name: string
}): ModelItem {
	return {
		id,
		group_id: "group-1",
		model_id: modelId,
		model_name: name,
		provider_model_id: modelId,
		model_description: `${name} description`,
		model_icon: "",
		model_status: ModelStatusEnum.Normal,
		sort: 1,
	}
}

function createCrewList(identifier: string) {
	return {
		list: [
			{
				mode: {
					id: identifier,
					name: identifier,
					identifier,
					icon: "",
					color: "",
					icon_url: "",
					icon_type: IconType.Icon,
					sort: 1,
					playbooks: [],
				},
				agent: {
					type: 1,
					category: "frequent",
				},
				groups: [],
			},
		],
		models: {},
	} as any
}

function createModeItem(identifier: string): ModeItem {
	return createCrewList(identifier).list[0] as ModeItem
}

function createRoleStore() {
	return new (roleStore.constructor as new () => typeof roleStore)()
}

function createModeListStorageKey(lang: string) {
	return `super_magic/mode_list/test-org/test-user/${lang}`
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((res) => {
		resolve = res
	})

	return {
		promise,
		resolve,
	}
}

async function flushPendingBootstrap() {
	await Promise.resolve()
	await Promise.resolve()
}

describe("SuperMagicModeService", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	beforeEach(async () => {
		await flushPendingBootstrap()
		vi.clearAllMocks()
		window.history.replaceState({}, "", "/")
		window.localStorage.clear()
		mockModeListStore.clear()
		;(superMagicModeService as any)._legacyMigrationPromise = null
		;(configStore.i18n as any).displayLanguage = "zh_CN"
		userStore.user.organizationCode = "test-org"
		userStore.user.userInfo = {
			user_id: "test-user",
		} as any
		superMagicModeService._modeList = []
		superMagicModeService._defaultAgentCode = undefined
		;(superMagicModeService as any)._isModeAvailabilityResolved = false
		superMagicModeService._modeMap = new Map([
			[
				"general",
				{
					mode: {
						id: "general",
						name: "General",
						identifier: "general",
						icon: "",
						color: "",
						icon_url: "",
						icon_type: IconType.Icon,
						sort: 1,
						playbooks: [],
					},
					agent: {
						type: 1,
						category: "frequent",
					},
					groups: [
						{
							group: {
								id: "group-1",
								mode_id: "general",
								icon: "",
								color: "",
								name: "group",
								description: "",
								sort: 1,
								status: true,
								created_at: "",
							},
							models: [
								createModelItem({
									id: "official-1",
									modelId: "shared-model",
									name: "Official Shared Model",
								}),
							],
							image_models: [
								createModelItem({
									id: "official-image-1",
									modelId: "shared-image-model",
									name: "Official Shared Image Model",
								}),
							],
						},
					],
				},
			],
		]) as any
		;(superMagicModeService as any)._modeListRequestState = {
			promise: null,
			contextKey: null,
		}
		;(superMagicModeService as any)._defaultModeModelRequestState = {
			promise: null,
			contextKey: null,
		}
		;(superMagicModeService as any)._defaultModeModelList = null
		;(superMagicModeService as any)._modeListFreshnessState = {
			lastContextKey: null,
			lastFetchAt: 0,
		}
		;(superMagicModeService as any)._defaultModeModelFreshnessState = {
			lastContextKey: null,
			lastFetchAt: 0,
		}
	})

	it("skips cache hydration before user context is ready", async () => {
		window.localStorage.setItem(
			"super_magic/mode_list/test-org/undefined",
			JSON.stringify([
				{
					mode: {
						identifier: "wrong-cache",
					},
				},
			]),
		)

		userStore.user.userInfo = null as any

		await superMagicModeService.hydrateFromStorage()

		expect(superMagicModeService.modeList).toEqual([])
	})

	it("hydrates cache from the current language key and migrates legacy entries", async () => {
		window.localStorage.setItem(
			createModeListStorageKey("zh_CN"),
			JSON.stringify([
				{
					mode: {
						identifier: "cached-zh",
					},
					groups: [],
				},
			]),
		)
		window.localStorage.setItem(
			createModeListStorageKey("en_US"),
			JSON.stringify([
				{
					mode: {
						identifier: "cached-en",
					},
					groups: [],
				},
			]),
		)

		await superMagicModeService.hydrateFromStorage()

		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("cached-zh")
		// Legacy entries are migrated to IDB and removed from localStorage
		expect(window.localStorage.getItem(createModeListStorageKey("zh_CN"))).toBeNull()
		expect(window.localStorage.getItem(createModeListStorageKey("en_US"))).toBeNull()
		expect(mockModeListStore.has(createModeListStorageKey("zh_CN"))).toBe(true)
		expect(mockModeListStore.has(createModeListStorageKey("en_US"))).toBe(true)
		;(configStore.i18n as any).displayLanguage = "en_US"
		await superMagicModeService.hydrateFromStorage()

		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("cached-en")
	})

	it("hydrates cached default agent together with the mode list", async () => {
		const storageKey = createModeListStorageKey("zh_CN")
		const general = createModeItem("general")
		const agentB = createModeItem("agent-b")
		mockModeListStore.set(storageKey, [general, agentB])
		window.localStorage.setItem(
			"super_magic/default_agent_code/test-org/test-user/zh_CN",
			"agent-b",
		)
		window.localStorage.setItem(
			"super_magic/topic_mode_store",
			JSON.stringify({
				version: 1,
				users: {
					"test-org/test-user": {
						global: "agent-c",
					},
				},
			}),
		)

		await superMagicModeService.hydrateFromStorage(storageKey)
		const store = createRoleStore()

		expect(superMagicModeService.modeList.map((item) => item.mode.identifier)).toEqual([
			"general",
			"agent-b",
		])
		expect(superMagicModeService.defaultAgentCode).toBe("agent-b")
		expect(superMagicModeService.isModeAvailabilityResolved).toBe(true)
		expect(store.currentRole).toBe("agent-b")
	})

	it("prefers custom language model over official model", async () => {
		vi.mocked(superMagicCustomModelService.findMyModelById).mockResolvedValue({
			id: "custom-1",
			name: "Custom Shared Model",
			model_id: "shared-model",
			model_type: MODEL_TYPE_LLM,
			category: "llm",
			service_provider_config_id: "provider-1",
			service_provider_config: {
				id: "provider-1",
				name: "Custom Provider",
			},
			description: "Custom description",
			icon: "custom-icon",
		})

		const resolved = await superMagicModeService.resolveModelByMode({
			mode: "general",
			modelId: "shared-model",
			modelType: MODEL_TYPE_LLM,
		})

		expect(superMagicCustomModelService.findMyModelById).toHaveBeenCalledWith({
			modelId: "shared-model",
			modelType: MODEL_TYPE_LLM,
		})
		expect(resolved?.id).toBe("custom-1")
		expect(resolved?.model_name).toBe("Custom Shared Model")
	})

	it("prefers custom image model over official image model", async () => {
		vi.mocked(superMagicCustomModelService.findMyModelById).mockResolvedValue({
			id: "custom-image-1",
			name: "Custom Shared Image Model",
			model_id: "shared-image-model",
			model_type: MODEL_TYPE_IMAGE,
			category: "vlm",
			service_provider_config_id: "provider-2",
			service_provider_config: {
				id: "provider-2",
				name: "Custom Image Provider",
			},
			description: "Custom image description",
			icon: "custom-image-icon",
		})

		const resolved = await superMagicModeService.resolveModelByMode({
			mode: "general",
			modelId: "shared-image-model",
			modelType: MODEL_TYPE_IMAGE,
		})

		expect(resolved?.id).toBe("custom-image-1")
		expect(resolved?.model_name).toBe("Custom Shared Image Model")
	})

	it("prefers custom video model over official video model", async () => {
		const videoGenerationConfig = {
			supported_inputs: ["text_prompt", "image"],
			generation: {
				aspect_ratios: ["16:9"],
				resolutions: ["720p"],
				durations: [5],
			},
		}
		vi.mocked(superMagicCustomModelService.findMyModelById).mockResolvedValue({
			id: "custom-video-1",
			name: "Custom Shared Video Model",
			model_id: "shared-video-model",
			model_type: MODEL_TYPE_VIDEO,
			category: "vgm",
			service_provider_config_id: "provider-3",
			service_provider_config: {
				id: "provider-3",
				name: "Custom Video Provider",
			},
			description: "Custom video description",
			icon: "custom-video-icon",
			video_generation_config: videoGenerationConfig,
		})

		const resolved = await superMagicModeService.resolveModelByMode({
			mode: "general",
			modelId: "shared-video-model",
			modelType: "video",
		})

		expect(superMagicCustomModelService.findMyModelById).toHaveBeenCalledWith({
			modelId: "shared-video-model",
			modelType: MODEL_TYPE_VIDEO,
		})
		expect(resolved?.id).toBe("custom-video-1")
		expect(resolved?.model_name).toBe("Custom Shared Video Model")
		expect(resolved?.video_generation_config).toEqual(videoGenerationConfig)
	})

	it("uses default model groups to organize all supported image and video models", () => {
		const videoFast = createModelItem({
			id: "video-fast",
			modelId: "seedance-2-fast",
			name: "Seedance 2 Fast",
		})
		const videoPro = createModelItem({
			id: "video-pro",
			modelId: "veo-3-pro",
			name: "Veo 3 Pro",
		})
		const videoExtra = createModelItem({
			id: "video-extra",
			modelId: "new-video-model",
			name: "New Video Model",
		})
		const imageFast = createModelItem({
			id: "image-fast",
			modelId: "image-fast",
			name: "Image Fast",
		})
		const imagePro = createModelItem({
			id: "image-pro",
			modelId: "image-pro",
			name: "Image Pro",
		})

		const createGroup = (
			id: string,
			name: string,
			imageModels: ModelItem[],
			videoModels: ModelItem[],
		) =>
			({
				group: { id, name, sort: 1 },
				models: [],
				model_ids: [],
				image_models: imageModels,
				image_model_ids: imageModels.map((model) => model.id),
				video_models: videoModels,
				video_model_ids: videoModels.map((model) => model.id),
			}) as any

		const dynamicGroup = createGroup(
			"dynamic",
			"测试动态模型",
			[imageFast, imagePro],
			[videoFast, videoPro],
		)
		const extraGroup = createGroup("extra", "扩展-video", [], [videoExtra])
		const defaultVideoFastGroup = createGroup("default-fast", "claude-video", [], [videoFast])
		const defaultVideoProGroup = createGroup("default-pro", "视频", [], [videoPro])
		const defaultImageFastGroup = createGroup(
			"default-image-fast",
			"claude-image",
			[imageFast],
			[],
		)
		const defaultImageProGroup = createGroup("default-image-pro", "图片", [imagePro], [])

		superMagicModeService._modeList = [
			{ groups: [dynamicGroup] },
			{ groups: [extraGroup] },
		] as any
		;(superMagicModeService as any)._modeMap.set(TopicMode.Default, {
			groups: [
				defaultVideoFastGroup,
				defaultVideoProGroup,
				defaultImageFastGroup,
				defaultImageProGroup,
			],
		})

		expect(
			superMagicModeService
				.getAllVideoModelGroups()
				.map((group) => [group.group.name, group.models.map((model) => model.model_id)]),
		).toEqual([
			["claude-video", ["seedance-2-fast"]],
			["视频", ["veo-3-pro"]],
			["扩展-video", ["new-video-model"]],
		])
		expect(
			superMagicModeService
				.getAllImageModelGroups()
				.map((group) => [group.group.name, group.models.map((model) => model.model_id)]),
		).toEqual([
			["claude-image", ["image-fast"]],
			["图片", ["image-pro"]],
		])
	})
	it("prefers the requested mode when it has language models", () => {
		const modeWithModels = superMagicModeService._modeMap.get("general")
		expect(modeWithModels).toBeDefined()
		if (!modeWithModels) return
		superMagicModeService._modeMap.set("micro-app", modeWithModels)

		expect(superMagicModeService.resolveLanguageModelMode("micro-app", "default")).toBe(
			"micro-app",
		)
	})

	it("falls back when the requested mode has no language models", () => {
		superMagicModeService._modeMap.set("micro-app", createCrewList("micro-app").list[0])

		expect(superMagicModeService.resolveLanguageModelMode("micro-app", "default")).toBe(
			"default",
		)
	})

	it("keeps the preferred catalog when any model category is available", () => {
		const modeWithModels = superMagicModeService._modeMap.get("general")
		expect(modeWithModels).toBeDefined()
		if (!modeWithModels) return

		const videoModel = createModelItem({
			id: "official-video-1",
			modelId: "shared-video-model",
			name: "Official Shared Video Model",
		})
		superMagicModeService._modeMap.set("default", {
			...modeWithModels,
			groups: modeWithModels.groups.map((group, index) => ({
				...group,
				video_models: index === 0 ? [videoModel] : [],
			})),
		} as never)
		superMagicModeService._modeMap.set("micro-app", {
			...modeWithModels,
			groups: modeWithModels.groups.map((group) => ({
				...group,
				image_models: [],
				video_models: [],
			})),
		} as never)

		expect(superMagicModeService.resolveModelSelectionMode("micro-app", "default")).toBe(
			"micro-app",
		)
	})

	it("keeps the preferred catalog when only image models are available", () => {
		const modeWithModels = superMagicModeService._modeMap.get("general")
		expect(modeWithModels).toBeDefined()
		if (!modeWithModels) return

		superMagicModeService._modeMap.set("micro-app", {
			...modeWithModels,
			groups: modeWithModels.groups.map((group) => ({
				...group,
				models: [],
				video_models: [],
			})),
		} as never)

		expect(superMagicModeService.resolveModelSelectionMode("micro-app", "default")).toBe(
			"micro-app",
		)
	})

	it("keeps the preferred catalog when only video models are available", () => {
		const modeWithModels = superMagicModeService._modeMap.get("general")
		expect(modeWithModels).toBeDefined()
		if (!modeWithModels) return

		superMagicModeService._modeMap.set("micro-app", {
			...modeWithModels,
			groups: modeWithModels.groups.map((group) => ({
				...group,
				models: [],
				image_models: [],
				video_models: [
					createModelItem({
						id: "official-video-1",
						modelId: "shared-video-model",
						name: "Official Shared Video Model",
					}),
				],
			})),
		} as never)

		expect(superMagicModeService.resolveModelSelectionMode("micro-app", "default")).toBe(
			"micro-app",
		)
	})

	it("falls back only when the preferred catalog has no models", () => {
		superMagicModeService._modeMap.set("micro-app", createCrewList("micro-app").list[0])

		expect(superMagicModeService.resolveModelSelectionMode("micro-app", "default")).toBe(
			"default",
		)
	})

	it("fetches again when force is true despite fresh cache", async () => {
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			list: [
				{
					mode: {
						id: "general",
						name: "General",
						identifier: "general",
						icon: "",
						color: "",
						icon_url: "",
						icon_type: IconType.Icon,
						sort: 1,
						playbooks: [],
					},
					agent: {
						type: 1,
						category: "frequent",
					},
					groups: [],
				},
			],
			models: {},
		} as any)
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList()
		await superMagicModeService.fetchModeList({ force: true })

		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(2)
	})

	it("stores default_agent_code returned by the featured endpoint", async () => {
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			...createCrewList("general"),
			default_agent_code: "general",
		})
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList({ force: true })

		expect(superMagicModeService.defaultAgentCode).toBe("general")
		await vi.waitFor(() => {
			expect(
				window.localStorage.getItem(
					"super_magic/default_agent_code/test-org/test-user/zh_CN",
				),
			).toBe("general")
		})
	})

	it("reconciles stored C to configured default B after featured refresh removes C", async () => {
		const general = createModeItem("general")
		const agentB = createModeItem("agent-b")
		const agentC = createModeItem("agent-c")
		superMagicModeService._modeList = [general, agentB, agentC]
		superMagicModeService._modeMap = new Map(
			superMagicModeService._modeList.map((item) => [item.mode.identifier, item]),
		)
		superMagicModeService._defaultAgentCode = "agent-b"
		window.localStorage.setItem(
			"super_magic/topic_mode_store",
			JSON.stringify({
				version: 1,
				users: {
					"test-org/test-user": {
						global: "agent-c",
					},
				},
			}),
		)
		const store = createRoleStore()
		expect(store.currentRole).toBe("agent-c")

		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			list: [general, agentB],
			models: {},
			default_agent_code: "agent-b",
		} as any)
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList({ force: true })

		expect(store.currentRole).toBe("agent-b")
	})

	it("reconciles a stored mode after an authoritative empty response", async () => {
		window.localStorage.setItem(
			"super_magic/topic_mode_store",
			JSON.stringify({
				version: 1,
				users: {
					"test-org/test-user": {
						global: "agent-c",
					},
				},
			}),
		)
		const store = createRoleStore()

		expect(store.currentRole).toBe("agent-c")

		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			list: [],
			total: 0,
			models: {},
		})

		await superMagicModeService.fetchModeList({ force: true })

		expect(superMagicModeService.isModeAvailabilityResolved).toBe(true)
		expect(store.currentRole).toBe("general")
	})

	it("uses featured is_visible when checking whether a mode can be selected", async () => {
		const response = createCrewList("hidden-agent")
		response.list[0].agent.is_visible = false
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(response)
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList({ force: true })

		expect(superMagicModeService.isModeValid("hidden-agent")).toBe(true)
		expect(superMagicModeService.isModeVisible("hidden-agent")).toBe(false)
	})

	it("keeps the internal micro-app mode available without a crew-list entry", () => {
		superMagicModeService._modeMap.clear()

		expect(superMagicModeService.isModeValid(TopicMode.MicroApp)).toBe(true)
	})

	it("reuses fresh mode list in the same user context", async () => {
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			list: [
				{
					mode: {
						id: "general",
						name: "General",
						identifier: "general",
						icon: "",
						color: "",
						icon_url: "",
						icon_type: IconType.Icon,
						sort: 1,
						playbooks: [],
					},
					agent: {
						type: 1,
						category: "frequent",
					},
					groups: [],
				},
			],
			models: {},
		} as any)
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList()
		await superMagicModeService.fetchModeList()

		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(1)
	})

	it("does not auto-fetch default mode models after featured list refresh", async () => {
		window.history.replaceState({}, "", "/?__smModeDiag=skip-default-model")
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(createCrewList("general"))
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList()

		expect(SuperMagicApi.getDefaultModeModelList).not.toHaveBeenCalled()
	})

	it("temporary skip-storage diagnostic bypasses mode cache hydration", async () => {
		window.history.replaceState({}, "", "/?__smModeDiag=skip-storage")
		window.localStorage.setItem(
			createModeListStorageKey("zh_CN"),
			JSON.stringify([{ mode: { identifier: "cached-zh" }, groups: [] }]),
		)

		await superMagicModeService.hydrateFromStorage()

		expect(superMagicModeService.modeList).toEqual([])
		expect(mockModeListStore.has(createModeListStorageKey("zh_CN"))).toBe(false)
		expect(window.localStorage.getItem(createModeListStorageKey("zh_CN"))).not.toBeNull()
	})

	it("temporary skip-persist diagnostic keeps fetched mode list out of storage", async () => {
		window.history.replaceState({}, "", "/?__smModeDiag=skip-persist")
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(createCrewList("general"))
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList()

		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("general")
		expect(mockModeListStore.has(createModeListStorageKey("zh_CN"))).toBe(false)
	})

	it("temporary skip-bootstrap diagnostic bypasses mode bootstrap IO", async () => {
		window.history.replaceState({}, "", "/?__smModeDiag=skip-bootstrap")
		window.localStorage.setItem(
			createModeListStorageKey("zh_CN"),
			JSON.stringify([{ mode: { identifier: "cached-zh" }, groups: [] }]),
		)
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(createCrewList("general"))
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.hydrateFromStorage()
		const result = await superMagicModeService.fetchModeList()
		await superMagicModeService.fetchDefaultModeModelList({ force: true })
		await superMagicModeService.migrateLegacyLocalStorage()
		await superMagicModeService.persistToStorage(
			createCrewList("general").list,
			createModeListStorageKey("zh_CN"),
		)

		expect(result).toEqual([])
		expect(superMagicModeService.modeList).toEqual([])
		expect(SuperMagicApi.getCrewList).not.toHaveBeenCalled()
		expect(SuperMagicApi.getDefaultModeModelList).not.toHaveBeenCalled()
		expect(mockModeListStore.has(createModeListStorageKey("zh_CN"))).toBe(false)
		expect(window.localStorage.getItem(createModeListStorageKey("zh_CN"))).not.toBeNull()
	})

	it("treats empty crew list as successful refresh and clears cached state", async () => {
		const cachedResponse = createCrewList("stale-mode")
		superMagicModeService._modeList = cachedResponse.list
		superMagicModeService._defaultAgentCode = "stale-agent"
		superMagicModeService._modeMap = new Map([
			[cachedResponse.list[0].mode.identifier, cachedResponse.list[0]],
		]) as unknown as typeof superMagicModeService._modeMap
		mockModeListStore.set(createModeListStorageKey("zh_CN"), cachedResponse.list)

		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue({
			list: [],
			total: 0,
			models: {},
		})

		const result = await superMagicModeService.fetchModeList()

		expect(result).toEqual([])
		expect(superMagicModeService.modeList).toEqual([])
		expect(superMagicModeService.defaultAgentCode).toBeUndefined()
		expect(mockModeListStore.get(createModeListStorageKey("zh_CN"))).toEqual([])
		expect(superMagicModeService._retryTimer).toBeNull()
		expect(SuperMagicApi.getDefaultModeModelList).not.toHaveBeenCalled()
	})

	it("returns cached list and retries in background", async () => {
		vi.useFakeTimers()

		vi.mocked(SuperMagicApi.getCrewList)
			.mockRejectedValueOnce(new Error("temporary failure"))
			.mockResolvedValueOnce({
				list: [
					{
						mode: {
							id: "writer",
							name: "Writer",
							identifier: "writer",
							icon: "",
							color: "",
							icon_url: "",
							icon_type: IconType.Icon,
							sort: 1,
							playbooks: [],
						},
						agent: {
							type: 1,
							category: "frequent",
						},
						groups: [],
					},
				],
				models: {},
			} as any)
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		const cachedList = superMagicModeService.modeList
		const result = await superMagicModeService.fetchModeList()

		expect(result).toBe(cachedList)
		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(1)

		await vi.runOnlyPendingTimersAsync()

		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(2)
		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("writer")
	})

	it("does not reuse or persist stale responses across language changes", async () => {
		const zhRequest = createDeferred<any>()

		vi.mocked(SuperMagicApi.getCrewList)
			.mockReturnValueOnce(zhRequest.promise)
			.mockResolvedValueOnce({
				...createCrewList("en-mode"),
				default_agent_code: "en-mode",
			})
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		const firstFetchPromise = superMagicModeService.fetchModeList()
		await flushPendingBootstrap()
		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(1)
		superMagicModeService._defaultAgentCode = "previous-agent"
		;(configStore.i18n as any).displayLanguage = "en_US"
		await flushPendingBootstrap()

		const secondFetchPromise = superMagicModeService.fetchModeList()
		await flushPendingBootstrap()
		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(2)

		await secondFetchPromise

		zhRequest.resolve({
			...createCrewList("zh-mode"),
			default_agent_code: "zh-mode",
		})
		await firstFetchPromise

		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("en-mode")
		expect(superMagicModeService.defaultAgentCode).toBe("en-mode")
		expect(mockModeListStore.has(createModeListStorageKey("zh_CN"))).toBe(false)
		expect(mockModeListStore.get(createModeListStorageKey("en_US"))?.[0]?.mode.identifier).toBe(
			"en-mode",
		)
		expect((superMagicModeService as any)._modeListFreshnessState.lastContextKey).toBe(
			"test-org:test-user:en_US",
		)
	})

	it("reuses fresh default mode models in the same user context", async () => {
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchDefaultModeModelList()
		await superMagicModeService.fetchDefaultModeModelList()

		expect(SuperMagicApi.getDefaultModeModelList).toHaveBeenCalledTimes(1)
	})

	it.each(["cached", "missing", "invalid", "storage-error"])(
		"keeps the micro-app model catalog when %s crew cache hydration finishes later",
		async (cacheState) => {
			const cachedCrewList = createCrewList("general").list
			const pendingCache = createDeferred<ModeItem[] | undefined>()
			if (cacheState === "invalid") {
				window.localStorage.setItem(createModeListStorageKey("zh_CN"), "{}")
			}
			if (cacheState === "storage-error") {
				vi.mocked(superMagicModeListRepository.getByKey).mockImplementationOnce(
					async () => {
						await pendingCache.promise
						throw new Error("Cache unavailable")
					},
				)
			} else {
				vi.mocked(superMagicModeListRepository.getByKey).mockReturnValueOnce(
					pendingCache.promise,
				)
			}
			const model = createModelItem({
				id: "default-1",
				modelId: "default-model",
				name: "Default Model",
			})
			const group = superMagicModeService._modeMap.get("general")?.groups[0].group
			if (!group) throw new Error("Missing model group fixture")
			vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
				...createModeItem(TopicMode.Default),
				groups: [
					{
						group,
						model_ids: [model.model_id],
						image_model_ids: [model.model_id],
						video_model_ids: [model.model_id],
					},
				],
				models: { [model.model_id]: model },
			})
			vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(createCrewList("general"))

			// Page mount loads default models independently of the slower crew cache read.
			const hydration = superMagicModeService.hydrateFromStorage()
			await flushPendingBootstrap()
			await superMagicModeService.fetchDefaultModeModelList({ force: true })
			expect(superMagicModeService.getModelListByMode(TopicMode.Default)).toEqual([model])

			pendingCache.resolve(cacheState === "cached" ? cachedCrewList : undefined)
			await hydration
			await superMagicModeService.fetchModeList()
			await superMagicModeService.fetchDefaultModeModelList()

			// A fresh default response must remain reachable by the editor after hydration.
			expect(superMagicModeService.getModelListByMode(TopicMode.Default)).toEqual([model])
			expect(superMagicModeService.getImageModelListByMode(TopicMode.Default)).toEqual([
				model,
			])
			expect(superMagicModeService.getVideoModelListByMode(TopicMode.Default)).toEqual([
				model,
			])
			expect(SuperMagicApi.getDefaultModeModelList).toHaveBeenCalledTimes(1)
		},
	)

	it.each(["language", "organization", "user"])(
		"does not retain the previous default catalog after a %s change",
		async (contextField) => {
			vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
				...createModeItem(TopicMode.Default),
				groups: [],
				models: {},
			})
			await superMagicModeService.fetchDefaultModeModelList()
			expect(superMagicModeService._modeMap.has(TopicMode.Default)).toBe(true)

			if (contextField === "language") configStore.i18n.displayLanguage = "en_US"
			if (contextField === "organization") userStore.user.organizationCode = "other-org"
			if (contextField === "user") {
				if (!userStore.user.userInfo) throw new Error("Missing user fixture")
				userStore.user.userInfo.user_id = "other-user"
			}
			await superMagicModeService.hydrateFromStorage()

			expect(superMagicModeService._modeMap.has(TopicMode.Default)).toBe(false)
		},
	)

	it("refetches default models after returning to a previous context", async () => {
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			...createModeItem(TopicMode.Default),
			groups: [],
			models: {},
		})
		await superMagicModeService.fetchDefaultModeModelList()
		configStore.i18n.displayLanguage = "en_US"
		await superMagicModeService.hydrateFromStorage()
		configStore.i18n.displayLanguage = "zh_CN"
		await superMagicModeService.hydrateFromStorage()
		await superMagicModeService.fetchDefaultModeModelList()

		expect(SuperMagicApi.getDefaultModeModelList).toHaveBeenCalledTimes(2)
		expect(superMagicModeService._modeMap.has(TopicMode.Default)).toBe(true)
	})

	it.each(["resolved", "rejected"])(
		"ignores a %s cache read from the previous context",
		async (result) => {
			const pendingCache = createDeferred<ModeItem[] | undefined>()
			vi.mocked(superMagicModeListRepository.getByKey).mockImplementationOnce(async () => {
				await pendingCache.promise
				if (result === "rejected") throw new Error("Old cache unavailable")
				return createCrewList("old-crew").list
			})
			const hydration = superMagicModeService.hydrateFromStorage()
			await flushPendingBootstrap()
			configStore.i18n.displayLanguage = "en_US"
			mockModeListStore.set(
				createModeListStorageKey("en_US"),
				createCrewList("new-crew").list,
			)
			await superMagicModeService.hydrateFromStorage()
			pendingCache.resolve(undefined)
			await hydration

			expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("new-crew")
		},
	)

	it("migrates and cleans localStorage entries from other organizations", async () => {
		const foreignKey = "super_magic/mode_list/other-org/other-user/zh_CN"
		const currentKey = createModeListStorageKey("zh_CN")

		window.localStorage.setItem(
			foreignKey,
			JSON.stringify([{ mode: { identifier: "foreign-cache" }, groups: [] }]),
		)
		window.localStorage.setItem(
			currentKey,
			JSON.stringify([{ mode: { identifier: "current-cache" }, groups: [] }]),
		)

		await superMagicModeService.migrateLegacyLocalStorage()

		expect(window.localStorage.getItem(foreignKey)).toBeNull()
		expect(window.localStorage.getItem(currentKey)).toBeNull()
		expect(mockModeListStore.get(foreignKey)?.[0]?.mode.identifier).toBe("foreign-cache")
		expect(mockModeListStore.get(currentKey)?.[0]?.mode.identifier).toBe("current-cache")
	})

	it("refetches default mode models when force is true", async () => {
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchDefaultModeModelList()
		await superMagicModeService.fetchDefaultModeModelList({ force: true })

		expect(SuperMagicApi.getDefaultModeModelList).toHaveBeenCalledTimes(2)
	})
})
