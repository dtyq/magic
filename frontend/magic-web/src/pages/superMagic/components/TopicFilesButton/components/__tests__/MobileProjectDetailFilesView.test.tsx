import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MobileProjectDetailFilesView from "../MobileProjectDetailFilesView"
import type { AttachmentItem } from "../../hooks/types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: () => <div />,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
		success: vi.fn(),
		loading: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview", () => ({
	detectContentTypeRender: vi.fn(() => null),
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment/utils", () => ({
	getAppEntryFile: vi.fn(() => null),
	getAttachmentType: vi.fn(() => undefined),
	getChildrenForCustomMetadataIconPath: vi.fn(() => []),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/hooks/fileSelectionUtils", () => ({
	findFileInTree: vi.fn(() => null),
}))

vi.mock("@/pages/superMagicMobile/components/MobileBottomSearchBar", () => ({
	default: () => <div />,
}))

vi.mock("../MobileFilesSelectionBar", () => ({
	default: () => <div />,
}))

vi.mock("../MobileFileDownloadSheet", () => ({
	MobileFileDownloadSheet: () => null,
}))

vi.mock("../CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: () => <div />,
}))

vi.mock("../TopicFileIcon", () => ({
	TopicFileIcon: () => <div />,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/utils/build-single-file-download-menu", () => ({
	menuItemsIncludeNoWaterMarkDownload: vi.fn(() => false),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder", () => ({
	isMagicSystemFolder: vi.fn(() => false),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/utils/getAttachmentKey", () => ({
	getAttachmentDisplayName: (item: AttachmentItem) => item.name || item.file_name || "",
	getAttachmentKey: (item: AttachmentItem) => item.file_id || item.name || "",
	getVisibleAttachmentChildren: (item: AttachmentItem) => item.children || [],
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/utils/mobileAttachmentTreeSelection", () => ({
	collectAttachmentsBySelectedKeys: vi.fn(() => []),
	collectCurrentViewSelectableKeys: vi.fn(() => []),
	getAttachmentNodeSelectionState: vi.fn(() => "none"),
	toggleAllInCurrentView: vi.fn((_: string[], selected: Set<string>) => selected),
	toggleAttachmentSelection: vi.fn((_: string, selected: Set<string>) => selected),
}))

vi.mock("../MobileFileSelectionCheckbox", () => ({
	default: () => null,
}))

describe("MobileProjectDetailFilesView", () => {
	it("深层路径栏支持横向滚动并放宽单段文本展示宽度", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "folder-1",
				name: "测试特殊长目录名称第一层",
				is_directory: true,
				relative_file_path: "/测试特殊长目录名称第一层",
				children: [
					{
						file_id: "folder-2",
						name: ".magic-第二层超长目录",
						is_directory: true,
						relative_file_path:
							"/测试特殊长目录名称第一层/.magic-第二层超长目录",
						children: [
							{
								file_id: "folder-3",
								name: "memory-第三层超长目录",
								is_directory: true,
								relative_file_path:
									"/测试特殊长目录名称第一层/.magic-第二层超长目录/memory-第三层超长目录",
								children: [],
							},
						],
					},
				],
			},
		]

		const { container } = render(
			<MobileProjectDetailFilesView attachments={attachments} mobileViewVariant="project-detail" />,
		)

		fireEvent.click(
			screen.getAllByRole("button", { name: /测试特殊长目录名称第一层/ })[0],
		)
		fireEvent.click(
			screen.getAllByRole("button", { name: /\.magic-第二层超长目录/ })[0],
		)

		const scrollContainer = container.querySelector(".overflow-x-auto")
		expect(scrollContainer).toBeTruthy()
		expect(scrollContainer?.className).toContain("no-scrollbar")

		const breadcrumbButton = screen
			.getAllByRole("button", { name: /测试特殊长目录名称第一层/ })
			.find((button) => button.className.includes("max-w-[168px]"))

		expect(breadcrumbButton).toBeTruthy()
		if (!breadcrumbButton) {
			throw new Error("Expected breadcrumb button to be rendered")
		}
		expect(breadcrumbButton.className).toContain("max-w-[168px]")
	})
})