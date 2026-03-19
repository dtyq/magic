import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import FileTree from "../index"
import type { DetailFileTreeData } from "../../../types"

// Mock dependencies
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../../../MessageList/components/Tool/components/ToolIcon", () => ({
	default: ({ type }: { type: string }) => <div data-testid="tool-icon">{type}</div>,
}))

vi.mock("../../../components/CommonHeaderV2", () => ({
	default: ({ children }: { children?: React.ReactNode }) => (
		<div data-testid="common-header">{children}</div>
	),
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type }: { type: string }) => <div data-testid="file-icon">{type}</div>,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: ({ component }: { component: any }) => (
		<div data-testid="magic-icon">{component.name}</div>
	),
}))

vi.mock("@/utils/string", () => ({
	formatFileSize: (size: number) => `${size}B`,
	formatTime: (time: string, format: string) => time,
}))

const mockData: DetailFileTreeData = {
	root_path: ".",
	level: 3,
	filter_binary: false,
	total_files: 4,
	total_dirs: 2,
	total_size: 2669484,
	tree: [
		{
			file_name: "src",
			relative_file_path: "src",
			is_directory: true,
			file_size: null,
			updated_at: "2025-08-05 17:46:45",
			children: [
				{
					file_name: "index.ts",
					relative_file_path: "src/index.ts",
					is_directory: false,
					file_size: 1024,
					updated_at: "2025-08-05 17:46:45",
					children: null,
					type: "file",
					error: null,
				},
				{
					file_name: "utils.ts",
					relative_file_path: "src/utils.ts",
					is_directory: false,
					file_size: 512,
					updated_at: "2025-08-05 17:46:45",
					children: null,
					type: "file",
					error: null,
				},
			],
			type: "directory",
			error: null,
		},
		{
			file_name: "README.md",
			relative_file_path: "README.md",
			is_directory: false,
			file_size: 2048,
			updated_at: "2025-08-05 17:46:45",
			children: null,
			type: "file",
			error: null,
		},
	],
}

describe("FileTree", () => {
	it("renders file tree structure correctly", () => {
		render(<FileTree data={mockData} userSelectDetail={null} />)

		// Check if header is rendered
		expect(screen.getByTestId("common-header")).toBeInTheDocument()

		// Check if table headers are rendered
		expect(screen.getByText("fileTree.name")).toBeInTheDocument()
		expect(screen.getByText("fileTree.modifiedTime")).toBeInTheDocument()
		expect(screen.getByText("fileTree.size")).toBeInTheDocument()

		// Check if files are rendered
		expect(screen.getByText("src")).toBeInTheDocument()
		expect(screen.getByText("README.md")).toBeInTheDocument()
	})

	it("handles directory expansion correctly", () => {
		render(<FileTree data={mockData} userSelectDetail={null} />)

		// Initially, children should not be visible
		expect(screen.queryByText("index.ts")).not.toBeInTheDocument()
		expect(screen.queryByText("utils.ts")).not.toBeInTheDocument()

		// Find and click the expand button for 'src' directory
		const expandButton = screen
			.getByText("src")
			.closest('[class*="tableRow"]')
			?.querySelector("button")
		if (expandButton) {
			fireEvent.click(expandButton)

			// After expansion, children should be visible
			expect(screen.getByText("index.ts")).toBeInTheDocument()
			expect(screen.getByText("utils.ts")).toBeInTheDocument()
		}
	})

	it("calculates directory size correctly by summing all children files", () => {
		render(<FileTree data={mockData} userSelectDetail={null} />)

		// The 'src' directory should show the sum of its children files (1024 + 512 = 1536)
		// Use a more reliable way to find the size cell - find by text content within row structure
		const allRows = screen.getAllByText(/src|README.md/)
		const srcTextElement = screen.getByText("src")
		const srcRow = srcTextElement.closest('div[style*="flex"]')

		// Find all child divs in the row and get the last one (size column)
		const cellsInRow = srcRow?.querySelectorAll("div > span")
		const sizeText = cellsInRow?.[cellsInRow.length - 1]?.textContent
		expect(sizeText).toBe("1536B") // 1024 + 512 = 1536

		// File should show its actual size
		const readmeTextElement = screen.getByText("README.md")
		const readmeRow = readmeTextElement.closest('div[style*="flex"]')
		const readmeCells = readmeRow?.querySelectorAll("div > span")
		const readmeSizeText = readmeCells?.[readmeCells.length - 1]?.textContent
		expect(readmeSizeText).toBe("2048B")
	})

	it("handles empty directories correctly", () => {
		const dataWithEmptyDir: DetailFileTreeData = {
			...mockData,
			tree: [
				{
					file_name: "empty_dir",
					relative_file_path: "empty_dir",
					is_directory: true,
					file_size: null,
					updated_at: "2025-08-05 17:46:45",
					children: [],
					type: "directory",
					error: null,
				},
			],
		}

		render(<FileTree data={dataWithEmptyDir} userSelectDetail={null} />)

		// Empty directory should show "-" for size
		const emptyDirTextElement = screen.getByText("empty_dir")
		const emptyDirRow = emptyDirTextElement.closest('div[style*="flex"]')
		const emptyDirCells = emptyDirRow?.querySelectorAll("div > span")
		const emptyDirSizeText = emptyDirCells?.[emptyDirCells.length - 1]?.textContent
		expect(emptyDirSizeText).toBe("-")
	})

	it("handles nested directories with recursive size calculation", () => {
		const nestedData: DetailFileTreeData = {
			...mockData,
			tree: [
				{
					file_name: "parent",
					relative_file_path: "parent",
					is_directory: true,
					file_size: null,
					updated_at: "2025-08-05 17:46:45",
					children: [
						{
							file_name: "child_dir",
							relative_file_path: "parent/child_dir",
							is_directory: true,
							file_size: null,
							updated_at: "2025-08-05 17:46:45",
							children: [
								{
									file_name: "nested.txt",
									relative_file_path: "parent/child_dir/nested.txt",
									is_directory: false,
									file_size: 256,
									updated_at: "2025-08-05 17:46:45",
									children: null,
									type: "file",
									error: null,
								},
							],
							type: "directory",
							error: null,
						},
						{
							file_name: "parent.txt",
							relative_file_path: "parent/parent.txt",
							is_directory: false,
							file_size: 128,
							updated_at: "2025-08-05 17:46:45",
							children: null,
							type: "file",
							error: null,
						},
					],
					type: "directory",
					error: null,
				},
			],
		}

		render(<FileTree data={nestedData} userSelectDetail={null} />)

		// Parent directory should show total size including nested files (256 + 128 = 384)
		const parentTextElement = screen.getByText("parent")
		const parentRow = parentTextElement.closest('div[style*="flex"]')
		const parentCells = parentRow?.querySelectorAll("div > span")
		const parentSizeText = parentCells?.[parentCells.length - 1]?.textContent
		expect(parentSizeText).toBe("384B")
	})

	it("handles empty tree gracefully", () => {
		const emptyData: DetailFileTreeData = {
			...mockData,
			tree: [],
		}

		render(<FileTree data={emptyData} userSelectDetail={null} />)

		expect(screen.getByText("fileTree.empty")).toBeInTheDocument()
	})
})
