import { describe, expect, it } from "vitest"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { buildArticlePromptContent } from "../services/selfMediaPromptBuilder"
import type {
	ArticleDetail,
	MaterialItem,
	SelfMediaInitGlobalSettings,
} from "../components/SelfMediaInitPanel/types"

function makeMaterial(name: string, uploadedPath: string, description = ""): MaterialItem {
	return {
		id: `${name}-${uploadedPath}`,
		file: new File(["dummy"], name, { type: "image/png" }),
		previewUrl: "",
		description,
		uploadedPath,
	}
}

function paragraphText(node: JSONContent | undefined): string {
	if (!node?.content) return ""
	return node.content
		.map((item) => {
			if (item.type === "text") return item.text || ""
			if (item.type === "hardBreak") return "\n"
			return ""
		})
		.join("")
}

function paragraphHasMention(node: JSONContent | undefined, filePath: string): boolean {
	return Boolean(
		node?.content?.some(
			(item) =>
				item.type === "mention" &&
				item.attrs?.type === "project_file" &&
				item.attrs?.data?.file_path === filePath,
		),
	)
}

describe("buildArticlePromptContent", () => {
	const global: SelfMediaInitGlobalSettings = {
		author: "测试账号",
		brandPosition: "效率工具分享",
		targetAudience: "职场创作者",
		brandImages: [],
	}

	it("wraps section labels with corner brackets", () => {
		const article: ArticleDetail = {
			title: "标签格式测试",
			folderName: "",
			style: "professional",
			visualPreset: "none",
			outline: [],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const labels = (result.content.content || []).map((node) => paragraphText(node))

		expect(labels).toContain("【品牌信息】")
		expect(labels).toContain("【文章要求】")
		expect(labels).not.toContain("品牌信息")
		expect(labels).not.toContain("文章要求")
	})

	it("keeps image handling guidance lightweight in frontend prompt", () => {
		const article: ArticleDetail = {
			title: "用 AI 提高写作效率",
			folderName: "",
			style: "professional",
			visualPreset: "none",
			outline: [],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const doc = result.content.content || []
		const fullText = doc.map((node) => paragraphText(node)).join("\n")

		expect(fullText).toContain("图片处理请遵循项目自媒体创作规范")
		expect(fullText).not.toContain("generate_images")
		expect(fullText).not.toContain("图片占位符 1")
	})

	it("embeds each outline level attachment as inline @ mentions", () => {
		const rootMaterial = makeMaterial(
			"root.png",
			"self-media/posts/01-post/materials/root.png",
			"一级节点配图",
		)
		const childMaterial = makeMaterial(
			"child.png",
			"self-media/posts/01-post/materials/child.png",
			"二级节点配图",
		)

		const article: ArticleDetail = {
			title: "分层大纲测试",
			folderName: "",
			style: "professional",
			visualPreset: "none",
			outline: [
				{
					id: "root-1",
					text: "一级节点",
					materials: [rootMaterial],
					children: [
						{
							id: "child-1",
							text: "二级节点",
							materials: [childMaterial],
							children: [],
						},
					],
				},
			],
			cardCount: 0,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const doc = result.content.content || []
		const rootParagraph = doc.find((node) => paragraphText(node).includes("一级节点"))
		const childParagraph = doc.find((node) => paragraphText(node).includes("二级节点"))

		expect(paragraphHasMention(rootParagraph, rootMaterial.uploadedPath ?? "")).toBe(true)
		expect(paragraphHasMention(childParagraph, childMaterial.uploadedPath ?? "")).toBe(true)
	})

	it("adds guidance to recreate screenshot or image outline attachments with emphasis", () => {
		const screenshotMaterial = makeMaterial(
			"dashboard-screenshot.png",
			"self-media/posts/01-post/materials/dashboard-screenshot.png",
			"后台核心指标截图",
		)
		const article: ArticleDetail = {
			title: "截图二次创作测试",
			folderName: "",
			style: "professional",
			visualPreset: "none",
			outline: [
				{
					id: "node-1",
					text: "展示核心指标",
					materials: [screenshotMaterial],
					children: [],
				},
			],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const fullText = (result.content.content || [])
			.map((node) => paragraphText(node))
			.join("\n")

		expect(fullText).toContain("二次创作")
		expect(fullText).toContain("重点区域")
		expect(fullText).toContain("generate_images")
	})

	it("does not duplicate missing-image execution rules from the backend skill", () => {
		const article: ArticleDetail = {
			title: "无图素材测试",
			folderName: "",
			style: "professional",
			visualPreset: "none",
			outline: [
				{
					id: "node-1",
					text: "用示意图解释三步方法",
					materials: [],
					children: [],
				},
			],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const fullText = (result.content.content || [])
			.map((node) => paragraphText(node))
			.join("\n")

		expect(fullText).toContain("图片处理请遵循项目自媒体创作规范")
		expect(fullText).not.toContain("适合生图")
		expect(fullText).not.toContain("不适合生图")
		expect(fullText).not.toContain("占位样式")
	})

	it("does not include concrete visual preset file paths", () => {
		const article: ArticleDetail = {
			title: "视觉路径测试",
			folderName: "",
			style: "professional",
			visualPreset: "minimal",
			outline: [],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/01-post/materials",
		)
		const fullText = (result.content.content || [])
			.map((node) => paragraphText(node))
			.join("\n")

		expect(fullText).toContain("视觉要求")
		expect(fullText).toContain("预设标识：minimal")
		expect(fullText).not.toContain("shared/presets")
		expect(fullText).not.toContain("minimal.css")
		expect(fullText).not.toContain("minimal.js")
	})

	it("tells the agent to leave the prefilled project index unchanged", () => {
		const article: ArticleDetail = {
			title: "预登记测试",
			folderName: "prefilled-post",
			style: "professional",
			visualPreset: "none",
			outline: [],
			cardCount: 6,
			materials: [],
			notes: "",
			platform: "rednote",
			description: "",
			visualReferenceFiles: [],
		}

		const result = buildArticlePromptContent(
			global,
			article,
			"self-media/posts/prefilled-post/materials",
		)
		const fullText = (result.content.content || [])
			.map((node) => paragraphText(node))
			.join("\n")

		expect(fullText).toContain("项目入口列表已经准备好")
		expect(fullText).toContain("只补齐这篇内容自己的文件")
		expect(fullText).not.toContain("register_in_project")
		expect(fullText).not.toContain("edit_file")
	})
})
