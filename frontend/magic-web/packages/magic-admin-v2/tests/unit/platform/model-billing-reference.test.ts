import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	getReferenceAmount,
	previewReferenceAmount,
	validateMultiplierSettings,
} from "../../../../model-billing-reference"
import type { ModelBillingMultiplierSettings } from "../../../../model-billing-reference"

/** 全部使用模拟单价，不查询真实模型或计费接口。 */
describe("管理端参考倍率预览", () => {
	const config: ModelBillingMultiplierSettings = {
		enabled: true,
		currency: "CNY" as const,
		base_price_cny: "0.8",
		input_price: "2",
		output_price: "3",
		usd_to_cny_rate: "5",
	}
	it("编辑按单价预览，查看使用后端金额，且不改写提交配置", () => {
		const original = JSON.stringify(config)
		assert.equal(previewReferenceAmount(config), "0.023")
		assert.equal(getReferenceAmount(config, true), "0.023")
		assert.equal(getReferenceAmount(config, false), "0.8")
		assert.equal(JSON.stringify(config), original)
		assert.equal(
			getReferenceAmount(
				{ ...config, input_price: undefined, output_price: undefined },
				true,
			),
			null,
		)
	})
	it("保持十二位单价精度，零值、缺项、非法输入不会伪造金额", () => {
		assert.equal(
			previewReferenceAmount({
				...config,
				input_price: "0",
				output_price: "0.000000000001",
			}),
			"0.000000000000001",
		)
		for (const input of [null, "", "-1", "1e3", "NaN", "Infinity", "0.0000000000001"]) {
			assert.equal(previewReferenceAmount({ ...config, input_price: input }), null)
		}
		assert.equal(
			previewReferenceAmount({ ...config, input_price: "0", output_price: "0" }),
			null,
		)
		assert.equal(getReferenceAmount({ ...config, input_price: null }, true), null)
	})
	it("允许一项零价，不允许两项同时为零或只有一项单价", () => {
		assert.deepEqual(validateMultiplierSettings({ ...config, input_price: "0" }), [])
		assert.deepEqual(
			validateMultiplierSettings({ ...config, input_price: "0", output_price: "0" }),
			["output_price"],
		)
		assert.deepEqual(validateMultiplierSettings({ ...config, output_price: null }), [
			"output_price",
		])
		assert.deepEqual(validateMultiplierSettings({ ...config, usd_to_cny_rate: "0" }), [
			"usd_to_cny_rate",
		])
	})
	it("美元基准按汇率精确换算，切换币种不改写单价", () => {
		const usd = { ...config, currency: "USD" as const }
		assert.equal(previewReferenceAmount(usd), "0.115")
		assert.equal(usd.input_price, "2")
		assert.equal(previewReferenceAmount({ ...usd, usd_to_cny_rate: null }), null)
		assert.equal(
			previewReferenceAmount({
				...usd,
				input_price: "0",
				output_price: "0.000000000001",
				usd_to_cny_rate: "0.000000000001",
			}),
			"0.000000000000000000000000001",
		)
		assert.deepEqual(validateMultiplierSettings({ ...config, currency: null }), ["currency"])
	})
})
