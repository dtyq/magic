import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HttpClient } from "../../../src/api/types.ts"
import { PERMISSION_KEY_MAP } from "../../../src/constants/permissions.ts"
import { platformSystemCapabilitiesAccess } from "../../../src/routes/route-access.ts"
import { createPlatformSystemCapabilitiesApi } from "../../../src/features/platform-system-capabilities/api.ts"
import {
	COMMON_PROVIDER_FIELDS,
	CONNECTIVITY_TEST_CODES,
	DEFAULT_PROVIDER_LIST_MAP,
	DEPRECATED_PROVIDER_MAP,
	IMAGE_TOOL_CODES,
	SERVICE_CONFIG_CODES,
} from "../../../src/features/platform-system-capabilities/consts.ts"
import {
	aiPowerCode,
	type ProviderConfig,
} from "../../../src/features/platform-system-capabilities/types.ts"
import {
	createCapabilityFormValues,
	getCapabilityDisplayText,
	getAvailableProviderList,
	normalizeProviderConfig,
} from "../../../src/features/platform-system-capabilities/utils.ts"
import { getProviderFields } from "../../../src/features/platform-system-capabilities/provider-fields.ts"
import type { AccessContext } from "../../../src/runtime/types.ts"

function createAccess(overrides: Partial<AccessContext> = {}): AccessContext {
	return {
		organizationCode: "organization-code",
		hasTeamshareAllPermissions: false,
		isOfficialOrganization: true,
		isPersonalOrganization: false,
		magicPermissionKeys: [],
		teamsharePermissionKeys: [],
		user: { id: "user-id", name: "Admin" },
		organization: {
			organizationCode: "organization-code",
			name: "Official organization",
		},
		...overrides,
	}
}

const allCapabilityCodes = Object.values(aiPowerCode)

describe("system capability coverage", () => {
	it("removes private brand text from capability display names and descriptions", () => {
		assert.equal(getCapabilityDisplayText("深度写作（超级麦吉）"), "深度写作")
		assert.equal(getCapabilityDisplayText("超级麦吉 - 文本净化"), "文本净化")
		assert.equal(getCapabilityDisplayText("Super Magic: deep writing"), "deep writing")
		assert.equal(
			getCapabilityDisplayText("使用超级麦吉能力，支持长文本。"),
			"使用能力，支持长文本。",
		)
	})

	it("keeps the complete legacy capability code set", () => {
		assert.equal(allCapabilityCodes.length, 26)
		assert.deepEqual(new Set(allCapabilityCodes).size, allCapabilityCodes.length)
		assert.deepEqual(
			new Set(allCapabilityCodes),
			new Set([
				"ocr",
				"web_search",
				"image_search",
				"realtime_speech_recognition",
				"audio_file_recognition",
				"auto_completion",
				"content_summary",
				"visual_understanding",
				"smart_rename",
				"ai_optimization",
				"web_scrape",
				"image_convert_high",
				"image_expand",
				"image_remove_background",
				"image_eraser",
				"weather_forecast",
				"knowledge_base_embedding_model",
				"knowledge_base_visual_understanding",
				"follow_up_questions",
				"video_understanding",
				"super_magic_deep_write",
				"super_magic_purify",
				"super_magic_smart_filename",
				"super_magic_compact",
				"super_magic_analysis_audio",
				"image_prompt_completion",
			]),
		)
	})

	it("keeps provider capability groups aligned with the legacy configuration", () => {
		assert.deepEqual(new Set(SERVICE_CONFIG_CODES), new Set([
			"ocr",
			"web_search",
			"web_scrape",
			"realtime_speech_recognition",
			"audio_file_recognition",
			"image_search",
			"image_remove_background",
			"image_eraser",
			"image_expand",
			"weather_forecast",
		]))
		assert.deepEqual(CONNECTIVITY_TEST_CODES, ["web_search", "web_scrape", "image_search"])
		assert.deepEqual(IMAGE_TOOL_CODES, ["image_convert_high", "image_expand", "image_eraser"])
		assert.deepEqual(Object.keys(DEFAULT_PROVIDER_LIST_MAP).sort(), [
			"audio_file_recognition",
			"image_eraser",
			"image_expand",
			"image_remove_background",
			"image_search",
			"ocr",
			"realtime_speech_recognition",
			"weather_forecast",
			"web_scrape",
			"web_search",
		].sort())
		assert.deepEqual([...DEPRECATED_PROVIDER_MAP.web_search ?? []].sort(), ["bing", "magic"])
		assert.deepEqual([...DEPRECATED_PROVIDER_MAP.image_search ?? []], ["doubao"])
	})
})

