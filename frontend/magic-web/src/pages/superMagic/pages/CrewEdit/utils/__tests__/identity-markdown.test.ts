import { describe, expect, it } from "vitest"
import {
	buildIdentityMarkdown,
	findIdentityMarkdownFile,
	parseIdentityMarkdown,
	syncIdentityMarkdownContent,
	updateIdentityMarkdownContent,
} from "../identity-markdown"

describe("identity-markdown", () => {
	it("parses heading based identity markdown", () => {
		expect(
			parseIdentityMarkdown(`# Market Analyst

Writes weekly reports and tracks campaign performance.`),
		).toEqual({
			name: "Market Analyst",
			description: "Writes weekly reports and tracks campaign performance.",
			nameCn: "",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "",
			descriptionCn: "",
			descriptionEn: "",
			promptZh: "",
			promptEn: "",
		})
	})

	it("parses frontmatter based identity markdown", () => {
		expect(
			parseIdentityMarkdown(`---
name: "Growth Operator"
description: |
  Owns growth experiments
  and retention analysis
---
`),
		).toEqual({
			name: "Growth Operator",
			description: "Owns growth experiments\nand retention analysis",
			nameCn: "",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "",
			descriptionCn: "",
			descriptionEn: "",
			promptZh: "",
			promptEn: "",
		})
	})

	it("parses full IDENTITY markdown template", () => {
		expect(
			parseIdentityMarkdown(`---
name: Research Assistant
name_cn: 研究助手
role: Academic Researcher
role_cn: 学术研究员
description: An intelligent assistant focused on academic literature search and analysis.
description_cn: 专注学术文献搜索与分析的智能助手
---

<!--zh
你是一位专业的学术研究员，在文献综述、数据分析和学术写作方面拥有深厚的知识。
-->
You are an expert academic researcher with deep knowledge in literature review.`),
		).toEqual({
			name: "Research Assistant",
			nameCn: "研究助手",
			nameEn: "",
			role: "Academic Researcher",
			roleCn: "学术研究员",
			roleEn: "",
			description:
				"An intelligent assistant focused on academic literature search and analysis.",
			descriptionCn: "专注学术文献搜索与分析的智能助手",
			descriptionEn: "",
			promptZh:
				"你是一位专业的学术研究员，在文献综述、数据分析和学术写作方面拥有深厚的知识。",
			promptEn:
				"You are an expert academic researcher with deep knowledge in literature review.",
		})
	})

	it("parses dashed locale fields from frontmatter", () => {
		expect(
			parseIdentityMarkdown(`---
name-en: Global Strategist
name-cn: 全球策略师
role-en: Growth Planner
role-cn: 增长策划师
description-en: Plans cross-market growth experiments.
description-cn: 负责跨市场增长实验规划。
---
`),
		).toEqual({
			name: "",
			nameCn: "全球策略师",
			nameEn: "Global Strategist",
			role: "",
			roleCn: "增长策划师",
			roleEn: "Growth Planner",
			description: "",
			descriptionCn: "负责跨市场增长实验规划。",
			descriptionEn: "Plans cross-market growth experiments.",
			promptZh: "",
			promptEn: "",
		})
	})

	it("parses quoted description fields from generated frontmatter", () => {
		expect(
			parseIdentityMarkdown(`---
description: "Quoted description"
description-cn: "中文描述"
description-en: "English description"
---`),
		).toEqual({
			name: "",
			nameCn: "",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "",
			description: "Quoted description",
			descriptionCn: "中文描述",
			descriptionEn: "English description",
			promptZh: "",
			promptEn: "",
		})
	})

	it("preserves quotes inside description block scalar", () => {
		expect(
			parseIdentityMarkdown(`---
description: |
  "Quoted on purpose"
---`),
		).toEqual({
			name: "",
			nameCn: "",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "",
			description: '"Quoted on purpose"',
			descriptionCn: "",
			descriptionEn: "",
			promptZh: "",
			promptEn: "",
		})
	})

	it("prefers dashed locale fields over underscored ones", () => {
		expect(
			parseIdentityMarkdown(`---
name-cn: 新名字
name_cn: 旧名字
role-en: New Role
role_en: Old Role
description-cn: 新描述
description_cn: 旧描述
---`),
		).toEqual({
			name: "",
			nameCn: "新名字",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "New Role",
			description: "",
			descriptionCn: "新描述",
			descriptionEn: "",
			promptZh: "",
			promptEn: "",
		})
	})

	it("ignores deprecated localized title fields", () => {
		expect(
			parseIdentityMarkdown(`---
title-cn: 不应读取
title_cn: 也不应读取
title-en: Should ignore
title_en: Should also ignore
---`),
		).toEqual({
			name: "",
			nameCn: "",
			nameEn: "",
			role: "",
			roleCn: "",
			roleEn: "",
			description: "",
			descriptionCn: "",
			descriptionEn: "",
			promptZh: "",
			promptEn: "",
		})
	})

	it("builds canonical markdown output", () => {
		expect(
			buildIdentityMarkdown({
				name: "Research Assistant",
				nameCn: "研究助手",
				nameEn: "Research Assistant EN",
				role: "Academic Researcher",
				roleCn: "学术研究员",
				roleEn: "Academic Researcher EN",
				description:
					"An intelligent assistant focused on academic literature search and analysis.",
				descriptionCn: "专注学术文献搜索与分析的智能助手",
				descriptionEn: "English description",
				promptZh: "你是一位专业的学术研究员。",
				promptEn: "You are an expert academic researcher.",
			}),
		).toBe(`---
name: "Research Assistant"
name-cn: "研究助手"
name-en: "Research Assistant EN"
role: "Academic Researcher"
role-cn: "学术研究员"
role-en: "Academic Researcher EN"
description: "An intelligent assistant focused on academic literature search and analysis."
description-cn: "专注学术文献搜索与分析的智能助手"
description-en: "English description"
---

<!--zh
你是一位专业的学术研究员。
-->

You are an expert academic researcher.`)
	})

	it("finds .magic/IDENTITY.md from attachment list by relative path", () => {
		expect(
			findIdentityMarkdownFile([
				{
					file_id: "1",
					file_name: "README.md",
					relative_file_path: "README.md",
					source: 0,
				},
				{
					file_id: "2",
					file_name: "IDENTITY.md",
					relative_file_path: ".magic/IDENTITY.md",
					source: 0,
				},
			]),
		).toMatchObject({
			file_id: "2",
			file_name: "IDENTITY.md",
			relative_file_path: ".magic/IDENTITY.md",
		})
	})

	it("does not match root-level IDENTITY.md", () => {
		expect(
			findIdentityMarkdownFile([
				{
					file_id: "1",
					file_name: "IDENTITY.md",
					relative_file_path: "IDENTITY.md",
					source: 0,
				},
			]),
		).toBeNull()
	})

	it("does not match nested .magic/IDENTITY.md by relative path", () => {
		expect(
			findIdentityMarkdownFile([
				{
					file_id: "1",
					file_name: "IDENTITY.md",
					relative_file_path: "foo/.magic/IDENTITY.md",
					source: 0,
				},
			]),
		).toBeNull()
	})

	it("finds IDENTITY.md under .magic in file tree when paths are missing", () => {
		expect(
			findIdentityMarkdownFile([
				{
					source: 0,
					file_id: "m1",
					is_directory: true,
					file_name: ".magic",
					children: [
						{
							source: 0,
							file_id: "id1",
							file_name: "IDENTITY.md",
							is_directory: false,
						},
					],
				},
			]),
		).toMatchObject({
			file_id: "id1",
			file_name: "IDENTITY.md",
		})
	})

	it("prefers .magic/IDENTITY.md when root IDENTITY.md also exists", () => {
		expect(
			findIdentityMarkdownFile([
				{
					file_id: "root",
					file_name: "IDENTITY.md",
					relative_file_path: "IDENTITY.md",
					source: 0,
				},
				{
					file_id: "magic",
					file_name: "IDENTITY.md",
					relative_file_path: ".magic/IDENTITY.md",
					source: 0,
				},
			]),
		).toMatchObject({
			file_id: "magic",
			relative_file_path: ".magic/IDENTITY.md",
		})
	})

	it("does not match nested .magic folder in attachment tree", () => {
		expect(
			findIdentityMarkdownFile([
				{
					source: 0,
					file_id: "folder-1",
					is_directory: true,
					file_name: "foo",
					children: [
						{
							source: 0,
							file_id: "nested-magic",
							is_directory: true,
							file_name: ".magic",
							children: [
								{
									source: 0,
									file_id: "id1",
									file_name: "IDENTITY.md",
									is_directory: false,
								},
							],
						},
					],
				},
			]),
		).toBeNull()
	})

	it("updates only recognized frontmatter fields", () => {
		const originalContent = `---
name: Research Assistant
role: Academic Researcher
description: Old description
custom_field: keep-me
---

<!--zh
中文提示词
-->
English prompt

## Notes
Do not remove this block.`

		expect(
			updateIdentityMarkdownContent({
				originalContent,
				previousData: parseIdentityMarkdown(originalContent),
				nextData: {
					...parseIdentityMarkdown(originalContent),
					name: "Research Lead",
					description: "New description",
				},
			}).content,
		).toBe(`---
name: "Research Lead"
role: Academic Researcher
description: "New description"
custom_field: keep-me
---

<!--zh
中文提示词
-->
English prompt

## Notes
Do not remove this block.`)
	})

	it("keeps content unchanged when target fields are not recognizable", () => {
		const originalContent = `---
role: Academic Researcher
custom_field: keep-me
---

Arbitrary custom body`

		expect(
			updateIdentityMarkdownContent({
				originalContent,
				previousData: parseIdentityMarkdown(originalContent),
				nextData: {
					...parseIdentityMarkdown(originalContent),
					name: "Changed name",
					description: "Changed description",
				},
			}),
		).toEqual({
			content: originalContent,
			updatedName: false,
			updatedDescription: false,
		})
	})

	it("syncs localized frontmatter while preserving custom content", () => {
		const originalContent = `---
name: Old Name
name_cn: 历史名字
role: Old Role
role_en: Historical Role EN
description: Old description
description_cn: 历史描述
custom_field: keep-me
---

<!--zh
保留中文 prompt
-->

## Notes
Do not remove this block.`

		expect(
			syncIdentityMarkdownContent({
				originalContent,
				nextData: {
					...parseIdentityMarkdown(originalContent),
					name: "New Name",
					nameCn: "新名字",
					nameEn: "New Name EN",
					role: "New Role",
					roleCn: "新角色",
					roleEn: "New Role EN",
					description: "New description",
					descriptionCn: "新的描述",
					descriptionEn: "New description EN",
				},
			}),
		).toBe(`---
name: "New Name"
name-cn: "新名字"
name-en: "New Name EN"
role: "New Role"
role-cn: "新角色"
role-en: "New Role EN"
description: "New description"
description-cn: "新的描述"
description-en: "New description EN"
custom_field: keep-me
---

<!--zh
保留中文 prompt
-->

## Notes
Do not remove this block.`)
	})
})
