# 消息引用 (Citations) 功能文档

## 概述

消息引用功能允许 Agent 回复中内嵌知识库引用或外部链接引用，用户可通过点击内联编号 badge 与引用列表进行交互。

---

## 数据格式

### 正文内联标记

在 `agent_reply` 的 `content` 字段中，使用 `{{cite:N}}` 标记引用位置（N 从 1 开始）：

```
好的。我从录音里归出了三类：交付窗口{{cite:1}}、合作方接口不稳定{{cite:2}}、设计稿未定稿{{cite:3}}。
```

### 引用定义块

在 `content` 末尾附加 `<references>...</references>` XML 块，包含各引用来源的结构化数据：

```xml
<references>
<ref index="1" type="knowledge_base" title="Project Risk Taxonomy & Severity Matrix" knowledge_base_name="Project Operations Playbook" knowledge_base_id="kb_001" file_key="file_abc" />
<ref index="2" type="url" title="Partner API SLA & Escalation Procedures" url="https://example.com/docs/api-sla" />
<ref index="3" type="knowledge_base" title="Design Handoff Protocol v2" knowledge_base_name="Product & Design Knowledge Base" knowledge_base_id="kb_002" file_key="file_def" />
</references>
```

---

## 完整 content 示例

### 示例 1：知识库引用

```
好的。我从录音里归出了三类：交付窗口{{cite:1}}、合作方接口不稳定{{cite:2}}、设计稿未定稿{{cite:3}}。接下来会按「风险 / 影响 / 建议负责人」输出表格。

| 风险类型 | 影响程度 | 建议负责人 |
|---------|---------|-----------|
| 交付窗口{{cite:1}} | 高 | PM |
| 合作方接口不稳定{{cite:2}} | 中 | 后端 |
| 设计稿未定稿{{cite:3}} | 低 | 设计 |

<references>
<ref index="1" type="knowledge_base" title="Project Risk Taxonomy & Severity Matrix" knowledge_base_name="Project Operations Playbook" knowledge_base_id="kb_001" file_key="file_abc" />
<ref index="2" type="knowledge_base" title="Partner API SLA & Escalation Procedures" knowledge_base_name="Engineering Standards Docs" knowledge_base_id="kb_002" file_key="file_def" />
<ref index="3" type="knowledge_base" title="Design Handoff Protocol v2" knowledge_base_name="Product & Design Knowledge Base" knowledge_base_id="kb_003" file_key="file_ghi" />
</references>
```

### 示例 2：混合引用（知识库 + URL）

```
根据最新的技术文档{{cite:1}}和社区讨论{{cite:2}}，推荐使用 React Server Components 来优化首屏加载性能。具体实施方案可参考内部架构规范{{cite:3}}。

<references>
<ref index="1" type="knowledge_base" title="前端架构选型指南 2024" knowledge_base_name="技术文档库" knowledge_base_id="kb_tech" file_key="file_arch_guide" />
<ref index="2" type="url" title="RFC: React Server Components" url="https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md" />
<ref index="3" type="knowledge_base" title="服务端渲染实施规范" knowledge_base_name="工程规范" knowledge_base_id="kb_eng" file_key="file_ssr_spec" />
</references>
```

### 示例 3：仅 URL 引用

```
Tailwind CSS v4 引入了全新的引擎{{cite:1}}，性能提升显著。迁移指南{{cite:2}}中列出了所有 breaking changes。

<references>
<ref index="1" type="url" title="Tailwind CSS v4.0 - Official Blog" url="https://tailwindcss.com/blog/tailwindcss-v4" />
<ref index="2" type="url" title="Upgrade Guide - Tailwind CSS" url="https://tailwindcss.com/docs/upgrade-guide" />
</references>
```

---

## `<ref />` 标签属性说明

| 属性                  | 必填                | 说明                                           |
| --------------------- | ------------------- | ---------------------------------------------- |
| `index`               | ✅                  | 引用序号，从 1 开始，对应正文中的 `{{cite:N}}` |
| `type`                | ✅                  | 引用类型：`knowledge_base` 或 `url`            |
| `title`               | ✅                  | 文档/页面标题                                  |
| `knowledge_base_name` | 仅 `knowledge_base` | 知识库名称                                     |
| `knowledge_base_id`   | 仅 `knowledge_base` | 知识库 ID                                      |
| `file_key`            | 仅 `knowledge_base` | 文件唯一标识，用于打开预览                     |
| `file_extension`      | 仅 `knowledge_base` | 文件扩展名（如 `pdf`、`docx`），用于 Tab 图标  |
| `url`                 | 仅 `url`            | 外部链接地址                                   |

