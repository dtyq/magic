import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	createDefaultPlatformInfoDetails,
	createEmptyPlatformInfoFormState,
	normalizePlatformWatermark,
	toChangedPlatformInfoParams,
	toPlatformInfoFormState,
} from "@magic-admin-v2/features/platform-info/api"
import {
	buildPlatformWatermarkPreviewText,
	createPlatformInfoSchema,
	platformInfoSectionDescriptionKeys,
	platformInfoSectionTitleKeys,
	platformWatermarkFields,
	showsPlatformInfoContentLocale,
} from "@magic-admin-v2/features/platform-info/utils"
import type {
	PlatformInfoWatermark,
	PlatformWatermarkDepth,
	PlatformWatermarkField,
} from "@magic-admin-v2/features/platform-info/types"

const watermarkSamples: Record<PlatformWatermarkField, string> = {
	real_name: "张三",
	employee_no: "2021034291",
	visit_time: "2026-09-09 14:30",
	department: "技术部",
	phone: "138****8888",
	email: "zhangsan@example.com",
}

describe("platform info watermark normalization", () => {
	it("falls back to the backend default configuration when the payload omits it", () => {
		assert.deepEqual(normalizePlatformWatermark(), {
			enabled: false,
			fields: ["real_name"],
			depth: "light",
		})
		assert.deepEqual(normalizePlatformWatermark(null), {
			enabled: false,
			fields: ["real_name"],
			depth: "light",
		})
	})

	it("keeps renderable fields in canonical order and rejects unknown values", () => {
		// 模拟后端返回历史字段或未支持的档位。
		const payload = {
			enabled: true,
			fields: ["department", "unknown_field", "real_name", "department"],
			depth: "extreme",
		} as unknown as Partial<PlatformInfoWatermark>

		assert.deepEqual(normalizePlatformWatermark(payload), {
			enabled: true,
			fields: ["real_name", "department"],
			depth: "light",
		})
	})

	it("keeps an explicitly empty field list so the user must pick a field before saving", () => {
		assert.deepEqual(
			normalizePlatformWatermark({ enabled: true, fields: [], depth: "strong" }),
			{ enabled: true, fields: [], depth: "strong" },
		)
	})

	it("normalizes the watermark carried by the platform details response", () => {
		const details = {
			...createDefaultPlatformInfoDetails(),
			watermark: { enabled: true, fields: ["email"], depth: "strong" },
		}

		assert.deepEqual(toPlatformInfoFormState(details).watermark, {
			enabled: true,
			fields: ["email"],
			depth: "strong",
		})
	})

	it("submits the whole watermark object whenever any of its fields is dirty", () => {
		const values = createEmptyPlatformInfoFormState()
		values.watermark = { enabled: true, fields: ["real_name", "phone"], depth: "strong" }

		assert.deepEqual(toChangedPlatformInfoParams(values, { watermark: { enabled: true } }), {
			watermark: { enabled: true, fields: ["real_name", "phone"], depth: "strong" },
		})
		assert.deepEqual(toChangedPlatformInfoParams(values, {}), {})
	})
})

describe("platform info watermark schema", () => {
	function parseWatermarkSection(watermark: PlatformInfoWatermark) {
		const schema = createPlatformInfoSchema((key) => key, "watermark")

		return schema.safeParse({ ...createEmptyPlatformInfoFormState(), watermark })
	}

	it("allows an empty field list while the watermark is disabled", () => {
		assert.equal(
			parseWatermarkSection({ enabled: false, fields: [], depth: "light" }).success,
			true,
		)
	})

	it("requires at least one field while the watermark is enabled", () => {
		const result = parseWatermarkSection({ enabled: true, fields: [], depth: "light" })

		assert.equal(result.success, false)
		if (!result.success) {
			const issue = result.error.issues.find(
				(item) => item.path.join(".") === "watermark.fields",
			)

			assert.equal(issue?.message, "platformInfo.validation.watermarkContentRequired")
		}
	})

	it("accepts an enabled watermark with a selected field", () => {
		assert.equal(
			parseWatermarkSection({ enabled: true, fields: ["real_name"], depth: "standard" })
				.success,
			true,
		)
	})

	it("rejects a depth value outside the supported options", () => {
		const result = parseWatermarkSection({
			enabled: false,
			fields: [],
			depth: "extreme" as unknown as PlatformWatermarkDepth,
		})

		assert.equal(result.success, false)
	})
})

describe("platform info watermark preview text", () => {
	it("joins the selected samples in the canonical field order", () => {
		assert.equal(
			buildPlatformWatermarkPreviewText(["real_name", "employee_no"], watermarkSamples),
			"张三 · 2021034291",
		)
		assert.equal(
			buildPlatformWatermarkPreviewText(platformWatermarkFields, watermarkSamples),
			"张三 · 2021034291 · 2026-09-09 14:30 · 技术部 · 138****8888 · zhangsan@example.com",
		)
	})

	it("returns an empty string when nothing is selected so the caller can use a fallback", () => {
		assert.equal(buildPlatformWatermarkPreviewText([], watermarkSamples), "")
	})
})

describe("platform info watermark section metadata", () => {
	it("registers the watermark section with its own copy and without the content language bar", () => {
		assert.equal(platformInfoSectionTitleKeys.watermark, "platformInfo.section.watermark")
		assert.equal(
			platformInfoSectionDescriptionKeys.watermark,
			"platformInfo.sectionDesc.watermark",
		)
		assert.equal(showsPlatformInfoContentLocale("watermark"), false)
		assert.equal(showsPlatformInfoContentLocale("footer"), true)
	})
})
