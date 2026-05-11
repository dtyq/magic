import { describe, expect, it } from "vitest"
import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import { buildMyModelGroups } from "./utils"

describe("buildMyModelGroups", () => {
	it("groups models by model_id", () => {
		const models: ServiceProviderModel[] = [
			{
				id: "model-1",
				name: "GPT-4o",
				model_id: "gpt-4o",
				model_version: "gpt-4o",
				model_type: 3,
				category: "llm",
				description: "first provider",
				service_provider_config_id: "provider-1",
				service_provider_config: {
					id: "provider-1",
					name: "Volcengine",
				},
			},
			{
				id: "model-2",
				name: "GPT-4o",
				model_id: "gpt-4o",
				model_version: "gpt-4o",
				model_type: 3,
				category: "llm",
				description: "second provider",
				service_provider_config_id: "provider-2",
				service_provider_config: {
					id: "provider-2",
					name: "Private Service",
				},
			},
			{
				id: "model-3",
				name: "Claude 3.7 Sonnet",
				model_id: "claude-3-7-sonnet",
				model_version: "claude-3-7-sonnet",
				model_type: 3,
				category: "llm",
				description: "unique provider",
				service_provider_config_id: "provider-3",
				service_provider_config: {
					id: "provider-3",
					name: "Anthropic",
				},
			},
		]

		const groups = buildMyModelGroups({ models })

		expect(groups).toHaveLength(2)
		expect(groups[0].representativeModel.id).toBe("model-1")
		expect(groups[0].providerEntries).toHaveLength(2)
		expect(groups[0].providerEntries.map((entry) => entry.providerName)).toEqual([
			"Volcengine",
			"Private Service",
		])
		expect(groups[0].providerEntries.map((entry) => entry.providerAlias)).toEqual(["", ""])
		expect(groups[0].providerEntries[1].providerTypeName).toBe("")
		expect(groups[1].representativeModel.id).toBe("model-3")
	})

	it("keeps empty provider metadata when provider config is incomplete", () => {
		const models: ServiceProviderModel[] = [
			{
				id: "model-1",
				name: "GPT-4o",
				model_id: "gpt-4o",
				model_version: "gpt-4o",
				model_type: 3,
				category: "llm",
				description: "missing provider",
				service_provider_config_id: "provider-404",
				service_provider_config: {
					id: "provider-404",
					name: "",
				},
			},
		]

		const groups = buildMyModelGroups({ models })

		expect(groups[0].providerEntries[0].provider).not.toBeNull()
		expect(groups[0].providerEntries[0].providerAlias).toBe("")
		expect(groups[0].providerEntries[0].providerName).toBe("")
		expect(groups[0].providerEntries[0].providerTypeName).toBe("")
	})

	it("uses provider name as display name", () => {
		const models: ServiceProviderModel[] = [
			{
				id: "model-1",
				name: "Qwen Max",
				model_id: "qwen-max",
				model_version: "qwen-max",
				model_type: 3,
				category: "llm",
				description: "ali model",
				service_provider_config_id: "provider-1",
				service_provider_config: {
					id: "provider-1",
					name: "Private Service",
				},
			},
			{
				id: "model-2",
				name: "Qwen Plus",
				model_id: "qwen-plus",
				model_version: "qwen-plus",
				model_type: 3,
				category: "llm",
				description: "ali model",
				service_provider_config_id: "provider-2",
				service_provider_config: {
					id: "provider-2",
					name: "Aliyun (Bailian)",
				},
			},
		]

		const groups = buildMyModelGroups({ models })

		expect(groups[0].providerEntries[0].providerAlias).toBe("")
		expect(groups[0].providerEntries[0].providerName).toBe("Private Service")
		expect(groups[0].providerEntries[0].providerTypeName).toBe("")
		expect(groups[1].providerEntries[0].providerName).toBe("Aliyun (Bailian)")
	})
})
