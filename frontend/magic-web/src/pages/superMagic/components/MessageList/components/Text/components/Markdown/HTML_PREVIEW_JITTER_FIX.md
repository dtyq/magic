# HTML 预览抖动问题分析报告

**分支**：`enterprise-pre-release`  
**对比基准**：`enterprise-released`  
**问题现象**：流式消息中 ` ```html ` 代码块对应的 HTML 预览区域抖动（反复挂载/卸载）

---

## 一、根因定位

### 引入问题的提交

| 字段 | 内容 |
|------|------|
| Commit SHA | `f20bc8cf2e09ece0ce4a370f7397fcbef4bdc933` |
| 提交信息 | `feat(knowledge): implement knowledge base file link retrieval and preview functionality` |
| 作者 | seagull（863176846@qq.com） |
| 提交时间 | 2026-06-02 20:08:27 +0800 |

### 核心改动文件

```
frontend/magic-web/src/pages/superMagic/components/MessageList/components/Text/components/Markdown/
├── streamingMarkdown.ts          # 新增（重构了 fence 补全逻辑，但改变了行为）
├── __tests__/streamingMarkdown.test.ts  # 新增（将错误行为固化为测试断言）
└── index.tsx                     # 修改（删除了原有 ensureClosedMarkdownFence 调用；新增 citations 依赖）
```

---

## 二、行为变化对比

### enterprise-released（正确行为）

`index.tsx` 中：

```ts
// 无论是否 streaming，都会补齐未闭合的 fence
function ensureClosedMarkdownFence(markdown: string) {
  if (!markdown.includes("```")) return markdown
  const fenceCount = markdown.match(MARKDOWN_FENCE_LINE_PATTERN)?.length ?? 0
  if (fenceCount % 2 === 0) return markdown
  return `${markdown.replace(/\s*$/, "")}\n\`\`\``
}

// useMemo 中：
const fenceClosed = ensureClosedMarkdownFence(nextMarkdownSource)

// useMarkdownComponent deps 稳定：
return useMemo(
  () => ({ pre(...) {...}, ... }),
  [isStreaming, streamingScrollStateRef]  // streaming 期间完全稳定
)
```

### enterprise-pre-release（引入问题）

新增的 `streamingMarkdown.ts`：

```ts
export function resolveMarkdownRenderSource(
  markdown: string,
  options: ResolveMarkdownRenderSourceOptions,
) {
  // ⚠️ isStreaming=true 时直接返回原文，不补 fence
  if (options.isStreaming) return markdown
  return ensureClosedMarkdownFence(markdown)
}
```

`index.tsx` 中 useMarkdownComponent deps 加入了不稳定值：

```ts
return useMemo(
  () => ({ pre(...) {...}, citation(...) {...}, ... }),
  [isStreaming, streamingScrollStateRef, citations, highlightedCitation, onCitationClick]
  //                                    ↑ 每个 chunk citations 是新数组引用，导致重建
)
```

---

## 三、抖动链路说明

**本次共发现两个独立根因，两者叠加导致严重抖动。**

### 根因 1：fence 未补齐（来自 streamingMarkdown.ts 行为回归）

```
流式 chunk 到达
  → markdown 中出现未闭合的 ```html ... (无结束 ```)
  → resolveMarkdownRenderSource(isStreaming=true) 直接返回原文
  → XMarkdown 解析时 ```html 块未闭合，被解析为普通文本段落
  → HtmlCodeBlockPreview 没有收到完整 HTML → isPreviewable=false → 不渲染预览
  → 下一个 chunk 到达，解析结果在"代码块"和"普通段落"之间反复横跳
  → 组件反复 mount/unmount → 视觉抖动
```

放大因素：`shared.ts` 中非 void/self-rendering 元素必须有可见子内容才触发预览，
流式过程中半截 HTML（如 `<div class="...">`）更容易被判为"不可预览"，加剧抖动。

### 根因 2：citations 引发 components 对象每 chunk 重建（新增 citations 功能引入）

