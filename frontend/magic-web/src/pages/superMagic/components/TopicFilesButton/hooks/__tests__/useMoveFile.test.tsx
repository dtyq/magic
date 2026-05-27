import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useMoveFile } from "../useMoveFile"
import type { AttachmentItem } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
		loading: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@tabler/icons-react", () => ({
	IconAlertTriangleFilled: () => null,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		moveFile: vi.fn(),
		moveFiles: vi.fn(),
		checkBatchOperationStatus: vi.fn(),
	},
}))

vi.mock("../../utils/checkDuplicateFileName", () => ({
	checkDuplicateFileName: vi.fn(() => false),
}))

describe("useMoveFile", () => {
	it("单个移动时默认从当前项目根目录打开", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "Folder 1",
				is_directory: true,
				relative_file_path: "/Folder 1",
				children: [
					{
						file_id: "child-file-1",
						name: "Child File",
						is_directory: false,
						relative_file_path: "/Folder 1/Child File",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useMoveFile({
				attachments,
			}),
		)

		act(() => {
			result.current.showMoveSelector(attachments[0].children?.[0] as AttachmentItem)
		})

		expect(result.current.selectorConfig.visible).toBe(true)
		expect(result.current.selectorConfig.defaultPath).toEqual([])
	})

	it("批量移动选中文件夹时只保留文件夹自身 ID，不递归展开子文件", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "Folder 1",
				is_directory: true,
				relative_file_path: "/Folder 1",
				children: [
					{
						file_id: "child-file-1",
						name: "Child File",
						is_directory: false,
						relative_file_path: "/Folder 1/Child File",
					},
				],
			},
		]

		const { result } = renderHook(() =>
			useMoveFile({
				attachments,
				allFiles: attachments,
				selectedItems: new Set(["folder-1"]),
				getItemId: (item) => item.file_id || "",
			}),
		)

		act(() => {
			result.current.openBatchMove()
		})

		expect(result.current.selectorConfig.visible).toBe(true)
		expect(result.current.selectorConfig.defaultPath).toEqual([])
		expect(result.current.selectorConfig.pendingMoveFileIds).toEqual(["folder-1"])
	})
})