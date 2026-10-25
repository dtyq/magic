import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import {
	buildModelPriceGroups,
	getVisibleModelPriceGroups,
	formatPreviewDecimal,
	calculateModelPrice,
	calculateModelBenchmark,
	formatBenchmarkUnitPrice,
	supportsPriceCalculation,
} from "../../../../model-billing-reference"
import { mockBinding, mockModel, mockSnapshot } from "../../fixtures/model-price-preview"

describe("系统模型售价预览", () => {
	it("生产目标编译后的模块可加载并保留精确金额与倍率", async () => {
		// 源码执行不会暴露指数降级问题，必须用实际构建器生成并执行产物。
		const { build } = await import("vite")
		const built = await build({
			configFile: false,
			envFile: false,
			logLevel: "silent",
			build: {
				write: false,
				target: "es2015",
				minify: true,
				lib: {
					entry: fileURLToPath(
						new URL(
							"../../../../model-billing-reference/system-model-price-preview.ts",
							import.meta.url,
						),
					),
					name: "ModelPricePreview",
					formats: ["iife"],
				},
			},
		})
		const bundle = Array.isArray(built) ? built[0] : built
		assert.ok(bundle && "output" in bundle)
		const chunk = bundle.output.find((item) => item.type === "chunk")
		assert.ok(chunk)
		const compiled = runInNewContext(
			`${chunk.code}\nModelPricePreview`,
			{},
			{ timeout: 1000 },
		) as typeof import("../../../../model-billing-reference/system-model-price-preview")
		assert.equal(compiled.calculateModelPrice(mockModel(), "0.015", "7").multiplier, "2.00x")
		const mixed = mockModel([mockBinding("3", "15"), mockBinding("0.4", "2", "USD")])
		assert.equal(compiled.calculateModelPrice(mixed, "0.015", "7").amount, "0.0435")
		assert.equal(compiled.calculateModelPrice(mixed, "0.015", "7").multiplier, "2.90x")
		assert.equal(
			compiled.calculateModelPrice(mockModel([mockBinding("0", "0")]), "1", null).multiplier,
			"0.00x",
		)
		const tiny = compiled.calculateModelPrice(
			mockModel([mockBinding("0", "0.000000000001")]),
			"1",
			null,
		)
		assert.equal(tiny.amount, "0.000000000000001")
		assert.equal(tiny.multiplier, "<0.01x")
		const reference = compiled.calculateModelBenchmark(mockModel(), "USD", "7")
		assert.equal(reference.input?.value, "0.285714285714")
		assert.equal(reference.input?.approximate, true)
		assert.equal(reference.output?.value, "1.428571428571")
	})
	it("按人民币金额平均混合币种，符合后端合成金样例", () => {
		const normal = calculateModelPrice(mockModel(), "0.015", "7")
		assert.equal(normal.amount, "0.03")
		assert.equal(normal.multiplier, "2.00x")
		const mixed = mockModel([mockBinding("3", "15"), mockBinding("0.4", "2", "USD")])
		assert.equal(calculateModelPrice(mixed, "0.015", "7").amount, "0.0435")
		assert.equal(calculateModelPrice(mixed, "0.015", "7").multiplier, "2.90x")
		assert.equal(
			calculateModelPrice(mockModel([mockBinding("2", "6", "USD")]), "0.015", "7").multiplier,
			"12.13x",
		)
		assert.equal(calculateModelPrice(mixed, "0.015", null).status, "invalid_rate")
		assert.equal(calculateModelPrice(mixed, "0.015", "0").amount, null)
	})
	it("部分缺价为零，非法价格剔除整个绑定，明确零价有效", () => {
		const missing = mockBinding()
		missing.input = {
			status: "missing_as_zero",
			effective_unit_price: "0",
			source: "missing",
			rule_prices: [],
		}
		assert.equal(calculateModelPrice(mockModel([missing]), "0.01", null).amount, "0.01")
		const invalid = mockBinding()
		invalid.input.status = "invalid"
		assert.equal(calculateModelPrice(mockModel([invalid]), "1", "7").status, "no_valid_price")
		assert.equal(
			calculateModelPrice(mockModel([mockBinding("0", "0")]), "1", null).multiplier,
			"0.00x",
		)
		invalid.eligible = false
		invalid.exclusion_reason = "provider_disabled"
		assert.equal(
			calculateModelPrice(mockModel([invalid, missing]), "0.01", "7").multiplier,
			"1.00x",
		)
		assert.equal(
			calculateModelPrice({ ...mockModel(), state: "disabled" }, "1", "7").status,
			"disabled",
		)
	})
	it("逐步截断36位、保留极小正数和27位基准，展示遵循 Number.toFixed", () => {
		const tier = mockBinding("0.333333333333333333333333333333333333", "0")
		tier.input.source = "tiered"
		tier.input.rule_prices = ["0", "1", "0"]
		assert.equal(
			calculateModelPrice(mockModel([tier]), "1", "7").amount,
			"0.003333333333333333333333333333333333",
		)
		assert.equal(
			calculateModelPrice(
				mockModel([mockBinding("0", "0.000000000001", "USD")]),
				"0.000000000000000000000000001",
				"0.000000000001",
			).multiplier,
			"1.00x",
		)
		const tiny = calculateModelPrice(mockModel([mockBinding("0", "0.000000000001")]), "1", null)
		assert.equal(tiny.amount, "0.000000000000001")
		assert.equal(tiny.multiplier, "<0.01x")
		assert.equal(
			calculateModelPrice(mockModel([mockBinding("100.5", "0")]), "1", null).multiplier,
			(1.005).toFixed(2) + "x",
		)
		assert.equal(calculateModelPrice(mockModel(), "0", "7").status, "invalid_base")
		assert.ok(
			calculateModelPrice(
				mockModel([mockBinding("999999999999", "0")]),
				"0.000000000000000000000000001",
				"7",
			).multiplier,
		)
	})
	it("拒绝未知协议，缺失模型保留位置，动态父项不计算且共享节点独立展开", () => {
		const snapshot = mockSnapshot()
		assert.equal(supportsPriceCalculation(snapshot), true)
		snapshot.calculation.version = "future"
		assert.equal(supportsPriceCalculation(snapshot), false)
		assert.equal(calculateModelPrice(mockModel(), "1", "7", false).status, "unsupported")
		snapshot.models.dynamic = {
			kind: "dynamic",
			model_id: "dynamic",
			name: "Mock dynamic",
			state: "available",
			children: [
				{ index: 0, model_id: "mock-model" },
				{ index: 1, model_id: "dynamic" },
				{ index: 2, model_id: "missing" },
			],
		}
		snapshot.groups[0].items.push({
			relation_id: "dynamic-relation",
			model_id: "dynamic",
			display_name: "Mock dynamic",
		})
		const rows = buildModelPriceGroups(snapshot)[0].rows
		assert.equal(rows[1].children[1].blocked, true)
		assert.equal(rows[1].children[2].model.kind, "unavailable")
		assert.notEqual(rows[0].key, rows[1].children[0].key)
		assert.equal(rows[1].model.kind, "dynamic")
	})
	it("缺省配置和空组保留顺序，深度保护不误伤重复候选", () => {
		const snapshot = mockSnapshot()
		snapshot.mode = null
		snapshot.groups = []
		assert.deepEqual(buildModelPriceGroups(snapshot), [])
		snapshot.groups = [{ id: "empty", name: "Empty", items: [] }]
		assert.equal(buildModelPriceGroups(snapshot)[0].rows.length, 0)
		for (let i = 0; i < 40; i++)
			snapshot.models[String(i)] = {
				kind: "dynamic",
				model_id: String(i),
				name: String(i),
				state: "available",
				children: [{ index: 0, model_id: String(i + 1) }],
			}
		snapshot.groups[0].items.push({ relation_id: "chain", model_id: "0", display_name: "0" })
		let row = buildModelPriceGroups(snapshot)[0].rows[0]
		while (row.children.length) row = row.children[0]
		assert.equal(row.depth, 32)
		assert.equal(row.blocked, true)
	})
})

