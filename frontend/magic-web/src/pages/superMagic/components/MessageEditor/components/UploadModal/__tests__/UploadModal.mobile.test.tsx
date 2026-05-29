import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import UploadModal from "../UploadModal"

const { uploadFile } = vi.hoisted(() => ({
	uploadFile: new File(["hello"], "demo.txt", { type: "text/plain" }),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: Record<string, unknown>) => {
				if (key === "selectPathModal.rootDirectory") return "根目录"
				if (key === "selectPathModal.searchDirectory") return "搜索文件夹"
				if (key === "selectPathModal.confirm") return "确认"
				if (key === "topicFiles.title") return "项目文件"
				if (key === "common.confirm") return "确认"
				if (key === "common.cancel") return "取消"
				if (key === "selectPathModal.searchEmptyDescription")
					return `暂无关于“${String(options?.keyword || "")}”的内容`
				return key
			},
		}),
	}
})

vi.mock("antd", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	Flex: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("@/hooks/use-window-size", () => ({
	useWindowSize: () => ({ width: 390, height: 844 }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		info: vi.fn(),
	},
}))

vi.mock("../styles", () => ({
	useDirectoryStyles: () => ({
		styles: {},
		cx: (...classes: string[]) => classes.filter(Boolean).join(" "),
	}),
}))

vi.mock("../components", () => ({
	UploadFileList: () => null,
	UploadDirectoryList: () => null,
	SearchBar: () => null,
	DirectoryBreadcrumb: () => null,
	DirectoryList: () => null,
	SearchResultHeader: () => null,
}))

vi.mock("../hooks", () => ({
	useUploadModal: () => ({
		loading: false,
		path: [],
		directories: [],
		isSearch: false,
		fileName: "",
		createDirectoryShown: false,
		createDirectoryName: "",
		createDirectoryErrorMessage: "",
		fileList: [{ name: "demo.txt", file: uploadFile }],
		navigateToDirectory: vi.fn(),
		navigateToBreadcrumb: vi.fn(),
		handleSearchChange: vi.fn(),
		handleCompositionStart: vi.fn(),
		handleCompositionEnd: vi.fn(),
		exitSearchMode: vi.fn(),
		showCreateDirectory: vi.fn(),
		submitCreateDirectory: vi.fn(),
		handleCreateDirectoryInputChange: vi.fn(),
		handleCreateDirectoryInputFocus: vi.fn(),
		handleCreateDirectoryInputKeyDown: vi.fn(),
		addFiles: vi.fn(),
		removeFile: vi.fn(),
		updateFileName: vi.fn(),
		resetState: vi.fn(),
	}),
}))

const attachments = [
	{
		file_id: "folder-a",
		name: "Folder A",
		is_directory: true,
		relative_file_path: "/Folder A",
		children: [],
	},
]

describe("UploadModal mobile", () => {
	const onClose = vi.fn()
	const onSubmit = vi.fn()

	beforeEach(() => {
		onClose.mockReset()
		onSubmit.mockReset()
	})

	/**
	 * Renders the upload path picker in mobile mode with a minimal attachment tree.
	 */
	function renderUploadModal() {
		return render(
			<UploadModal
				visible
				projectId="project-1"
				uploadFiles={[uploadFile]}
				attachments={attachments}
				onClose={onClose}
				onSubmit={onSubmit}
			/>,
		)
	}

	it("renders the move-file style sheet instead of the legacy BaseModal footer", () => {
		renderUploadModal()

		expect(screen.getByTestId("select-directory-mobile-sheet-root")).toBeInTheDocument()
		expect(screen.getByText("项目文件")).toBeInTheDocument()
		expect(screen.queryByText("取消")).not.toBeInTheDocument()
		expect(screen.queryByText("存储位置")).not.toBeInTheDocument()
	})

	it("submits the selected root path together with pending upload files", () => {
		renderUploadModal()

		fireEvent.click(screen.getByTestId("select-directory-mobile-root-select-button"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			path: [],
			files: [uploadFile],
		})
		expect(onClose).toHaveBeenCalled()
	})

	it("does not expose cross-project workspace browsing for upload path selection", () => {
		renderUploadModal()

		fireEvent.click(screen.getByTestId("select-directory-mobile-home-button"))

		expect(
			screen.queryByTestId("select-directory-mobile-workspace-collaboration"),
		).not.toBeInTheDocument()
		expect(screen.queryByText("我的工作区")).not.toBeInTheDocument()
		expect(screen.getByTestId("select-directory-mobile-root-select-button")).toBeInTheDocument()
	})
})
