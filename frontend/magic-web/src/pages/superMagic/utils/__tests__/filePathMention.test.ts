import { describe, expect, it } from "vitest"
import {
	createCanonicalWorkspaceHref,
	extractFilePathMentions,
	parseFilePathMentionAt,
	replaceFilePathMentions,
} from "../filePathMention"

const balancedBracketPath = "team/[active] 20260629/review-schedule.html"
const unclosedBracketPath = "team/[active 20260629/review-schedule.html"
const bareClosingBracketPath = "team/active] 20260629/review-schedule.html"

describe("filePathMention", () => {
	it("parses simple unquoted paths", () => {
		expect(parseFilePathMentionAt("[@file_path:reports/a.md]")).toMatchObject({
			path: "reports/a.md",
			fullMatch: "[@file_path:reports/a.md]",
		})
	})

	it("parses paths with balanced square brackets", () => {
		const input = `[@file_path:${balancedBracketPath}]`
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: balancedBracketPath,
			fullMatch: input,
		})
	})

	it("parses paths with an unclosed opening bracket before the closing delimiter", () => {
		const input = `[@file_path:${unclosedBracketPath}]`
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: unclosedBracketPath,
			fullMatch: input,
		})
	})

	it("parses quoted paths containing bare closing brackets", () => {
		const input = `[@file_path:"${bareClosingBracketPath}"]`
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: bareClosingBracketPath,
			fullMatch: input,
		})
	})

	it("requires quotes for paths containing bare closing brackets", () => {
		const input = `[@file_path:${bareClosingBracketPath}]`
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: "team/active",
			fullMatch: "[@file_path:team/active]",
		})
	})

	it("stops an unquoted mention before later bracketed multiline content", () => {
		const content = `[@file_path:个人使用画像/个人AI协作画像.md]

本次采用**最小化更新**。

10. 部分 [unknown]`

		expect(extractFilePathMentions(content)).toEqual([
			expect.objectContaining({
				path: "个人使用画像/个人AI协作画像.md",
				fullMatch: "[@file_path:个人使用画像/个人AI协作画像.md]",
			}),
		])
	})

	it("stops an unquoted mention before later bracketed inline content", () => {
		const content = "[@file_path:reports/a.md] result 10. [unknown]"

		expect(parseFilePathMentionAt(content)).toMatchObject({
			path: "reports/a.md",
			fullMatch: "[@file_path:reports/a.md]",
		})
	})

	it("parses single-quoted paths and supports escape sequences", () => {
		const input = "[@file_path:'reports/[draft\\] v2]/final.md']"
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: "reports/[draft] v2]/final.md",
			fullMatch: input,
		})
	})

	it("preserves special characters in quoted paths for downstream html escaping", () => {
		const input = '[@file_path:"foo\\"bar&baz\'qux"]'
		expect(parseFilePathMentionAt(input)).toMatchObject({
			path: "foo\"bar&baz'qux",
		})
	})

	it("extracts multiple mentions from mixed content", () => {
		const content =
			"See [@file_path:docs/a.md] and [@file_path:team/[active]/b.html] in the message"
		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual([
			"docs/a.md",
			"team/[active]/b.html",
		])
	})

	it("replaces mentions while preserving surrounding text", () => {
		const content = "prefix [@file_path:team/[active] x.html] suffix"
		expect(
			replaceFilePathMentions(content, (path) => `<file-path path="${path}"></file-path>`),
		).toBe('prefix <file-path path="team/[active] x.html"></file-path> suffix')
	})

	it("returns null for malformed quoted mentions", () => {
		expect(parseFilePathMentionAt('[@file_path:"missing closing quote]')).toBeNull()
		expect(parseFilePathMentionAt("[@file_path:'missing-bracket\"]")).toBeNull()
	})

	it("skips malformed mentions and continues scanning", () => {
		const content = '[@file_path:"unclosed quote] ok [@file_path:good.md]'
		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual(["good.md"])
	})

	it("does not merge consecutive mentions when an unclosed bracket is followed by another mention", () => {
		const content = [
			`[@file_path:${unclosedBracketPath}]`,
			`[@file_path:"${bareClosingBracketPath}"]`,
		].join("\n")

		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual([
			unclosedBracketPath,
			bareClosingBracketPath,
		])
	})

	it("does not treat the next mention as part of a bare closing bracket path", () => {
		const content = "[@file_path:a.md] [@file_path:b.md]"
		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual([
			"a.md",
			"b.md",
		])
	})

	it("extracts all three mixed mention styles from message-like content", () => {
		const content = `# sample heading
[@file_path:${balancedBracketPath}]
[@file_path:${unclosedBracketPath}]
 [@file_path:"${bareClosingBracketPath}"]
`

		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual([
			balancedBracketPath,
			unclosedBracketPath,
			bareClosingBracketPath,
		])
	})

	it("does not absorb plain text between tightly packed mentions", () => {
		const content = [
			`[@file_path:${balancedBracketPath}]noise1`,
			`[@file_path:${unclosedBracketPath}]noise2`,
			`[@file_path:"${bareClosingBracketPath}"]`,
		].join("")

		expect(extractFilePathMentions(content).map((match) => match.path)).toEqual([
			balancedBracketPath,
			unclosedBracketPath,
			bareClosingBracketPath,
		])
	})
})

describe("createCanonicalWorkspaceHref", () => {
	it("serializes workspace-relative and root-prefixed paths as ./ hrefs", () => {
		expect(createCanonicalWorkspaceHref("77/images/cat.png")).toBe("./77/images/cat.png")
		expect(createCanonicalWorkspaceHref("./77/images/cat.png")).toBe("./77/images/cat.png")
		expect(createCanonicalWorkspaceHref("/77/images/cat.png")).toBe("./77/images/cat.png")
		expect(createCanonicalWorkspaceHref("asset://virtual-id")).toBeNull()
	})
})