### 属性值转义

属性值中的特殊字符需使用 HTML 实体：

| 字符 | 转义     |
| ---- | -------- |
| `&`  | `&amp;`  |
| `<`  | `&lt;`   |
| `>`  | `&gt;`   |
| `"`  | `&quot;` |
| `'`  | `&#39;`  |

---

## 流式传输兼容性

该格式天然支持流式传输（SSE / chunk streaming）：

### 流式阶段行为

| 阶段            | content 状态                                  | 前端行为                                             |
| --------------- | --------------------------------------------- | ---------------------------------------------------- |
| 正文输出        | `交付窗口{{cite:1`                            | `{{cite:` 未闭合 → 截断末尾不完整标记，不渲染        |
| 标记完成        | `交付窗口{{cite:1}}`                          | 完整标记 → 渲染为圆形数字 badge                      |
| references 开始 | `...<references>\n<ref index="1"...`          | 检测到 `<references>` → 从正文分离，开始解析引用数据 |
| ref 逐条到达    | `...<ref index="1" ... />\n<ref index="2"...` | 已完成的 `<ref />` 即时解析，CitationCard 逐条出现   |
| references 结束 | `...</references>`                            | 全部引用到位，完整渲染                               |

### 关键设计

- **引用数据内嵌在 content 中** → 不需要额外字段，不修改消息协议
- **`{{cite:N}}` 而非 `[N]`** → 避免与 Markdown 链接语法 `[text](url)` 冲突
- **`<references>` 在 content 末尾** → 前端可通过正则分离，不影响正文 Markdown 渲染
- **流式中截断保护** → 末尾不完整的 `{{cite:` 会被自动隐藏，不会展示给用户

---

## TypeScript 类型定义

```typescript
interface CitationSource {
	/** 引用序号（从 1 开始） */
	index: number
	/** 引用类型 */
	type: "knowledge_base" | "url"
	/** 文档标题 */
	title: string
	/** 知识库名称 (type === 'knowledge_base') */
	knowledge_base_name?: string
	/** 知识库 ID (type === 'knowledge_base') */
	knowledge_base_id?: string
	/** 文件 key (type === 'knowledge_base') */
	file_key?: string
	/** URL (type === 'url') */
	url?: string
}

interface ParseCitationsResult {
	/** 去除 <references> 块后的正文内容 */
	content: string
	/** 解析出的引用来源列表 */
	citations: CitationSource[]
	/** 是否正在流式中（<references> 块未闭合） */
	isReferencesStreaming: boolean
}
```

---

## 前端解析 API

```typescript
import { parseCitations, trimIncompleteCiteMarker } from "@/pages/superMagic/utils/parseCitations"

// 1. 从 content 中分离引用数据
const { content, citations, isReferencesStreaming } = parseCitations(rawContent)

// 2. 流式阶段：截断末尾不完整的 {{cite: 标记
const displayContent = isReferencesStreaming ? trimIncompleteCiteMarker(content) : content
```

---

## 交互行为

| 操作                           | 行为                                                      |
| ------------------------------ | --------------------------------------------------------- |
| 点击正文中的 badge             | 高亮 CitationCard 中对应条目                              |
| 点击 CitationCard 条目序号     | 切换该条目高亮状态                                        |
| 点击 CitationCard 外部链接按钮 | `knowledge_base` → 打开文件预览 tab；`url` → 新标签页打开 |
| CitationCard header            | 折叠/展开引用列表                                         |

---

## 边界情况

| 场景                                      | 处理方式                               |
| ----------------------------------------- | -------------------------------------- |
| `{{cite:5}}` 但 references 只有 3 条      | badge 显示但灰色不可点击               |
| 正文中无 `{{cite:N}}` 但有 `<references>` | 仅显示 CitationCard，无内联 badge      |
| `<references>` 中 `<ref />` 缺少必填属性  | 该条引用被跳过不解析                   |
| 属性值包含 HTML 特殊字符                  | 使用 HTML 实体转义（`&amp;` 等）       |
| 分享场景 (`isShare = true`)               | 引用正常渲染，知识库点击可能需降级处理 |
