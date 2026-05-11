import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import { MODEL_TYPE_IMAGE, MODEL_TYPE_LLM } from "@/apis/modules/org-ai-model-provider"
import type { ModeItem } from "@/pages/superMagic/pages/Workspace/types"

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
		})),
	},
}))

import superMagicModeService from "../SuperMagicModeService"
import superMagicCustomModelService from "../SuperMagicCustomModelService"
import { SuperMagicApi } from "@/apis"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"

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

describe("SuperMagicModeService", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	beforeEach(() => {
		vi.clearAllMocks()
		window.localStorage.clear()
		mockModeListStore.clear()
		;(superMagicModeService as any)._legacyMigrationPromise = null
		;(configStore.i18n as any).displayLanguage = "zh_CN"
		userStore.user.organizationCode = "test-org"
		userStore.user.userInfo = {
			user_id: "test-user",
		} as any
		superMagicModeService._modeList = []
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
		vi.mocked(SuperMagicApi.getCrewList).mockResolvedValue(createCrewList("general"))
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		await superMagicModeService.fetchModeList()

		expect(SuperMagicApi.getDefaultModeModelList).not.toHaveBeenCalled()
	})

	it("treats empty crew list as successful refresh and clears cached state", async () => {
		const cachedResponse = createCrewList("stale-mode")
		superMagicModeService._modeList = cachedResponse.list
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
			.mockResolvedValueOnce(createCrewList("en-mode"))
		vi.mocked(SuperMagicApi.getDefaultModeModelList).mockResolvedValue({
			groups: [],
			models: {},
		} as any)

		const firstFetchPromise = superMagicModeService.fetchModeList()

		;(configStore.i18n as any).displayLanguage = "en_US"

		const secondFetchPromise = superMagicModeService.fetchModeList()
		expect(SuperMagicApi.getCrewList).toHaveBeenCalledTimes(2)

		await secondFetchPromise

		zhRequest.resolve(createCrewList("zh-mode"))
		await firstFetchPromise

		expect(superMagicModeService.modeList[0]?.mode.identifier).toBe("en-mode")
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
