import assert from "node:assert/strict"
import { test } from "node:test"
import {
	areModelMultiplierOverridesValid,
	getDisplayModelMultiplier,
	updateModelMultiplierOverrides,
	toModelMultiplierUpdate,
} from "../../../../model-billing-reference"

test("逻辑入口独立覆盖，保留不可见项，清空只移除目标项", () => {
	const initial = [
		{ model_id: "mock-hidden", multiplier: "3" },
		{ model_id: "mock-auto", multiplier: "0.5" },
	]
	const next = updateModelMultiplierOverrides(initial, "mock-max", "1")
	assert.equal(next.find((item) => item.model_id === "mock-auto")?.multiplier, "0.5")
	assert.equal(next.find((item) => item.model_id === "mock-max")?.multiplier, "1")
	assert.deepEqual(updateModelMultiplierOverrides(next, "mock-max", ""), initial)
	assert.equal(initial.length, 2)
})

test("覆盖集合拒绝重复逻辑 ID 与非法倍率，正数极小值保留展示语义", () => {
	for (const multiplier of [
		"",
		"0",
		"-1",
		"1e2",
		"NaN",
		"Infinity",
		"0.0000000000001",
		"1000000000000",
	]) {
		assert.equal(areModelMultiplierOverridesValid([{ model_id: "mock", multiplier }]), false)
	}
	assert.equal(
		areModelMultiplierOverridesValid([
			{ model_id: "mock", multiplier: "1" },
			{ model_id: "mock", multiplier: "2" },
		]),
		false,
	)
	assert.equal(
		areModelMultiplierOverridesValid([{ model_id: "mock", multiplier: "0.000000000001" }]),
		true,
	)
	assert.equal(getDisplayModelMultiplier("0.000000000001", "9.00x"), "<0.01x")
	assert.equal(getDisplayModelMultiplier("0.5", "9.00x"), "0.50x")
	assert.equal(getDisplayModelMultiplier(undefined, "9.00x"), "9.00x")
	assert.equal(getDisplayModelMultiplier("invalid", "9.00x"), "—")
})

test("保存投影只携带明确提供的覆盖字段，空数组明确清空", () => {
	const config = { enabled: false, base_price_cny: null, usd_to_cny_rate: "7" }
	assert.equal("model_overrides" in toModelMultiplierUpdate(config), false)
	assert.deepEqual(
		toModelMultiplierUpdate({ ...config, model_overrides: [] }).model_overrides,
		[],
	)
	const overrides = [{ model_id: "mock", multiplier: "0.5" }]
	assert.deepEqual(
		toModelMultiplierUpdate({ ...config, model_overrides: overrides }).model_overrides,
		overrides,
	)
})