describe("system capability API contract", () => {
	it("calls the legacy endpoints with the correct model category and filters", async () => {
		const calls: Array<{ method: string; url: string; data?: unknown }> = []
		const client = {
			get: async <T>(url: string) => {
				calls.push({ method: "GET", url })
				return [] as T
			},
			post: async <T>(url: string, data?: unknown) => {
				calls.push({ method: "POST", url, data })
				return [] as T
			},
			put: async <T>(url: string, data?: unknown) => {
				calls.push({ method: "PUT", url, data })
				return {} as T
			},
			patch: async <T>() => ({}) as T,
			delete: async <T>() => ({}) as T,
		} satisfies HttpClient

		const api = createPlatformSystemCapabilitiesApi(client)
		await api.getSystemCapabilityList()
		await api.getSystemCapabilityDetail("audio_file_recognition")
		await api.updateSystemCapability({ code: "ocr", status: 1 })
		await api.testSystemCapabilityConnection({
			ai_ability: "web_search",
			provider: "cloudsway",
		})
		await api.getCapabilityModels("image_expand")
		await api.getCapabilityModels("content_summary")

		assert.deepEqual(calls, [
			{ method: "GET", url: "/api/v1/admin/ai-abilities" },
			{
				method: "GET",
				url: "/api/v1/admin/ai-abilities/audio_file_recognition",
			},
			{ method: "PUT", url: "/api/v1/admin/ai-abilities/ocr", data: { code: "ocr", status: 1 } },
			{
				method: "POST",
				url: "/api/v1/admin/ai-abilities/connectivity-test",
				data: { ai_ability: "web_search", provider: "cloudsway" },
			},
			{
				method: "POST",
				url: "/api/v1/admin/service-providers/models/queries",
				data: { category: "vlm", is_model_id_filter: true, status: 1 },
			},
			{
				method: "POST",
				url: "/api/v1/admin/service-providers/models/queries",
				data: { category: "llm", is_model_id_filter: true, status: 1 },
			},
		])
	})
})

describe("provider configuration behavior", () => {
	it("preserves nested provider fields while keeping their provider identity", () => {
		const upstream = {
			url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
			model_name: "qwen3-asr-flash",
			api_key: "masked",
		}
		const provider = normalizeProviderConfig({
			provider: "MagicEngine",
			enable: false,
			upstream,
		})

		assert.equal(provider?.provider, "MagicEngine")
		assert.deepEqual(provider?.upstream, upstream)
	})

	it("renders known fields and infers new fields without making unknown fields required", () => {
		const fields = getProviderFields("audio_file_recognition", "MagicEngine", {
			provider: "MagicEngine",
			enable: false,
			app_key: "masked",
			access_key: "masked",
			upstream: { model_name: "qwen3-asr-flash" },
			prompt: "line one\nline two",
		})
		const byName = new Map(fields.map((field) => [field.name, field]))

		assert.equal(byName.get(COMMON_PROVIDER_FIELDS.provider.name)?.type, "select")
		assert.equal(byName.get(COMMON_PROVIDER_FIELDS.appKey.name)?.type, "password")
		assert.equal(byName.get(COMMON_PROVIDER_FIELDS.accessKey.name)?.type, "password")
		assert.equal(byName.get("upstream")?.required, false)
		assert.equal(byName.get("prompt")?.type, "textarea")
	})

	it("selects the enabled provider and preserves model fields on first initialization", () => {
		const detail = {
			id: "capability-id",
			code: "image_convert_high",
			name: "Image upscale",
			description: "description",
			status: 1,
			config: {
				model_id: "model-a",
				prompt: "use high quality",
			},
		}
		const providers: ProviderConfig[] = []
		const values = createCapabilityFormValues(detail, providers)

		assert.deepEqual(values, {
			status: true,
			selectedProvider: "",
			model_id: "model-a",
			prompt: "use high quality",
			provider: {
				provider: "",
				name: "",
				enable: false,
			},
		})

		const providerValues = createCapabilityFormValues(
			{ ...detail, config: { providers: [{ provider: "first", enable: false }, { provider: "second", enable: true }] } },
			[
				{ provider: "first", name: "First", enable: false },
				{ provider: "second", name: "Second", enable: true },
			],
		)
		assert.equal(providerValues.selectedProvider, "second")
		assert.equal(providerValues.provider.provider, "second")
	})

	it("filters deprecated providers and merges missing defaults without duplicates", () => {
		const providers = getAvailableProviderList("web_search", [
			{ provider: "CLOUDSWAY", name: "Configured Cloudsway", enable: true },
			{ provider: "magic", name: "Legacy Magic", enable: false },
		])

		assert.deepEqual(providers.map((provider) => provider.provider), [
			"CLOUDSWAY",
			"baidu",
			"doubao",
		])
		assert.equal(providers.filter((provider) => provider.provider.toLowerCase() === "cloudsway").length, 1)
	})
})

describe("system capability route permissions", () => {
	it("allows official query or edit users, but not non-official organizations", () => {
		assert.equal(
			platformSystemCapabilitiesAccess(
				createAccess({
					magicPermissionKeys: [PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY],
				}),
			),
			true,
		)
		assert.equal(
			platformSystemCapabilitiesAccess(
				createAccess({
					magicPermissionKeys: [PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT],
				}),
			),
			true,
		)
		assert.equal(
			platformSystemCapabilitiesAccess(
				createAccess({ isOfficialOrganization: false }),
			),
			false,
		)
	})
})
