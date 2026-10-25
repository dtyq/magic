import type {
	ModelPriceSnapshot,
	PreviewBinding,
	PreviewModel,
} from "../../../model-billing-reference"
/** 构造合成售价，避免测试依赖真实服务商和模型配置。 */
export function mockBinding(
	input = "2",
	output = "10",
	currency: "CNY" | "USD" = "CNY",
): PreviewBinding {
	return {
		binding_id: "mock-binding",
		provider_name: "Mock provider",
		currency,
		eligible: true,
		exclusion_reason: null,
		input: { status: "priced", effective_unit_price: input, source: "fixed", rule_prices: [] },
		output: {
			status: "priced",
			effective_unit_price: output,
			source: "fixed",
			rule_prices: [],
		},
	}
}
/** 默认普通模型仅使用模拟标识。 */
export function mockModel(bindings = [mockBinding()]): Extract<PreviewModel, { kind: "normal" }> {
	return {
		kind: "normal",
		model_id: "mock-model",
		name: "Mock model",
		state: "available",
		bindings,
	}
}
/** 可复用的默认分组响应，不包含账号或业务数据。 */
export function mockSnapshot(): ModelPriceSnapshot {
	return {
		snapshot_id: "mock-snapshot",
		generated_at: "2026-01-01T00:00:00Z",
		scope: "default_text_models",
		mode: { id: "mock-mode", name: "Mock mode" },
		calculation: {
			version: "text-reference-v1",
			input_tokens: 10000,
			output_tokens: 1000,
			price_unit: "per_million_tokens",
			decimal_scale: 36,
			tier_aggregation: "equal_average",
			provider_aggregation: "equal_average",
		},
		groups: [
			{
				id: "mock-group",
				name: "Mock group",
				items: [
					{
						relation_id: "mock-relation",
						model_id: "mock-model",
						display_name: "Mock model",
					},
				],
			},
		],
		models: { "mock-model": mockModel() },
		warnings: [],
	}
}
