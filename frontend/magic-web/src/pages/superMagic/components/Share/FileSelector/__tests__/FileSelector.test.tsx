import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type { TreeNodeData } from "@/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"
import FileSelector from "../FileSelector"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock("../style", () => ({
	default: () => ({
		styles: new Proxy({}, { get: (_target, key) => String(key) }),
		cx: (...classNames: Array<string | false | null | undefined>) =>
			classNames.filter(Boolean).join(" "),
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/components/shadcn-ui/checkbox", () => ({
	Checkbox: () => <span data-testid="checkbox" />,
}))

vi.mock("@/components/base/MagicIcon", () => ({
	default: () => <span data-testid="magic-icon" />,
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: () => <span data-testid="magic-file-icon" />,
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ text, className }: { text?: string; className?: string }) => (
		<div className={className}>{text}</div>
	),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: () => <span data-testid="custom-folder-icon" />,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/CustomTree/CustomTree", () => ({
	default: ({
		visibleNodes,
		titleRender,
	}: {
		visibleNodes: TreeNodeData[]
		titleRender: (node: TreeNodeData) => ReactNode
	}) => (
		<>
			{visibleNodes.map((node) => (
				<div key={node.key}>{titleRender(node)}</div>
			))}
		</>
	),
}))

vi.mock("@/pages/superMagic/assets/svg/file-folder.svg", () => ({
	default: "folder.svg",
}))

vi.mock("../hooks/useLocateFile", () => ({
	useLocateFile: () => ({
		locatingFileId: null,
		handleLocateFileInTree: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		warning: vi.fn(),
	},
}))

describe("FileSelector", () => {
	it("uses the same icon as the project file list for PPT template folders", () => {
		const templateRoot = {
			file_id: "template-root",
			file_name: "PPT-template",
			is_directory: true,
			children: [
				{ file_id: "manifest", file_name: "template.json", is_directory: false },
				{ file_id: "spec", file_name: "visual-spec.md", is_directory: false },
				{ file_id: "theme", file_name: "theme.css", is_directory: false },
				{ file_id: "slides", file_name: "slides", is_directory: true, children: [] },
			],
		}

		render(
			<FileSelector
				attachments={[templateRoot]}
				selectedFileIds={[]}
				onSelectionChange={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("slides-template-folder-icon")).toBeInTheDocument()
		expect(screen.queryByTestId("file-selector-image")).not.toBeInTheDocument()
	})
})
