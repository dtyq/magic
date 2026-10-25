import { describe, expect, it } from "vitest"
import { getStringFromContent } from "../contentUtils"

describe("getStringFromContent", () => {
	it("保留段落边界，避免草稿恢复后多行内容粘连", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "1. 中景/后仰视" }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "2. 特写/俯视" }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "3. 中景/平视" }],
				},
			],
		}

		expect(getStringFromContent(content)).toBe("1. 中景/后仰视\n2. 特写/俯视\n3. 中景/平视")
	})
})
