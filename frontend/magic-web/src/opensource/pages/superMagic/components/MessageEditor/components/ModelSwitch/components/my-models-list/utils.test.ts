import { describe, expect, it } from "vitest"
import type { ServiceProviderModel } from "@/opensource/apis/modules/org-ai-model-provider"
import type { ProviderTemplateOption, ServiceProvider } from "../AddModel/types"
import { buildMyModelGroups } from "./utils"

describe("buildMyModelGroups", () => {
	const providerTemplates: ProviderTemplateOption[] = [
		{
			id: "volcengine",
			name: "Volcengine",
			icon: "",
			providerCode: "volcengine",
			fields: [],
		},
		{
			id: "alibabacloud",
			name: "Aliyun (Bailian)",
			icon: "",
			providerCode: "alibabacloud",
			fields: [],
		},
		{
			id: "custom",
			name: "Custom Provider",
			icon: "",
			providerCode: "custom",
			fields: [],
		},
	]

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
			},
		]
		const providers: ServiceProvider[] = [
			{
				id: "provider-1",
				name: "Volcengine",
				icon: "",
				providerTypeId: "volcengine",
				fields: {},
			},
			{
				id: "provider-2",
				name: "Private Service",
				icon: "",
				providerTypeId: "alibabacloud",
				fields: {},
			},
			{
				id: "provider-3",
				name: "Anthropic",
				icon: "",
				providerTypeId: "custom",
				fields: {},
			},
		]

		const groups = buildMyModelGroups({ models, providers, providerTemplates })

		expect(groups).toHaveLength(2)
		expect(groups[0].representativeModel.id).toBe("model-1")
		expect(groups[0].providerEntries).toHaveLength(2)
		expect(groups[0].providerEntries.map((entry) => entry.providerName)).toEqual([
			"Volcengine",
			"Private Service",
		])
		expect(groups[0].providerEntries.map((entry) => entry.providerAlias)).toEqual(["", ""])
		expect(groups[0].providerEntries[1].providerTypeName).toBe("Aliyun (Bailian)")
		expect(groups[1].representativeModel.id).toBe("model-3")
	})

	it("keeps empty provider metadata when provider is missing", () => {
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
			},
		]

		const groups = buildMyModelGroups({
			models,
			providers: [],
			providerTemplates,
		})

		expect(groups[0].providerEntries[0].provider).toBeNull()
		expect(groups[0].providerEntries[0].providerAlias).toBe("")
		expect(groups[0].providerEntries[0].providerName).toBe("")
		expect(groups[0].providerEntries[0].providerTypeName).toBe("")
	})

	it("keeps provider type on the right only when alias differs", () => {
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
			},
		]
		const providers: ServiceProvider[] = [
			{
				id: "provider-1",
				name: "Private Service",
				icon: "",
				providerTypeId: "alibabacloud",
				fields: { alias: "Private Service" },
			},
			{
				id: "provider-2",
				name: "Aliyun (Bailian)",
				icon: "",
				providerTypeId: "alibabacloud",
				fields: { alias: "Aliyun (Bailian)" },
			},
		]

		const groups = buildMyModelGroups({ models, providers, providerTemplates })

		expect(groups[0].providerEntries[0].providerAlias).toBe("Private Service")
		expect(groups[0].providerEntries[0].providerTypeName).toBe("Aliyun (Bailian)")
		expect(groups[1].providerEntries[0].providerAlias).toBe("Aliyun (Bailian)")
		expect(groups[1].providerEntries[0].providerTypeName).toBe("Aliyun (Bailian)")
	})
})
