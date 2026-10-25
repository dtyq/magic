import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	getAvailableProviderList,
	getProviderLabel,
	normalizeProviderConfig,
} from "../../../src/features/platform-system-capabilities/utils.ts"

describe("provider compatibility merge", () => {
	it("uses the single default provider only for a legacy provider without identity", () => {
		const normalized = normalizeProviderConfig(
			{ app_key: "masked", access_key: "masked", enable: true },
			{ provider: "Volcengine", name: "Volcengine", enable: true, app_key: "", access_key: "" },
		)

		assert.equal(normalized?.provider, "Volcengine")
		assert.equal(normalized?.name, "Volcengine")
		assert.equal(normalized?.app_key, "masked")
	})

	it("does not leak the Volcengine fallback into an explicitly named MagicEngine provider", () => {
		const normalized = normalizeProviderConfig(
			{
				provider: "MagicEngine",
				enable: false,
				ws_endpoint: "/go/ws/api/v3/sauc/bigmodel_async",
				upstream: { model_name: "qwen3-asr-flash" },
			},
			{ provider: "Volcengine", name: "Volcengine", enable: true, app_key: "", access_key: "" },
		)

		assert.equal(normalized?.provider, "MagicEngine")
		assert.equal(normalized?.name, "MagicEngine")
		assert.equal(normalized?.app_key, undefined)
		assert.equal(normalized?.access_key, undefined)
	})

	it("keeps distinct provider labels in the audio provider list", () => {
		const providers = getAvailableProviderList("audio_file_recognition", [
			{
				provider: "Volcengine",
				name: "Volcengine",
				app_key: "masked",
				access_key: "masked",
				enable: true,
			},
			{
				provider: "MagicEngine",
				enable: false,
				ws_endpoint: "/go/ws/api/v3/sauc/bigmodel_async",
				resource_id: "magic.sauc.duration",
				protocol: "volc-sauc",
				upstream: { model_name: "qwen3-asr-flash" },
				app_key: "masked",
				access_key: "masked",
			},
		])

		assert.deepEqual(
			providers.map((provider) => provider.provider),
			["Volcengine", "MagicEngine"],
		)
		assert.deepEqual(providers.map(getProviderLabel), ["Volcengine", "MagicEngine"])
	})
})
