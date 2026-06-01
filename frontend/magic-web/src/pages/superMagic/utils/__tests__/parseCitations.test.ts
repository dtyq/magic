import { describe, it, expect } from "vitest"
import {
    parseCitations,
    trimIncompleteCiteMarker,
    CITE_MARKER_PATTERN,
} from "../parseCitations"

describe("parseCitations", () => {
    it("should return original content when no references block exists", () => {
        const content = "Hello world, no citations here."
        const result = parseCitations(content)
        expect(result.content).toBe(content)
        expect(result.citations).toEqual([])
        expect(result.isReferencesStreaming).toBe(false)
    })

    it("should parse a complete references block", () => {
        const content = `好的。我从录音里归出了三类：交付窗口{{cite:1}}、合作方接口不稳定{{cite:2}}。

<references>
<ref index="1" type="knowledge_base" title="Project Risk Taxonomy" knowledge_base_name="Ops Playbook" knowledge_base_id="kb_001" file_key="file_abc" />
<ref index="2" type="url" title="Partner API SLA" url="https://example.com/docs" />
</references>`

        const result = parseCitations(content)

        expect(result.content).toBe(
            "好的。我从录音里归出了三类：交付窗口{{cite:1}}、合作方接口不稳定{{cite:2}}。",
        )
        expect(result.citations).toHaveLength(2)
        expect(result.citations[0]).toEqual({
            index: 1,
            type: "knowledge_base",
            title: "Project Risk Taxonomy",
            knowledge_base_name: "Ops Playbook",
            knowledge_base_id: "kb_001",
            file_key: "file_abc",
        })
        expect(result.citations[1]).toEqual({
            index: 2,
            type: "url",
            title: "Partner API SLA",
            url: "https://example.com/docs",
        })
        expect(result.isReferencesStreaming).toBe(false)
    })

    it("should handle streaming (unclosed references block)", () => {
        const content = `Hello{{cite:1}}

<references>
<ref index="1" type="knowledge_base" title="Doc A" knowledge_base_name="KB1" knowledge_base_id="kb_x" file_key="f1" />
<ref index="2" type="url" title="Doc B" url="https://ex`

        const result = parseCitations(content)

        expect(result.content).toBe("Hello{{cite:1}}")
        expect(result.citations).toHaveLength(1)
        expect(result.citations[0].title).toBe("Doc A")
        expect(result.isReferencesStreaming).toBe(true)
    })

    it("should handle empty content", () => {
        const result = parseCitations("")
        expect(result.content).toBe("")
        expect(result.citations).toEqual([])
    })

    it("should decode HTML entities in attributes", () => {
        const content = `Text{{cite:1}}
<references>
<ref index="1" type="knowledge_base" title="A &amp; B &lt;Doc&gt;" knowledge_base_name="KB &quot;Main&quot;" knowledge_base_id="kb1" file_key="f1" />
</references>`

        const result = parseCitations(content)
        expect(result.citations[0].title).toBe('A & B <Doc>')
        expect(result.citations[0].knowledge_base_name).toBe('KB "Main"')
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
| 技术债务{{cite:1}} | 高 |
| 人员流动{{cite:2}} | 中 |`

        const result = parseCitations(content)

        expect(result.citations).toHaveLength(2)
        expect(result.citations[0].type).toBe("url")
        expect(result.citations[1].url).toBe("https://example.com/turnover")
        // 前后内容都保留
        expect(result.content).toContain("以下是格式展示")
        expect(result.content).toContain("**项目风险评估汇总**")
        expect(result.content).toContain("{{cite:1}}")
        expect(result.content).not.toContain("<references>")
        expect(result.isReferencesStreaming).toBe(false)
    })
})

describe("trimIncompleteCiteMarker", () => {
    it("should not modify complete content", () => {
        expect(trimIncompleteCiteMarker("Hello {{cite:1}} world")).toBe("Hello {{cite:1}} world")
    })

    it("should trim incomplete {{cite: at end", () => {
        expect(trimIncompleteCiteMarker("Hello {{cite:")).toBe("Hello ")
    })

    it("should trim incomplete {{cite:1 at end (no closing }})", () => {
        expect(trimIncompleteCiteMarker("Hello {{cite:12")).toBe("Hello ")
    })

    it("should trim {{ at end", () => {
        expect(trimIncompleteCiteMarker("Hello {{cite")).toBe("Hello ")
    })

    it("should not trim complete markers", () => {
        expect(trimIncompleteCiteMarker("A{{cite:1}}B{{cite:2}}C")).toBe("A{{cite:1}}B{{cite:2}}C")
    })
})

describe("parseCitations - type inference", () => {
    it("should infer knowledge_base type from fields even when type is wrong", () => {
        const content = `text{{cite:1}}

<references>
<ref index="1" type="kb" title="Doc" knowledge_base_id="kb_001" file_key="f1" />
</references>`
        const result = parseCitations(content)
        expect(result.citations[0].type).toBe("knowledge_base")
        expect(result.citations[0].file_key).toBe("f1")
        expect(result.citations[0].knowledge_base_id).toBe("kb_001")
    })

    it("should infer url type from url field even when type is missing", () => {
        const content = `text{{cite:1}}

<references>
<ref index="1" title="Link" url="https://example.com" />
</references>`
        const result = parseCitations(content)
        expect(result.citations[0].type).toBe("url")
        expect(result.citations[0].url).toBe("https://example.com")
    })

    it("should preserve all fields regardless of declared type", () => {
        const content = `text{{cite:1}}

<references>
<ref index="1" type="url" title="Hybrid" knowledge_base_name="KB" file_key="f1" url="https://x.com" />
</references>`
        const result = parseCitations(content)
        // 有 file_key → knowledge_base 优先
        expect(result.citations[0].type).toBe("knowledge_base")
        expect(result.citations[0].file_key).toBe("f1")
        expect(result.citations[0].url).toBe("https://x.com")
    })
})

describe("CITE_MARKER_PATTERN", () => {
    it("should match all cite markers in text", () => {
        const text = "A{{cite:1}}B{{cite:23}}C{{cite:4}}"
        const matches = [...text.matchAll(CITE_MARKER_PATTERN)]
        expect(matches).toHaveLength(3)
        expect(matches[0][1]).toBe("1")
        expect(matches[1][1]).toBe("23")
        expect(matches[2][1]).toBe("4")
    })
})