/** 格式化不损失试算数据，主表限制展示长度，详情仍可核对全部有效位。 */
it("trims padded decimals without mutating prices or hiding tiny positives", () => {
	assert.equal(formatPreviewDecimal("0.750000000000000000000000000000000000"), "0.75")
	assert.equal(formatPreviewDecimal("0002.000000000000"), "2")
	assert.equal(formatPreviewDecimal("0.0761362875", 6), "0.076136")
	assert.equal(formatPreviewDecimal("9.9999999", 6), "10")
	assert.equal(formatPreviewDecimal("0.000000000000000000000000000000000001", 6), "<0.000001")
	assert.equal(formatPreviewDecimal("0.0000000", 6), "0")
	assert.equal(formatPreviewDecimal(null), "—")
	assert.equal(formatPreviewDecimal("1.2500", 0), "1.25")
})

it("filters missing models and empty groups without changing source data or surviving paths", () => {
	const snapshot = mockSnapshot()
	snapshot.groups.unshift({
		id: "missing-only",
		name: "Missing group",
		items: [
			{ relation_id: "missing-root", model_id: "deleted", display_name: "Deleted model" },
		],
	})
	snapshot.models.deleted = {
		kind: "unavailable",
		model_id: "deleted",
		name: "Deleted model",
		reason: "missing",
	}
	snapshot.models.dynamic = {
		kind: "dynamic",
		model_id: "dynamic",
		name: "Mock dynamic",
		state: "available",
		children: [
			{ index: 0, model_id: "deleted" },
			{ index: 1, model_id: "mock-model" },
		],
	}
	snapshot.groups[1].items.push({
		relation_id: "dynamic",
		model_id: "dynamic",
		display_name: "Mock dynamic",
	})
	snapshot.models.pending = {
		kind: "unavailable",
		model_id: "pending",
		name: "Pending model",
		reason: "not_loaded",
	}
	snapshot.groups[1].items.push({
		relation_id: "pending",
		model_id: "pending",
		display_name: "Pending model",
	})
	const before = JSON.stringify(snapshot)
	const original = buildModelPriceGroups(snapshot)
	const visible = getVisibleModelPriceGroups(snapshot)
	assert.equal(visible.length, 1)
	assert.equal(visible[0].id, "mock-group")
	assert.equal(visible[0].rows[1].children.length, 1)
	assert.equal(visible[0].rows[1].children[0].key, original[1].rows[1].children[1].key)
	assert.equal(visible[0].rows[2].model.model_id, "pending")
	assert.equal(JSON.stringify(snapshot), before)
})

