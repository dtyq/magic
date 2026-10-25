import { act, fireEvent, render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Text from "../index"

// 保留真实编辑和保存回调，文件加载、导出及其他界面依赖使用 Mock。
vi.mock("@/pages/superMagic/hooks/useFileData", () => ({
	useFileData: () => ({ fileData: "before", isNewestVersion: true }),
}))
vi.mock("@/components/base/MagicSpin", () => ({ default: () => null }))
vi.mock("../../../components/DetailEmpty", () => ({ default: () => null }))
vi.mock("../../../components/CommonHeaderV2", () => ({ default: () => null }))
vi.mock("../../../components/TextSaveStatus", () => ({ TextSaveStatus: () => null }))
vi.mock("../../../components/CommonFooter", () => ({ default: () => null }))
vi.mock("../../../components/Deleted", () => ({ default: () => null }))
vi.mock("@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons", () => ({
	default: () => null,
}))
vi.mock("@/pages/superMagic/components/Detail/components/EditToolbar/useAIEditMenuItems", () => ({
	useAIEditMenuItems: () => [],
}))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: {} }))
vi.mock("../../HTML/useExportMenuItems", () => ({
	default: () => ({ ExportDropdownButton: null }),
}))
vi.mock("@magic-web/html2image", () => ({ exportHtmlToImage: vi.fn() }))
vi.mock("@/pages/superMagic/utils/textToHtml", () => ({ textToHtml: vi.fn() }))
vi.mock("@/pages/superMagic/providers/FileAccessProvider", () => ({
	FileAccessProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("antd", async () => {
	const { forwardRef } = await import("react")
	return {
		Input: {
			TextArea: forwardRef<
				HTMLTextAreaElement,
				React.TextareaHTMLAttributes<HTMLTextAreaElement>
			>((props, ref) => <textarea {...props} ref={ref} />),
		},
	}
})

afterEach(cleanup)

describe("文本保存解码开关", () => {
	it.each(["SHADOWED_hello", "SHADOWED2_literal", "저 코드"])(
		"明文 %s 关闭解码",
		async (text) => {
			const save = vi.fn().mockResolvedValue(undefined)
			const registration: { handler: (() => Promise<void>) | null } = { handler: null }
			render(
				<Text
					data={{ file_id: "mock-file" }}
					isEditMode
					showFileHeader={false}
					saveEditContent={save}
					onRegisterSaveHandler={(next: typeof registration.handler) => {
						registration.handler = next
					}}
				/>,
			)
			fireEvent.change(screen.getByRole("textbox"), { target: { value: text } })
			expect(registration.handler).toBeTypeOf("function")
			await act(async () => {
				await registration.handler?.()
			})
			expect(save).toHaveBeenCalledWith(
				text,
				"mock-file",
				false,
				undefined,
				undefined,
				false,
				{ silent: true },
			)
		},
	)
})
