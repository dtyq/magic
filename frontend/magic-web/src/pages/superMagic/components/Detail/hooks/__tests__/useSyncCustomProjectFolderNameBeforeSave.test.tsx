import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSyncCustomProjectFolderNameBeforeSave } from "../useSyncCustomProjectFolderNameBeforeSave"
import { shadow } from "@/utils/shadow"
import { SuperMagicApi } from "@/apis"

vi.mock("@/apis", () => ({ SuperMagicApi: { renameFile: vi.fn().mockResolvedValue(undefined) } }))

// 复用真实配置解析器，隔离与保存解码无关的 PPT 更新依赖。
vi.mock(
	"@/pages/superMagic/components/Detail/contents/HTML/utils/magicProjectUpdater",
	async () => {
		const { parseMagicProjectConfigContent } =
			await import("@/pages/superMagic/utils/magicProjectConfigParser")
		return {
			parseMagicProjectJs: (content: string) => ({
				config: parseMagicProjectConfigContent(content),
			}),
		}
	},
)

describe("项目配置保存前解码", () => {
	it("V2 配置多语言名称用于 Mock 重命名请求", async () => {
		const { result } = renderHook(() =>
			useSyncCustomProjectFolderNameBeforeSave({
				attachments: [
					{
						file_id: "mock-parent",
						name: "before",
						children: [
							{
								file_id: "mock-file",
								name: "magic.project.js",
								parent_id: "mock-parent",
							},
						],
					},
				],
			}),
		)
		await result.current.syncCustomProjectFolderNameBeforeSave(
			"mock-file",
			shadow('window.magicProjectConfig = { type: "custom", name: "저 코드" };'),
		)
		expect(SuperMagicApi.renameFile).toHaveBeenCalledWith({
			file_id: "mock-parent",
			target_name: "저 코드",
		})
	})
})
