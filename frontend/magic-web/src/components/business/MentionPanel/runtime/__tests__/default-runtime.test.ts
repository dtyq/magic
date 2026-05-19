import { describe, expect, it, vi } from "vitest"
import type { DataService, MentionPanelRuntime } from "../../types"

const builtinMocks = vi.hoisted(() => ({
	dataService: {
		dispatch: vi.fn(() => ({
			items: [],
		})),
	},
	catalogBehavior: {
		getStaticTransition: vi.fn(() => null),
	},
	buildStoreRequest: vi.fn(() => null),
	getItemRenderer: vi.fn(() => ({
		getTypeDescription: () => "builtin",
	})),
	getCatalogHeaderMeta: vi.fn(() => ({
		hint: null,
		icon: null,
	})),
}))

vi.mock("../builtin/store", () => ({
	default: builtinMocks.dataService,
}))

vi.mock("../builtin/catalog-behavior", () => ({
	defaultMentionPanelCatalogBehavior: builtinMocks.catalogBehavior,
}))

vi.mock("../builtin/request-builder", () => ({
	buildMentionStoreRequest: builtinMocks.buildStoreRequest,
}))

vi.mock("../builtin/renderer", () => ({
	getBuiltinMentionItemRenderer: builtinMocks.getItemRenderer,
}))

vi.mock("../builtin/catalog-metadata", () => ({
	getCatalogHeaderMeta: builtinMocks.getCatalogHeaderMeta,
}))

import { defaultMentionPanelRuntime, resolveMentionPanelRuntime } from "../default-runtime"

function createMockDataService(): DataService {
	return {
		dispatch: vi.fn(() => ({
			items: [],
		})),
	}
}

describe("resolveMentionPanelRuntime", () => {
	it("should use builtin runtime by default", () => {
		const resolvedRuntime = resolveMentionPanelRuntime({})

		expect(resolvedRuntime.dataService).toBe(defaultMentionPanelRuntime.dataService)
		expect(resolvedRuntime.catalogBehavior).toBe(defaultMentionPanelRuntime.catalogBehavior)
		expect(resolvedRuntime.buildStoreRequest).toBe(defaultMentionPanelRuntime.buildStoreRequest)
		expect(resolvedRuntime.getItemRenderer).toBe(defaultMentionPanelRuntime.getItemRenderer)
	})

	it("should prefer runtime overrides over legacy props", () => {
		const runtimeDataService = createMockDataService()
		const legacyDataService = createMockDataService()
		const runtimeCatalogBehavior = {
			getStaticTransition: vi.fn(() => null),
		}
		const legacyCatalogBehavior = {
			getStaticTransition: vi.fn(() => null),
		}
		const runtimeBuildStoreRequest = vi.fn(() => null)
		const legacyBuildStoreRequest = vi.fn(() => null)
		const runtimeGetItemRenderer = vi.fn(() => ({}))
		const runtimeGetCatalogHeaderMeta = vi.fn(() => ({
			hint: "runtime",
			icon: "custom",
		}))
		const runtime: MentionPanelRuntime = {
			dataService: runtimeDataService,
			catalogBehavior: runtimeCatalogBehavior,
			buildStoreRequest: runtimeBuildStoreRequest,
			getItemRenderer: runtimeGetItemRenderer,
			getCatalogHeaderMeta: runtimeGetCatalogHeaderMeta,
		}

		const resolvedRuntime = resolveMentionPanelRuntime({
			runtime,
			dataService: legacyDataService,
			catalogBehavior: legacyCatalogBehavior,
			buildStoreRequest: legacyBuildStoreRequest,
		})

		expect(resolvedRuntime.dataService).toBe(runtimeDataService)
		expect(resolvedRuntime.catalogBehavior).toBe(runtimeCatalogBehavior)
		expect(resolvedRuntime.buildStoreRequest).toBe(runtimeBuildStoreRequest)
		expect(resolvedRuntime.getItemRenderer).toBe(runtimeGetItemRenderer)
		expect(resolvedRuntime.getCatalogHeaderMeta).toBe(runtimeGetCatalogHeaderMeta)
	})

	it("should prefer legacy props over builtin runtime", () => {
		const legacyDataService = createMockDataService()
		const legacyCatalogBehavior = {
			getDynamicTransition: vi.fn(() => null),
		}
		const legacyBuildStoreRequest = vi.fn(() => null)

		const resolvedRuntime = resolveMentionPanelRuntime({
			dataService: legacyDataService,
			catalogBehavior: legacyCatalogBehavior,
			buildStoreRequest: legacyBuildStoreRequest,
		})

		expect(resolvedRuntime.dataService).toBe(legacyDataService)
		expect(resolvedRuntime.catalogBehavior).toBe(legacyCatalogBehavior)
		expect(resolvedRuntime.buildStoreRequest).toBe(legacyBuildStoreRequest)
		expect(resolvedRuntime.getItemRenderer).toBe(defaultMentionPanelRuntime.getItemRenderer)
	})
})
