import { describe, expect, it } from "vitest"
import { AiModel } from "@admin/const/aiModel"
import { AiManage } from "@admin/types/aiManage"
import { buildAddModelInitialValues, getDefaultModelInfo } from "../utils"

describe("AddModelModal chat_api config", () => {
	it("defaults chat_api to chat_completions for new LLM models", () => {
		const modelInfo = getDefaultModelInfo({
			modelType: AiModel.ModelTypeGroup.LargeLanguageModel,
			category: AiModel.ServiceProviderCategory.LLM,
		})

		expect(modelInfo.config.chat_api).toBe(AiModel.ChatApi.ChatCompletions)
	})

	it("fills missing chat_api when editing an existing model", () => {
		const values = buildAddModelInitialValues({
			info: {
				id: "1",
				name: "gpt-test",
				model_id: "gpt-test",
				model_version: "gpt-test",
				model_type: AiModel.ModelTypeGroup.LargeLanguageModel,
				config: {
					max_tokens: 128000,
					max_output_tokens: 64000,
					creativity: 0.7,
					temperature: 0.7,
					support_function: true,
					support_multi_modal: true,
					support_deep_think: false,
					billing_currency: AiManage.BillingCurrency.CNY,
					billing_type: AiManage.BillingType.TextTokens,
					input_pricing: 0,
					output_pricing: 0,
					cache_write_pricing: 0,
					cache_hit_pricing: 0,
					input_cost: 0,
					output_cost: 0,
					cache_write_cost: 0,
					cache_hit_cost: 0,
					time_pricing: 0,
				},
			} as AiManage.ModelInfo,
			category: AiModel.ServiceProviderCategory.LLM,
		})

		expect(values.config.chat_api).toBe(AiModel.ChatApi.ChatCompletions)
	})

	it("keeps responses when editing a model configured with responses", () => {
		const values = buildAddModelInitialValues({
			info: {
				id: "2",
				name: "gpt-responses",
				model_id: "gpt-responses",
				model_version: "gpt-responses",
				model_type: AiModel.ModelTypeGroup.LargeLanguageModel,
				config: {
					max_tokens: 128000,
					max_output_tokens: 64000,
					creativity: 0.7,
					temperature: 0.7,
					support_function: true,
					support_multi_modal: false,
					support_deep_think: false,
					chat_api: AiModel.ChatApi.Responses,
					billing_currency: AiManage.BillingCurrency.CNY,
					billing_type: AiManage.BillingType.TextTokens,
					input_pricing: 0,
					output_pricing: 0,
					cache_write_pricing: 0,
					cache_hit_pricing: 0,
					input_cost: 0,
					output_cost: 0,
					cache_write_cost: 0,
					cache_hit_cost: 0,
					time_pricing: 0,
				},
			} as AiManage.ModelInfo,
			category: AiModel.ServiceProviderCategory.LLM,
		})

		expect(values.config.chat_api).toBe(AiModel.ChatApi.Responses)
	})
})
