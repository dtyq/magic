import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { FilesDeleteConfirmSheet } from "../FilesDeleteConfirmSheet"
import type { DeleteConfirmHierarchyGroup } from "../../utils/mobileAttachmentTreeSelection"

const translations: Record<string, string> = {
	"projectDetail.deleteConfirm.title": "删除文件",
	"projectDetail.deleteConfirm.intro": "以下 {{count}} 个项目将移入回收站：",
	"projectDetail.deleteConfirm.warning": "你可以在回收站中恢复或彻底删除。",
	"projectDetail.deleteConfirm.fileCount": "{{count}} 个文件",
	"projectDetail.deleteConfirm.emptyLabel": "空文件夹",
	"projectDetail.deleteConfirm.rootFiles": "{{count}} 个文件",
	"projectDetail.deleteConfirm.magicWarningSingle": "系统文件夹删除后，部分功能可能无法使用。",
	"projectDetail.deleteConfirm.magicWarningMulti":
		"选中内容包含系统文件夹，删除后部分功能可能无法使用。",
	"projectDetail.deleteConfirm.canvasMixedWarning": "删除后可能导致画布无法打开。",
	"common.cancel": "取消",
	"topicFiles.contextMenu.delete": "删除",
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		// Keep the test focused on the copy rendered by the confirmation sheet.
		t: (key: string, values?: Record<string, number>) => {
			const value = translations[key] ?? key
			return values
				? value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]))
				: value
		},
	}),
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerTitle,
	}: {
		visible: boolean
		children?: ReactNode
		headerTitle?: string
	}) =>
		visible ? (
			<div>
				<div>{headerTitle}</div>
				{children}
			</div>
		) : null,
}))

vi.mock("../TopicFileIcon", () => ({
	TopicFileIcon: () => <span data-testid="topic-file-icon" />,
}))

const fileHierarchy: DeleteConfirmHierarchyGroup[] = [
	{
		folder: null,
		items: [{ kind: "file", id: "mock-file-id", name: "mock-file.txt", fileExtension: "txt" }],
	},
]

describe("FilesDeleteConfirmSheet", () => {
	it("shows recoverable Trash copy for ordinary file deletion", () => {
		render(
			<FilesDeleteConfirmSheet
				visible
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				selectedHierarchy={fileHierarchy}
			/>,
		)

		expect(screen.getByText("以下 1 个项目将移入回收站：")).toBeInTheDocument()
		expect(screen.getByText("你可以在回收站中恢复或彻底删除。")).toBeInTheDocument()
		expect(screen.queryByText(/永久删除|无法撤销/)).not.toBeInTheDocument()
	})

	it("keeps the dedicated system-folder warning", () => {
		render(
			<FilesDeleteConfirmSheet
				visible
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				selectedHierarchy={fileHierarchy}
				magicWarningVariant="single"
			/>,
		)

		expect(screen.getByText("系统文件夹删除后，部分功能可能无法使用。")).toBeInTheDocument()
		expect(screen.queryByText("你可以在回收站中恢复或彻底删除。")).not.toBeInTheDocument()
	})

	it("keeps the dedicated canvas warning", () => {
		render(
			<FilesDeleteConfirmSheet
				visible
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				selectedHierarchy={fileHierarchy}
				canvasWarning
				canvasWarningContent="删除后可能导致画布无法打开。"
			/>,
		)

		expect(screen.getByText("删除后可能导致画布无法打开。")).toBeInTheDocument()
		expect(screen.queryByText("你可以在回收站中恢复或彻底删除。")).not.toBeInTheDocument()
	})
})
