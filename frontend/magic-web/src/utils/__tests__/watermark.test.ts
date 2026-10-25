import { beforeEach, describe, expect, it } from "vitest"
import type { PlatformWatermarkConfig } from "@/apis/types"
import {
	USER_ID_WATERMARK_CONFIG,
	resolveUserWatermarkMode,
	resolveUserWatermarkRenderConfig,
	setPlatformWatermarkConfig,
	setWatermarkOrganizationType,
} from "../watermark"

const platformConfig: PlatformWatermarkConfig = {
	enabled: true,
	fields: ["real_name"],
	depth: "strong",
}

/** 取 rgba 颜色的透明度，用于断言“接近透明”。 */
function alphaOf(color: string) {
	const matched = color.match(/[\d.]+(?=\s*\))/)
	return matched ? Number(matched[0]) : Number.NaN
}

beforeEach(() => {
	setWatermarkOrganizationType(false)
	setPlatformWatermarkConfig(undefined)
})

describe("resolveUserWatermarkMode", () => {
	it("uses the platform watermark for shared organizations when it is enabled", () => {
		expect(
			resolveUserWatermarkMode({
				isPersonalOrganization: false,
				platformConfig,
				isLegacyEnabled: true,
			}),
		).toBe("platform")
	})

	it("keeps the environment controlled user id watermark for personal organizations", () => {
		expect(
			resolveUserWatermarkMode({
				isPersonalOrganization: true,
				platformConfig,
				isLegacyEnabled: true,
			}),
		).toBe("legacy")
	})

	it("disables the watermark when neither policy applies", () => {
		expect(
			resolveUserWatermarkMode({
				isPersonalOrganization: true,
				platformConfig,
				isLegacyEnabled: false,
			}),
		).toBe("disabled")
	})
})

describe("resolveUserWatermarkRenderConfig", () => {
	it("follows the configured depth for the platform watermark", () => {
		setPlatformWatermarkConfig({ ...platformConfig, depth: "strong" })

		const { config, key } = resolveUserWatermarkRenderConfig("platform")

		expect(key).toBe("strong")
		expect(config.textColor).toBe("rgba(0, 0, 0, 0.06)")
	})

	it("renders the personal organization user id watermark almost transparent", () => {
		setWatermarkOrganizationType(true)

		const { config, key } = resolveUserWatermarkRenderConfig("legacy")

		expect(key).toBe("user-id")
		expect(config.textColor).toBe("rgba(0, 0, 0, 0.01)")
		expect(config.textColor).toBe(USER_ID_WATERMARK_CONFIG.textColor)
		// 必须比共享组织最浅档位还要淡，否则个人组织版的水印会再次显眼。
		expect(alphaOf(config.textColor ?? "")).toBeLessThan(alphaOf("rgba(0, 0, 0, 0.03)"))
	})

	it("keeps the environment watermark almost transparent for shared organizations", () => {
		setWatermarkOrganizationType(false)

		const { config, key } = resolveUserWatermarkRenderConfig("legacy")

		expect(key).toBe("legacy")
		expect(config.textColor).toBe(USER_ID_WATERMARK_CONFIG.textColor)
		// 团队/企业组织与个人组织一致，必须比平台水印最浅档（0.03）还淡。
		expect(alphaOf(config.textColor ?? "")).toBeLessThan(alphaOf("rgba(0, 0, 0, 0.03)"))
	})

	it("returns a different render key per variant so the watermark remounts on switches", () => {
		setWatermarkOrganizationType(false)
		const sharedKey = resolveUserWatermarkRenderConfig("legacy").key

		setWatermarkOrganizationType(true)
		const personalKey = resolveUserWatermarkRenderConfig("legacy").key

		expect(personalKey).not.toBe(sharedKey)
	})
})
