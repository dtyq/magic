import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { createFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { SelfMediaAttachmentNode } from "../../types"
import { WECHAT_ARTICLE_IMAGE_PROCESS } from "../../constants/imageProcess"
import { loadWechatArticleHtml } from "./wechatArticleHtml"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getAdminLocaleModules: () => ({}),
	getLocaleModules: () => ({}),
	loadFallbackLocale: () => Promise.resolve({ default: {} }),
	loadMagicFlowLocale: () => Promise.resolve({ default: {} }),
}))

describe("loadWechatArticleHtml", () => {
	beforeEach(() => {
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://cdn.example.test/${fileId}`,
			})),
		)

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				text: async () => `
					<!doctype html>
					<html>
						<head>
							<link rel="stylesheet" href="./styles/main.css">
						</head>
						<body>
							<img src="assets/cover.png" alt="cover">
						</body>
					</html>
				`,
			})),
		)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.mocked(getTemporaryDownloadUrl).mockReset()
	})

	it("uses the fallback attachment tree to rewrite relative article resources", async () => {
		const attachments: SelfMediaAttachmentNode[] = [
			{
				file_id: "post-root",
				file_name: "post-root",
				is_directory: true,
				relative_file_path: "self-media/wechat/post-1",
				children: [
					{
						file_id: "article-html",
						file_name: "article.html",
						relative_file_path: "self-media/wechat/post-1/article.html",
					},
					{
						file_id: "article-css",
						file_name: "main.css",
						relative_file_path: "self-media/wechat/post-1/styles/main.css",
					},
					{
						file_id: "article-cover",
						file_name: "cover.png",
						relative_file_path: "self-media/wechat/post-1/assets/cover.png",
					},
				],
			},
		]

		const result = await loadWechatArticleHtml({
			fileId: "article-html",
			fileApi: createFileApi(),
			attachmentList: [{ file_id: "article-html", updated_at: "partial-version" }],
			attachments,
		})

		expect(result.content).toContain("https://cdn.example.test/article-css")
		expect(result.content).toContain("https://cdn.example.test/article-cover")
		expect(result.content).toContain('data-original-path="./styles/main.css"')
		expect(result.content).toContain('data-original-path="assets/cover.png"')
		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["article-cover"],
			options: { xMagicImageProcess: WECHAT_ARTICLE_IMAGE_PROCESS },
			access: undefined,
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["article-css"],
			access: undefined,
		})
	})
})
