import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SelectDirectoryModal from "./SelectDirectoryModal"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "selectPathModal.rootDirectory") return "根目录"
			if (key === "selectPathModal.searchDirectory") return "搜索文件夹"
			if (key === "common.confirm") return "确认"
			if (key === "common.cancel") return "取消"
			if (key === "selectPathModal.searchEmptyDescription")
				return `暂无关于“${String(options?.keyword || "")}”的内容`
			return key
		},
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	Dropdown: ({ children }: { children: React.ReactNode }) => children,
	Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
		if (!visible) return null

		return <div data-testid="mock-magic-popup">{children}</div>
	},
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components", () => ({
	InputWithError: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/pages/superMagic/components/SelectPathModal/hooks/useCreateDirectory", () => ({
	useCreateDirectory: () => ({
		loading: false,
		createDirectoryShown: false,
		createDirectoryName: "",
		createDirectoryErrorMessage: "",
		showCreateDirectory: vi.fn(),
		cancelCreateDirectory: vi.fn(),
		onCreateDirectoryInputChange: vi.fn(),
		onCreateDirectoryInputFocus: vi.fn(),
		submitCreateDirectory: vi.fn(),
		onCreateDirectoryInputKeyDown: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		info: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const attachments = [
	{
		file_id: "folder-a",
		name: "Folder A",
		is_directory: true,
		relative_file_path: "/Folder A",
		children: [
			{
				file_id: "folder-a-child",
				name: "Child Folder",
				is_directory: true,
				relative_file_path: "/Folder A/Child Folder",
				children: [],
			},
		],
	},
	{
		file_id: "folder-b",
		name: "Folder B",
		is_directory: true,
		relative_file_path: "/Folder B",
		children: [],
	},
]

describe("SelectDirectoryModal mobile", () => {
	const onClose = vi.fn()
	const onSubmit = vi.fn()

	beforeEach(() => {
		onClose.mockReset()
		onSubmit.mockReset()
	})

	/**
	 * 统一渲染移动端目录选择器，确保每个交互测试都从同一份受控输入开始。
	 */
	function renderModal(disabledFolderIds: string[] = []) {
		return render(
			<SelectDirectoryModal
				visible
				projectId="project-1"
				title="移动文件"
				attachments={attachments}
				disabledFolderIds={disabledFolderIds}
				onClose={onClose}
				onSubmit={onSubmit}
			/>,
		)
	}

	it("allows selecting the root directory and confirming from the dedicated mobile sheet", () => {
		renderModal()

		expect(screen.getByTestId("select-directory-mobile-sheet-root")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("select-directory-mobile-root-select-button"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({ path: [] })
	})

	it("drills into child folders without keeping the root row in the nested list", () => {
		renderModal()

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-drill-folder-a"))

		expect(screen.getByText("Child Folder")).toBeInTheDocument()
		expect(
			screen.queryByTestId("select-directory-mobile-root-select-button"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("select-directory-mobile-confirm-button")).toBeDisabled()
	})

	it("supports selecting a folder from search results", () => {
		renderModal()

		fireEvent.change(screen.getByTestId("select-directory-mobile-search-input"), {
			target: { value: "Child" },
		})
		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-select-folder-a-child"))
		fireEvent.click(screen.getByTestId("select-directory-mobile-confirm-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			path: [attachments[0], attachments[0].children?.[0]],
		})
	})

	it("prevents selecting disabled folders from the mobile sheet", () => {
		renderModal(["folder-b"])

		fireEvent.click(screen.getByTestId("select-directory-mobile-folder-select-folder-b"))

		expect(screen.getByTestId("select-directory-mobile-confirm-button")).toBeDisabled()
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("keeps a fixed sheet height and a dedicated bottom search layer", () => {
		renderModal()

		expect(screen.getByTestId("select-directory-mobile-sheet-root")).toHaveClass(
			"h-[calc(100dvh-var(--safe-area-inset-top,0px))]",
		)
		expect(screen.getByTestId("select-directory-mobile-scroll-area")).toHaveClass(
			"overflow-hidden",
		)
		expect(screen.getByTestId("select-directory-mobile-search-dock")).toHaveClass("shrink-0")
	})
})
