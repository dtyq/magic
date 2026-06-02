import { describe, expect, it } from "vitest"
import { extractCitations, trimIncompleteCitationTag } from "../citations"

describe("extractCitations", () => {
	it("should return no citations when no references block exists", () => {
		expect(extractCitations("Hello world, no citations here.")).toEqual([])
	})

	it("should parse a complete references block", () => {
		const content = `好的。我从录音里归出了三类：交付窗口<citation index="1"></citation>、合作方接口不稳定<citation index="2"></citation>。

<references>
<ref index="1" type="knowledge_base" title="Project Risk Taxonomy" knowledge_base_name="Ops Playbook" knowledge_base_id="kb_001" file_key="file_abc" />
<ref index="2" type="url" title="Partner API SLA" url="https://example.com/docs" />
</references>`

		const citations = extractCitations(content)

		expect(citations).toHaveLength(2)
		expect(citations[0]).toEqual({
			index: 1,
			type: "knowledge_base",
			title: "Project Risk Taxonomy",
			knowledge_base_name: "Ops Playbook",
			knowledge_base_id: "kb_001",
			file_key: "file_abc",
		})
		expect(citations[1]).toEqual({
			index: 2,
			type: "url",
			title: "Partner API SLA",
			url: "https://example.com/docs",
		})
	})

	it("should parse document_code from knowledge base references", () => {
		const content = `正文 <citation index="1"></citation>

<references>
<ref index="1" type="knowledge_base" title="ES搜索技术方案 - 后端.md" knowledge_base_name="ssss" knowledge_base_id="KNOWLEDGE-96e690043cb84a-508ceafa" document_code="52743672-b805-4059-92ca-ddf8e9bc5692" file_key="DT001/source.md" />
</references>`

		expect(extractCitations(content)[0]).toEqual(
			expect.objectContaining({
				index: 1,
				type: "knowledge_base",
				knowledge_base_id: "KNOWLEDGE-96e690043cb84a-508ceafa",
				document_code: "52743672-b805-4059-92ca-ddf8e9bc5692",
				file_key: "DT001/source.md",
			}),
		)
	})

	it("should parse completed refs from a streaming references block", () => {
		const content = `Hello<citation index="1"></citation>

<references>
<ref index="1" type="knowledge_base" title="Doc A" knowledge_base_name="KB1" knowledge_base_id="kb_x" file_key="f1" />
<ref index="2" type="url" title="Doc B" url="https://ex`

		const citations = extractCitations(content)

		expect(citations).toHaveLength(1)
		expect(citations[0].title).toBe("Doc A")
	})

	it("should decode HTML entities in attributes", () => {
		const content = `Text<citation index="1"></citation>
<references>
<ref index="1" type="knowledge_base" title="A &amp; B &lt;Doc&gt;" knowledge_base_name="KB &quot;Main&quot;" knowledge_base_id="kb1" file_key="f1" />
</references>`

		const citations = extractCitations(content)

		expect(citations[0].title).toBe("A & B <Doc>")
		expect(citations[0].knowledge_base_name).toBe('KB "Main"')
	})

	it("should handle references block in the middle of content", () => {
		const content = `以下是格式展示：

<references>
<ref index="1" type="url" title="Tech Debt" url="https://example.com/tech-debt" />
<ref index="2" type="url" title="Turnover" url="https://example.com/turnover" />
</references>

**项目风险评估汇总**

| 风险类型 | 影响程度 |
|---------|---------|
| 技术债务<citation index="1"></citation> | 高 |
| 人员流动<citation index="2"></citation> | 中 |`

		const citations = extractCitations(content)

		expect(citations).toHaveLength(2)
		expect(citations[0].type).toBe("url")
		expect(citations[1].url).toBe("https://example.com/turnover")
	})

	it("should ignore references text inside fenced code blocks", () => {
		const content = [
			"工具参数示例：",
			"```json",
			'{"tag":"<references>","value":"keep me"}',
			"```",
			"后续正文",
		].join("\n")

		expect(extractCitations(content)).toEqual([])
	})

	it("should ignore unclosed references text inside streaming fenced code blocks", () => {
		const content = [
			"工具参数示例：",
			"```json",
			'{"tag":"<references>","value":"keep me"}',
		].join("\n")

		expect(extractCitations(content)).toEqual([])
	})

	it("should ignore references text inside indented code blocks", () => {
		const content = [
			"工具参数示例：",
			"    <references>",
			'    {"value":"keep me"}',
			"    </references>",
			"后续正文",
		].join("\n")

		expect(extractCitations(content)).toEqual([])
	})

	it("should ignore references text inside list fenced code blocks", () => {
		const content = [
			"- 工具参数示例：",
			"    ```json",
			'    {"tag":"<references>","value":"keep me"}',
			"    ```",
			"后续正文",
		].join("\n")

		expect(extractCitations(content)).toEqual([])
	})

	it("should ignore standalone references tags inside list fenced code blocks", () => {
		const content = [
			"- 工具参数示例：",
			"  ```xml",
			"  <references>",
			'  <ref index="1" title="keep me" />',
			"  </references>",
			"  ```",
			"后续正文",
		].join("\n")

		expect(extractCitations(content)).toEqual([])
	})
})

