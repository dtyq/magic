import { describe, expect, it } from "vitest"
import { splitHighlights } from "../services/transcriptHighlights"

const answer =
	"最后一算，连送货带赊账，欠了十三万多。找了个中间人坐下来谈，分三次给了九万，剩下四万就不了了之了。"

describe("splitHighlights", () => {
	it("returns the text unchanged when nothing matches", () => {
		expect(splitHighlights("没有引用", [{ text: "完全不同的一句话" }])).toEqual([
			{ text: "没有引用" },
		])
	})

	it("matches each side of an ellipsis and keeps the tag", () => {
		const segments = splitHighlights(answer, [
			{ text: "“连送货带赊账，欠了十三万多……剩下四万就不了了之了。”", tag: "H1" },
		])
		expect(segments.filter((segment) => segment.mark)).toEqual([
			{ text: "连送货带赊账，欠了十三万多", mark: { tag: "H1" } },
			{ text: "剩下四万就不了了之了。", mark: { tag: "H1" } },
		])
		expect(segments.map((segment) => segment.text).join("")).toBe(answer)
	})

	it("drops overlapping matches and short fragments", () => {
		const segments = splitHighlights(answer, [
			{ text: "欠了十三万多。找了个中间人", tag: "H1" },
			{ text: "十三万多。找了个中间人坐下来谈", tag: "H2" },
			{ text: "九万" },
		])
		expect(segments.filter((segment) => segment.mark)).toEqual([
			{ text: "欠了十三万多。找了个中间人", mark: { tag: "H1" } },
		])
	})
})
