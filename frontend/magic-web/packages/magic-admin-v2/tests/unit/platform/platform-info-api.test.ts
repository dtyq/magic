import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RequestUrl } from "@magic-admin-v2/api/constants"
import type { HttpClient } from "@magic-admin-v2/api/types"
import {
	createDefaultPlatformInfoDetails,
	createEmptyPlatformInfoFormState,
	createPlatformInfoApi,
	toChangedPlatformInfoParams,
	toPlatformInfoFormState,
} from "@magic-admin-v2/features/platform-info/api"
import type {
	PlatformInfoDetails,
	PlatformInfoFormState,
} from "@magic-admin-v2/features/platform-info/types"
import {
	createPlatformInfoSchema,
	GLOBAL_SYSTEM_PROMPT_MAX_LENGTH,
} from "@magic-admin-v2/features/platform-info/utils"

function createValidFormState(): PlatformInfoFormState {
	return {
		...createEmptyPlatformInfoFormState(),
		logo: {
			zh_CN: "https://example.com/logo-zh.png",
			en_US: "https://example.com/logo-en.png",
		},
		favicon: "https://example.com/favicon.png",
		minimal_logo: "https://example.com/minimal-logo.png",
		name_i18n: { zh_CN: "平台", en_US: "Platform" },
		agent_role_name_i18n: { zh_CN: "助理", en_US: "Assistant" },
		agent_role_description_i18n: { zh_CN: "角色说明", en_US: "Role description" },
	}
}

describe("platform info global system prompt", () => {
	it("normalizes a missing prompt to an empty string", () => {
		const details = createDefaultPlatformInfoDetails()
		delete details.global_system_prompt

		assert.equal(toPlatformInfoFormState(details).global_system_prompt, "")
	})

	it("preserves an explicitly cleared prompt", () => {
		const details = {
			...createDefaultPlatformInfoDetails(),
			global_system_prompt: "",
		}

		assert.equal(toPlatformInfoFormState(details).global_system_prompt, "")
	})

	it("submits only the dirty global system prompt, including an empty string", () => {
		const values = createValidFormState()
		values.global_system_prompt = ""

		assert.deepEqual(toChangedPlatformInfoParams(values, { global_system_prompt: true }), {
			global_system_prompt: "",
		})
	})

	it("maps localized logo changes to only the corresponding request fields", () => {
		const values = createValidFormState()

		assert.deepEqual(toChangedPlatformInfoParams(values, { logo: { zh_CN: true } }), {
			logo_zh_url: values.logo.zh_CN,
		})
		assert.deepEqual(toChangedPlatformInfoParams(values, { logo: { en_US: true } }), {
			logo_en_url: values.logo.en_US,
		})
	})

	it("passes a partial payload to PUT and returns the refreshed platform details", async () => {
		let requestUrl = ""
		let requestBody: unknown
		const response: PlatformInfoDetails = {
			...createDefaultPlatformInfoDetails(),
			global_system_prompt: "Updated prompt",
		}
		const client = {
			put: async (url: string, body: unknown) => {
				requestUrl = url
				requestBody = body
				return response
			},
		} as unknown as HttpClient

		const result = await createPlatformInfoApi(client).updatePlatformInfo({
			global_system_prompt: "Updated prompt",
		})

		assert.equal(requestUrl, RequestUrl.platformInfo)
		assert.deepEqual(requestBody, { global_system_prompt: "Updated prompt" })
		assert.equal(result, response)
	})

	it("validates only the selected tab schema and preserves other tab values", () => {
		const schema = createPlatformInfoSchema((key) => key, "globalSystemPrompt")
		const values = createEmptyPlatformInfoFormState()
		const result = schema.safeParse(values)

		assert.equal(result.success, true)
		if (result.success) {
			assert.deepEqual(result.data.logo, values.logo)
		}
		assert.equal(
			schema.safeParse({
				...values,
				global_system_prompt: "a".repeat(GLOBAL_SYSTEM_PROMPT_MAX_LENGTH + 1),
			}).success,
			false,
		)
	})

	it("accepts 5,000 characters and rejects 5,001 characters", () => {
		const schema = createPlatformInfoSchema((key) => key)
		const values = createValidFormState()

		assert.equal(
			schema.safeParse({
				...values,
				global_system_prompt: "a".repeat(GLOBAL_SYSTEM_PROMPT_MAX_LENGTH),
			}).success,
			true,
		)
		assert.equal(
			schema.safeParse({
				...values,
				global_system_prompt: "a".repeat(GLOBAL_SYSTEM_PROMPT_MAX_LENGTH + 1),
			}).success,
			false,
		)
	})
})
