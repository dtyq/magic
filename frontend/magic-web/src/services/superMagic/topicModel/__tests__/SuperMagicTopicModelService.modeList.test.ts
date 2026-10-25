import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import superMagicTopicModelCacheService from "../SuperMagicTopicModelCacheService"
import superMagicTopicModelService from "../SuperMagicTopicModelService"

/**
 * The workspace home ("/chat") composer resolves its model through the four-level
 * cascade, and every level below "Topic" is keyed by the mode — the models themselves
 * come from the featured crew list.
 *
 * A brand-new account has nothing to hydrate from storage, so the composer's cascade
 * can start before that list lands. These tests pin the contract that the cascade must
 * not settle while the list is still unknown, because settling empty clears `isLoading`
 * and leaves `isLanguageModelReady` false: the send button stays disabled, which is
 * exactly what blocks the onboarding "first AI work" step after its case prompt is
 * filled in.
 */

const modeListState = {
	models: [] as ModelItem[],
	fetchCalls: 0,
	resolved: false,
}

const homeModel: ModelItem = {
	id: "home-model",
	group_id: "group-1",
	model_id: "home-model",
	model_name: "Home model",
	provider_model_id: "home-model",
	model_description: "",
	model_icon: "",
	model_status: ModelStatusEnum.Normal,
	sort: 1,
}

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSuperMagicTopicModel: vi.fn(),
		saveSuperMagicTopicModel: vi.fn(),
		getCrewList: vi.fn(),
		getDefaultModeModelList: vi.fn(),
	},
}))

vi.mock("../SuperMagicTopicModelCacheService", () => ({
	default: {
		getDefaultModel: vi.fn(),
		getModeDefaultModel: vi.fn(),
		getTopicModel: vi.fn(),
		getProjectModel: vi.fn(),
		saveTopicModel: vi.fn(),
		saveProjectModel: vi.fn(),
		saveModeDefaultModel: vi.fn(),
	},
}))

/**
 * Only the mode-list lifecycle is faked; the cascade below it runs for real. The stub
 * mirrors the real service: `getModelListByMode` stays empty until the crew list has
 * been fetched, and fetching it is what publishes both the models and the availability.
 */
vi.mock("../../SuperMagicModeService", () => ({
	default: {
		getModelListByMode: vi.fn(() => modeListState.models),
		getImageModelListByMode: vi.fn(() => []),
		getVideoModelListByMode: vi.fn(() => []),
		resolveLanguageModelByMode: vi.fn(
			async (_mode: string, modelId?: string | null) =>
				modeListState.models.find((model) => model.model_id === modelId) ?? null,
		),
		resolveImageModelByMode: vi.fn(async () => null),
		resolveVideoModelByMode: vi.fn(async () => null),
		fetchModeList: vi.fn(async () => {
			modeListState.fetchCalls += 1
			modeListState.resolved = true
			modeListState.models = [homeModel]
			return [homeModel] as never
		}),
		get isModeAvailabilityResolved() {
			return modeListState.resolved
		},
	},
	resolveModeMapKey: (topicMode: string, agentCode?: string | null) =>
		topicMode === TopicMode.CustomAgent && agentCode ? agentCode : topicMode,
}))

describe("SuperMagicTopicModelService workspace-home model resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		modeListState.models = []
		modeListState.fetchCalls = 0
		modeListState.resolved = false

		vi.mocked(superMagicTopicModelCacheService.getDefaultModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getModeDefaultModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.saveTopicModel).mockResolvedValue(undefined)
		vi.mocked(superMagicTopicModelCacheService.saveProjectModel).mockResolvedValue(undefined)
		vi.mocked(superMagicTopicModelCacheService.saveModeDefaultModel).mockResolvedValue(
			undefined,
		)
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({} as never)
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({} as never)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		superMagicTopicModelService.destroy()
	})

	/** Workspace home is the empty topic/project pair; the mode carries the model list. */
	function mountWorkspaceHomeContext(store = createSuperMagicTopicModelStore()) {
		superMagicTopicModelService.initForStore(store)
		store.setCurrentContext(undefined, "", TopicMode.General, undefined)
		return store
	}

	it("settles on the mode's first usable model when the crew list is already known", async () => {
		modeListState.resolved = true
		modeListState.models = [homeModel]

		const store = mountWorkspaceHomeContext()

		await vi.waitFor(() => expect(store.isLoading).toBe(false))
		expect(store.selectedLanguageModel?.model_id).toBe(homeModel.model_id)
		expect(store.isLanguageModelReady).toBe(true)
		// Availability was already resolved, so nothing had to wait for a fetch.
		expect(modeListState.fetchCalls).toBe(0)
	})

	it("waits for the crew list instead of settling empty, so the home composer ends ready", async () => {
		// The state a brand-new account starts in: no hydrated list, request in flight.
		const store = mountWorkspaceHomeContext()

		await vi.waitFor(() => expect(store.isLoading).toBe(false))

		// Regression guard for the reported bug: settling here left the send button
		// disabled with no way to recover, because nothing re-runs the resolution
		// once the crew list arrives.
		expect(store.selectedLanguageModel?.model_id).toBe(homeModel.model_id)
		expect(store.isLanguageModelReady).toBe(true)
		expect(modeListState.fetchCalls).toBe(1)
	})

	it("does not re-request the crew list once availability is resolved with no models", async () => {
		modeListState.resolved = true
		modeListState.models = []

		const store = mountWorkspaceHomeContext()

		await vi.waitFor(() => expect(store.isLoading).toBe(false))
		expect(modeListState.fetchCalls).toBe(0)
		expect(store.isLanguageModelReady).toBe(false)
	})
})
