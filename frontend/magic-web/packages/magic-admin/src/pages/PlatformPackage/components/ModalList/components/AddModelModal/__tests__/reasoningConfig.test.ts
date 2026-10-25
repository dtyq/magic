import { describe, expect, it } from "vitest"
import { AiModel } from "@admin/const/aiModel"
import type { AiManage } from "@admin/types/aiManage"
import { buildAddModelInitialValues, getDefaultModelInfo } from "../utils"

/** 构造接口配置快照，不请求数据库或真实模型。 */
function createMockModel(
	levels: AiModel.ReasoningEffort[],
	defaultLevel: AiModel.ReasoningEffort | null,
	enabled = true,
) {
	return {
		id: "mock-reasoning-model",
		config: {
			support_deep_think: enabled,
			reasoning_effort_levels: levels,
			reasoning_effort_default: defaultLevel,
		},
	} as AiManage.ModelInfo
}

describe("旧版模型表单思考配置", () => {
	it("只为新建草稿初始化三档与服务商默认", () => {
		const values = getDefaultModelInfo({ category: AiModel.ServiceProviderCategory.LLM })
		expect(values.config.reasoning_effort_levels).toEqual(["low", "medium", "high"])
		expect(values.config.reasoning_effort_default).toBeNull()
	})

	it.each([null, "none", "max"] as const)("编辑和复制直接保留后端默认 %s", (level) => {
		const values = buildAddModelInitialValues({ info: createMockModel(["none", "max"], level) })
		expect(values.config.reasoning_effort_levels).toEqual(["none", "max"])
		expect(values.config.reasoning_effort_default).toBe(level)
	})

	it("显式空数组不补档位，关闭能力也不清除已配置参数", () => {
		const empty = buildAddModelInitialValues({ info: createMockModel([], null) })
		expect(empty.config.reasoning_effort_levels).toEqual([])
		const disabled = buildAddModelInitialValues({
			info: createMockModel(["high"], "high", false),
		})
		expect(
			"model_power" in disabled &&
				disabled.model_power.includes(AiModel.ModelPower.SupportThink),
		).toBe(false)
		expect(disabled.config.reasoning_effort_levels).toEqual(["high"])
		expect(disabled.config.reasoning_effort_default).toBe("high")
	})
})
