import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createEmptyPlatformInfoFormState } from "../../../src/features/platform-info/api"
import { getContentLocaleCompletion } from "../../../src/features/platform-info/utils"

describe("platform info section language completion", () => {
	it("marks SEO complete independently of Agent and copyright content", () => {
		const value = createEmptyPlatformInfoFormState()
		value.title_i18n.zh_CN = "标题"
		value.keywords_i18n.zh_CN = "关键词"
		value.description_i18n.zh_CN = "描述"
		assert.deepEqual(getContentLocaleCompletion(value, "seo"), { zh_CN: true, en_US: false })
		assert.equal(getContentLocaleCompletion(value, "agentPrompt").zh_CN, false)
		assert.equal(getContentLocaleCompletion(value, "footer").zh_CN, false)
		for (const key of ["title_i18n", "keywords_i18n", "description_i18n"] as const) {
			const partial = structuredClone(value)
			partial[key].zh_CN = " \n "
			assert.equal(getContentLocaleCompletion(partial, "seo").zh_CN, false)
		}
	})

	it("requires both Agent fields in the same language and ignores other sections", () => {
		const value = createEmptyPlatformInfoFormState()
		value.agent_role_name_i18n.en_US = "Assistant"
		value.agent_role_description_i18n.zh_CN = "描述"
		assert.deepEqual(getContentLocaleCompletion(value, "agentPrompt"), {
			zh_CN: false,
			en_US: false,
		})
		value.agent_role_description_i18n.en_US = " Assistant description "
		assert.deepEqual(getContentLocaleCompletion(value, "agentPrompt"), {
			zh_CN: false,
			en_US: true,
		})
		value.agent_role_name_i18n.en_US = "\t"
		assert.equal(getContentLocaleCompletion(value, "agentPrompt").en_US, false)
	})

	it("judges copyright by localized text without requiring shared filing fields", () => {
		const value = createEmptyPlatformInfoFormState()
		value.footer.copyright_i18n = { zh_CN: "版权", en_US: "Copyright" }
		value.footer.filing = { enabled: true, number: "", link: "" }
		assert.deepEqual(getContentLocaleCompletion(value, "footer"), { zh_CN: true, en_US: true })
		value.footer.copyright_i18n.en_US = " "
		assert.deepEqual(getContentLocaleCompletion(value, "footer"), { zh_CN: true, en_US: false })
		value.footer.filing.enabled = false
		assert.deepEqual(getContentLocaleCompletion(value, "footer"), { zh_CN: true, en_US: false })
	})

	it("keeps empty localized sections incomplete", () => {
		const value = createEmptyPlatformInfoFormState()
		for (const section of ["seo", "agentPrompt", "footer"] as const) {
			assert.deepEqual(getContentLocaleCompletion(value, section), {
				zh_CN: false,
				en_US: false,
			})
		}
	})
})
