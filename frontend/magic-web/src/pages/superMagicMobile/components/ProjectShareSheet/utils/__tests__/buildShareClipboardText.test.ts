import { beforeEach, describe, expect, it, vi } from "vitest"
import { ResourceType, ShareType } from "@/pages/superMagic/components/Share/types"
import type { FileShareItem } from "@/pages/superMagic/components/ShareManagement/types"
import { buildShareClipboardText } from "../buildShareClipboardText"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		batchGetFileDetails: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers", () => ({
	generateShareUrl: vi.fn(
		(resourceId: string, password?: string) =>
			`https://www.letsmagic.cn/share/files/${resourceId}${
				password ? `?password=${password}` : ""
			}`,
	),
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				nickname: "测试用户",
				real_name: "测试用户",
			},
		},
	},
}))

/**
 * Minimal i18n stub that returns PC zh_CN lines for share clipboard assertions.
 */
function createShareClipboardT(key: string, values?: Record<string, unknown>): string {
	const count = values?.count as number | undefined
	const shareName = values?.shareName as string | undefined
	const shareUrl = values?.shareUrl as string | undefined
	const projectName = values?.projectName as string | undefined
	const username = values?.username as string | undefined
	const brand = values?.brand as string | undefined

	const map: Record<string, string> = {
		"share.shareMessageMultipleFiles": `我分享了一些文件给你 (共 ${count} 个文件):`,
		"share.shareMessageMultipleFilesFile": `📄 文件：${shareName}`,
		"share.shareMessageMultipleFilesLink": `🔗 访问链接: ${shareUrl}`,
		"share.shareMessageMultipleFilesTip": "💡 点击链接即可直接查看文件内容。",
		"share.shareMessageProject": "我分享了一个项目给你：",
		"share.shareMessageProjectName": `📁 项目: ${projectName}`,
		"share.shareMessageProjectLink": `🔗 访问链接: ${shareUrl}`,
		"share.shareMessageProjectTip": "💡 点击链接即可查看项目内容。",
		"share.createdBy.footerLine": `-- 来自「${brand}」的 ${username} 分享`,
		"share.createdBy.brand": "超级麦吉",
		"share.untitled": "未命名",
	}

	return map[key] ?? key
}

describe("buildShareClipboardText", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("多文件分享复制文案与 PC 多文件分支一致", async () => {
		const share: FileShareItem = {
			title: "文件分享_测试特殊文件",
			project_id: "project-1",
			project_name: "Demo Project",
			workspace_id: "",
			workspace_name: "",
			resource_type: ResourceType.FileCollection,
			share_type: ShareType.PasswordProtected,
			resource_id: "917473513704189952",
			has_password: true,
			password: "1VP1RX",
			share_project: false,
			file_ids: Array.from({ length: 8 }, (_, index) => `file-${index + 1}`),
			extend: { file_count: 8 },
			created_at: "2026-05-05",
		}

		const text = await buildShareClipboardText({
			share,
			projectName: "Demo Project",
			t: createShareClipboardT as never,
		})

		expect(text).toContain("我分享了一些文件给你 (共 8 个文件):")
		expect(text).toContain("📄 文件：文件分享_测试特殊文件")
		expect(text).toContain(
			"🔗 访问链接: https://www.letsmagic.cn/share/files/917473513704189952?password=1VP1RX",
		)
		expect(text).toContain("💡 点击链接即可直接查看文件内容。")
		expect(text).toContain("-- 来自「超级麦吉」的 测试用户 分享")
		expect(text).not.toBe(
			"https://www.letsmagic.cn/share/files/917473513704189952?password=1VP1RX",
		)
	})

	it("整项目分享走项目模板而非多文件模板", async () => {
		const share: FileShareItem = {
			title: "项目分享_Demo",
			project_id: "project-1",
			project_name: "Demo Project",
			workspace_id: "",
			workspace_name: "",
			resource_type: ResourceType.FileCollection,
			share_type: ShareType.Public,
			resource_id: "project-share-1",
			has_password: false,
			share_project: true,
			extend: { file_count: 8 },
			created_at: "2026-05-05",
		}

		const text = await buildShareClipboardText({
			share,
			t: createShareClipboardT as never,
		})

		expect(text).toContain("我分享了一个项目给你：")
		expect(text).toContain("📁 项目: Demo Project")
		expect(text).not.toContain("我分享了一些文件给你")
	})
})
