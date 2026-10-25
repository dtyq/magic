import { describe, expect, it } from "vitest"
import { encodeCrewAgentPrompt, CREW_AGENT_PROMPT_VERSION } from "../agent-prompt"
import { unshadow } from "@/utils/shadow"

describe("提示词多语言传输", () => {
	it("JSON 传输后提示词文本保持一致", () => {
		const text = "저 코드 မြန်မာ 日本語 \u{1f600} SHADOWED_literal"
		const wire = JSON.parse(JSON.stringify({ prompt_shadow: encodeCrewAgentPrompt(text) }))
		expect(wire.prompt_shadow).toMatch(/^SHADOWED2_/)
		expect(JSON.parse(unshadow(wire.prompt_shadow))).toEqual({
			version: CREW_AGENT_PROMPT_VERSION,
			structure: { string: text },
		})
	})
})
