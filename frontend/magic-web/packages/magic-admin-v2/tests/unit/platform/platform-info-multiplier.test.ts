import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	createDefaultPlatformInfoDetails,
	createEmptyPlatformInfoFormState,
	toChangedPlatformInfoParams,
	toPlatformInfoFormState,
} from "@magic-admin-v2/features/platform-info/api"
import { createPlatformInfoSchema } from "@magic-admin-v2/features/platform-info/utils"

/** 接口配置全部为模拟值，预览不会改写原始提交金额。 */
describe("模型参考倍率配置", () => {
	it("直接回显后端金额，并且只提交已修改的配置组", () => {
		const config = {
			enabled: true,
			currency: "CNY" as const,
			base_price_cny: "0.123456789012",
			input_price: "2.000000000001",
			output_price: "3",
			usd_to_cny_rate: "7.123456789012",
		}
		const values = toPlatformInfoFormState({
			...createDefaultPlatformInfoDetails(),
			model_billing_multiplier: config,
		})
		assert.deepEqual(values.model_billing_multiplier, config)
		assert.deepEqual(
			toChangedPlatformInfoParams(values, { model_billing_multiplier: { enabled: true } }),
			{
				model_billing_multiplier: {
					enabled: true,
					currency: "CNY",
					input_price: "2.000000000001",
					output_price: "3",
					usd_to_cny_rate: "7.123456789012",
				},
			},
		)
		assert.equal(
			"model_billing_multiplier" in
				toChangedPlatformInfoParams(values, { global_system_prompt: true }),
			false,
		)
	})
	it("关闭允许未填写，启用必须填写两项源单价和正汇率", () => {
		const schema = createPlatformInfoSchema((key) => key, "modelMultiplier")
		const values = createEmptyPlatformInfoFormState()
		assert.equal(schema.safeParse(values).success, true)
		for (const amount of [
			null,
			"",
			"0",
			"-1",
			"NaN",
			"Infinity",
			"1e3",
			"0.0000000000000000000000000001",
		]) {
			assert.equal(
				schema.safeParse({
					...values,
					model_billing_multiplier: {
						enabled: true,
						currency: "CNY" as const,
						base_price_cny: amount,
						usd_to_cny_rate: "7",
					},
				}).success,
				false,
			)
		}
		assert.equal(
			schema.safeParse({
				...values,
				model_billing_multiplier: {
					enabled: true,
					currency: "CNY" as const,
					base_price_cny: "0.1",
					usd_to_cny_rate: null,
				},
			}).success,
			false,
		)
		assert.equal(
			schema.safeParse({
				...values,
				model_billing_multiplier: {
					enabled: true,
					currency: "CNY" as const,
					base_price_cny: "0.1",
					usd_to_cny_rate: "7",
				},
			}).success,
			false,
		)
	})
	it("新单价按原文提交，不要求前端生成后端参考金额", () => {
		const schema = createPlatformInfoSchema((key) => key, "modelMultiplier")
		const values = createEmptyPlatformInfoFormState()
		values.model_billing_multiplier = {
			enabled: true,
			currency: "CNY" as const,
			base_price_cny: null,
			input_price: "0",
			output_price: "3.000000000001",
			usd_to_cny_rate: "5",
		}
		assert.equal(schema.safeParse(values).success, true)
		assert.deepEqual(
			toChangedPlatformInfoParams(values, {
				model_billing_multiplier: { input_price: true },
			}),
			{
				model_billing_multiplier: {
					enabled: true,
					currency: "CNY",
					input_price: "0",
					output_price: "3.000000000001",
					usd_to_cny_rate: "5",
				},
			},
		)
		assert.equal(
			schema.safeParse({
				...values,
				model_billing_multiplier: {
					...values.model_billing_multiplier,
					output_price: "0",
				},
			}).success,
			false,
		)
	})
})

it("表单保存保留手动覆盖，非法覆盖拒绝提交", () => {
	const schema = createPlatformInfoSchema((key) => key, "modelMultiplier")
	const values = createEmptyPlatformInfoFormState()
	values.model_billing_multiplier.model_overrides = [{ model_id: "mock.auto", multiplier: "0.5" }]
	const parsed = schema.safeParse(values)
	assert.equal(parsed.success, true)
	if (parsed.success)
		assert.deepEqual(
			parsed.data.model_billing_multiplier.model_overrides,
			values.model_billing_multiplier.model_overrides,
		)
	values.model_billing_multiplier.model_overrides[0].multiplier = "-1"
	assert.equal(schema.safeParse(values).success, false)
})