```
流式 chunk 到达
  → rawContent 变化
  → citations = extractCitations(rawContent) → 每次生成新数组引用（即使内容为空 []）
  → useMarkdownComponent deps 含 citations → components 对象重建
  → components.pre 是新函数引用
  → XMarkdown 认为 pre 是不同组件类型 → 重新挂载 HtmlCodeBlockPreview
  → 视觉抖动（每个 chunk 都触发）
```

**此为导致每个 chunk 都抖动的主因。** 即使根因 1 已修复，根因 2 单独也足以造成持续抖动。

---

## 四、错误被测试固化

`streamingMarkdown.test.ts` 原断言了错误行为：

```ts
// ⚠️ 断言 streaming 时不补 fence，这正是导致抖动的根因
it("does not append a synthetic closing fence during streaming", () => {
  expect(resolveMarkdownRenderSource(markdown, { isStreaming: true })).toBe(markdown)
})
```

---

## 五、值得保留的改动

该提交中有一个**合理**的改动，在修复时已保留：

```ts
// shouldEnableStreamingTextAnimation：有 fence 时禁用流式打字动画
// 避免代码块内容一边流入一边动画，体验更好
export function shouldEnableStreamingTextAnimation(markdown, options) {
  return options.isStreaming && !hasMarkdownFence(markdown)
}
```

---

## 六、修复方案（均已实施）

### 改动 1：`streamingMarkdown.ts`

```ts
// 修复前
export function resolveMarkdownRenderSource(markdown, options) {
  if (options.isStreaming) return markdown          // ← 删除
  return ensureClosedMarkdownFence(markdown)
}

// 修复后：无论是否 streaming，始终补齐未闭合 fence
export function resolveMarkdownRenderSource(markdown, _options) {
  return ensureClosedMarkdownFence(markdown)
}
```

### 改动 2：`streamingMarkdown.test.ts`

```ts
// 修复后：断言 streaming 时同样补 fence
it("appends a synthetic closing fence during streaming when fence is unclosed", () => {
  const markdown = ["```javascript", "console.log('streaming')"].join("\n")
  const expected = ["```javascript", "console.log('streaming')", "```"].join("\n")
  expect(resolveMarkdownRenderSource(markdown, { isStreaming: true })).toBe(expected)
})
```

### 改动 3：`Markdown/index.tsx` — useMarkdownComponent

将 citations 相关值改用 ref 持有，防止 `components` 对象每 chunk 重建：

```ts
// 用 ref 持有易变值，deps 恢复稳定
const citationsRef = useRef(citations)
citationsRef.current = citations
const highlightedCitationRef = useRef(highlightedCitation)
highlightedCitationRef.current = highlightedCitation
const onCitationClickRef = useRef(onCitationClick)
onCitationClickRef.current = onCitationClick

return useMemo(
  () => ({
    citation(props) {
      const hasCitationData = citationsRef.current?.some(...)
      const highlighted = highlightedCitationRef.current
      return <CitationBadge highlighted={highlighted === index} ... />
    },
  }),
  [isStreaming, streamingScrollStateRef]  // ← 与 enterprise-released 一致，streaming 期间完全稳定
)
```

---

## 七、影响范围

| 文件 | 改动性质 | 状态 | 影响 |
|------|----------|------|------|
| `streamingMarkdown.ts` | 修复行为回归 | ✅ 已修复 | 流式 HTML/代码块预览不再因 fence 缺失而抖动 |
| `streamingMarkdown.test.ts` | 同步更新断言 | ✅ 已修复 | 测试反映真实预期行为，4 个测试全部通过 |
| `Markdown/index.tsx` | 修复 components 引用稳定性 | ✅ 已修复 | streaming 期间 components.pre 引用稳定，HtmlCodeBlockPreview 不再每 chunk 重挂载 |
| `shared.ts` | 无需改动 | — | 两分支内容相同 |

`shouldEnableStreamingTextAnimation` 逻辑（禁用代码块 streaming 动画）**无需修改**，该逻辑本身是正确且有价值的新增。

---

*生成时间：2026-06-04*  
*分析者：GitHub Copilot CLI*