describe("trimIncompleteCitationTag", () => {
	it("should not modify complete content", () => {
		expect(trimIncompleteCitationTag('Hello <citation index="1"></citation> world')).toBe(
			'Hello <citation index="1"></citation> world',
		)
	})

	it("should trim incomplete citation tag at end", () => {
		expect(trimIncompleteCitationTag("Hello <citation")).toBe("Hello ")
	})

	it("should trim opening citation tag without closing tag at end", () => {
		expect(trimIncompleteCitationTag('Hello <citation index="12">')).toBe("Hello ")
	})

	it("should trim citation tag with incomplete closing tag at end", () => {
		expect(trimIncompleteCitationTag('Hello <citation index="12"></cit')).toBe("Hello ")
		expect(trimIncompleteCitationTag('Hello <citation index="12"></citation')).toBe("Hello ")
	})

	it("should not trim incomplete citation text inside fenced code blocks", () => {
		expect(trimIncompleteCitationTag('```json\n{"tag":"<citation"}')).toBe(
			'```json\n{"tag":"<citation"}',
		)
	})

	it("should not trim complete citation tags", () => {
		expect(
			trimIncompleteCitationTag(
				'A<citation index="1"></citation>B<citation index="2"></citation>C',
			),
		).toBe('A<citation index="1"></citation>B<citation index="2"></citation>C')
	})

	it("should not trim complete self-closing citation tags", () => {
		expect(trimIncompleteCitationTag('Hello <citation index="1" />')).toBe(
			'Hello <citation index="1" />',
		)
	})

	it("should not trim complete self-closing citation tags followed by text", () => {
		expect(trimIncompleteCitationTag('Hello <citation index="1" /> world')).toBe(
			'Hello <citation index="1" /> world',
		)
	})
})

describe("extractCitations - type inference", () => {
	it("should infer knowledge_base type from fields even when type is wrong", () => {
		const content = `text<citation index="1"></citation>

<references>
<ref index="1" type="kb" title="Doc" knowledge_base_id="kb_001" file_key="f1" />
</references>`
		const citations = extractCitations(content)

		expect(citations[0].type).toBe("knowledge_base")
		expect(citations[0].file_key).toBe("f1")
		expect(citations[0].knowledge_base_id).toBe("kb_001")
	})

	it("should infer url type from url field even when type is missing", () => {
		const content = `text<citation index="1"></citation>

<references>
<ref index="1" title="Link" url="https://example.com" />
</references>`
		const citations = extractCitations(content)

		expect(citations[0].type).toBe("url")
		expect(citations[0].url).toBe("https://example.com")
	})

	it("should preserve all fields regardless of declared type", () => {
		const content = `text<citation index="1"></citation>

<references>
<ref index="1" type="url" title="Hybrid" knowledge_base_name="KB" file_key="f1" url="https://x.com" />
</references>`
		const citations = extractCitations(content)

		expect(citations[0].type).toBe("knowledge_base")
		expect(citations[0].file_key).toBe("f1")
		expect(citations[0].url).toBe("https://x.com")
	})
})