/** 基准参考仅消费合成价格，覆盖换汇与可配置精度的边界。 */
describe("所选币种的一倍基准参考", () => {
	it("同币种保留原价且不依赖汇率，美元原价不往返换算", () => {
		const usd = mockModel([mockBinding("0.142857142857", "0.714285714286", "USD")])
		const result = calculateModelBenchmark(usd, "USD", null)
		assert.equal(result.status, "available")
		assert.deepEqual(result.input, {
			value: "0.142857142857",
			approximate: false,
			belowPrecision: false,
		})
		assert.equal(result.output?.value, "0.714285714286")
		assert.equal(calculateModelBenchmark(mockModel(), "CNY", "invalid").input?.value, "2")
	})
	it("双向换汇只在最终舍入，有限小数不标近似，循环小数明确标注", () => {
		const cny = calculateModelBenchmark(
			mockModel([mockBinding("0.75", "3.75", "USD")]),
			"CNY",
			"7",
		)
		assert.equal(cny.input?.value, "5.25")
		assert.equal(cny.output?.value, "26.25")
		assert.equal(cny.input?.approximate, false)
		const usd = calculateModelBenchmark(mockModel([mockBinding("1", "5")]), "USD", "7")
		assert.equal(usd.input?.value, "0.142857142857")
		assert.equal(usd.output?.value, "0.714285714286")
		assert.ok(usd.input)
		assert.equal(formatBenchmarkUnitPrice(usd.input), "≈0.142857142857")
	})
	it("混合币种等权平均，汇率无效不丢弃需换汇的有效来源", () => {
		const mixed = mockModel([mockBinding("1", "5"), mockBinding("1", "5", "USD")])
		const result = calculateModelBenchmark(mixed, "CNY", "7")
		assert.equal(result.input?.value, "4")
		assert.equal(result.output?.value, "20")
		for (const rate of [null, "0", "-1", "invalid", "1.0000000000001"])
			assert.equal(calculateModelBenchmark(mixed, "CNY", rate).status, "invalid_rate")
		// 各绑定的除法有余数，合计恰好整除时仍应判为精确值。
		const exact = calculateModelBenchmark(
			mockModel([mockBinding("1", "1"), mockBinding("6", "6")]),
			"USD",
			"7",
		)
		assert.equal(exact.input?.value, "0.5")
		assert.equal(exact.input?.approximate, false)
	})
	it("部分缺价按零，两侧共用有效绑定分母，不修改源数据", () => {
		const missing = mockBinding("2", "10")
		missing.input.status = "missing_as_zero"
		const invalid = mockBinding("999", "999")
		invalid.output.status = "invalid"
		const excluded = mockBinding("999", "999")
		excluded.eligible = false
		const tiered = mockBinding("4", "6")
		tiered.input.source = "tiered"
		tiered.input.rule_prices = ["2", "6"]
		const model = mockModel([missing, invalid, excluded, tiered])
		const before = JSON.stringify(model)
		const result = calculateModelBenchmark(model, "CNY", "7")
		assert.equal(result.input?.value, "2")
		assert.equal(result.output?.value, "8")
		assert.equal(JSON.stringify(model), before)
	})
	it("舍入有标记，溢出和极小价不伪装为可填零价", () => {
		const result = calculateModelBenchmark(
			mockModel([mockBinding("1.1234567890125", "1")]),
			"CNY",
			null,
		)
		assert.equal(result.input?.value, "1.123456789013")
		assert.equal(result.input?.approximate, true)
		assert.equal(
			calculateModelBenchmark(
				mockModel([mockBinding("999999999999.9999999999999", "1")]),
				"CNY",
				null,
			).status,
			"out_of_range",
		)
		assert.equal(
			calculateModelBenchmark(mockModel([mockBinding("0.0000000000001", "0")]), "CNY", null)
				.status,
			"below_precision",
		)
		const tiny = calculateModelBenchmark(
			mockModel([mockBinding("0.0000000000001", "1")]),
			"CNY",
			null,
		)
		assert.ok(tiny.input)
		assert.equal(formatBenchmarkUnitPrice(tiny.input), "<0.000000000001")
	})
	it("拒绝未知协议、币种、禁用、零价和空绑定", () => {
		assert.equal(calculateModelBenchmark(mockModel(), "EUR", "7").status, "invalid_currency")
		assert.equal(calculateModelBenchmark(mockModel(), null, "7").status, "invalid_currency")
		assert.equal(calculateModelBenchmark(mockModel(), "CNY", "7", false).status, "unsupported")
		assert.equal(
			calculateModelBenchmark({ ...mockModel(), state: "disabled" }, "CNY", "7").status,
			"disabled",
		)
		assert.equal(calculateModelBenchmark(mockModel([]), "CNY", "7").status, "no_valid_price")
		assert.equal(
			calculateModelBenchmark(mockModel([mockBinding("0", "0")]), "CNY", "7").status,
			"zero_price",
		)
	})
})
